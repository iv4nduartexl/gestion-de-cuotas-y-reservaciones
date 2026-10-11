import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUSES,
  CANCELLED_BY,
} from "../../lib/appointment-status";
import { organizationIdColumn, timestamps } from "./columns";
import { clients, services, staff } from "./domain";

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

// A booked turno. Overlapping active turnos (pending/confirmed) for the same
// staff member are rejected by an exclusion constraint (migration
// 0005_appointments_exclusion.sql), which is what prevents double booking.
export const appointments = pgTable(
  "appointments",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    clientId: uuid().notNull(),
    serviceId: uuid().notNull(),
    // "slot": a turno with a staff member. "stay": a rental of the service
    // itself (no staff); overlapping stays of the same service are rejected by
    // an exclusion constraint (migration 0013).
    kind: text({ enum: ["slot", "stay"] }).notNull().default("slot"),
    staffId: uuid(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: text({ enum: APPOINTMENT_STATUSES }).notNull().default("confirmed"),
    source: text({ enum: APPOINTMENT_SOURCES }).notNull(),
    // Snapshot at booking time: later price changes don't rewrite history.
    price: integer().notNull(),
    currency: text().notNull(),
    notes: text(),
    // Online bookings: the name the visitor typed. The client is matched by
    // phone and may be stored under another name, which must not be shown
    // to whoever holds the private link.
    bookedName: text(),
    internalNotes: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledBy: text({ enum: CANCELLED_BY }),
    cancellationReason: text(),
    // sha256 of the client's private link token (online bookings only).
    manageTokenHash: text().unique(),
    ...timestamps,
  },
  (t) => [
    unique("appointments_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "appointments_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: "appointments_service_fk",
      columns: [t.organizationId, t.serviceId],
      foreignColumns: [services.organizationId, services.id],
    }),
    foreignKey({
      name: "appointments_staff_fk",
      columns: [t.organizationId, t.staffId],
      foreignColumns: [staff.organizationId, staff.id],
    }),
    index("appointments_org_starts_idx").on(t.organizationId, t.startsAt),
    index("appointments_org_staff_starts_idx").on(t.organizationId, t.staffId, t.startsAt),
    index("appointments_org_client_starts_idx").on(t.organizationId, t.clientId, t.startsAt),
    check("appointments_time_order", sql`${t.startsAt} < ${t.endsAt}`),
    check("appointments_status", inList("status", APPOINTMENT_STATUSES)),
    check("appointments_source", inList("source", APPOINTMENT_SOURCES)),
    check(
      "appointments_cancelled_by",
      sql`cancelled_by is null or ${inList("cancelled_by", CANCELLED_BY)}`,
    ),
    check("appointments_price_non_negative", sql`${t.price} >= 0`),
    check("appointments_kind", sql`(${t.kind} = 'slot' and ${t.staffId} is not null) or (${t.kind} = 'stay' and ${t.staffId} is null)`),
    index("appointments_org_service_starts_idx").on(t.organizationId, t.serviceId, t.startsAt),
  ],
);

// Online booking attempts, for rate limiting (no external service).
export const bookingAttempts = pgTable(
  "booking_attempts",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    ipHash: text().notNull(),
    phone: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_attempts_ip_idx").on(t.ipHash, t.createdAt),
    index("booking_attempts_phone_idx").on(t.organizationId, t.phone, t.createdAt),
  ],
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  client: one(clients, { fields: [appointments.clientId], references: [clients.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  staff: one(staff, { fields: [appointments.staffId], references: [staff.id] }),
}));
