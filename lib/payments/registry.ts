import "server-only";

import { env } from "@/lib/env";
import { createFakeProvider } from "./fake";
import { manualProvider } from "./manual";
import type { PaymentProvider } from "./types";

/** Enabled providers (env PAYMENT_PROVIDERS). Add real providers here. */
export function getPaymentProvider(id: string): PaymentProvider | null {
  const enabled = new Set(env.PAYMENT_PROVIDERS.split(",").map((value) => value.trim()).filter(Boolean));
  enabled.add("manual");
  if (!enabled.has(id)) return null;
  switch (id) {
    case "manual":
      return manualProvider;
    case "fake":
      return env.FAKE_PROVIDER_SECRET ? createFakeProvider(env.FAKE_PROVIDER_SECRET) : null;
    default:
      return null;
  }
}
