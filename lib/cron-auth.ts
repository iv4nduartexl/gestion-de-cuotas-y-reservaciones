import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/** Scheduled-job endpoints require "Authorization: Bearer $CRON_SECRET". Unset secret = disabled. */
export function isCronAuthorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
