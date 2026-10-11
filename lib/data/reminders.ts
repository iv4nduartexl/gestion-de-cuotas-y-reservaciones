import "server-only";

import { and, count, desc, eq, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { appointments, businessSettings, charges, clients, enrollments, plans, reminders, services } from "@/db/schema";
import { PAGE_SIZE, type TenantScope } from "@/lib/data/scope";
import { addDaysToDate, formatCalendarDate, formatInZone, todayInZone, zonedToUtc } from "@/lib/datetime";
import { reminderReason, whatsappText, type AppointmentReminderData, type ChargeReminderData } from "@/lib/messaging/templates";
import { formatMoney } from "@/lib/money";
import { getStaffForMember } from "@/lib/data/staff";
import { whatsappUrl } from "@/lib/phone";
import { DEFAULT_APPOINTMENT_TEMPLATE, type ReminderKind, type ReminderStatus } from "@/lib/reminder-constants";
import type { TenantContext } from "@/lib/tenant";

/**
 * Who may act on which reminders: members only see turno reminders of their
 * own staff record (cuota reminders are shared, like the Cuotas page).
 * `staffId` null = no restriction.
 */
export type ReminderAccess = { staffId: string | null };

/** Members only handle turno reminders of their own staff record. */
export async function reminderAccessFor(ctx: TenantContext): Promise<ReminderAccess> {
  if (ctx.role !== "member") return { staffId: null };
  const own = await getStaffForMember(ctx, ctx.memberId);
  // A member without a staff record matches no turno.
  return { staffId: own?.id ?? NO_STAFF };
}
const NO_STAFF = "00000000-0000-0000-0000-000000000000";

function accessFilter(access: ReminderAccess): SQL | undefined {
  if (access.staffId === null) return undefined;
  return or(isNull(reminders.appointmentId), eq(appointments.staffId, access.staffId));
}

/** End of the business's current day: the tray shows everything due before it. */
function endOfToday(ctx: TenantScope, now: Date) {
  return zonedToUtc(addDaysToDate(todayInZone(ctx.settings.timezone, now), 1), "00:00", ctx.settings.timezone);
}

const paidSum = sql<number>`coalesce((select sum(amount)::int from payments where payments.charge_id = ${charges.id}), 0)`;

function baseQuery() {
  return db
    .select({
      id: reminders.id,
      kind: reminders.kind,
      channel: reminders.channel,
      status: reminders.status,
      scheduledFor: reminders.scheduledFor,
      sentAt: reminders.sentAt,
      lastError: reminders.lastError,
      updatedAt: reminders.updatedAt,
      appointmentId: reminders.appointmentId,
      chargeId: reminders.chargeId,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      startsAt: appointments.startsAt,
      serviceName: services.name,
      dueDate: charges.dueDate,
      amount: charges.amount,
      currency: charges.currency,
      paid: paidSum,
      planName: sql<string | null>`coalesce(${charges.concept}, ${plans.name})`,
    })
    .from(reminders)
    .innerJoin(clients, and(eq(clients.id, reminders.clientId), eq(clients.organizationId, reminders.organizationId)))
    .leftJoin(appointments, and(eq(appointments.id, reminders.appointmentId), eq(appointments.organizationId, reminders.organizationId)))
    .leftJoin(services, and(eq(services.id, appointments.serviceId), eq(services.organizationId, appointments.organizationId)))
    .leftJoin(charges, and(eq(charges.id, reminders.chargeId), eq(charges.organizationId, reminders.organizationId)))
    .leftJoin(enrollments, and(eq(enrollments.id, charges.enrollmentId), eq(enrollments.organizationId, charges.organizationId)))
    .leftJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
    .$dynamic();
}

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["execute"]>>[number];

export type ReminderItem = {
  id: string;
  kind: ReminderKind;
  group: "turnos" | "cuotas";
  status: ReminderStatus;
  channel: BaseRow["channel"];
  clientId: string;
  clientName: string;
  reason: string;
  detail: string;
  whatsappHref: string;
  sentAt: Date | null;
  lastError: string | null;
  updatedAt: Date;
};

function toItem(ctx: TenantScope, row: BaseRow): ReminderItem {
  const tz = ctx.settings.timezone;
  const nombre = row.clientName.split(" ")[0];
  const negocio = ctx.organization.name;
  let data: AppointmentReminderData | ChargeReminderData;
  let detail: string;
  if (row.appointmentId && row.startsAt) {
    data = {
      kind: row.kind as AppointmentReminderData["kind"],
      nombre,
      servicio: row.serviceName ?? "",
      negocio,
      dia: formatInZone(row.startsAt, tz, "EEEE dd/MM"),
      hora: formatInZone(row.startsAt, tz, "HH:mm"),
      link: null,
      direccion: ctx.settings.address,
    };
    detail = `${row.serviceName} · ${formatInZone(row.startsAt, tz, "EEE dd/MM · HH:mm")}`;
  } else {
    const remaining = Math.max(0, (row.amount ?? 0) - row.paid);
    const monto = formatMoney(remaining, row.currency ?? ctx.settings.currency);
    const vencimiento = formatCalendarDate(row.dueDate ?? "", "dd/MM/yyyy");
    data = { kind: row.kind as ChargeReminderData["kind"], nombre, plan: row.planName ?? "", negocio, monto, vencimiento, dias: 0 };
    detail = `${row.planName} · ${monto} · vence ${vencimiento}`;
  }
  const text = whatsappText(data, {
    appointment: ctx.settings.appointmentReminderTemplate,
    overdue: ctx.settings.paymentReminderTemplate,
    defaultAppointment: DEFAULT_APPOINTMENT_TEMPLATE,
  });
  return {
    id: row.id,
    kind: row.kind,
    group: row.appointmentId ? "turnos" : "cuotas",
    status: row.status,
    channel: row.channel,
    clientId: row.clientId,
    clientName: row.clientName,
    reason: reminderReason(row.kind),
    detail,
    whatsappHref: whatsappUrl(row.clientPhone, text),
    sentAt: row.sentAt,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
  };
}

function trayWhere(ctx: TenantScope, access: ReminderAccess, now: Date) {
  return and(
    eq(reminders.organizationId, ctx.organization.id),
    eq(reminders.channel, "whatsapp_manual"),
    eq(reminders.status, "pending"),
    lt(reminders.scheduledFor, endOfToday(ctx, now)),
    accessFilter(access),
  );
}

/** Manual WhatsApp reminders to send today, oldest first. */
export async function listTrayReminders(ctx: TenantScope, access: ReminderAccess, now = new Date()) {
  const rows = await baseQuery().where(trayWhere(ctx, access, now)).orderBy(reminders.scheduledFor, clients.name);
  return rows.map((row) => toItem(ctx, row));
}

/** How many manual reminders are waiting today (nav badge, Inicio card). */
export async function countTrayReminders(ctx: TenantScope, access: ReminderAccess, now = new Date()) {
  const [row] = await db
    .select({ n: count() })
    .from(reminders)
    .leftJoin(appointments, and(eq(appointments.id, reminders.appointmentId), eq(appointments.organizationId, reminders.organizationId)))
    .where(trayWhere(ctx, access, now));
  return row?.n ?? 0;
}

/** Everything that already happened (sent, done by hand, skipped, failed), newest first. */
export async function listReminderHistory(ctx: TenantScope, access: ReminderAccess, { page = 1 }: { page?: number } = {}) {
  const where = and(eq(reminders.organizationId, ctx.organization.id), ne(reminders.status, "pending"), accessFilter(access));
  const [rows, [total]] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(desc(reminders.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(reminders)
      .leftJoin(appointments, and(eq(appointments.id, reminders.appointmentId), eq(appointments.organizationId, reminders.organizationId)))
      .where(where),
  ]);
  return { rows: rows.map((row) => toItem(ctx, row)), page, pageCount: Math.max(1, Math.ceil(total.n / PAGE_SIZE)) };
}

/** Ids among `ids` this user may act on (same business, access rules). */
async function allowedIds(ctx: TenantScope, access: ReminderAccess, ids: string[], status: ReminderStatus) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: reminders.id })
    .from(reminders)
    .leftJoin(appointments, and(eq(appointments.id, reminders.appointmentId), eq(appointments.organizationId, reminders.organizationId)))
    .where(
      and(
        eq(reminders.organizationId, ctx.organization.id),
        eq(reminders.channel, "whatsapp_manual"),
        eq(reminders.status, status),
        inArray(reminders.id, ids),
        accessFilter(access),
      ),
    );
  return rows.map((row) => row.id);
}

/** Marks manual reminders as sent by WhatsApp. Returns how many changed. */
export async function markRemindersDone(ctx: TenantScope, access: ReminderAccess, ids: string[], now = new Date()) {
  const allowed = await allowedIds(ctx, access, ids, "pending");
  if (allowed.length === 0) return 0;
  const updated = await db
    .update(reminders)
    .set({ status: "done_manually", sentAt: now })
    .where(and(eq(reminders.organizationId, ctx.organization.id), eq(reminders.status, "pending"), inArray(reminders.id, allowed)))
    .returning({ id: reminders.id });
  return updated.length;
}

/** Undo of markRemindersDone. */
export async function undoReminderDone(ctx: TenantScope, access: ReminderAccess, id: string) {
  const allowed = await allowedIds(ctx, access, [id], "done_manually");
  if (allowed.length === 0) return false;
  const updated = await db
    .update(reminders)
    .set({ status: "pending", sentAt: null })
    .where(and(eq(reminders.organizationId, ctx.organization.id), eq(reminders.id, id), eq(reminders.status, "done_manually")))
    .returning({ id: reminders.id });
  return updated.length > 0;
}

/** Marks every reminder in today's tray as done. */
export async function markAllTrayDone(ctx: TenantScope, access: ReminderAccess, now = new Date()) {
  const rows = await db
    .select({ id: reminders.id })
    .from(reminders)
    .leftJoin(appointments, and(eq(appointments.id, reminders.appointmentId), eq(appointments.organizationId, reminders.organizationId)))
    .where(trayWhere(ctx, access, now));
  return markRemindersDone(ctx, access, rows.map((row) => row.id), now);
}

export async function updateReminderSettings(
  ctx: TenantScope,
  input: Partial<{
    remindAppointments24h: boolean;
    remindAppointments2h: boolean;
    remindChargesDaysBefore: number;
    remindChargesOnDue: boolean;
    remindChargesDaysAfter: number;
    appointmentReminderTemplate: string | null;
  }>,
) {
  if (Object.keys(input).length === 0) return;
  await db.update(businessSettings).set(input).where(eq(businessSettings.organizationId, ctx.organization.id));
}
