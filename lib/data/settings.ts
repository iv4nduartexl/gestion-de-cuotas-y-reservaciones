import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { businessSettings, organization, staff } from "@/db/schema";
import type { BusinessType, TeamMode } from "@/lib/business-types";
import type { TenantScope } from "./scope";

export class TooManyStaffError extends Error {
  constructor() {
    super("More than one active staff member");
    this.name = "TooManyStaffError";
  }
}

/** Name, public link and time zone. Keeps organization.slug in sync. */
export async function updateBusinessProfile(
  ctx: TenantScope,
  input: { name: string; slug: string; timezone: string },
) {
  await db.transaction(async (tx) => {
    await tx
      .update(organization)
      .set({ name: input.name, slug: input.slug })
      .where(eq(organization.id, ctx.organization.id));
    await tx
      .update(businessSettings)
      .set({ slug: input.slug, timezone: input.timezone })
      .where(eq(businessSettings.organizationId, ctx.organization.id));
  });
}

export async function updateBusinessUsage(
  ctx: TenantScope,
  input: { businessType: BusinessType; appointmentsEnabled: boolean; membershipsEnabled: boolean },
) {
  await db
    .update(businessSettings)
    .set(input)
    .where(eq(businessSettings.organizationId, ctx.organization.id));
}

export async function updateTeamMode(ctx: TenantScope, teamMode: TeamMode) {
  await db.transaction(async (tx) => {
    if (teamMode === "solo") {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(staff)
        .where(and(eq(staff.organizationId, ctx.organization.id), isNull(staff.archivedAt)));
      if (n > 1) throw new TooManyStaffError();
    }
    await tx
      .update(businessSettings)
      .set({ teamMode })
      .where(eq(businessSettings.organizationId, ctx.organization.id));
  });
}

/**
 * Makes sure the given member has an active staff record (used when
 * appointments get enabled for a business that had none).
 */
export async function ensureStaffForMember(ctx: TenantScope, memberId: string, name: string) {
  const [existing] = await db
    .select({ id: staff.id, archivedAt: staff.archivedAt })
    .from(staff)
    .where(and(eq(staff.organizationId, ctx.organization.id), eq(staff.memberId, memberId)));
  if (existing) {
    if (existing.archivedAt) {
      await db.update(staff).set({ archivedAt: null }).where(eq(staff.id, existing.id));
    }
    return existing.id;
  }
  const [created] = await db
    .insert(staff)
    .values({ organizationId: ctx.organization.id, name, memberId })
    .returning({ id: staff.id });
  return created.id;
}
