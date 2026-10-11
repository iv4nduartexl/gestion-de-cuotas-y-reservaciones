// Imported by lib/auth (the Better Auth CLI loads it, so no "server-only" here).
import { env } from "@/lib/env";

/** Impersonation sessions last one hour (Better Auth admin plugin). */
export const IMPERSONATION_SECONDS = 3600;

/**
 * The developer admin: a verified email listed in ADMIN_EMAILS, acting as
 * themselves (not while impersonating someone). The env is the only source
 * of truth; the `user.role` column the plugin needs is derived from it.
 */
export function isAdminIdentity(
  user: { email: string; emailVerified: boolean },
  session: { impersonatedBy?: string | null },
  adminEmails: readonly string[] = env.ADMIN_EMAILS,
) {
  return user.emailVerified && !session.impersonatedBy && adminEmails.includes(user.email.trim().toLowerCase());
}
