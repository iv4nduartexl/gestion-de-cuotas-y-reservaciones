import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { businessSettings, charges, organization, paymentEvents, payments, providerSubscriptions } from "@/db/schema";
import { cancelEnrollment } from "@/lib/data/enrollments";
import { recordPayment, syncCharges } from "@/lib/data/charges";
import type { TenantScope } from "@/lib/data/scope";
import { todayInZone } from "@/lib/datetime";
import { getPaymentProvider } from "./registry";
import { WebhookVerificationError, type WebhookResult } from "./types";

export type WebhookResponse = { status: number; body: Record<string, unknown> };

async function businessForSubscription(provider: string, externalId: string) {
  const [row] = await db
    .select({
      subscriptionId: providerSubscriptions.id,
      enrollmentId: providerSubscriptions.enrollmentId,
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      settings: businessSettings,
    })
    .from(providerSubscriptions)
    .innerJoin(organization, eq(organization.id, providerSubscriptions.organizationId))
    .innerJoin(businessSettings, eq(businessSettings.organizationId, providerSubscriptions.organizationId))
    .where(and(eq(providerSubscriptions.provider, provider), eq(providerSubscriptions.externalId, externalId)));
  return row ?? null;
}

/** Applies a payment to the oldest unpaid cuotas of the subscription's enrollment. */
async function applyPayment(provider: string, event: Extract<WebhookResult, { type: "payment_succeeded" }>) {
  const found = await businessForSubscription(provider, event.subscriptionExternalId);
  if (!found) return "Suscripción desconocida";
  const business: TenantScope = { organization: found.organization, settings: found.settings };
  if (event.currency !== business.settings.currency) return `Moneda inesperada: ${event.currency}`;

  await syncCharges(business, { today: todayInZone(business.settings.timezone, event.paidAt), enrollmentId: found.enrollmentId });
  const open = await db
    .select({
      id: charges.id,
      amount: charges.amount,
      paid: sql<number>`coalesce((select sum(${payments.amount})::int from ${payments} where ${payments.chargeId} = ${charges.id}), 0)`,
    })
    .from(charges)
    .where(and(eq(charges.organizationId, business.organization.id), eq(charges.enrollmentId, found.enrollmentId), eq(charges.status, "pending")))
    .orderBy(asc(charges.dueDate));

  let left = event.amount;
  let part = 0;
  for (const charge of open) {
    if (left <= 0) break;
    const amount = Math.min(left, charge.amount - charge.paid);
    if (amount <= 0) continue;
    part++;
    await recordPayment(business, {
      chargeId: charge.id,
      amount,
      method: "online",
      paidOn: todayInZone(business.settings.timezone, event.paidAt),
      paidAtInstant: event.paidAt,
      reference: event.externalPaymentId,
      userId: null,
      provider,
      externalId: part === 1 ? event.externalPaymentId : `${event.externalPaymentId}#${part}`,
    });
    left -= amount;
  }
  return left > 0 ? `Sobrante sin aplicar: ${left}` : null;
}

async function applyCancellation(provider: string, event: Extract<WebhookResult, { type: "subscription_cancelled" }>) {
  const found = await businessForSubscription(provider, event.subscriptionExternalId);
  if (!found) return "Suscripción desconocida";
  const business: TenantScope = { organization: found.organization, settings: found.settings };
  await cancelEnrollment(business, found.enrollmentId, todayInZone(business.settings.timezone));
  await db.update(providerSubscriptions).set({ status: "cancelled" }).where(eq(providerSubscriptions.id, found.subscriptionId));
  return null;
}

/**
 * Full webhook flow: verify → log the event once (idempotent by event id) →
 * apply → record the outcome. Always answers quickly with a status code the
 * provider understands (2xx = don't retry).
 */
const MAX_WEBHOOK_BYTES = 64 * 1024;

export async function processWebhook(providerId: string, request: Request): Promise<WebhookResponse> {
  const provider = getPaymentProvider(providerId);
  if (!provider || provider.id === "manual") return { status: 404, body: { error: "unknown_provider" } };
  // Provider events are small; refuse anything big before reading it.
  // (Caddy also caps request bodies, which covers a missing/lying header.)
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BYTES) {
    return { status: 413, body: { error: "payload_too_large" } };
  }

  let event: WebhookResult;
  try {
    event = await provider.handleWebhook(request);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return { status: 401, body: { error: "invalid_signature" } };
    throw error;
  }

  const [logged] = await db
    .insert(paymentEvents)
    .values({ provider: provider.id, externalEventId: event.eventId, type: event.type, payload: event as unknown as Record<string, unknown> })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  if (!logged) return { status: 200, body: { duplicate: true } };

  let outcome: string | null = null;
  try {
    if (event.type === "payment_succeeded") outcome = await applyPayment(provider.id, event);
    else if (event.type === "subscription_cancelled") outcome = await applyCancellation(provider.id, event);
  } catch (error) {
    outcome = error instanceof Error ? error.message : String(error);
  }
  await db.update(paymentEvents).set({ processedAt: new Date(), error: outcome }).where(eq(paymentEvents.id, logged.id));
  return { status: 200, body: { received: true, ...(outcome ? { note: outcome } : {}) } };
}
