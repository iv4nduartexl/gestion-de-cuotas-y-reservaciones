import "server-only";

import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { services, serviceStaff, staff } from "@/db/schema";
import { slotServiceIssues, stayIssues } from "@/lib/config-rules";
import { longestTurnoByStaff } from "@/lib/data/availability";
import type { ServiceInput } from "@/lib/validation/services";
import type { TenantScope } from "./scope";
import { assertActiveStaffIds } from "./staff";

export type Service = typeof services.$inferSelect;

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(services.organizationId, ctx.organization.id), ...conditions);
}

export async function listServices(
  ctx: TenantScope,
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  return db
    .select({
      id: services.id,
      name: services.name,
      bookingType: services.bookingType,
      durationMinutes: services.durationMinutes,
      stayUnit: services.stayUnit,
      checkInTime: services.checkInTime,
      checkOutTime: services.checkOutTime,
      price: services.price,
      currency: services.currency,
      archivedAt: services.archivedAt,
      staffCount: sql<number>`(
        select count(*)::int from ${serviceStaff}
        where ${serviceStaff.serviceId} = ${services.id}
          and ${serviceStaff.organizationId} = ${services.organizationId}
      )`,
    })
    .from(services)
    .where(scoped(ctx, includeArchived ? undefined : isNull(services.archivedAt)))
    .orderBy(asc(services.archivedAt), asc(services.name));
}

export async function getService(ctx: TenantScope, id: string) {
  const [service] = await db.select().from(services).where(scoped(ctx, eq(services.id, id)));
  if (!service) return null;
  const staffRows = await db
    .select({ staffId: serviceStaff.staffId })
    .from(serviceStaff)
    .where(
      and(
        eq(serviceStaff.organizationId, ctx.organization.id),
        eq(serviceStaff.serviceId, id),
      ),
    );
  return { ...service, staffIds: staffRows.map((row) => row.staffId) };
}

/** Columns for either kind of service; the other kind's fields are cleared. */
function serviceValues(ctx: TenantScope, input: ServiceInput) {
  const common = {
    name: input.name,
    description: input.description,
    bookingType: input.bookingType,
    price: input.price,
    // Currency always comes from the tenant's settings.
    currency: ctx.settings.currency,
  };
  if (input.bookingType === "slot") {
    return {
      ...common,
      durationMinutes: input.durationMinutes,
      stayUnit: null,
      checkInTime: null,
      checkOutTime: null,
      minStay: null,
      maxStay: null,
      weeklyPrice: null,
      monthlyPrice: null,
    };
  }
  return {
    ...common,
    durationMinutes: null,
    stayUnit: input.stayUnit,
    checkInTime: input.checkInTime,
    checkOutTime: input.checkOutTime,
    minStay: input.minStay,
    maxStay: input.maxStay ?? null,
    weeklyPrice: input.weeklyPrice,
    monthlyPrice: input.monthlyPrice,
  };
}

/** Rentals are booked by the service itself: they have no staff. */
const staffIdsOf = (input: ServiceInput) => (input.bookingType === "slot" ? input.staffIds : []);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** In solo mode the form has no staff picker: everyone active does everything. */
async function resolveStaffIds(tx: Tx, ctx: TenantScope, staffIds: string[]) {
  if (ctx.settings.teamMode !== "solo") return staffIds;
  const rows = await tx
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.organizationId, ctx.organization.id), isNull(staff.archivedAt)));
  return rows.map((row) => row.id);
}

async function replaceServiceStaff(
  tx: Tx,
  ctx: TenantScope,
  serviceId: string,
  requestedStaffIds: string[],
  bookingType: ServiceInput["bookingType"] = "slot",
) {
  const staffIds = bookingType === "stay" ? [] : await resolveStaffIds(tx, ctx, requestedStaffIds);
  await assertActiveStaffIds(tx, ctx, staffIds);
  await tx
    .delete(serviceStaff)
    .where(
      and(
        eq(serviceStaff.organizationId, ctx.organization.id),
        eq(serviceStaff.serviceId, serviceId),
      ),
    );
  const unique = [...new Set(staffIds)];
  if (unique.length > 0) {
    await tx.insert(serviceStaff).values(
      unique.map((staffId) => ({
        organizationId: ctx.organization.id,
        serviceId,
        staffId,
      })),
    );
  }
}

export async function createService(ctx: TenantScope, input: ServiceInput) {
  return db.transaction(async (tx) => {
    const [service] = await tx
      .insert(services)
      .values({ ...serviceValues(ctx, input), organizationId: ctx.organization.id })
      .returning();
    await replaceServiceStaff(tx, ctx, service.id, staffIdsOf(input), input.bookingType);
    return service;
  });
}

export async function updateService(ctx: TenantScope, id: string, input: ServiceInput) {
  return db.transaction(async (tx) => {
    const [service] = await tx
      .update(services)
      .set(serviceValues(ctx, input))
      .where(scoped(ctx, eq(services.id, id)))
      .returning();
    if (!service) return null;
    await replaceServiceStaff(tx, ctx, service.id, staffIdsOf(input), input.bookingType);
    return service;
  });
}

export async function setServiceArchived(ctx: TenantScope, id: string, archived: boolean) {
  const rows = await db
    .update(services)
    .set({ archivedAt: archived ? new Date() : null })
    .where(scoped(ctx, eq(services.id, id)))
    .returning({ id: services.id });
  return rows.length > 0;
}

/**
 * Services that can't work as configured (saved before the rule book
 * existed, or broken by later changes such as shorter hours), with the reason
 * in plain words. They are hidden from the booking page and flagged
 * "Necesita arreglo" in the dashboard.
 */
export async function findServiceProblems(ctx: TenantScope): Promise<Map<string, string>> {
  const [rows, links, longestByStaff] = await Promise.all([
    db.select().from(services).where(scoped(ctx, isNull(services.archivedAt))),
    db
      .select({ serviceId: serviceStaff.serviceId, staffId: serviceStaff.staffId })
      .from(serviceStaff)
      .where(eq(serviceStaff.organizationId, ctx.organization.id)),
    longestTurnoByStaff(ctx),
  ]);
  const problems = new Map<string, string>();
  for (const service of rows) {
    if (service.bookingType === "stay") {
      const [problem] = stayIssues(
        {
          stayUnit: service.stayUnit ?? "night",
          checkInTime: service.checkInTime ?? "14:00",
          checkOutTime: service.checkOutTime ?? "10:00",
          minStay: service.minStay ?? 1,
          maxStay: service.maxStay,
          price: service.price,
          weeklyPrice: service.weeklyPrice,
          monthlyPrice: service.monthlyPrice,
        },
        service.currency,
      );
      if (problem) problems.set(service.id, problem.message);
      continue;
    }
    const people = links.filter((link) => link.serviceId === service.id).map((link) => link.staffId);
    const known = people.map((id) => longestByStaff[id]).filter((minutes) => minutes !== undefined);
    const [problem] = slotServiceIssues(
      { durationMinutes: service.durationMinutes ?? 0 },
      { longestMinutes: known.length > 0 ? Math.max(...known) : null },
    );
    if (problem) problems.set(service.id, problem.message);
  }
  return problems;
}
