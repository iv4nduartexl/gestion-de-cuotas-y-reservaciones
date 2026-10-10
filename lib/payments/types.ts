// Contract every online payment provider implements (Bancard, Pagopar...).
// See docs/payment-providers.md.

export type SubscriptionInput = {
  business: { organizationId: string; name: string; currency: string };
  enrollment: { id: string; price: number; startDate: string };
  client: { id: string; name: string; email: string | null; phone: string };
  plan: { name: string; intervalUnit: "week" | "month"; intervalCount: number };
  returnUrl: string;
};

export type SubscriptionResult = {
  externalId: string;
  /** Where the client authorizes the recurring charge, if the provider needs it. */
  checkoutUrl?: string;
  status: "active" | "pending_authorization" | "manual";
};

export type WebhookResult =
  | {
      type: "payment_succeeded";
      eventId: string;
      subscriptionExternalId: string;
      /** Minor units of `currency` (PYG: whole guaraníes). */
      amount: number;
      currency: string;
      paidAt: Date;
      externalPaymentId: string;
    }
  | { type: "subscription_cancelled"; eventId: string; subscriptionExternalId: string }
  | { type: "ignored"; eventId: string };

/** Thrown when a webhook's signature or format is invalid (HTTP 401/400). */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export interface PaymentProvider {
  id: string;
  createSubscription(input: SubscriptionInput): Promise<SubscriptionResult>;
  cancelSubscription(input: { externalId: string }): Promise<void>;
  /** Verifies the signature and parses the provider's payload. */
  handleWebhook(request: Request): Promise<WebhookResult>;
}
