"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import type { AppointmentStatus } from "@/lib/appointment-status";
import {
  bookAppointment,
  BookingReferenceError,
  getAvailability,
  listBookableServices,
  AppointmentClosedError,
  bookStay,
  changeAppointment,
  changeStayDates,
  SlotUnavailableError,
  StayRulesError,
} from "@/lib/booking";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/data/clients";
import {
  changeAppointmentClient,
  getAppointment,
  InvalidTransitionError,
  updateAppointmentPrice,
  setAppointmentStatus,
  updateInternalNotes,
} from "@/lib/data/appointments";
import { getStayService, loadOccupiedDates } from "@/lib/data/stays";
import { getStaffForMember } from "@/lib/data/staff";
import { addDaysToDate, DATE_PATTERN, todayInZone, zonedToUtc } from "@/lib/datetime";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { parseMoneyInput } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import type { TenantContext } from "@/lib/tenant";
import { optionalText } from "@/lib/validation/common";
import { isUniqueViolation } from "@/lib/db-errors";
import {
  changeClientSchema,
  changeStayDatesSchema,
  changeTurnoSchema,
  dashboardBookingSchema,
  dashboardStayBookingSchema,
  stayCalendarQuerySchema,
} from "@/lib/validation/booking";
import type { StayCalendar } from "@/app/[slug]/actions";

const APPOINTMENTS = { product: "appointments" } as const;

/** Members only manage turnos of their own staff record; null = any staff. */
async function restrictedStaffId(ctx: TenantContext) {
  if (ctx.role !== "member") return null;
  const own = await getStaffForMember(ctx, ctx.memberId);
  return own?.id ?? "none";
}

export async function getDashboardSlotsAction(query: { serviceId: string; staffChoice: string; date: string; excludeId?: string }) {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx || !DATE_PATTERN.test(query.date)) return [];
  const service = (await listBookableServices(ctx)).find((s) => s.id === query.serviceId);
  if (!service) return [];
  const excludeId = query.excludeId ? (parseId(query.excludeId) ?? undefined) : undefined;
  const [day] = await getAvailability(ctx, service, query.staffChoice, query.date, 1, { online: false, excludeId });
  return day.slots.map(({ start, time }) => ({ start, time }));
}

export async function createAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(dashboardBookingSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  const input = parsed.data;

  const restricted = await restrictedStaffId(ctx);
  if (restricted && input.staffChoice !== restricted) {
    return { errors: { staffChoice: "Solo podés agendar turnos para vos." } };
  }

  const start = input.manualTime
    ? zonedToUtc(input.date, input.time, ctx.settings.timezone).toISOString()
    : input.start;

  let id: string;
  try {
    const booked = await bookAppointment(ctx, {
      serviceId: input.serviceId,
      staffChoice: input.staffChoice,
      start,
      client: input.clientId
        ? { id: input.clientId }
        : { name: input.newClientName!, phone: normalizePhone(input.newClientPhone)! },
      status: "confirmed",
      source: "dashboard",
      notes: input.notes,
      manualTime: input.manualTime,
    });
    id = booked.id;
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return {
        errors: {
          [input.manualTime ? "time" : "start"]: input.manualTime
            ? "Ese horario se superpone con otro turno de esa persona."
            : "Ese horario ya no está libre. Elegí otro.",
        },
      };
    }
    if (error instanceof BookingReferenceError) {
      return { errors: { [error.field === "clientId" ? "client" : error.field]: "Ya no está disponible. Recargá la página." } };
    }
    throw error;
  }
  redirect(withFlash(`/dashboard/agenda/${id}`, "turno-creado"));
}

/** How far ahead the dashboard can book a rental (no online horizon here). */
const DASHBOARD_STAY_DAYS = 365;

/** Taken dates of a rental for the dashboard calendars (no minimum notice). */
export async function getDashboardStayCalendarAction(query: {
  serviceId: string;
  fromDate: string;
  excludeId?: string;
}): Promise<StayCalendar | null> {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx) return null;
  const parsed = stayCalendarQuerySchema.safeParse(query);
  if (!parsed.success) return null;
  const service = await getStayService(ctx, parsed.data.serviceId);
  if (!service) return null;
  const today = todayInZone(ctx.settings.timezone);
  const lastCheckIn = addDaysToDate(today, DASHBOARD_STAY_DAYS);
  const lastDate = addDaysToDate(lastCheckIn, service.maxStay ?? 31);
  const from = parsed.data.fromDate < today ? today : parsed.data.fromDate;
  const to = addDaysToDate(from, 100) < lastDate ? addDaysToDate(from, 100) : lastDate;
  const taken = await loadOccupiedDates(ctx, service, from, to, query.excludeId ? (parseId(query.excludeId) ?? undefined) : undefined);
  return { taken: [...taken], firstDate: today, lastDate, lastCheckIn };
}

export async function createStayAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  // Rentals have no staff: members only book their own turnos.
  if (await restrictedStaffId(ctx)) return FORBIDDEN;
  const parsed = parseForm(dashboardStayBookingSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  const input = parsed.data;
  const service = await getStayService(ctx, input.serviceId);
  if (!service) return { errors: { serviceId: "Ya no está disponible. Recargá la página." } };
  let price: number | undefined;
  if (input.price) {
    const amount = parseMoneyInput(input.price, service.currency);
    if (amount === null) return { errors: { price: "Precio inválido." } };
    price = amount;
  }

  let id: string;
  try {
    const booked = await bookStay(ctx, {
      serviceId: service.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      client: input.clientId
        ? { id: input.clientId }
        : { name: input.newClientName!, phone: normalizePhone(input.newClientPhone)! },
      status: "confirmed",
      source: "dashboard",
      notes: input.notes,
      price,
    });
    id = booked.id;
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { errors: { checkIn: "Alguna de esas fechas ya está ocupada. Elegí otras." } };
    }
    if (error instanceof StayRulesError) return { errors: { checkIn: STAY_RULE_MESSAGES[error.reason] } };
    if (error instanceof BookingReferenceError) {
      return { errors: { [error.field === "clientId" ? "client" : "serviceId"]: "Ya no está disponible. Recargá la página." } };
    }
    throw error;
  }
  redirect(withFlash(`/dashboard/agenda/${id}`, "alquiler-creado"));
}

const STATUS_MESSAGES: Partial<Record<AppointmentStatus, string>> = {
  confirmed: "Turno confirmado",
  cancelled: "Turno cancelado",
  completed: "Marcado como completado",
  no_show: "Marcado como “No vino”",
};

export async function setAppointmentStatusAction(appointmentId: string, status: AppointmentStatus) {
  const ctx = await authorizeAction(
    { appointment: [status === "cancelled" ? "cancel" : "update"] },
    APPOINTMENTS,
  );
  const id = parseId(appointmentId);
  if (!ctx || !id) return;
  const turno = await getAppointment(ctx, id);
  if (!turno) return;
  const restricted = await restrictedStaffId(ctx);
  if (restricted && turno.staffId !== restricted) return;
  try {
    await setAppointmentStatus(ctx, id, status, { cancelledBy: "business" });
  } catch (error) {
    if (!(error instanceof InvalidTransitionError)) throw error;
  }
  refresh();
  return STATUS_MESSAGES[status];
}

const notesSchema = z.object({ internalNotes: optionalText(1000) });

export async function updateInternalNotesAction(
  appointmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ appointment: ["update"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(appointmentId);
  if (!id) return { errors: { form: "Turno no encontrado." } };
  const turno = await getAppointment(ctx, id);
  const restricted = await restrictedStaffId(ctx);
  if (!turno || (restricted && turno.staffId !== restricted)) return FORBIDDEN;
  const parsed = parseForm(notesSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  await updateInternalNotes(ctx, id, parsed.data.internalNotes);
  refresh();
  return { message: "Nota guardada" };
}

const STAY_RULE_MESSAGES = {
  order: "La salida tiene que ser después de la entrada.",
  too_short: "La estadía es más corta que el mínimo.",
  too_long: "La estadía es más larga que el máximo.",
  past: "Esa fecha ya pasó.",
  too_far: "Esa fecha está demasiado lejos.",
};

/** The turno, if this user may change it (members: only their own). */
async function editableTurno(appointmentId: string) {
  const ctx = await authorizeAction({ appointment: ["update"] }, APPOINTMENTS);
  const id = parseId(appointmentId);
  if (!ctx || !id) return null;
  const turno = await getAppointment(ctx, id);
  const restricted = await restrictedStaffId(ctx);
  if (!turno || (restricted && turno.staffId !== restricted)) return null;
  return { ctx, turno, restricted };
}

/** "Cambiar día y hora" (and service / person) of a turno. */
export async function changeAppointmentAction(appointmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableTurno(appointmentId);
  if (!found) return FORBIDDEN;
  const { ctx, turno, restricted } = found;
  const parsed = parseForm(changeTurnoSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  const input = parsed.data;
  if (restricted && input.staffChoice !== restricted) return { errors: { staffChoice: "Solo podés mover tus propios turnos." } };
  const start = input.manualTime ? zonedToUtc(input.date, input.time, ctx.settings.timezone).toISOString() : input.start;
  try {
    const { before, after } = await changeAppointment(ctx, turno.id, { ...input, start });
    await recordAudit(ctx, "appointment.changed", { type: "appointment", id: turno.id }, {
      from: before.startsAt.toISOString(),
      to: after.startsAt.toISOString(),
      ...(before.serviceId !== after.serviceId && { serviceFrom: before.serviceId, serviceTo: after.serviceId }),
      ...(before.staffId !== after.staffId && { staffFrom: before.staffId, staffTo: after.staffId }),
    });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return {
        errors: {
          [input.manualTime ? "time" : "start"]: input.manualTime
            ? "Ese horario se superpone con otro turno de esa persona."
            : "Ese horario ya no está libre. Elegí otro.",
        },
      };
    }
    if (error instanceof AppointmentClosedError) return { errors: { form: "Este turno ya no se puede mover (está cancelado o ya pasó)." } };
    if (error instanceof BookingReferenceError) return { errors: { [error.field]: "Ya no está disponible. Recargá la página." } };
    throw error;
  }
  redirect(withFlash(`/dashboard/agenda/${turno.id}`, "turno-cambiado"));
}

/** "Cambiar fechas" of a rental (members don't manage rentals). */
export async function changeStayDatesAction(appointmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableTurno(appointmentId);
  if (!found || found.restricted) return FORBIDDEN;
  const { ctx, turno } = found;
  const parsed = parseForm(changeStayDatesSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  try {
    const { before, after } = await changeStayDates(ctx, turno.id, parsed.data);
    await recordAudit(ctx, "stay.dates_changed", { type: "appointment", id: turno.id }, {
      from: before.startsAt.toISOString(),
      to: after.startsAt.toISOString(),
      priceFrom: before.price,
      priceTo: after.price,
    });
  } catch (error) {
    if (error instanceof SlotUnavailableError) return { errors: { checkIn: "Alguna de esas fechas ya está ocupada. Elegí otras." } };
    if (error instanceof StayRulesError) return { errors: { checkIn: STAY_RULE_MESSAGES[error.reason] } };
    if (error instanceof AppointmentClosedError) return { errors: { form: "Esta reserva ya no se puede cambiar (está cancelada o ya pasó)." } };
    if (error instanceof BookingReferenceError) return { errors: { form: "Este alquiler ya no está disponible." } };
    throw error;
  }
  redirect(withFlash(`/dashboard/agenda/${turno.id}`, "turno-cambiado"));
}

/** "Cambiar precio": what this turno or rental costs (discount, extra). */
export async function changeAppointmentPriceAction(appointmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableTurno(appointmentId);
  if (!found) return FORBIDDEN;
  const { ctx, turno } = found;
  const price = parseMoneyInput(String(formData.get("price") ?? ""), turno.currency);
  if (price === null) return { errors: { price: "Escribí un precio válido." } };
  const changed = await updateAppointmentPrice(ctx, turno.id, price);
  if (!changed) return { errors: { form: "Este turno está cancelado: no se puede cambiar el precio." } };
  await recordAudit(ctx, "appointment.price_changed", { type: "appointment", id: turno.id }, { from: changed.before, to: price });
  redirect(withFlash(`/dashboard/agenda/${turno.id}`, "turno-cambiado"));
}

/** "Cambiar cliente": the turno is someone else's (existing or new). */
export async function changeAppointmentClientAction(appointmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableTurno(appointmentId);
  if (!found) return FORBIDDEN;
  const { ctx, turno } = found;
  const parsed = parseForm(changeClientSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  let clientId = parsed.data.clientId;
  if (!clientId) {
    try {
      const created = await createClient(ctx, {
        name: parsed.data.newClientName!,
        phone: normalizePhone(parsed.data.newClientPhone)!,
        email: null,
        documentNumber: null,
        notes: null,
      });
      clientId = created.id;
    } catch (error) {
      if (isUniqueViolation(error, "clients_org_phone_unique")) {
        return { errors: { newClientPhone: "Ya existe alguien con ese teléfono: buscalo por nombre." } };
      }
      throw error;
    }
  }
  const changed = await changeAppointmentClient(ctx, turno.id, clientId);
  if (!changed) return { errors: { client: "Esa persona ya no está disponible." } };
  await recordAudit(ctx, "appointment.client_changed", { type: "appointment", id: turno.id }, { from: changed.before, to: clientId });
  redirect(withFlash(`/dashboard/agenda/${turno.id}`, "turno-cambiado"));
}
