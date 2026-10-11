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
  BILLING_TIMINGS,
  CHARGE_KINDS,
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
    /** Default for new enrollments: pay at the start or the end of each period. */
    billingTiming: text({ enum: BILLING_TIMINGS }).notNull().default("advance"),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("plans_org_id_unique").on(t.organizationId, t.id),
    index("plans_org_name_idx").on(t.organizationId, t.name),
    check("plans_price_non_negative", sql`${t.price} >= 0`),
    check("plans_interval_unit", inList("interval_unit", INTERVAL_UNITS)),
    check("plans_interval_count", sql`${t.intervalCount} between 1 and 365`),
    check("plans_billing_timing", inList("billing_timing", BILLING_TIMINGS)),
    check("plans_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** A client subscribed to a plan. Cuotas fall due at the start (or end) of each period. */
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
    /** Pay at the start ("advance") or the end ("arrears") of each period. */
    billingTiming: text({ enum: BILLING_TIMINGS }).notNull().default("advance"),
    /** Optional due date of the very first cuota (e.g. "paga el 15"). */
    firstDueDate: date(),
    /** "Socio desde": kept when the billing day is re-anchored (startDate moves). */
    memberSince: date(),
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
    check("enrollments_billing_timing", inList("billing_timing", BILLING_TIMINGS)),
    check("enrollments_first_due", sql`${t.firstDueDate} is null or ${t.firstDueDate} >= ${t.startDate}`),
  ],
);

/**
 * Something a client owes: a cuota (one billing period of an enrollment), a
 * one-off charge, or a part of a split cuota.
 */
export const charges = pgTable(
  "charges",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    kind: text({ enum: CHARGE_KINDS }).notNull().default("cuota"),
    /** Null for one-off charges. */
    enrollmentId: uuid(),
    clientId: uuid().notNull(),
    /** Cuotas only. */
    periodStart: date(),
    periodEnd: date(),
    /** What it is for (one-off charges and parts), e.g. "Matrícula". */
    concept: text(),
    /** Parts: the cuota they were split from. */
    parentChargeId: uuid(),
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
    foreignKey({
      name: "charges_parent_fk",
      columns: [t.organizationId, t.parentChargeId],
      foreignColumns: [t.organizationId, t.id],
    }),
    index("charges_org_due_idx").on(t.organizationId, t.dueDate),
    index("charges_org_client_idx").on(t.organizationId, t.clientId),
    check("charges_status", inList("status", CHARGE_STATUSES)),
    check("charges_amount_non_negative", sql`${t.amount} >= 0`),
    check("charges_period_order", sql`${t.periodStart} < ${t.periodEnd}`),
    check("charges_kind", inList("kind", CHARGE_KINDS)),
    check(
      "charges_kind_fields",
      sql`(${t.kind} = 'cuota' and ${t.enrollmentId} is not null and ${t.periodStart} is not null and ${t.periodEnd} is not null)
        or (${t.kind} = 'one_off' and ${t.concept} is not null and ${t.periodStart} is null)
        or (${t.kind} = 'part' and ${t.concept} is not null and ${t.parentChargeId} is not null and ${t.periodStart} is null)`,
    ),
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
