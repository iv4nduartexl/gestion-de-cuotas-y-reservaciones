# Payment providers

Online payments go through one interface, `PaymentProvider` (`lib/payments/types.ts`). The domain never knows which provider is behind it: a payment that arrives by webhook ends up as a regular row in `payments` (method `online`), exactly like a payment recorded by hand.

```ts
interface PaymentProvider {
  id: string;
  createSubscription(input): Promise<{ externalId; status; checkoutUrl? }>;
  cancelSubscription(input): Promise<void>;
  handleWebhook(request: Request): Promise<WebhookResult>; // verify + parse only
}
```

Two providers ship today:

| Provider | Use |
| --- | --- |
| `manual` | Default. Payments are recorded by hand in Cuotas; no subscriptions, no webhooks. |
| `fake` | Development and tests only. HMAC-signed webhooks (`x-fake-signature`), so the full flow can be tested end to end. Enabled with `FAKE_PROVIDER_SECRET`. |

## Flow

1. **Enroll.** If the business has an active `payment_provider_accounts` row for a non-manual provider, `startProviderSubscription` calls `createSubscription`. It stores the returned id in `provider_subscriptions`. With only `manual`, nothing happens.
2. **Webhook.** The provider calls `POST /api/payments/webhook/<provider>`. `processWebhook` (`lib/payments/webhooks.ts`):
   - returns 404 if the provider is unknown or not enabled in `PAYMENT_PROVIDERS`
   - calls `handleWebhook`, which must verify the signature; on failure it throws `WebhookVerificationError`, and the route answers 401
   - stores the event in `payment_events`; `(provider, external_event_id)` is unique, so a retried event returns 200 with `duplicate: true` and changes nothing
   - applies the event:
     - `payment_succeeded`: finds the subscription, then its enrollment, generates due cuotas, and pays the oldest unpaid cuotas through `recordPayment` (method `online`, `provider`, `externalId`). A payment larger than what is owed is noted on the event, not applied.
     - `subscription_cancelled`: cancels the enrollment.
   - marks the event `processed_at` (or stores the `error`).
3. **Cancel.** Cancelling an enrollment in the dashboard calls `cancelSubscription` for its active provider subscriptions.

The business is always derived from the stored subscription, never from the webhook body. A webhook can only touch the business that owns the subscription.

## Adding a provider (Bancard, Pagopar, Dinelco…)

1. Create `lib/payments/<name>.ts` that implements `PaymentProvider`:
   - `createSubscription`: create the recurring charge or card token at the provider and return its id. Return `checkoutUrl` if the client must authorize it, with status `pending_authorization`.
   - `cancelSubscription`: cancel at the provider; it must be idempotent.
   - `handleWebhook`: **verify the signature first** (with `timingSafeEqual`), then parse with Zod and map to a `WebhookResult`. Amounts must be integers in the currency's minor unit; PYG has no decimals.
2. Add its id to `PAYMENT_PROVIDER_IDS` (`lib/reminder-constants.ts`), and to the registry in `lib/payments/registry.ts`, with its secrets read from `lib/env.ts` (validated with Zod).
3. Enable it with `PAYMENT_PROVIDERS=manual,<name>`, then give each business a row in `payment_provider_accounts` (`status = 'active'`). `config` holds non-secret settings only.
4. Point the provider's webhook URL to `https://your-domain/api/payments/webhook/<name>`.
5. Add tests modelled on `tests/integration/jobs.test.ts` (fake provider): valid, tampered and replayed webhooks; payment on the right cuota; foreign subscription ids.

### Security checklist
- Signature checked before anything else; reject unsigned requests.
- Events are idempotent (`payment_events` unique key); never trust event order.
- The currency must match the cuota's currency; mismatches are recorded as errors.
- Secrets live only in env vars, never in `payment_provider_accounts.config`.
- Respond 2xx quickly. Heavy work belongs in the scheduled job.
