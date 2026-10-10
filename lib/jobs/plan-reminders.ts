import "server-only";

import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { appointments, charges, clients, reminders } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import { addDays } from "@/lib/billing";
import type { TenantScope } from "@/lib/data/scope";
import { todayInZone, zonedToUtc } from "@/lib/datetime";
import type { ReminderChannel, ReminderKind } from "@/lib/reminder-constants";

const HOUR = 3_600_000;
const MINUTE = 60_000;
/** Overdue reminders are still planned if the job missed up to a week. */
const OVERDUE_CATCH_UP_DAYS = 7;

type NewReminder = {
  organizationId: string;
  kind: ReminderKind;
  appointmentId?: string;
  chargeId?: string;
  clientId: string;
  scheduledFor: Date;
  channel: ReminderChannel;
};

/**
 * Clients with an email get it automatically; the rest (or those who
 * unsubscribed from emails) go to the WhatsApp tray.
 */
export function channelFor(client: { email: string | null; emailOptOutAt?: Date | null }): ReminderChannel {
  return client.email && !client.emailOptOutAt ? "email" : "whatsapp_manual";
}

/**
 * Decides which appointment reminders are due for these turnos.
 * - 24 h: for turnos 3–25 h away (no "mañana" reminder for same-day bookings)
 * - 2 h: for turnos 30 min–2 h 15 min away
 */
export function appointmentReminderKinds(
  startsAt: Date,
  now: Date,
  settings: { remindAppointments24h: boolean; remindAppointments2h: boolean },
): { kind: ReminderKind; scheduledFor: Date }[] {
  const ahead = startsAt.getTime() - now.getTime();
  const result: { kind: ReminderKind; scheduledFor: Date }[] = [];
  if (settings.remindAppointments24h && ahead >= 3 * HOUR && ahead <= 25 * HOUR) {
    result.push({ kind: "appointment_24h", scheduledFor: new Date(Math.max(startsAt.getTime() - 24 * HOUR, now.getTime())) });
  }
  if (settings.remindAppointments2h && ahead >= 30 * MINUTE && ahead <= 2 * HOUR + 15 * MINUTE) {
    result.push({ kind: "appointment_2h", scheduledFor: new Date(Math.max(startsAt.getTime() - 2 * HOUR, now.getTime())) });
  }
  return result;
}

/** Which cuota reminder applies on `today` for a cuota due on `dueDate` (calendar dates). */
export function chargeReminderKind(
  dueDate: string,
  today: string,
  settings: { remindChargesDaysBefore: number; remindChargesOnDue: boolean; remindChargesDaysAfter: number },
): ReminderKind | null {
  if (settings.remindChargesDaysBefore > 0 && dueDate > today && dueDate <= addDays(today, settings.remindChargesDaysBefore)) {
    return "charge_upcoming";
  }
  if (settings.remindChargesOnDue && dueDate === today) return "charge_due";
  if (settings.remindChargesDaysAfter > 0) {
    const threshold = addDays(today, -settings.remindChargesDaysAfter);
    if (dueDate <= threshold && dueDate > addDays(threshold, -OVERDUE_CATCH_UP_DAYS)) return "charge_overdue";
  }
  return null;
}

/** Plans reminders for one business. Idempotent (unique per target + kind). */
export async function planRemindersFor(business: TenantScope, now: Date) {
  const { settings } = business;
  const org = business.organization.id;
  const rows: NewReminder[] = [];

  if (settings.appointmentsEnabled && (settings.remindAppointments24h || settings.remindAppointments2h)) {
    const upcoming = await db
      .select({ id: appointments.id, startsAt: appointments.startsAt, clientId: appointments.clientId, email: clients.email, emailOptOutAt: clients.emailOptOutAt })
      .from(appointments)
      .innerJoin(clients, and(eq(clients.id, appointments.clientId), eq(clients.organizationId, appointments.organizationId)))
      .where(
        and(
          eq(appointments.organizationId, org),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          gt(appointments.startsAt, now),
          lte(appointments.startsAt, new Date(now.getTime() + 25 * HOUR)),
        ),
      );
    for (const turno of upcoming) {
      for (const { kind, scheduledFor } of appointmentReminderKinds(turno.startsAt, now, settings)) {
        rows.push({ organizationId: org, kind, appointmentId: turno.id, clientId: turno.clientId, scheduledFor, channel: channelFor(turno) });
      }
    }
  }

  if (settings.membershipsEnabled) {
    const today = todayInZone(settings.timezone, now);
    const from = addDays(today, -(settings.remindChargesDaysAfter + OVERDUE_CATCH_UP_DAYS));
    const to = addDays(today, settings.remindChargesDaysBefore);
    const pending = await db
      .select({ id: charges.id, dueDate: charges.dueDate, clientId: charges.clientId, email: clients.email, emailOptOutAt: clients.emailOptOutAt })
      .from(charges)
      .innerJoin(clients, and(eq(clients.id, charges.clientId), eq(clients.organizationId, charges.organizationId)))
      // Archived clients are no longer reminded about cuotas.
      .where(
        and(
          eq(charges.organizationId, org),
          eq(charges.status, "pending"),
          isNull(clients.archivedAt),
          gt(charges.dueDate, from),
          lte(charges.dueDate, to),
        ),
      );
    // Cuota reminders go out at 09:00 local time (or now, if later).
    const morning = zonedToUtc(today, "09:00", settings.timezone);
    const scheduledFor = new Date(Math.max(morning.getTime(), now.getTime()));
    for (const charge of pending) {
      const kind = chargeReminderKind(charge.dueDate, today, settings);
      if (kind) rows.push({ organizationId: org, kind, chargeId: charge.id, clientId: charge.clientId, scheduledFor, channel: channelFor(charge) });
    }
  }

  if (rows.length === 0) return 0;
  const inserted = await db.insert(reminders).values(rows).onConflictDoNothing().returning({ id: reminders.id });
  return inserted.length;
}
