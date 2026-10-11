import "server-only";

import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { appointments, availabilityRules, blockedSlots, staff } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import { longestBookableMinutes, type StaffAvailability } from "@/lib/availability";
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

/**
 * Longest turno (minutes) each staff member could take on any weekday, from
 * their first opening to their last closing. Drives the "nobody can book
 * this long" warning in the service form.
 */
export async function longestTurnoByStaff(ctx: TenantScope): Promise<Record<string, number>> {
  const rows = await db
    .select({
      staffId: availabilityRules.staffId,
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.organizationId, ctx.organization.id));
  const byStaff = new Map<string, { weekday: number; startTime: string; endTime: string }[]>();
  for (const row of rows) {
    const list = byStaff.get(row.staffId) ?? [];
    list.push({ weekday: row.weekday, startTime: toHHmm(row.startTime), endTime: toHHmm(row.endTime) });
    byStaff.set(row.staffId, list);
  }
  return Object.fromEntries([...byStaff].map(([staffId, rules]) => [staffId, longestBookableMinutes(rules)]));
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

/**
 * Everything the availability engine needs for these staff members between
 * `from` and `to`: weekly hours, días libres (theirs + business-wide) and
 * active turnos.
 */
export async function loadStaffAvailability(
  ctx: TenantScope,
  { staffIds, from, to }: { staffIds: string[]; from: Date; to: Date },
): Promise<StaffAvailability[]> {
  if (staffIds.length === 0) return [];
  const org = ctx.organization.id;
  const [rules, blocks, busy] = await Promise.all([
    db
      .select({
        staffId: availabilityRules.staffId,
        weekday: availabilityRules.weekday,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
      })
      .from(availabilityRules)
      .where(and(eq(availabilityRules.organizationId, org), inArray(availabilityRules.staffId, staffIds))),
    db
      .select({ staffId: blockedSlots.staffId, startsAt: blockedSlots.startsAt, endsAt: blockedSlots.endsAt })
      .from(blockedSlots)
      .where(
        and(
          eq(blockedSlots.organizationId, org),
          or(isNull(blockedSlots.staffId), inArray(blockedSlots.staffId, staffIds)),
          lt(blockedSlots.startsAt, to),
          gt(blockedSlots.endsAt, from),
        ),
      ),
    db
      .select({ staffId: appointments.staffId, startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, org),
          inArray(appointments.staffId, staffIds),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          lt(appointments.startsAt, to),
          gt(appointments.endsAt, from),
        ),
      ),
  ]);

  const interval = (row: { startsAt: Date; endsAt: Date }) => ({
    start: row.startsAt.getTime(),
    end: row.endsAt.getTime(),
  });

  return staffIds.map((staffId) => ({
    staffId,
    rules: rules
      .filter((rule) => rule.staffId === staffId)
      .map((rule) => ({ weekday: rule.weekday, startTime: toHHmm(rule.startTime), endTime: toHHmm(rule.endTime) })),
    blocks: blocks.filter((block) => block.staffId === null || block.staffId === staffId).map(interval),
    busy: busy.filter((turno) => turno.staffId === staffId).map(interval),
  }));
}

/** Staff ids that have at least one weekly rule. */
export async function staffWithHours(ctx: TenantScope, staffIds: string[]) {
  if (staffIds.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ staffId: availabilityRules.staffId })
    .from(availabilityRules)
    .where(and(eq(availabilityRules.organizationId, ctx.organization.id), inArray(availabilityRules.staffId, staffIds)));
  return new Set(rows.map((row) => row.staffId));
}
