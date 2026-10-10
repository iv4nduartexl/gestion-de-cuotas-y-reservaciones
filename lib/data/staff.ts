import "server-only";

import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { member, staff, user } from "@/db/schema";
import type { StaffInput } from "@/lib/validation/staff";
import { InvalidReferenceError, type TenantScope } from "./scope";

export type Staff = typeof staff.$inferSelect;
type Executor = Pick<typeof db, "select">;

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(staff.organizationId, ctx.organization.id), ...conditions);
}

export async function listStaff(
  ctx: TenantScope,
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  return db
    .select({
      id: staff.id,
      name: staff.name,
      memberId: staff.memberId,
      archivedAt: staff.archivedAt,
      userEmail: user.email,
    })
    .from(staff)
    .leftJoin(member, eq(member.id, staff.memberId))
    .leftJoin(user, eq(user.id, member.userId))
    .where(scoped(ctx, includeArchived ? undefined : isNull(staff.archivedAt)))
    .orderBy(asc(staff.archivedAt), asc(staff.name));
}

export async function getStaff(ctx: TenantScope, id: string): Promise<Staff | null> {
  const [row] = await db.select().from(staff).where(scoped(ctx, eq(staff.id, id)));
  return row ?? null;
}

/** The staff record linked to a dashboard member, if any. */
export async function getStaffForMember(ctx: TenantScope, memberId: string) {
  const [row] = await db
    .select()
    .from(staff)
    .where(scoped(ctx, eq(staff.memberId, memberId), isNull(staff.archivedAt)));
  return row ?? null;
}

/** Organization members, for linking a staff record to a dashboard user. */
export async function listOrganizationMembers(ctx: TenantScope) {
  return db
    .select({ id: member.id, name: user.name, email: user.email, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, ctx.organization.id))
    .orderBy(asc(user.name));
}

async function assertMemberInTenant(ctx: TenantScope, memberId: string | null) {
  if (!memberId) return;
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organization.id)));
  if (!row) throw new InvalidReferenceError("memberId");
}

/** Throws InvalidReferenceError unless every id is an active staff member of this tenant. */
export async function assertActiveStaffIds(
  executor: Executor,
  ctx: TenantScope,
  ids: string[],
  field = "staffIds",
) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await executor
    .select({ id: staff.id })
    .from(staff)
    .where(scoped(ctx, inArray(staff.id, unique), isNull(staff.archivedAt)));
  if (rows.length !== unique.length) throw new InvalidReferenceError(field);
}

export async function createStaff(ctx: TenantScope, input: StaffInput) {
  await assertMemberInTenant(ctx, input.memberId);
  const [row] = await db
    .insert(staff)
    .values({ ...input, organizationId: ctx.organization.id })
    .returning();
  return row;
}

export async function updateStaff(ctx: TenantScope, id: string, input: StaffInput) {
  await assertMemberInTenant(ctx, input.memberId);
  const [row] = await db
    .update(staff)
    .set(input)
    .where(scoped(ctx, eq(staff.id, id)))
    .returning();
  return row ?? null;
}

export async function setStaffArchived(ctx: TenantScope, id: string, archived: boolean) {
  const rows = await db
    .update(staff)
    .set({ archivedAt: archived ? new Date() : null })
    .where(scoped(ctx, eq(staff.id, id)))
    .returning({ id: staff.id });
  return rows.length > 0;
}
