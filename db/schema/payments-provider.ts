import { sql } from "drizzle-orm";
import { foreignKey, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { organizationIdColumn, timestamps } from "./columns";
import { enrollments } from "./memberships";

// Tables for online payment providers (Bancard, Pagopar...). Unused while
// every business uses the manual provider; see docs/payment-providers.md.

/** A business connected to a provider. Secrets never go here (env only). */
export const paymentProviderAccounts = pgTable(
  "payment_provider_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    provider: text().notNull(),
    status: text().notNull().default("active"),
    config: jsonb().$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [unique("payment_provider_accounts_org_provider_unique").on(t.organizationId, t.provider)],
);

/** An enrollment billed automatically by a provider. */
export const providerSubscriptions = pgTable(
  "provider_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    enrollmentId: uuid().notNull(),
    provider: text().notNull(),
    externalId: text().notNull(),
    status: text().notNull(),
    ...timestamps,
  },
  (t) => [
    unique("provider_subscriptions_external_unique").on(t.provider, t.externalId),
    foreignKey({
      name: "provider_subscriptions_enrollment_fk",
      columns: [t.organizationId, t.enrollmentId],
      foreignColumns: [enrollments.organizationId, enrollments.id],
    }).onDelete("cascade"),
  ],
);

/** Every webhook received, keyed by the provider's event id (idempotency). */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    externalEventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
  },
  (t) => [
    unique("payment_events_external_unique").on(t.provider, t.externalEventId),
    index("payment_events_received_idx").on(t.receivedAt),
  ],
);
