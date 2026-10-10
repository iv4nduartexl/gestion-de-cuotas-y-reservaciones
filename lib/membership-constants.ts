// Membership enums shared by the schema, server and client code (no dependencies).

export const INTERVAL_UNITS = ["week", "month"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export const ENROLLMENT_STATUSES = ["active", "paused", "cancelled"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Stored cuota status. "Parcial" and "Vencida" are derived (lib/billing.ts). */
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

/** "por mes", "cada 3 meses", "por semana", "cada 2 semanas". */
export function intervalLabel(unit: IntervalUnit, count: number) {
  if (count === 1) return unit === "month" ? "por mes" : "por semana";
  return unit === "month" ? `cada ${count} meses` : `cada ${count} semanas`;
}

export const DEFAULT_REMINDER_TEMPLATE =
  "Hola {nombre}, te recordamos que tu cuota de {plan} por {monto} venció el {vencimiento}. ¡Gracias!";
