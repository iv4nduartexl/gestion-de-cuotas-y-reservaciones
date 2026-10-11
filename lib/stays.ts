// Rentals ("Por días" services): counting, pricing and occupied dates.
// Pure (no database): unit-tested, and used by the public calendar, the
// dashboard and the server-side re-check before inserting.

import { addDaysToDate, formatInZone, zonedToUtc } from "@/lib/datetime";
import type { StayUnit } from "@/lib/service-constants";

export type StayService = {
  stayUnit: StayUnit;
  checkInTime: string; // "HH:mm"
  checkOutTime: string; // "HH:mm"
  minStay: number;
  maxStay: number | null;
  price: number; // per night/day
  weeklyPrice: number | null;
  monthlyPrice: number | null;
};

export type StayQuote = {
  units: number;
  total: number;
  /** How the total was built, for the summary ("1 mes + 3 noches"). */
  breakdown: { label: "month" | "week" | "unit"; count: number; amount: number }[];
  startsAt: Date;
  endsAt: Date;
};

export type StayError = "order" | "too_short" | "too_long";

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Nights (check-out after check-in) or days (inclusive: a single day counts
 * as 1) between two calendar dates.
 */
export function stayUnits(unit: StayUnit, checkIn: string, checkOut: string) {
  const diff = daysBetween(checkIn, checkOut);
  return unit === "night" ? diff : diff + 1;
}

/**
 * Price of a stay: whole months at the monthly price (30 units), then whole
 * weeks at the weekly price (7 units), the rest per unit. Missing bundle
 * prices just aren't used.
 */
export function stayPrice(service: Pick<StayService, "price" | "weeklyPrice" | "monthlyPrice">, units: number) {
  const breakdown: StayQuote["breakdown"] = [];
  let rest = units;
  if (service.monthlyPrice !== null && rest >= 30) {
    const months = Math.floor(rest / 30);
    breakdown.push({ label: "month", count: months, amount: months * service.monthlyPrice });
    rest -= months * 30;
  }
  if (service.weeklyPrice !== null && rest >= 7) {
    const weeks = Math.floor(rest / 7);
    breakdown.push({ label: "week", count: weeks, amount: weeks * service.weeklyPrice });
    rest -= weeks * 7;
  }
  if (rest > 0) breakdown.push({ label: "unit", count: rest, amount: rest * service.price });
  return { total: breakdown.reduce((sum, part) => sum + part.amount, 0), breakdown };
}

/** Validates the dates and prices a stay. Instants use the business time zone. */
export function quoteStay(
  service: StayService,
  checkIn: string,
  checkOut: string,
  timeZone: string,
): { ok: true; quote: StayQuote } | { ok: false; error: StayError } {
  const units = stayUnits(service.stayUnit, checkIn, checkOut);
  if (units < 1) return { ok: false, error: "order" };
  if (units < service.minStay) return { ok: false, error: "too_short" };
  if (service.maxStay !== null && units > service.maxStay) return { ok: false, error: "too_long" };
  const startsAt = zonedToUtc(checkIn, service.checkInTime, timeZone);
  const endsAt = zonedToUtc(checkOut, service.checkOutTime, timeZone);
  if (endsAt <= startsAt) return { ok: false, error: "order" };
  const { total, breakdown } = stayPrice(service, units);
  return { ok: true, quote: { units, total, breakdown, startsAt, endsAt } };
}

/**
 * Calendar dates that can't be part of a new stay because an existing booking
 * (or a business-wide día libre) occupies them.
 * - Nights: a date is taken when someone sleeps there that night. The
 *   check-out day stays free, so the next guest can arrive that afternoon.
 * - Days: every day the booking touches is taken.
 */
export function occupiedDates(
  unit: StayUnit,
  busy: { start: Date; end: Date }[],
  timeZone: string,
): Set<string> {
  const taken = new Set<string>();
  for (const interval of busy) {
    const first = formatInZone(interval.start, timeZone, "yyyy-MM-dd");
    // An instant exactly at midnight belongs to the day before.
    const lastInstant = new Date(interval.end.getTime() - 1);
    const last = formatInZone(lastInstant, timeZone, "yyyy-MM-dd");
    const lastTaken = unit === "night" ? addDaysToDate(formatInZone(interval.end, timeZone, "yyyy-MM-dd"), -1) : last;
    for (let date = first; date <= lastTaken; date = addDaysToDate(date, 1)) taken.add(date);
  }
  return taken;
}

/** Whether a stay from `checkIn` to `checkOut` avoids every occupied date. */
export function rangeIsFree(unit: StayUnit, checkIn: string, checkOut: string, taken: Set<string>) {
  const last = unit === "night" ? addDaysToDate(checkOut, -1) : checkOut;
  for (let date = checkIn; date <= last; date = addDaysToDate(date, 1)) {
    if (taken.has(date)) return false;
  }
  return true;
}
