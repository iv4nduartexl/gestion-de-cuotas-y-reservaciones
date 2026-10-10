"use server";

import { refresh } from "next/cache";

import { authorizeAction, parseId } from "@/lib/actions";
import { markAllTrayDone, markRemindersDone, reminderAccessFor as accessFor, undoReminderDone } from "@/lib/data/reminders";
import { reminderIdsSchema } from "@/lib/validation/reminders";

const SEND = { reminder: ["send"] } as const;

type Result = { ok: boolean; count?: number };

export async function markReminderDoneAction(ids: string[]): Promise<Result> {
  const ctx = await authorizeAction(SEND);
  const parsed = reminderIdsSchema.safeParse(ids);
  if (!ctx || !parsed.success) return { ok: false };
  const changed = await markRemindersDone(ctx, await accessFor(ctx), parsed.data);
  refresh();
  return { ok: changed > 0, count: changed };
}

export async function undoReminderDoneAction(id: string): Promise<Result> {
  const ctx = await authorizeAction(SEND);
  const reminderId = parseId(id);
  if (!ctx || !reminderId) return { ok: false };
  const ok = await undoReminderDone(ctx, await accessFor(ctx), reminderId);
  refresh();
  return { ok };
}

export async function markAllRemindersDoneAction(): Promise<Result> {
  const ctx = await authorizeAction(SEND);
  if (!ctx) return { ok: false };
  const changed = await markAllTrayDone(ctx, await accessFor(ctx));
  refresh();
  return { ok: changed > 0, count: changed };
}
