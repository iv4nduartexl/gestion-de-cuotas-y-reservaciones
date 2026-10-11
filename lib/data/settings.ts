import "server-only";

import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appointments, businessSettings, enrollments, organization, slugRedirects, staff } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import type { BusinessType, TeamMode } from "@/lib/business-types";
import type { GraceUnit } from "@/lib/membership-constants";
import type { TenantScope } from "./scope";

export class TooManyStaffError extends Error {
  constructor() {
    super("More than one active staff member");
    this.name = "TooManyStaffError";
  }
}

/**
 * Name, public link and time zone. Keeps organization.slug in sync. When the
 * slug changes, the old one is kept as a redirect so shared links and the
 * clients' private turno links keep working.
 */
export async function updateBusinessProfile(
  ctx: TenantScope,
  input: { name: string; slug: string; timezone: string },
) {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ slug: businessSettings.slug })
      .from(businessSettings)
      .where(eq(businessSettings.organizationId, ctx.organization.id));
    if (current && current.slug !== input.slug) {
      await tx
        .insert(slugRedirects)
        .values({ slug: current.slug, organizationId: ctx.organization.id })
        .onConflictDoNothing();
      // Taking back one of its own old links: it's current again, not a redirect.
      await tx
        .delete(slugRedirects)
        .where(and(eq(slugRedirects.slug, input.slug), eq(slugRedirects.organizationId, ctx.organization.id)));
    }
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

export async function updateBookingRules(
  ctx: TenantScope,
  input: {
    autoConfirmBookings: boolean;
    minNoticeMinutes: number;
    maxDaysAhead: number;
    slotIntervalMinutes: number;
    bufferMinutes: number;
    clientCancelNoticeHours: number;
  },
) {
  await db.update(businessSettings).set(input).where(eq(businessSettings.organizationId, ctx.organization.id));
}

export async function updatePublicProfile(
  ctx: TenantScope,
  input: { publicPhone: string | null; address: string | null; description: string | null },
) {
  await db.update(businessSettings).set(input).where(eq(businessSettings.organizationId, ctx.organization.id));
}

export async function updateMembershipSettings(
  ctx: TenantScope,
  input: { graceCount: number; graceUnit: GraceUnit; paymentReminderTemplate: string | null },
) {
  await db.update(businessSettings).set(input).where(eq(businessSettings.organizationId, ctx.organization.id));
}

/** What would be hidden by turning a product off (Configuración → Qué usás). */
export async function productUsage(ctx: TenantScope, now = new Date()) {
  const [[turnos], [memberships]] = await Promise.all([
    db
      .select({ n: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, ctx.organization.id),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          gt(appointments.startsAt, now),
        ),
      ),
    db
      .select({ n: count() })
      .from(enrollments)
      .where(and(eq(enrollments.organizationId, ctx.organization.id), eq(enrollments.status, "active"))),
  ]);
  return { upcomingTurnos: turnos.n, activeMemberships: memberships.n };
}
