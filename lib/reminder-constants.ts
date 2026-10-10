// Reminder enums shared by the schema, server and client code (no dependencies).

export const REMINDER_KINDS = [
  "appointment_24h",
  "appointment_2h",
  "charge_upcoming",
  "charge_due",
  "charge_overdue",
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_CHANNELS = ["email", "whatsapp_manual", "whatsapp_api", "sms"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = ["pending", "sent", "done_manually", "skipped", "failed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  done_manually: "Enviado por WhatsApp",
  skipped: "Ya no hacía falta",
  failed: "Falló",
};

export const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  email: "Correo",
  whatsapp_manual: "WhatsApp",
  whatsapp_api: "WhatsApp automático",
  sms: "SMS",
};

export const DEFAULT_APPOINTMENT_TEMPLATE =
  "Hola {nombre}, te recordamos tu turno de {servicio} en {negocio} el {dia} a las {hora}. ¡Te esperamos!";

export const PAYMENT_PROVIDER_IDS = ["manual", "fake"] as const;
