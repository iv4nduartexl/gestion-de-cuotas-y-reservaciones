import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, lt, ne, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { appointments, clients, services, staff } from "@/db/schema";
import {
  ACTIVE_STATUSES,
  canTransition,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import type { TenantScope } from "./scope";

export class InvalidTransitionError extends Error {
  constructor(public from: AppointmentStatus, public to: AppointmentStatus) {
    super(`Cannot change appointment from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(appointments.organizationId, ctx.organization.id), ...conditions);
}

/** Appointment with the names the UI shows. Joins are tenant-safe via composite FKs. */
const withNames = {
  id: appointments.id,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  status: appointments.status,
  source: appointments.source,
  price: appointments.price,
  currency: appointments.currency,
  notes: appointments.notes,
  bookedName: appointments.bookedName,
  internalNotes: appointments.internalNotes,
  cancelledBy: appointments.cancelledBy,
  cancellationReason: appointments.cancellationReason,
  createdAt: appointments.createdAt,
  clientId: appointments.clientId,
  clientName: clients.name,
  clientPhone: clients.phone,
  serviceId: appointments.serviceId,
  serviceName: services.name,
  staffId: appointments.staffId,
  staffName: staff.name,
};

function joined() {
  return db
    .select(withNames)
    .from(appointments)
    .innerJoin(clients, and(eq(clients.id, appointments.clientId), eq(clients.organizationId, appointments.organizationId)))
    .innerJoin(services, and(eq(services.id, appointments.serviceId), eq(services.organizationId, appointments.organizationId)))
    .innerJoin(staff, and(eq(staff.id, appointments.staffId), eq(staff.organizationId, appointments.organizationId)));
}

export type AppointmentWithNames = NonNullable<Awaited<ReturnType<typeof getAppointment>>>;

export async function listAppointmentsBetween(
  ctx: TenantScope,
  { from, to, staffId }: { from: Date; to: Date; staffId?: string },
) {
  return joined()
    .where(
      scoped(
        ctx,
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
        staffId ? eq(appointments.staffId, staffId) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(staff.name));
}

export async function getAppointment(ctx: TenantScope, id: string) {
  const [row] = await joined().where(scoped(ctx, eq(appointments.id, id)));
  return row ?? null;
}

export async function listClientAppointments(ctx: TenantScope, clientId: string) {
  return joined()
    .where(scoped(ctx, eq(appointments.clientId, clientId)))
    .orderBy(desc(appointments.startsAt))
    .limit(50);
}

/** Upcoming active turnos, e.g. "Turnos de hoy" on Inicio. */
export async function listUpcomingAppointments(ctx: TenantScope, { from, to, limit = 5 }: { from: Date; to: Date; limit?: number }) {
  return joined()
    .where(
      scoped(
        ctx,
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        gte(appointments.endsAt, from),
        lt(appointments.startsAt, to),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(limit);
}

export async function countPendingAppointments(ctx: TenantScope, now = new Date()) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(appointments)
    .where(scoped(ctx, eq(appointments.status, "pending"), gte(appointments.endsAt, now)));
  return n;
}

/** Upcoming active turnos that reference a service or staff member (archive warnings). */
export async function countUpcomingFor(
  ctx: TenantScope,
  ref: { serviceId?: string; staffId?: string },
  now = new Date(),
) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(appointments)
    .where(
      scoped(
        ctx,
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        gte(appointments.startsAt, now),
        ref.serviceId ? eq(appointments.serviceId, ref.serviceId) : undefined,
        ref.staffId ? eq(appointments.staffId, ref.staffId) : undefined,
      ),
    );
  return n;
}

/** Active turnos per staff member in a time range (to balance "Cualquiera"). */
export async function countTurnosByStaff(ctx: TenantScope, staffIds: string[], from: Date, to: Date) {
  if (staffIds.length === 0) return {};
  const rows = await db
    .select({ staffId: appointments.staffId, n: count() })
    .from(appointments)
    .where(
      scoped(
        ctx,
        inArray(appointments.staffId, staffIds),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
      ),
    )
    .groupBy(appointments.staffId);
  return Object.fromEntries(rows.map((row) => [row.staffId, row.n]));
}

/** Active upcoming turnos booked for a phone number (anti-abuse cap). */
export async function countUpcomingForPhone(ctx: TenantScope, phone: string, now = new Date()) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(appointments)
    .innerJoin(clients, and(eq(clients.id, appointments.clientId), eq(clients.organizationId, appointments.organizationId)))
    .where(
      scoped(
        ctx,
        eq(clients.phone, phone),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        gte(appointments.startsAt, now),
      ),
    );
  return n;
}

export async function setAppointmentStatus(
  ctx: TenantScope,
  id: string,
  to: AppointmentStatus,
  details: { cancelledBy?: "client" | "business"; reason?: string | null } = {},
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: appointments.status })
      .from(appointments)
      .where(scoped(ctx, eq(appointments.id, id)))
      .for("update");
    if (!current) return null;
    if (!canTransition(current.status, to)) throw new InvalidTransitionError(current.status, to);

    const [updated] = await tx
      .update(appointments)
      .set({
        status: to,
        ...(to === "cancelled"
          ? { cancelledAt: new Date(), cancelledBy: details.cancelledBy ?? "business", cancellationReason: details.reason ?? null }
          : { cancelledAt: null, cancelledBy: null, cancellationReason: null }),
      })
      .where(scoped(ctx, eq(appointments.id, id), ne(appointments.status, to)))
      .returning({ id: appointments.id, status: appointments.status });
    return updated ?? null;
  });
}

export async function updateInternalNotes(ctx: TenantScope, id: string, internalNotes: string | null) {
  const rows = await db
    .update(appointments)
    .set({ internalNotes })
    .where(scoped(ctx, eq(appointments.id, id)))
    .returning({ id: appointments.id });
  return rows.length > 0;
}

/** The turno behind a client's private link (looked up by token hash). */
export async function getAppointmentByTokenHash(ctx: TenantScope, tokenHash: string) {
  const [row] = await joined().where(scoped(ctx, eq(appointments.manageTokenHash, tokenHash)));
  return row ?? null;
}
