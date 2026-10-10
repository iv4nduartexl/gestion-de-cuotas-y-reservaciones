import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { member } from "./auth";
import { organizationIdColumn, timestamps } from "./columns";

// Tenant integrity: every parent table has unique(organization_id, id), and
// children reference it with composite foreign keys, so the database rejects
// rows that link records from two different organizations.

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    name: text().notNull(),
    // E.164 (e.g. +595981123456), normalized by lib/phone.ts.
    phone: text().notNull(),
    email: text(),
    // Paraguayan cédula or other ID document.
    documentNumber: text(),
    notes: text(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("clients_org_id_unique").on(t.organizationId, t.id),
    unique("clients_org_phone_unique").on(t.organizationId, t.phone),
    index("clients_org_name_idx").on(t.organizationId, t.name),
    check("clients_phone_format", sql`${t.phone} ~ '^\\+[1-9][0-9]{6,14}$'`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    name: text().notNull(),
    description: text(),
    durationMinutes: integer().notNull(),
    // Integer amount in the currency's minor unit (PYG has none).
    price: integer().notNull(),
    currency: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("services_org_id_unique").on(t.organizationId, t.id),
    index("services_org_name_idx").on(t.organizationId, t.name),
    check(
      "services_duration_range",
      sql`${t.durationMinutes} between 5 and 720 and ${t.durationMinutes} % 5 = 0`,
    ),
    check("services_price_non_negative", sql`${t.price} >= 0`),
    check("services_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

// People who take appointments. Optionally linked to a dashboard user.
export const staff = pgTable(
  "staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    name: text().notNull(),
    memberId: text()
      .unique()
      .references(() => member.id, { onDelete: "set null" }),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("staff_org_id_unique").on(t.organizationId, t.id),
    index("staff_org_name_idx").on(t.organizationId, t.name),
  ],
);

export const serviceStaff = pgTable(
  "service_staff",
  {
    organizationId: organizationIdColumn(),
    serviceId: uuid().notNull(),
    staffId: uuid().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.staffId] }),
    foreignKey({
      name: "service_staff_service_fk",
      columns: [t.organizationId, t.serviceId],
      foreignColumns: [services.organizationId, services.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "service_staff_staff_fk",
      columns: [t.organizationId, t.staffId],
      foreignColumns: [staff.organizationId, staff.id],
    }).onDelete("cascade"),
    index("service_staff_staff_idx").on(t.staffId),
  ],
);

// Weekly working hours per staff member. Times are wall-clock times in the
// business timezone (business_settings.timezone). Overlapping ranges for the
// same staff/weekday are rejected by an exclusion constraint (see migration
// 0002_availability_exclusion.sql).
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    staffId: uuid().notNull(),
    // ISO weekday: 1 = Monday ... 7 = Sunday.
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "availability_rules_staff_fk",
      columns: [t.organizationId, t.staffId],
      foreignColumns: [staff.organizationId, staff.id],
    }).onDelete("cascade"),
    index("availability_rules_staff_idx").on(t.staffId, t.weekday),
    check("availability_rules_weekday", sql`${t.weekday} between 1 and 7`),
    check("availability_rules_time_order", sql`${t.startTime} < ${t.endTime}`),
  ],
);

// Time off. staffId = null blocks the whole business (e.g. holidays).
export const blockedSlots = pgTable(
  "blocked_slots",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    staffId: uuid(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: text(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "blocked_slots_staff_fk",
      columns: [t.organizationId, t.staffId],
      foreignColumns: [staff.organizationId, staff.id],
    }).onDelete("cascade"),
    index("blocked_slots_org_starts_idx").on(t.organizationId, t.startsAt),
    check("blocked_slots_time_order", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const servicesRelations = relations(services, ({ many }) => ({
  serviceStaff: many(serviceStaff),
}));

export const staffRelations = relations(staff, ({ many, one }) => ({
  serviceStaff: many(serviceStaff),
  availabilityRules: many(availabilityRules),
  member: one(member, { fields: [staff.memberId], references: [member.id] }),
}));

export const serviceStaffRelations = relations(serviceStaff, ({ one }) => ({
  service: one(services, {
    fields: [serviceStaff.serviceId],
    references: [services.id],
  }),
  staff: one(staff, { fields: [serviceStaff.staffId], references: [staff.id] }),
}));

export const availabilityRulesRelations = relations(
  availabilityRules,
  ({ one }) => ({
    staff: one(staff, {
      fields: [availabilityRules.staffId],
      references: [staff.id],
    }),
  }),
);
