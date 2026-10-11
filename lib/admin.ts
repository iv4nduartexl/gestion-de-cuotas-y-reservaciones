import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { appointments, auditEvents, businessSettings, clients, enrollments, member, organization, session, user } from "@/db/schema";
import { isAdminIdentity } from "@/lib/admin-access";
import { likePattern, PAGE_SIZE } from "@/lib/data/scope";
import type { Session } from "@/lib/auth";

/** The signed-in developer admin (ADMIN_EMAILS, verified, not impersonating). */
export function isAdmin(current: Session | null): current is Session {
  if (!current) return false;
  return isAdminIdentity(current.user, { impersonatedBy: current.session.impersonatedBy });
}

/**
 * Keeps `user.role` (what the Better Auth admin plugin checks) in line with
 * ADMIN_EMAILS: "admin" for the listed developer, "user" for anyone else.
 */
export async function ensureAdminRole(current: Session) {
  const role = isAdmin(current) ? "admin" : "user";
  if ((current.user.role ?? "user") !== role) {
    await db.update(user).set({ role }).where(eq(user.id, current.user.id));
  }
  return role === "admin";
}

/** The business owner: the oldest member with the "owner" role. */
export async function findOwner(organizationId: string) {
  const [owner] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return owner ?? null;
}

/** Whether `userId` already belongs to the business (then no impersonation is needed). */
export async function isMemberOf(userId: string, organizationId: string) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));
  return !!row;
}

const ownerColumn = <K extends "name" | "email">(column: K) => sql<string | null>`(
  select ${user[column]} from ${member} inner join ${user} on ${user.id} = ${member.userId}
  where ${member.organizationId} = ${organization.id} and ${member.role} = 'owner'
  order by ${member.createdAt} asc limit 1
)`;

/** Every registered business, newest first, for the admin console. */
export async function listBusinesses({ q = "", page = 1, now = new Date() }: { q?: string; page?: number; now?: Date }) {
  const search = q.trim();
  const where = search
    ? or(ilike(organization.name, likePattern(search)), ilike(organization.slug, likePattern(search)), ilike(ownerColumn("email"), likePattern(search)))
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        businessType: businessSettings.businessType,
        appointmentsEnabled: businessSettings.appointmentsEnabled,
        membershipsEnabled: businessSettings.membershipsEnabled,
        teamMode: businessSettings.teamMode,
        ownerName: ownerColumn("name"),
        ownerEmail: ownerColumn("email"),
        clients: sql<number>`(select count(*)::int from ${clients} where ${clients.organizationId} = ${organization.id} and ${clients.archivedAt} is null)`,
        upcoming: sql<number>`(select count(*)::int from ${appointments} where ${appointments.organizationId} = ${organization.id}
          and ${appointments.startsAt} >= ${now} and ${appointments.status} in ('pending', 'confirmed'))`,
        activeMemberships: sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.organizationId} = ${organization.id} and ${enrollments.status} = 'active')`,
        lastActivity: sql<Date | null>`greatest(
          (select max(${auditEvents.createdAt}) from ${auditEvents} where ${auditEvents.organizationId} = ${organization.id}),
          (select max(${appointments.createdAt}) from ${appointments} where ${appointments.organizationId} = ${organization.id})
        )`.mapWith((value) => (value ? new Date(value) : null)),
      })
      .from(organization)
      .innerJoin(businessSettings, eq(businessSettings.organizationId, organization.id))
      .where(where)
      .orderBy(desc(organization.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(organization)
      .innerJoin(businessSettings, eq(businessSettings.organizationId, organization.id))
      .where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Points an impersonation session at the business the admin chose. */
export async function setSessionBusiness(sessionToken: string, organizationId: string) {
  await db.update(session).set({ activeOrganizationId: organizationId }).where(eq(session.token, sessionToken));
}
