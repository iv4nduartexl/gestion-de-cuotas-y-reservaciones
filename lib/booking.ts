import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appointments, clients, services, serviceStaff, staff } from "@/db/schema";
import type { AppointmentStatus } from "@/lib/appointment-status";
import { computeSlots, pickStaff, type SlotOptions } from "@/lib/availability";
import { loadStaffAvailability } from "@/lib/data/availability";
import { countTurnosByStaff } from "@/lib/data/appointments";
import type { TenantScope } from "@/lib/data/scope";
import { addDaysToDate, formatInZone, zonedToUtc } from "@/lib/datetime";
import { isExclusionViolation, isUniqueViolation } from "@/lib/db-errors";

export class SlotUnavailableError extends Error {
  constructor() {
    super("The selected time is not available");
    this.name = "SlotUnavailableError";
  }
}

export class BookingReferenceError extends Error {
  constructor(public field: "serviceId" | "staffId" | "clientId") {
    super(`Invalid ${field}`);
    this.name = "BookingReferenceError";
  }
}

export type BookableService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  staffIds: string[];
};

/** Active services with their active staff (only those can be booked). */
export async function listBookableServices(ctx: TenantScope): Promise<BookableService[]> {
  const org = ctx.organization.id;
  const [serviceRows, links] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMinutes: services.durationMinutes,
        price: services.price,
        currency: services.currency,
      })
      .from(services)
      .where(and(eq(services.organizationId, org), isNull(services.archivedAt)))
      .orderBy(services.name),
    db
      .select({ serviceId: serviceStaff.serviceId, staffId: serviceStaff.staffId })
      .from(serviceStaff)
      .innerJoin(staff, and(eq(staff.id, serviceStaff.staffId), eq(staff.organizationId, serviceStaff.organizationId)))
      .where(and(eq(serviceStaff.organizationId, org), isNull(staff.archivedAt))),
  ]);
  return serviceRows.map((service) => ({
    ...service,
    staffIds: links.filter((link) => link.serviceId === service.id).map((link) => link.staffId),
  }));
}

export function slotOptionsFor(
  ctx: TenantScope,
  service: { durationMinutes: number },
  dates: string[],
  { online, now = new Date() }: { online: boolean; now?: Date },
): SlotOptions {
  const settings = ctx.settings;
  const today = formatInZone(now, settings.timezone, "yyyy-MM-dd");
  return {
    dates,
    timeZone: settings.timezone,
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bufferMinutes: settings.bufferMinutes,
    // The dashboard may book any time from now on; clients need minimum notice.
    earliestStart: now.getTime() + (online ? settings.minNoticeMinutes * 60_000 : 0),
    latestStart: online
      ? zonedToUtc(addDaysToDate(today, settings.maxDaysAhead + 1), "00:00", settings.timezone).getTime()
      : undefined,
  };
}

/** Slots for `days` consecutive local dates starting at `fromDate`. */
export async function getAvailability(
  ctx: TenantScope,
  service: BookableService,
  staffChoice: string | "any",
  fromDate: string,
  days: number,
  { online, now = new Date() }: { online: boolean; now?: Date },
) {
  const candidates = staffChoice === "any" ? service.staffIds : service.staffIds.filter((id) => id === staffChoice);
  const dates = Array.from({ length: days }, (_, i) => addDaysToDate(fromDate, i));
  const tz = ctx.settings.timezone;
  const people = await loadStaffAvailability(ctx, {
    staffIds: candidates,
    from: zonedToUtc(dates[0], "00:00", tz),
    to: zonedToUtc(addDaysToDate(dates.at(-1)!, 1), "00:00", tz),
  });
  return computeSlots(people, slotOptionsFor(ctx, service, dates, { online, now }));
}

export function newManageToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashManageToken(token) };
}

export function hashManageToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Finds a client by phone (restoring it if archived) or creates one. */
async function findOrCreateClient(tx: Tx, ctx: TenantScope, input: { name: string; phone: string }) {
  const org = ctx.organization.id;
  const find = async () => {
    const [row] = await tx
      .select({ id: clients.id, archivedAt: clients.archivedAt })
      .from(clients)
      .where(and(eq(clients.organizationId, org), eq(clients.phone, input.phone)));
    return row;
  };
  const existing = await find();
  if (existing) {
    if (existing.archivedAt) await tx.update(clients).set({ archivedAt: null }).where(eq(clients.id, existing.id));
    return existing.id;
  }
  const [created] = await tx
    .insert(clients)
    .values({ organizationId: org, name: input.name, phone: input.phone })
    .onConflictDoNothing()
    .returning({ id: clients.id });
  if (created) return created.id;
  // Someone created the same phone concurrently.
  const raced = await find();
  if (!raced) throw new BookingReferenceError("clientId");
  return raced.id;
}

export type BookingInput = {
  serviceId: string;
  /** A staff id, or "any" for whoever is free. */
  staffChoice: string | "any";
  /** ISO instant of the chosen start. */
  start: string;
  client: { id: string } | { name: string; phone: string };
  status: AppointmentStatus;
  source: "online" | "dashboard";
  notes?: string | null;
  /** Dashboard only: skip the availability check (overlaps are still rejected). */
  manualTime?: boolean;
  withManageToken?: boolean;
  now?: Date;
};

/**
 * Books a turno. Re-checks availability on the server and relies on the
 * database exclusion constraint for races: throws SlotUnavailableError when
 * the time is no longer free.
 */
export async function bookAppointment(ctx: TenantScope, input: BookingInput) {
  const online = input.source === "online";
  const service = (await listBookableServices(ctx)).find((s) => s.id === input.serviceId);
  if (!service) throw new BookingReferenceError("serviceId");

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new SlotUnavailableError();
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);
  const tz = ctx.settings.timezone;
  const date = formatInZone(start, tz, "yyyy-MM-dd");

  let staffId: string;
  if (input.manualTime && !online) {
    if (input.staffChoice === "any" || !service.staffIds.includes(input.staffChoice)) {
      // Manual bookings may use any active staff member of the business.
      const [person] = input.staffChoice === "any"
        ? []
        : await db
            .select({ id: staff.id })
            .from(staff)
            .where(and(eq(staff.organizationId, ctx.organization.id), eq(staff.id, input.staffChoice), isNull(staff.archivedAt)));
      if (!person) throw new BookingReferenceError("staffId");
      staffId = person.id;
    } else {
      staffId = input.staffChoice;
    }
  } else {
    if (input.staffChoice !== "any" && !service.staffIds.includes(input.staffChoice)) {
      throw new BookingReferenceError("staffId");
    }
    const [day] = await getAvailability(ctx, service, input.staffChoice, date, 1, { online, now: input.now });
    const slot = day.slots.find((s) => s.start === start.toISOString());
    if (!slot) throw new SlotUnavailableError();
    const dayStart = zonedToUtc(date, "00:00", tz);
    const dayEnd = zonedToUtc(addDaysToDate(date, 1), "00:00", tz);
    const picked = pickStaff(slot.staffIds, await countTurnosByStaff(ctx, slot.staffIds, dayStart, dayEnd));
    if (!picked) throw new SlotUnavailableError();
    staffId = picked;
  }

  const token = input.withManageToken ? newManageToken() : null;
  try {
    const appointment = await db.transaction(async (tx) => {
      let clientId: string;
      if ("id" in input.client) {
        const [row] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.organizationId, ctx.organization.id), eq(clients.id, input.client.id)));
        if (!row) throw new BookingReferenceError("clientId");
        clientId = row.id;
      } else {
        clientId = await findOrCreateClient(tx, ctx, input.client);
      }
      const [created] = await tx
        .insert(appointments)
        .values({
          organizationId: ctx.organization.id,
          clientId,
          serviceId: service.id,
          staffId,
          startsAt: start,
          endsAt: end,
          status: input.status,
          source: input.source,
          price: service.price,
          currency: service.currency,
          notes: input.notes ?? null,
          bookedName: "name" in input.client ? input.client.name : null,
          manageTokenHash: token?.hash ?? null,
        })
        .returning({ id: appointments.id, status: appointments.status });
      return created;
    });
    return { ...appointment, token: token?.token ?? null };
  } catch (error) {
    if (isExclusionViolation(error)) throw new SlotUnavailableError();
    if (isUniqueViolation(error, "appointments_manage_token_hash_unique")) throw new SlotUnavailableError();
    throw error;
  }
}

/** Active staff of a business with names (for pickers). */
export async function listActiveStaffNames(ctx: TenantScope, ids?: string[]) {
  return db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(
      and(
        eq(staff.organizationId, ctx.organization.id),
        isNull(staff.archivedAt),
        ids ? inArray(staff.id, ids) : undefined,
      ),
    )
    .orderBy(staff.name);
}
