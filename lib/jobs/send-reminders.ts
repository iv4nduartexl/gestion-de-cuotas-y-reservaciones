import "server-only";

import { and, eq, inArray, isNotNull, lt, lte, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { appointments, businessSettings, charges, clients, enrollments, organization, plans, reminders, services } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import { formatCalendarDate, formatInZone } from "@/lib/datetime";
import { env } from "@/lib/env";
import { CHANNELS } from "@/lib/messaging/channels";
import { reminderEmail, type AppointmentReminderData, type ChargeReminderData } from "@/lib/messaging/templates";
import { formatMoney } from "@/lib/money";
import { createUnsubscribeToken } from "@/lib/unsubscribe";

const BATCH = 100;

function unsubscribeLinks(clientId: string) {
  const token = createUnsubscribeToken(clientId, env.BETTER_AUTH_SECRET);
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  return { page: `${origin}/baja/${token}`, oneClick: `${origin}/api/baja/${token}` };
}
export const MAX_ATTEMPTS = 3;

/** Marks pending reminders whose turno/cuota no longer needs one (cancelled, paid...). */
export async function skipStaleReminders(now: Date) {
  const staleAppointments = await db
    .update(reminders)
    .set({ status: "skipped" })
    .where(
      and(
        eq(reminders.status, "pending"),
        inArray(
          reminders.appointmentId,
          db
            .select({ id: appointments.id })
            .from(appointments)
            .where(sql`${appointments.status} not in ('pending', 'confirmed') or ${appointments.startsAt} <= ${now}`),
        ),
      ),
    )
    .returning({ id: reminders.id });
  const staleCharges = await db
    .update(reminders)
    .set({ status: "skipped" })
    .where(
      and(
        eq(reminders.status, "pending"),
        // Paid/voided cuota, or the client was archived.
        or(
          inArray(reminders.chargeId, db.select({ id: charges.id }).from(charges).where(notInArray(charges.status, ["pending"]))),
          and(
            isNotNull(reminders.chargeId),
            inArray(reminders.clientId, db.select({ id: clients.id }).from(clients).where(isNotNull(clients.archivedAt))),
          ),
        ),
      ),
    )
    .returning({ id: reminders.id });
  // Manual reminders nobody sent within 3 days are no longer useful.
  const expired = await db
    .update(reminders)
    .set({ status: "skipped" })
    .where(and(eq(reminders.status, "pending"), eq(reminders.channel, "whatsapp_manual"), lt(reminders.scheduledFor, new Date(now.getTime() - 3 * 86_400_000))))
    .returning({ id: reminders.id });
  return staleAppointments.length + staleCharges.length + expired.length;
}

type Row = {
  id: string;
  kind: (typeof reminders.$inferSelect)["kind"];
  channel: (typeof reminders.$inferSelect)["channel"];
  attempts: number;
  appointmentId: string | null;
  chargeId: string | null;
  clientId: string;
  clientName: string;
  clientEmailOptOutAt: Date | null;
  clientEmail: string | null;
  businessName: string;
  timezone: string;
  address: string | null;
};

async function buildMessage(row: Row): Promise<AppointmentReminderData | ChargeReminderData | null> {
  const nombre = row.clientName.split(" ")[0];
  if (row.appointmentId) {
    const [turno] = await db
      .select({ startsAt: appointments.startsAt, status: appointments.status, serviceName: services.name })
      .from(appointments)
      .innerJoin(services, and(eq(services.id, appointments.serviceId), eq(services.organizationId, appointments.organizationId)))
      .where(eq(appointments.id, row.appointmentId));
    if (!turno || !(ACTIVE_STATUSES as readonly string[]).includes(turno.status)) return null;
    return {
      kind: row.kind as AppointmentReminderData["kind"],
      nombre,
      servicio: turno.serviceName,
      negocio: row.businessName,
      dia: formatInZone(turno.startsAt, row.timezone, "EEEE dd/MM"),
      hora: formatInZone(turno.startsAt, row.timezone, "HH:mm"),
      // Only a hash of the private link token is stored, so the link can't be rebuilt here.
      link: null,
      direccion: row.address,
    };
  }
  const [charge] = await db
    .select({
      status: charges.status,
      amount: charges.amount,
      currency: charges.currency,
      dueDate: charges.dueDate,
      paid: sql<number>`coalesce((select sum(amount)::int from payments where payments.charge_id = ${charges.id}), 0)`,
      planName: sql<string>`coalesce(${charges.concept}, ${plans.name}, 'Cobro')`,
    })
    .from(charges)
    .leftJoin(enrollments, and(eq(enrollments.id, charges.enrollmentId), eq(enrollments.organizationId, charges.organizationId)))
    .leftJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
    .where(eq(charges.id, row.chargeId!));
  if (!charge || charge.status !== "pending") return null;
  return {
    kind: row.kind as ChargeReminderData["kind"],
    nombre,
    plan: charge.planName,
    negocio: row.businessName,
    monto: formatMoney(charge.amount - charge.paid, charge.currency),
    vencimiento: formatCalendarDate(charge.dueDate, "dd/MM/yyyy"),
    dias: 0,
  };
}

/**
 * Sends due reminders through automatic channels (email today). Rows are
 * locked with SKIP LOCKED, so parallel runs never pick the same reminder.
 */
export async function sendDueReminders(now: Date) {
  const automatic = Object.values(CHANNELS).filter((channel) => channel.automatic).map((channel) => channel.id);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    const due = await tx
      .select({
        id: reminders.id,
        kind: reminders.kind,
        channel: reminders.channel,
        attempts: reminders.attempts,
        appointmentId: reminders.appointmentId,
        chargeId: reminders.chargeId,
        clientId: reminders.clientId,
        clientName: clients.name,
        clientEmailOptOutAt: clients.emailOptOutAt,
        clientEmail: clients.email,
        businessName: organization.name,
        timezone: businessSettings.timezone,
        address: businessSettings.address,
      })
      .from(reminders)
      .innerJoin(clients, and(eq(clients.id, reminders.clientId), eq(clients.organizationId, reminders.organizationId)))
      .innerJoin(organization, eq(organization.id, reminders.organizationId))
      .innerJoin(businessSettings, eq(businessSettings.organizationId, reminders.organizationId))
      .where(and(eq(reminders.status, "pending"), inArray(reminders.channel, automatic), lte(reminders.scheduledFor, now)))
      .orderBy(reminders.scheduledFor)
      .limit(BATCH)
      .for("update", { of: reminders, skipLocked: true });

    for (const row of due) {
      const data = await buildMessage(row);
      if (!data || (row.channel === "email" && !row.clientEmail)) {
        await tx.update(reminders).set({ status: "skipped" }).where(eq(reminders.id, row.id));
        skipped++;
        continue;
      }
      if (row.channel === "email" && row.clientEmailOptOutAt) {
        // Unsubscribed after it was planned: the business sends it by WhatsApp instead.
        await tx.update(reminders).set({ channel: "whatsapp_manual" }).where(eq(reminders.id, row.id));
        continue;
      }
      const result = await CHANNELS[row.channel].send(reminderEmail(row.clientEmail ?? "", data, { unsubscribe: unsubscribeLinks(row.clientId) }));
      if (result.ok) {
        await tx.update(reminders).set({ status: "sent", sentAt: now, attempts: row.attempts + 1, lastError: null }).where(eq(reminders.id, row.id));
        sent++;
      } else {
        const attempts = row.attempts + 1;
        await tx
          .update(reminders)
          .set({ attempts, lastError: result.error.slice(0, 500), status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" })
          .where(eq(reminders.id, row.id));
        if (attempts >= MAX_ATTEMPTS) failed++;
      }
    }
  });
  return { sent, failed, skipped };
}
