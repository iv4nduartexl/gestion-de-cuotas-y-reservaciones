// Billing engine for memberships: periods, due dates and derived statuses.
// Pure and calendar-date based ("yyyy-MM-dd" strings, UTC arithmetic), so
// time zones and DST can never shift a due date.

import type { BillingTiming, ChargeStatus, GraceUnit, IntervalUnit } from "@/lib/membership-constants";

type YMD = { y: number; m: number; d: number }; // m: 1-12

function parse(date: string): YMD {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function format({ y, m, d }: YMD) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Adds months keeping the original day when possible (Jan 31 + 1 → Feb 28/29). */
export function addMonthsAnchored(date: string, months: number): string {
  const { y, m, d } = parse(date);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return format({ y: year, m: month, d: Math.min(d, daysInMonth(year, month)) });
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parse(date);
  const value = new Date(Date.UTC(y, m - 1, d + days));
  return value.toISOString().slice(0, 10);
}

/** Adds `n` units (day, week, month or year) to a calendar date. Months and years keep the anchor day. */
export function addInterval(date: string, unit: IntervalUnit | GraceUnit, n: number): string {
  switch (unit) {
    case "day":
      return addDays(date, n);
    case "week":
      return addDays(date, n * 7);
    case "month":
      return addMonthsAnchored(date, n);
    case "year":
      return addMonthsAnchored(date, n * 12);
  }
}

/** Start of the k-th period (k = 0 is the start date), always computed from the anchor. */
export function periodStart(startDate: string, unit: IntervalUnit, count: number, k: number): string {
  return addInterval(startDate, unit, k * count);
}

/** Whole days between two calendar dates (b − a). */
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * A period index at or before the one containing `date`, so loops can start
 * there instead of at the first period (daily plans over years stay fast).
 */
function periodIndexBefore(startDate: string, unit: IntervalUnit, count: number, date: string) {
  if (date <= startDate) return 0;
  const days = daysBetween(startDate, date);
  const approxUnitDays = { day: 1, week: 7, month: 28, year: 365 }[unit];
  // Months/years vary in length: step back a little to stay at or before.
  const k = Math.floor(days / (approxUnitDays * count)) - (unit === "month" || unit === "year" ? 2 : 0);
  return Math.max(0, k);
}

export type Period = { periodStart: string; periodEnd: string; dueDate: string };

const MAX_PERIODS = 2000;

/**
 * Cuotas of an enrollment that are due on or before `until`, skipping
 * periods that start before `billFrom` (paused time or a free first period).
 * - "advance": the member pays at the start of each period (due = start).
 * - "arrears": at the end (due = end of the period).
 * `firstDueDate` overrides the due date of the very first period.
 */
export function periodsFor({
  startDate,
  billFrom = startDate,
  unit,
  count,
  until,
  timing = "advance",
  firstDueDate = null,
}: {
  startDate: string;
  billFrom?: string;
  unit: IntervalUnit;
  count: number;
  until: string;
  timing?: BillingTiming;
  firstDueDate?: string | null;
}): Period[] {
  const periods: Period[] = [];
  const first = periodIndexBefore(startDate, unit, count, billFrom);
  for (let k = first; k < first + MAX_PERIODS; k++) {
    const start = periodStart(startDate, unit, count, k);
    const end = periodStart(startDate, unit, count, k + 1);
    const naturalDue = timing === "arrears" ? end : start;
    // Due dates only grow from here on (the override only applies to k = 0).
    if (naturalDue > until && k > 0) break;
    if (start < billFrom) continue;
    const dueDate = k === 0 && firstDueDate ? firstDueDate : naturalDue;
    if (dueDate > until) continue;
    periods.push({ periodStart: start, periodEnd: end, dueDate });
  }
  return periods;
}

/** Start of the period that contains `date` (used when resuming a paused enrollment). */
export function currentPeriodStart(startDate: string, unit: IntervalUnit, count: number, date: string): string {
  if (date <= startDate) return startDate;
  let k = periodIndexBefore(startDate, unit, count, date);
  while (periodStart(startDate, unit, count, k + 1) <= date) k++;
  return periodStart(startDate, unit, count, k);
}

/** Tolerance after the due date before a cuota counts as overdue. */
export type Grace = { count: number; unit: GraceUnit };

/** Due dates before this are overdue today (today minus the tolerance). */
export function overdueCutoff(today: string, grace: Grace) {
  return addInterval(today, grace.unit, -grace.count);
}

export type DerivedChargeStatus = "pagada" | "parcial" | "pendiente" | "vencida" | "anulada";

export function isOverdue(dueDate: string, today: string, grace: Grace) {
  return dueDate < overdueCutoff(today, grace);
}

/** What the business sees: overdue wins over partial ("vencida, pagó X de Y"). */
export function chargeStatus(
  charge: { status: ChargeStatus; amount: number; dueDate: string },
  amountPaid: number,
  today: string,
  grace: Grace,
): DerivedChargeStatus {
  if (charge.status === "void") return "anulada";
  if (charge.status === "paid" || amountPaid >= charge.amount) return "pagada";
  if (isOverdue(charge.dueDate, today, grace)) return "vencida";
  return amountPaid > 0 ? "parcial" : "pendiente";
}

export const CHARGE_STATUS_LABELS: Record<DerivedChargeStatus, string> = {
  pagada: "Pagada",
  parcial: "Parcial",
  pendiente: "Por cobrar",
  vencida: "Vencida",
  anulada: "Anulada",
};

export const CHARGE_STATUS_BADGE: Record<DerivedChargeStatus, "success" | "warning" | "info" | "coral" | "neutral"> = {
  pagada: "success",
  parcial: "warning",
  pendiente: "info",
  vencida: "coral",
  anulada: "neutral",
};

/** A member's overall situation from their cuotas (excluding future ones). */
export function memberStatus(
  charges: { status: DerivedChargeStatus; amount: number; amountPaid: number; dueDate: string }[],
  today: string,
): { kind: "al_dia" | "debe" | "vencido"; owed: number; overdue: number } {
  let owed = 0;
  let overdue = 0;
  for (const charge of charges) {
    if (charge.status === "anulada" || charge.status === "pagada" || charge.dueDate > today) continue;
    owed += charge.amount - charge.amountPaid;
    if (charge.status === "vencida") overdue += 1;
  }
  return { kind: overdue > 0 ? "vencido" : owed > 0 ? "debe" : "al_dia", owed, overdue };
}

/** Fills the WhatsApp reminder template. */
export function renderReminder(
  template: string,
  values: { nombre: string; plan: string; monto: string; vencimiento: string },
) {
  return template.replace(/\{(nombre|plan|monto|vencimiento)\}/g, (_, key: keyof typeof values) => values[key]);
}
