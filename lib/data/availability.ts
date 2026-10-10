import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { availabilityRules, staff } from "@/db/schema";
import { toHHmm } from "@/lib/datetime";
import type { AvailabilityRuleInput } from "@/lib/validation/staff";
import { InvalidReferenceError, type TenantScope } from "./scope";

export async function getWeeklySchedule(ctx: TenantScope, staffId: string) {
  const rows = await db
    .select({
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.organizationId, ctx.organization.id),
        eq(availabilityRules.staffId, staffId),
      ),
    )
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));
  return rows.map((row) => ({
    weekday: row.weekday,
    startTime: toHHmm(row.startTime),
    endTime: toHHmm(row.endTime),
  }));
}

/** Replaces the whole weekly schedule of a staff member atomically. */
export async function replaceWeeklySchedule(
  ctx: TenantScope,
  staffId: string,
  rules: AvailabilityRuleInput[],
) {
  await db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.organizationId, ctx.organization.id)))
      .for("update");
    if (!owner) throw new InvalidReferenceError("staffId");

    await tx
      .delete(availabilityRules)
      .where(
        and(
          eq(availabilityRules.organizationId, ctx.organization.id),
          eq(availabilityRules.staffId, staffId),
        ),
      );
    if (rules.length > 0) {
      await tx.insert(availabilityRules).values(
        rules.map((rule) => ({
          organizationId: ctx.organization.id,
          staffId,
          weekday: rule.weekday,
          startTime: rule.startTime,
          endTime: rule.endTime,
        })),
      );
    }
  });
}
