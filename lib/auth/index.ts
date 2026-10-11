import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { IMPERSONATION_SECONDS, isAdminIdentity } from "@/lib/admin-access";
import { APP_NAME } from "@/lib/brand";
import { CLIENT_IP_HEADERS } from "@/lib/client-ip";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verificationEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { ac, roles } from "./permissions";

// Emails are sent without awaiting so response timing doesn't reveal
// whether an account exists.
function sendInBackground(promise: Promise<void>) {
  promise.catch((error) => console.error("Failed to send email", error));
}

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Organizations are created/updated/deleted only through our server
  // actions, which also maintain `business_settings` (and give deletion a
  // grace period). Blocks the public HTTP endpoints; `auth.api.*` calls on the
  // server are unaffected.
  disabledPaths: [
    "/organization/create",
    "/organization/update",
    "/organization/delete",
    // The admin plugin is only used for impersonation (see lib/admin.ts).
    ...[
      "ban-user",
      "create-user",
      "get-user",
      "has-permission",
      "list-user-sessions",
      "list-users",
      "remove-user",
      "revoke-user-session",
      "revoke-user-sessions",
      "set-role",
      "set-user-password",
      "unban-user",
      "update-user",
    ].map((path) => `/admin/${path}`),
  ],
  hooks: {
    // The plugin trusts `user.role`; we also require ADMIN_EMAILS, so a role
    // set in the database alone can never impersonate anyone.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/admin/impersonate-user") return;
      const current = await getSessionFromCtx(ctx);
      const impersonatedBy = (current?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy;
      if (!current || !isAdminIdentity(current.user, { impersonatedBy })) {
        throw new APIError("FORBIDDEN", { message: "Not allowed" });
      }
    }),
  },
  ...(env.RATE_LIMITS === "off" && { rateLimit: { enabled: false } }),
  // Behind Caddy: the client IP comes from X-Real-IP (see lib/client-ip.ts).
  advanced: { ipAddress: { ipAddressHeaders: CLIENT_IP_HEADERS } },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendInBackground(
        sendEmail(resetPasswordEmail({ to: user.email, name: user.name, url })),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // The sign-in form re-sends it itself so the link carries our callback URL.
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground(
        sendEmail(verificationEmail({ to: user.email, name: user.name, url })),
      );
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Start every new session in the user's oldest organization, so
        // returning users land on their dashboard instead of onboarding.
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .innerJoin(
              schema.businessSettings,
              eq(schema.businessSettings.organizationId, schema.member.organizationId),
            )
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
    }),
    // Must be last: lets server actions that call auth.api set cookies.
    adminPlugin({ impersonationSessionDuration: IMPERSONATION_SECONDS }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
