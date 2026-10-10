// Billing engine for memberships: periods, due dates and derived statuses.
// Pure and calendar-date based ("yyyy-MM-dd" strings, UTC arithmetic), so
// time zones and DST can never shift a due date.

import type { ChargeStatus, IntervalUnit } from "@/lib/membership-constants";

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

/** Start of the k-th period (k = 0 is the start date), always computed from the anchor. */
export function periodStart(startDate: string, unit: IntervalUnit, count: number, k: number): string {
  return unit === "month" ? addMonthsAnchored(startDate, k * count) : addDays(startDate, k * 7 * count);
}

export type Period = { periodStart: string; periodEnd: string; dueDate: string };

const MAX_PERIODS = 1000;

/**
 * Periods of an enrollment whose start is on or before `until`, skipping those
 * that start before `billFrom` (paused time). Members pay at the start of each
 * period, so the due date is the period start.
 */
export function periodsFor({
  startDate,
  billFrom = startDate,
  unit,
  count,
  until,
}: {
  startDate: string;
  billFrom?: string;
  unit: IntervalUnit;
  count: number;
  until: string;
}): Period[] {
  const periods: Period[] = [];
  for (let k = 0; k < MAX_PERIODS; k++) {
    const start = periodStart(startDate, unit, count, k);
    if (start > until) break;
    if (start < billFrom) continue;
    periods.push({ periodStart: start, periodEnd: periodStart(startDate, unit, count, k + 1), dueDate: start });
  }
  return periods;
}

/** Start of the period that contains `date` (used when resuming a paused enrollment). */
export function currentPeriodStart(startDate: string, unit: IntervalUnit, count: number, date: string): string {
  if (date <= startDate) return startDate;
  let current = startDate;
  for (let k = 1; k < MAX_PERIODS; k++) {
    const next = periodStart(startDate, unit, count, k);
    if (next > date) break;
    current = next;
  }
  return current;
}

export type DerivedChargeStatus = "pagada" | "parcial" | "pendiente" | "vencida" | "anulada";

export function isOverdue(dueDate: string, today: string, graceDays: number) {
  return today > addDays(dueDate, graceDays);
}

/** What the business sees: overdue wins over partial ("vencida, pagó X de Y"). */
export function chargeStatus(
  charge: { status: ChargeStatus; amount: number; dueDate: string },
  amountPaid: number,
  today: string,
  graceDays: number,
): DerivedChargeStatus {
  if (charge.status === "void") return "anulada";
  if (charge.status === "paid" || amountPaid >= charge.amount) return "pagada";
  if (isOverdue(charge.dueDate, today, graceDays)) return "vencida";
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
