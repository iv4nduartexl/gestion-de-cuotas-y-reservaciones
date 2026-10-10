import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { WebhookVerificationError, type PaymentProvider } from "./types";

// Test/dev-only provider: signs payloads with HMAC-SHA256 like real providers
// do, so the whole webhook path (signature, idempotency, applying payments)
// is exercised end to end.

export const FAKE_SIGNATURE_HEADER = "x-fake-signature";

const payloadSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("payment.succeeded"),
    subscriptionId: z.string().min(1),
    amount: z.number().int().positive(),
    currency: z.string().length(3),
    paidAt: z.iso.datetime(),
    paymentId: z.string().min(1),
  }),
  z.object({ id: z.string().min(1), type: z.literal("subscription.cancelled"), subscriptionId: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("other") }),
]);
export type FakePayload = z.infer<typeof payloadSchema>;

export function signFakePayload(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createFakeProvider(secret: string): PaymentProvider {
  return {
    id: "fake",
    async createSubscription() {
      return { externalId: `fake_sub_${randomUUID()}`, status: "active" };
    },
    async cancelSubscription() {},
    async handleWebhook(request) {
      const body = await request.text();
      const given = Buffer.from(request.headers.get(FAKE_SIGNATURE_HEADER) ?? "", "utf8");
      const expected = Buffer.from(signFakePayload(body, secret), "utf8");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new WebhookVerificationError("Invalid signature");
      }
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new WebhookVerificationError("Invalid JSON");
      }
      const parsed = payloadSchema.safeParse(json);
      if (!parsed.success) throw new WebhookVerificationError("Invalid payload");
      const event = parsed.data;
      switch (event.type) {
        case "payment.succeeded":
          return {
            type: "payment_succeeded",
            eventId: event.id,
            subscriptionExternalId: event.subscriptionId,
            amount: event.amount,
            currency: event.currency,
            paidAt: new Date(event.paidAt),
            externalPaymentId: event.paymentId,
          };
        case "subscription.cancelled":
          return { type: "subscription_cancelled", eventId: event.id, subscriptionExternalId: event.subscriptionId };
        default:
          return { type: "ignored", eventId: event.id };
      }
    },
  };
}
