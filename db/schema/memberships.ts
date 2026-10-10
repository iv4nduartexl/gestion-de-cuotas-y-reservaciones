import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  CHARGE_STATUSES,
  ENROLLMENT_STATUSES,
  INTERVAL_UNITS,
  PAYMENT_METHODS,
} from "../../lib/membership-constants";
import { user } from "./auth";
import { organizationIdColumn, timestamps } from "./columns";
import { clients } from "./domain";

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

/** A membership plan, e.g. "Musculación mensual · Gs. 150.000". */
export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    name: text().notNull(),
    description: text(),
    price: integer().notNull(),
    currency: text().notNull(),
    intervalUnit: text({ enum: INTERVAL_UNITS }).notNull(),
    intervalCount: integer().notNull().default(1),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("plans_org_id_unique").on(t.organizationId, t.id),
    index("plans_org_name_idx").on(t.organizationId, t.name),
    check("plans_price_non_negative", sql`${t.price} >= 0`),
    check("plans_interval_unit", inList("interval_unit", INTERVAL_UNITS)),
    check("plans_interval_count", sql`${t.intervalCount} between 1 and 12`),
    check("plans_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** A client subscribed to a plan. Cuotas fall due on the start day of each period. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    clientId: uuid().notNull(),
    planId: uuid().notNull(),
    status: text({ enum: ENROLLMENT_STATUSES }).notNull().default("active"),
    /** Local calendar day that anchors the due dates. */
    startDate: date().notNull(),
    /**
     * Periods starting before this date are not generated (set when resuming
     * after a pause, so paused months are not billed).
     */
    billFrom: date().notNull(),
    /** Snapshot of the plan price (editable: personal discounts). */
    price: integer().notNull(),
    currency: text().notNull(),
    notes: text(),
    pausedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("enrollments_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "enrollments_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: "enrollments_plan_fk",
      columns: [t.organizationId, t.planId],
      foreignColumns: [plans.organizationId, plans.id],
    }),
    // One running enrollment per client and plan.
    uniqueIndex("enrollments_running_unique")
      .on(t.organizationId, t.clientId, t.planId)
      .where(sql`status in ('active', 'paused')`),
    index("enrollments_org_status_idx").on(t.organizationId, t.status),
    check("enrollments_status", inList("status", ENROLLMENT_STATUSES)),
    check("enrollments_price_non_negative", sql`${t.price} >= 0`),
    check("enrollments_bill_from", sql`${t.billFrom} >= ${t.startDate}`),
  ],
);

/** A cuota: one billing period of an enrollment. */
export const charges = pgTable(
  "charges",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    enrollmentId: uuid().notNull(),
    clientId: uuid().notNull(),
    periodStart: date().notNull(),
    periodEnd: date().notNull(),
    dueDate: date().notNull(),
    amount: integer().notNull(),
    currency: text().notNull(),
    status: text({ enum: CHARGE_STATUSES }).notNull().default("pending"),
    /** When the cuota became fully paid. */
    paidAt: timestamp({ withTimezone: true }),
    note: text(),
    ...timestamps,
  },
  (t) => [
    unique("charges_org_id_unique").on(t.organizationId, t.id),
    // Makes automatic generation idempotent.
    unique("charges_enrollment_period_unique").on(t.enrollmentId, t.periodStart),
    foreignKey({
      name: "charges_enrollment_fk",
      columns: [t.organizationId, t.enrollmentId],
      foreignColumns: [enrollments.organizationId, enrollments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "charges_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    index("charges_org_due_idx").on(t.organizationId, t.dueDate),
    index("charges_org_client_idx").on(t.organizationId, t.clientId),
    check("charges_status", inList("status", CHARGE_STATUSES)),
    check("charges_amount_non_negative", sql`${t.amount} >= 0`),
    check("charges_period_order", sql`${t.periodStart} < ${t.periodEnd}`),
  ],
);

/** A payment towards a cuota (several allowed: partial payments). */
export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    chargeId: uuid().notNull(),
    clientId: uuid().notNull(),
    amount: integer().notNull(),
    currency: text().notNull(),
    paidAt: timestamp({ withTimezone: true }).notNull(),
    method: text({ enum: PAYMENT_METHODS }).notNull(),
    reference: text(),
    // Online payments: which provider and its payment id (null = manual).
    provider: text(),
    externalId: text(),
    recordedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "payments_charge_fk",
      columns: [t.organizationId, t.chargeId],
      foreignColumns: [charges.organizationId, charges.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "payments_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    index("payments_charge_idx").on(t.chargeId),
    unique("payments_provider_external_unique").on(t.provider, t.externalId),
    index("payments_org_paid_idx").on(t.organizationId, t.paidAt),
    check("payments_amount_positive", sql`${t.amount} > 0`),
    check("payments_method", inList("method", PAYMENT_METHODS)),
  ],
);

export const plansRelations = relations(plans, ({ many }) => ({ enrollments: many(enrollments) }));
export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  plan: one(plans, { fields: [enrollments.planId], references: [plans.id] }),
  client: one(clients, { fields: [enrollments.clientId], references: [clients.id] }),
  charges: many(charges),
}));
export const chargesRelations = relations(charges, ({ one, many }) => ({
  enrollment: one(enrollments, { fields: [charges.enrollmentId], references: [enrollments.id] }),
  payments: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  charge: one(charges, { fields: [payments.chargeId], references: [charges.id] }),
}));
