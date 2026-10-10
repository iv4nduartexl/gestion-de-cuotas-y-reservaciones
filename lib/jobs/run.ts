import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { syncCharges } from "@/lib/data/charges";
import { todayInZone } from "@/lib/datetime";
import { listActiveBusinesses } from "./businesses";
import { planRemindersFor } from "./plan-reminders";
import { sendDueReminders, skipStaleReminders } from "./send-reminders";

export type JobReport =
  | { ran: false; reason: "already_running" }
  | {
      ran: true;
      businesses: number;
      chargesCreated: number;
      remindersPlanned: number;
      remindersSkipped: number;
      sent: number;
      failed: number;
      durationMs: number;
    };

/**
 * The scheduled job (every ~15 min): generate due cuotas, plan reminders,
 * send the automatic ones. A transaction-scoped advisory lock prevents two
 * overlapping runs.
 */
export async function runScheduledJobs(now: Date = new Date()): Promise<JobReport> {
  const started = Date.now();
  return db.transaction(async (tx) => {
    const [{ locked }] = (
      await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('agenda:scheduled-jobs')) as locked`)
    ).rows;
    if (!locked) return { ran: false, reason: "already_running" } as const;

    const businesses = await listActiveBusinesses();
    let chargesCreated = 0;
    let remindersPlanned = 0;
    for (const business of businesses) {
      if (business.settings.membershipsEnabled) {
        chargesCreated += await syncCharges(business, { today: todayInZone(business.settings.timezone, now) });
      }
      remindersPlanned += await planRemindersFor(business, now);
    }
    const remindersSkipped = await skipStaleReminders(now);
    const { sent, failed, skipped } = await sendDueReminders(now);
    return {
      ran: true,
      businesses: businesses.length,
      chargesCreated,
      remindersPlanned,
      remindersSkipped: remindersSkipped + skipped,
      sent,
      failed,
      durationMs: Date.now() - started,
    } as const;
  });
}
