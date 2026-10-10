import { WebhookVerificationError, type PaymentProvider } from "./types";

/** Today's behavior: payments are recorded by hand in the dashboard. */
export const manualProvider: PaymentProvider = {
  id: "manual",
  async createSubscription({ enrollment }) {
    return { externalId: `manual:${enrollment.id}`, status: "manual" };
  },
  async cancelSubscription() {},
  async handleWebhook() {
    throw new WebhookVerificationError("The manual provider has no webhooks.");
  },
};
