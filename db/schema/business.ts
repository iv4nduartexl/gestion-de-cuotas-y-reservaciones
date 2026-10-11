import { relations, sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { BUSINESS_TYPES, TEAM_MODES } from "../../lib/business-types";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../../lib/constants";
import { GRACE_UNITS } from "../../lib/membership-constants";
import { organization } from "./auth";

// Per-organization business configuration (1:1 with `organization`).
// `slug` is the canonical public URL segment (e.g. /mi-barberia) and is kept
// in sync with `organization.slug`.
export const businessSettings = pgTable(
  "business_settings",
  {
    organizationId: text()
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text().notNull().unique(),
    timezone: text().notNull().default(DEFAULT_TIMEZONE),
    // ISO 4217 code. Money columns elsewhere store integer minor units of it.
    currency: text().notNull().default(DEFAULT_CURRENCY),
    appointmentsEnabled: boolean().notNull().default(false),
    membershipsEnabled: boolean().notNull().default(false),
    // Drives defaults and UI wording (lib/business-types.ts).
    businessType: text({ enum: BUSINESS_TYPES }).notNull().default("otro"),
    // "solo": the owner is the only person taking appointments, and the UI
    // never mentions staff. "team": staff management is shown.
    teamMode: text({ enum: TEAM_MODES }).notNull().default("solo"),

    // Online booking rules (Configuración → Reservas online).
    // false: online bookings arrive as "pending" and the business confirms them.
    autoConfirmBookings: boolean().notNull().default(true),
    minNoticeMinutes: integer().notNull().default(60),
    maxDaysAhead: integer().notNull().default(60),
    slotIntervalMinutes: integer().notNull().default(15),
    bufferMinutes: integer().notNull().default(0),
    clientCancelNoticeHours: integer().notNull().default(4),

    // Public profile shown on the booking page.
    publicPhone: text(), // E.164
    address: text(),
    description: text(),

    // Memberships: tolerance after the due date before a cuota counts as
    // overdue (e.g. 5 days, 1 month), and the WhatsApp reminder text
    // ({nombre}, {plan}, {monto}, {vencimiento}).
    graceCount: integer().notNull().default(0),
    graceUnit: text({ enum: GRACE_UNITS }).notNull().default("day"),
    paymentReminderTemplate: text(),

    // Reminders (Configuración → Recordatorios).
    remindAppointments24h: boolean().notNull().default(true),
    remindAppointments2h: boolean().notNull().default(false),
    remindChargesDaysBefore: integer().notNull().default(3), // 0 = off
    remindChargesOnDue: boolean().notNull().default(true),
    remindChargesDaysAfter: integer().notNull().default(3), // 0 = off
    appointmentReminderTemplate: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "business_settings_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "business_settings_booking_rules",
      sql`${table.minNoticeMinutes} between 0 and 10080
        and ${table.maxDaysAhead} between 1 and 365
        and ${table.slotIntervalMinutes} in (5, 10, 15, 20, 30, 45, 60)
        and ${table.bufferMinutes} between 0 and 120
        and ${table.clientCancelNoticeHours} between 0 and 168
        and ${table.remindChargesDaysBefore} between 0 and 30
        and ${table.remindChargesDaysAfter} between 0 and 30`,
    ),
    check(
      "business_settings_grace",
      sql`(${table.graceUnit} = 'day' and ${table.graceCount} between 0 and 365)
        or (${table.graceUnit} = 'week' and ${table.graceCount} between 0 and 52)
        or (${table.graceUnit} = 'month' and ${table.graceCount} between 0 and 12)`,
    ),
    check(
      "business_settings_business_type",
      sql.raw(`business_type in (${BUSINESS_TYPES.map((t) => `'${t}'`).join(", ")})`),
    ),
    check(
      "business_settings_team_mode",
      sql.raw(`team_mode in (${TEAM_MODES.map((t) => `'${t}'`).join(", ")})`),
    ),
    check(
      "business_settings_currency_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const businessSettingsRelations = relations(
  businessSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [businessSettings.organizationId],
      references: [organization.id],
    }),
  }),
);
