// Membership enums shared by the schema, server and client code (no dependencies).

export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];
export const MAX_INTERVAL_COUNT = 365;

/** When members pay each period: at the start ("advance") or at the end ("arrears"). */
export const BILLING_TIMINGS = ["advance", "arrears"] as const;
export type BillingTiming = (typeof BILLING_TIMINGS)[number];
export const BILLING_TIMING_LABELS: Record<BillingTiming, string> = {
  advance: "Por adelantado (al inicio de cada período)",
  arrears: "A período vencido (al final de cada período)",
};

/** Tolerance after the due date before a cuota is "vencida". */
export const GRACE_UNITS = ["day", "week", "month"] as const;
export type GraceUnit = (typeof GRACE_UNITS)[number];
export const MAX_GRACE: Record<GraceUnit, number> = { day: 365, week: 52, month: 12 };

const UNIT_WORDS: Record<IntervalUnit, [string, string]> = {
  day: ["día", "días"],
  week: ["semana", "semanas"],
  month: ["mes", "meses"],
  year: ["año", "años"],
};

/** "3 días", "1 semana", "2 meses". */
export function unitAmount(unit: IntervalUnit | GraceUnit, count: number) {
  const [one, many] = UNIT_WORDS[unit];
  return `${count} ${count === 1 ? one : many}`;
}

export const ENROLLMENT_STATUSES = ["active", "paused", "cancelled"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Stored cuota status. "Parcial" and "Vencida" are derived (lib/billing.ts). */
/**
 * What a charge is: a plan's cuota (one period), a one-off charge (matrícula,
 * deuda vieja, clase suelta) or a part of a cuota that was split.
 */
export const CHARGE_KINDS = ["cuota", "one_off", "part"] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const CHARGE_STATUSES = ["pending", "paid", "void"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_METHODS = ["efectivo", "transferencia", "tarjeta", "billetera", "otro", "online"] as const;
/** Methods offered when recording a payment by hand ("online" comes from providers). */
export const MANUAL_PAYMENT_METHODS = ["efectivo", "transferencia", "tarjeta", "billetera", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  billetera: "Billetera (Tigo Money, Personal…)",
  otro: "Otro",
  online: "Pago online",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

/** "por mes", "cada 3 meses", "por día", "cada 10 días", "por año". */
export function intervalLabel(unit: IntervalUnit, count: number) {
  if (count === 1) return `por ${UNIT_WORDS[unit][0]}`;
  return `cada ${unitAmount(unit, count)}`;
}

export const DEFAULT_REMINDER_TEMPLATE =
  "Hola {nombre}, te recordamos que tu cuota de {plan} por {monto} venció el {vencimiento}. ¡Gracias!";
