"use server";

import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { organization } from "@/db/schema";
import { ensureAdminRole, findOwner, isAdmin, isMemberOf, setSessionBusiness } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getTenantContext, readSessionUncached } from "@/lib/tenant";

/**
 * Enters a business as its owner (developer admin only). Returns an error
 * message, or redirects to the business's dashboard.
 */
export async function impersonateAction(organizationId: string): Promise<string | undefined> {
  const current = await readSessionUncached();
  if (!isAdmin(current) || !(await ensureAdminRole(current))) return "No tenés permiso para hacer esto.";
  const [business] = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId));
  if (!business) return "Ese negocio ya no existe.";

  // The admin's own business: just switch to it.
  if (await isMemberOf(current.user.id, business.id)) {
    await setSessionBusiness(current.session.token, business.id);
    redirect("/dashboard");
  }

  const owner = await findOwner(business.id);
  if (!owner) return "Ese negocio no tiene dueño.";
  let started: { session: { token: string; expiresAt: Date } };
  try {
    started = await auth.api.impersonateUser({ body: { userId: owner.id }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) return "No se pudo entrar a ese negocio (¿el dueño también es admin?).";
    throw error;
  }
  await setSessionBusiness(started.session.token, business.id);
  await recordAudit(
    { organization: business, user: { ...owner, image: null }, impersonation: { adminId: current.user.id, expiresAt: started.session.expiresAt } },
    "admin.impersonation_started",
  );
  redirect("/dashboard");
}

/** Leaves the business and goes back to the admin console. */
export async function stopImpersonatingAction() {
  try {
    const ctx = await getTenantContext();
    if (ctx.impersonation) await recordAudit(ctx, "admin.impersonation_stopped");
  } catch {
    // No business in the session (e.g. it was deleted): just leave.
  }
  try {
    await auth.api.stopImpersonating({ headers: await headers() });
  } catch (error) {
    // The impersonation session already expired: sign in again.
    if (error instanceof APIError) redirect("/sign-in?next=/admin");
    throw error;
  }
  redirect("/admin");
}
