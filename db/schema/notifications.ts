import { relations, sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { REMINDER_CHANNELS, REMINDER_KINDS, REMINDER_STATUSES } from "../../lib/reminder-constants";
import { appointments } from "./appointments";
import { organizationIdColumn, timestamps } from "./columns";
import { clients } from "./domain";
import { charges } from "./memberships";

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

/**
 * Reminder outbox: one row per (turno or cuota, kind). The unique keys make
 * the scheduled job idempotent: a reminder is planned and sent only once.
 */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    kind: text({ enum: REMINDER_KINDS }).notNull(),
    appointmentId: uuid(),
    chargeId: uuid(),
    clientId: uuid().notNull(),
    scheduledFor: timestamp({ withTimezone: true }).notNull(),
    channel: text({ enum: REMINDER_CHANNELS }).notNull(),
    status: text({ enum: REMINDER_STATUSES }).notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    sentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("reminders_kind_appointment_unique").on(t.kind, t.appointmentId),
    unique("reminders_kind_charge_unique").on(t.kind, t.chargeId),
    foreignKey({
      name: "reminders_appointment_fk",
      columns: [t.organizationId, t.appointmentId],
      foreignColumns: [appointments.organizationId, appointments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "reminders_charge_fk",
      columns: [t.organizationId, t.chargeId],
      foreignColumns: [charges.organizationId, charges.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "reminders_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("cascade"),
    index("reminders_due_idx").on(t.status, t.channel, t.scheduledFor),
    index("reminders_org_scheduled_idx").on(t.organizationId, t.scheduledFor),
    check("reminders_kind", inList("kind", REMINDER_KINDS)),
    check("reminders_channel", inList("channel", REMINDER_CHANNELS)),
    check("reminders_status", inList("status", REMINDER_STATUSES)),
    check("reminders_one_target", sql`(${t.appointmentId} is null) <> (${t.chargeId} is null)`),
  ],
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  appointment: one(appointments, { fields: [reminders.appointmentId], references: [appointments.id] }),
  charge: one(charges, { fields: [reminders.chargeId], references: [charges.id] }),
  client: one(clients, { fields: [reminders.clientId], references: [clients.id] }),
}));
