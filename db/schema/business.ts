import { relations, sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { BUSINESS_TYPES, TEAM_MODES } from "../../lib/business-types";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../../lib/constants";
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
