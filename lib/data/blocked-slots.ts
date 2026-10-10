import "server-only";

import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { blockedSlots, staff } from "@/db/schema";
import { InvalidReferenceError, type TenantScope } from "./scope";
import { assertActiveStaffIds } from "./staff";

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(blockedSlots.organizationId, ctx.organization.id), ...conditions);
}

/**
 * Blocks that haven't ended yet. With `staffId`, returns that person's blocks
 * plus business-wide ones.
 */
export async function listUpcomingBlockedSlots(
  ctx: TenantScope,
  { staffId, now = new Date() }: { staffId?: string; now?: Date } = {},
) {
  return db
    .select({
      id: blockedSlots.id,
      staffId: blockedSlots.staffId,
      staffName: staff.name,
      startsAt: blockedSlots.startsAt,
      endsAt: blockedSlots.endsAt,
      reason: blockedSlots.reason,
    })
    .from(blockedSlots)
    .leftJoin(
      staff,
      and(eq(staff.id, blockedSlots.staffId), eq(staff.organizationId, blockedSlots.organizationId)),
    )
    .where(
      scoped(
        ctx,
        gt(blockedSlots.endsAt, now),
        staffId
          ? or(eq(blockedSlots.staffId, staffId), isNull(blockedSlots.staffId))
          : undefined,
      ),
    )
    .orderBy(asc(blockedSlots.startsAt));
}

export async function getBlockedSlot(ctx: TenantScope, id: string) {
  const [row] = await db.select().from(blockedSlots).where(scoped(ctx, eq(blockedSlots.id, id)));
  return row ?? null;
}

export async function createBlockedSlot(
  ctx: TenantScope,
  input: { staffId: string | null; startsAt: Date; endsAt: Date; reason: string | null },
) {
  if (input.staffId) await assertActiveStaffIds(db, ctx, [input.staffId], "staffId");
  const [row] = await db
    .insert(blockedSlots)
    .values({ ...input, organizationId: ctx.organization.id })
    .returning();
  return row;
}

export async function deleteBlockedSlot(ctx: TenantScope, id: string) {
  const rows = await db
    .delete(blockedSlots)
    .where(scoped(ctx, eq(blockedSlots.id, id)))
    .returning({ id: blockedSlots.id });
  if (rows.length === 0) throw new InvalidReferenceError("id");
}

/** Adds business-wide blocks, skipping ones that already start at the same instant. */
export async function createMissingBusinessWideBlocks(
  ctx: TenantScope,
  blocks: { startsAt: Date; endsAt: Date; reason: string }[],
) {
  if (blocks.length === 0) return 0;
  const existing = await db
    .select({ startsAt: blockedSlots.startsAt })
    .from(blockedSlots)
    .where(
      scoped(
        ctx,
        isNull(blockedSlots.staffId),
        inArray(blockedSlots.startsAt, blocks.map((block) => block.startsAt)),
      ),
    );
  const taken = new Set(existing.map((row) => row.startsAt.getTime()));
  const missing = blocks.filter((block) => !taken.has(block.startsAt.getTime()));
  if (missing.length === 0) return 0;
  await db.insert(blockedSlots).values(
    missing.map((block) => ({ ...block, staffId: null, organizationId: ctx.organization.id })),
  );
  return missing.length;
}
