import "server-only";

import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { services, serviceStaff, staff } from "@/db/schema";
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
      durationMinutes: services.durationMinutes,
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

function serviceValues(ctx: TenantScope, input: ServiceInput) {
  return {
    name: input.name,
    description: input.description,
    durationMinutes: input.durationMinutes,
    price: input.price,
    // Currency always comes from the tenant's settings.
    currency: ctx.settings.currency,
  };
}

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
) {
  const staffIds = await resolveStaffIds(tx, ctx, requestedStaffIds);
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
    await replaceServiceStaff(tx, ctx, service.id, input.staffIds);
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
    await replaceServiceStaff(tx, ctx, service.id, input.staffIds);
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
