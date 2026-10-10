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
  SlotUnavailableError,
} from "@/lib/booking";
import {
  getAppointment,
  InvalidTransitionError,
  setAppointmentStatus,
  updateInternalNotes,
} from "@/lib/data/appointments";
import { listClients } from "@/lib/data/clients";
import { getStaffForMember } from "@/lib/data/staff";
import { DATE_PATTERN, zonedToUtc } from "@/lib/datetime";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { normalizePhone } from "@/lib/phone";
import type { TenantContext } from "@/lib/tenant";
import { optionalText } from "@/lib/validation/common";
import { dashboardBookingSchema } from "@/lib/validation/booking";

const APPOINTMENTS = { product: "appointments" } as const;

/** Members only manage turnos of their own staff record; null = any staff. */
async function restrictedStaffId(ctx: TenantContext) {
  if (ctx.role !== "member") return null;
  const own = await getStaffForMember(ctx, ctx.memberId);
  return own?.id ?? "none";
}

export async function searchClientsAction(query: string) {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx) return [];
  const { rows } = await listClients(ctx, { q: query.slice(0, 100) });
  return rows.slice(0, 8).map((client) => ({ id: client.id, name: client.name, phone: client.phone }));
}

export async function getDashboardSlotsAction(query: { serviceId: string; staffChoice: string; date: string }) {
  const ctx = await authorizeAction({ appointment: ["create"] }, APPOINTMENTS);
  if (!ctx || !DATE_PATTERN.test(query.date)) return [];
  const service = (await listBookableServices(ctx)).find((s) => s.id === query.serviceId);
  if (!service) return [];
  const [day] = await getAvailability(ctx, service, query.staffChoice, query.date, 1, { online: false });
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
