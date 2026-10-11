import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { businessSettings, member, organization } from "@/db/schema";
import { auth } from "@/lib/auth";
import { roles, type OrganizationRole } from "@/lib/auth/permissions";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export class NoActiveOrganizationError extends Error {
  constructor() {
    super("No active organization");
    this.name = "NoActiveOrganizationError";
  }
}

export type TenantContext = {
  user: { id: string; name: string; email: string; image: string | null };
  sessionId: string;
  /** Set while the developer admin is acting as this user (lib/admin.ts). */
  impersonation: { adminId: string; expiresAt: Date } | null;
  organization: { id: string; name: string; slug: string };
  role: OrganizationRole;
  memberId: string;
  settings: typeof businessSettings.$inferSelect;
};

/** Reads the Better Auth session without per-request caching. */
export async function readSessionUncached() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Current Better Auth session, or null. Deduplicated per request.
 *
 * Careful in server actions that change the session (e.g. the active
 * organization) and then redirect: Next renders the redirect target in the
 * same request, so it would reuse this cached value. Use
 * readSessionUncached() there instead.
 */
export const getSession = cache(readSessionUncached);

/**
 * Resolves the signed-in user and their active organization.
 *
 * The organization id comes only from the server-side session and is
 * re-checked against the `member` table, so a removed member loses access
 * immediately. Use the returned `organization.id` to scope every query.
 *
 * Throws `UnauthenticatedError` or `NoActiveOrganizationError`.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();

  const activeOrganizationId = session.session.activeOrganizationId;
  if (!activeOrganizationId) throw new NoActiveOrganizationError();

  const [row] = await db
    .select({
      role: member.role,
      memberId: member.id,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      settings: businessSettings,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(
      businessSettings,
      eq(businessSettings.organizationId, member.organizationId),
    )
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);

  if (!row || !isOrganizationRole(row.role)) {
    throw new NoActiveOrganizationError();
  }

  const { user } = session;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
    sessionId: session.session.id,
    impersonation: session.session.impersonatedBy
      ? { adminId: session.session.impersonatedBy, expiresAt: session.session.expiresAt }
      : null,
    organization: row.organization,
    role: row.role,
    memberId: row.memberId,
    settings: row.settings,
  };
});

/**
 * For Server Components: same as `getTenantContext()`, but redirects to
 * sign-in or onboarding instead of throwing.
 */
export async function getTenantContextOrRedirect(): Promise<TenantContext> {
  try {
    return await getTenantContext();
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof NoActiveOrganizationError) redirect("/onboarding");
    throw error;
  }
}

/** Checks the current member's role against the access-control statements. */
export function can(
  context: TenantContext,
  permissions: Parameters<(typeof roles)[OrganizationRole]["authorize"]>[0],
) {
  return roles[context.role].authorize(permissions).success;
}

/** Organizations the user belongs to (only ones that finished onboarding). */
export async function listUserOrganizations(userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(
      businessSettings,
      eq(businessSettings.organizationId, member.organizationId),
    )
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));
}

function isOrganizationRole(role: string): role is OrganizationRole {
  return Object.hasOwn(roles, role);
}
