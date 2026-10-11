"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { turnoTiming } from "@/lib/appointment-status";
import {
  bookAppointment,
  BookingReferenceError,
  bookStay,
  getAvailability,
  hashManageToken,
  SlotUnavailableError,
  StayRulesError,
} from "@/lib/booking";
import { clientIpFrom } from "@/lib/client-ip";
import { countUpcomingForPhone, getAppointmentByTokenHash, setAppointmentStatus } from "@/lib/data/appointments";
import { hashIp, isRateLimited, LIMITS, recordAttempt } from "@/lib/data/booking-limits";
import { getPublicBusiness, getPublicCatalog, type PublicBusiness } from "@/lib/data/public";
import { getStayService, loadOccupiedDates } from "@/lib/data/stays";
import { addDaysToDate, todayInZone } from "@/lib/datetime";
import { parseForm, type FieldErrors } from "@/lib/forms";
import {
  availabilityQuerySchema,
  publicBookingSchema,
  publicStayBookingSchema,
  stayCalendarQuerySchema,
} from "@/lib/validation/booking";

const DAYS_PER_PAGE = 14;

export type PublicDay = { date: string; slots: { start: string; time: string }[] };

/** Bookable times for a service (and person) over the next days. */
export async function getAvailabilityAction(
  slug: string,
  query: { serviceId: string; staffChoice: string; fromDate: string },
): Promise<{ days: PublicDay[]; hasMore: boolean } | null> {
  const business = await getPublicBusiness(slug);
  if (!business) return null;
  const parsed = availabilityQuerySchema.safeParse(query);
  if (!parsed.success) return null;

  const { services } = await getPublicCatalog(business);
  const service = services.find((s) => s.id === parsed.data.serviceId);
  if (!service) return null;
  if (parsed.data.staffChoice !== "any" && !service.staffIds.includes(parsed.data.staffChoice)) return null;

  const today = todayInZone(business.settings.timezone);
  const lastDay = addDaysToDate(today, business.settings.maxDaysAhead);
  const fromDate = parsed.data.fromDate < today ? today : parsed.data.fromDate;
  if (fromDate > lastDay) return { days: [], hasMore: false };

  const days = await getAvailability(business, service, parsed.data.staffChoice, fromDate, DAYS_PER_PAGE, { online: true });
  return {
    days: days
      .filter((day) => day.date <= lastDay)
      .map((day) => ({ date: day.date, slots: day.slots.map(({ start, time }) => ({ start, time })) })),
    hasMore: addDaysToDate(fromDate, DAYS_PER_PAGE) <= lastDay,
  };
}

export type BookingState = { errors?: FieldErrors; slotTaken?: boolean; message?: string };

async function clientIp() {
  return clientIpFrom(await headers());
}

/** Anti-abuse shared by every public booking: rate limits and a cap of upcoming bookings per phone. */
async function guardPublicBooking(business: PublicBusiness, phone: string): Promise<BookingState | null> {
  const ipHash = hashIp(await clientIp());
  if (await isRateLimited(business, ipHash, phone)) {
    return { errors: { form: "Hiciste muchos intentos seguidos. Esperá unos minutos y volvé a probar." } };
  }
  await recordAttempt(business, ipHash, phone);
  if ((await countUpcomingForPhone(business, phone)) >= LIMITS.upcomingPerPhone) {
    return {
      errors: {
        form: `Ya tenés ${LIMITS.upcomingPerPhone} reservas con este teléfono. Para otra, escribile al negocio.`,
      },
    };
  }
  return null;
}

export async function createBookingAction(
  slug: string,
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const business = await getPublicBusiness(slug);
  if (!business) return { errors: { form: "Este negocio no está tomando reservas." } };

  const parsed = parseForm(publicBookingSchema, formData);
  if (!parsed.success) {
    if (parsed.errors.website) return { errors: { form: "No pudimos tomar tu reserva." } };
    return { errors: parsed.errors };
  }
  const input = parsed.data;

  const blocked = await guardPublicBooking(business, input.phone);
  if (blocked) return blocked;

  let token: string;
  try {
    const booked = await bookAppointment(business, {
      serviceId: input.serviceId,
      staffChoice: input.staffChoice,
      start: input.start,
      client: { name: input.name, phone: input.phone },
      status: business.settings.autoConfirmBookings ? "confirmed" : "pending",
      source: "online",
      notes: input.notes,
      withManageToken: true,
    });
    token = booked.token!;
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { slotTaken: true, errors: { start: "Ese horario se acaba de ocupar. Elegí otro, por favor." } };
    }
    if (error instanceof BookingReferenceError) {
      return { errors: { form: "Ese servicio ya no está disponible. Recargá la página." } };
    }
    throw error;
  }
  redirect(`/${slug}/turno/${token}`);
}

/** Taken dates plus the window: entries up to `lastCheckIn`, exits up to `lastDate`. */
export type StayCalendar = { taken: string[]; firstDate: string; lastDate: string; lastCheckIn: string };

/** Taken dates of a rental for the public range calendar (about three months from `fromDate`). */
export async function getStayCalendarAction(slug: string, query: { serviceId: string; fromDate: string }): Promise<StayCalendar | null> {
  const business = await getPublicBusiness(slug);
  if (!business) return null;
  const parsed = stayCalendarQuerySchema.safeParse(query);
  if (!parsed.success) return null;
  const service = await getStayService(business, parsed.data.serviceId);
  if (!service) return null;
  const today = todayInZone(business.settings.timezone);
  // Check-ins up to the booking horizon; the stay itself may end later.
  const lastDate = addDaysToDate(today, business.settings.maxDaysAhead + (service.maxStay ?? 31));
  const from = parsed.data.fromDate < today ? today : parsed.data.fromDate;
  const to = addDaysToDate(from, 100) < lastDate ? addDaysToDate(from, 100) : lastDate;
  const taken = await loadOccupiedDates(business, service, from, to);
  return { taken: [...taken], firstDate: today, lastDate, lastCheckIn: addDaysToDate(today, business.settings.maxDaysAhead) };
}

export async function createStayBookingAction(slug: string, _prev: BookingState, formData: FormData): Promise<BookingState> {
  const business = await getPublicBusiness(slug);
  if (!business) return { errors: { form: "Este negocio no está tomando reservas." } };
  const parsed = parseForm(publicStayBookingSchema, formData);
  if (!parsed.success) {
    if (parsed.errors.website) return { errors: { form: "No pudimos tomar tu reserva." } };
    return { errors: parsed.errors };
  }
  const input = parsed.data;
  const blocked = await guardPublicBooking(business, input.phone);
  if (blocked) return blocked;

  let token: string;
  try {
    const booked = await bookStay(business, {
      serviceId: input.serviceId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      client: { name: input.name, phone: input.phone },
      status: business.settings.autoConfirmBookings ? "confirmed" : "pending",
      source: "online",
      notes: input.notes,
      withManageToken: true,
    });
    token = booked.token!;
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { slotTaken: true, errors: { checkIn: "Esas fechas se acaban de ocupar. Elegí otras, por favor." } };
    }
    if (error instanceof StayRulesError) {
      const messages = {
        order: "La salida tiene que ser después de la entrada.",
        too_short: "La estadía es más corta que el mínimo.",
        too_long: "La estadía es más larga que el máximo.",
        past: "Esa fecha ya pasó o está muy cerca. Elegí otra.",
        too_far: "Todavía no se puede reservar tan adelante.",
      };
      return { errors: { checkIn: messages[error.reason] } };
    }
    if (error instanceof BookingReferenceError) {
      return { errors: { form: "Este alquiler ya no está disponible. Recargá la página." } };
    }
    throw error;
  }
  redirect(`/${slug}/turno/${token}`);
}

/** Cancellation from the client's private link. */
export async function cancelBookingAction(slug: string, token: string): Promise<BookingState> {
  const business = await getPublicBusiness(slug);
  if (!business) return { errors: { form: "No encontramos el turno." } };
  const turno = await getAppointmentByTokenHash(business, hashManageToken(token));
  if (!turno) return { errors: { form: "No encontramos el turno." } };
  const timing = turnoTiming(turno, business.settings.clientCancelNoticeHours);
  if (!timing.upcoming) return { errors: { form: "Este turno ya no se puede cancelar." } };
  if (!timing.canCancel) {
    return { errors: { form: "Ya pasó el plazo para cancelar online. Escribile al negocio." } };
  }
  await setAppointmentStatus(business, turno.id, "cancelled", { cancelledBy: "client" });
  refresh();
  return { message: "Turno cancelado" };
}
