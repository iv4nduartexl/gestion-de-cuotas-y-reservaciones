"use server";

import { refresh } from "next/cache";

import { setEmailOptOut } from "@/lib/data/email-preferences";

export async function setEmailOptOutAction(token: string, optOut: boolean) {
  const ok = await setEmailOptOut(token, optOut);
  refresh();
  return { ok };
}
