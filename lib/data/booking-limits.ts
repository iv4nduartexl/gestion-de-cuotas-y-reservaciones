import "server-only";

import { createHash } from "node:crypto";

import { and, count, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { bookingAttempts } from "@/db/schema";
import { env } from "@/lib/env";
import type { TenantScope } from "./scope";

// Built-in anti-abuse for public bookings (no external captcha):
// per-IP and per-phone attempt limits stored in Postgres.
export const LIMITS = {
  perIp: { max: 5, windowMinutes: 10 },
  perPhone: { max: 3, windowMinutes: 60 },
  upcomingPerPhone: 3,
};

/** IPs are stored hashed (salted with the app secret), never in clear text. */
export function hashIp(ip: string) {
  return createHash("sha256").update(`${env.BETTER_AUTH_SECRET}:${ip}`).digest("hex");
}

export async function isRateLimited(ctx: TenantScope, ipHash: string, phone: string | null, now = new Date()) {
  if (env.RATE_LIMITS === "off") return false;
  const ipSince = new Date(now.getTime() - LIMITS.perIp.windowMinutes * 60_000);
  const [{ n: byIp }] = await db
    .select({ n: count() })
    .from(bookingAttempts)
    .where(and(eq(bookingAttempts.ipHash, ipHash), gte(bookingAttempts.createdAt, ipSince)));
  if (byIp >= LIMITS.perIp.max) return true;
  if (!phone) return false;

  const phoneSince = new Date(now.getTime() - LIMITS.perPhone.windowMinutes * 60_000);
  const [{ n: byPhone }] = await db
    .select({ n: count() })
    .from(bookingAttempts)
    .where(
      and(
        eq(bookingAttempts.organizationId, ctx.organization.id),
        eq(bookingAttempts.phone, phone),
        gte(bookingAttempts.createdAt, phoneSince),
      ),
    );
  return byPhone >= LIMITS.perPhone.max;
}

export async function recordAttempt(ctx: TenantScope, ipHash: string, phone: string | null, now = new Date()) {
  await db.insert(bookingAttempts).values({ organizationId: ctx.organization.id, ipHash, phone, createdAt: now });
  // Opportunistic cleanup instead of a cron job.
  if (Math.random() < 0.05) {
    await db.delete(bookingAttempts).where(lt(bookingAttempts.createdAt, new Date(now.getTime() - 86_400_000)));
  }
}
