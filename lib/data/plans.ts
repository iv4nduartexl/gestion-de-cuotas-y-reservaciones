import "server-only";

import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { enrollments, plans } from "@/db/schema";
import type { PlanInput } from "@/lib/validation/memberships";
import type { TenantScope } from "./scope";

export type Plan = typeof plans.$inferSelect;

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(plans.organizationId, ctx.organization.id), ...conditions);
}

export async function listPlans(ctx: TenantScope, { includeArchived = false } = {}) {
  return db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      price: plans.price,
      currency: plans.currency,
      intervalUnit: plans.intervalUnit,
      intervalCount: plans.intervalCount,
      billingTiming: plans.billingTiming,
      archivedAt: plans.archivedAt,
      activeMembers: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.planId} = ${plans.id}
          and ${enrollments.organizationId} = ${plans.organizationId}
          and ${enrollments.status} = 'active'
      )`,
    })
    .from(plans)
    .where(scoped(ctx, includeArchived ? undefined : isNull(plans.archivedAt)))
    .orderBy(asc(plans.archivedAt), asc(plans.name));
}

export async function getPlan(ctx: TenantScope, id: string) {
  const [row] = await db.select().from(plans).where(scoped(ctx, eq(plans.id, id)));
  return row ?? null;
}

export async function createPlan(ctx: TenantScope, input: PlanInput) {
  const [row] = await db
    .insert(plans)
    .values({ ...input, currency: ctx.settings.currency, organizationId: ctx.organization.id })
    .returning();
  return row;
}

/** Price changes apply to new enrollments; existing ones keep their snapshot. */
export async function updatePlan(ctx: TenantScope, id: string, input: PlanInput) {
  const [row] = await db.update(plans).set(input).where(scoped(ctx, eq(plans.id, id))).returning();
  return row ?? null;
}

export async function setPlanArchived(ctx: TenantScope, id: string, archived: boolean) {
  const rows = await db
    .update(plans)
    .set({ archivedAt: archived ? new Date() : null })
    .where(scoped(ctx, eq(plans.id, id)))
    .returning({ id: plans.id });
  return rows.length > 0;
}
