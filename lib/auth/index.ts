import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
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
  disabledPaths: ["/organization/create", "/organization/update", "/organization/delete"],
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
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
