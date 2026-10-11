// Audit actions and their Spanish labels (no dependencies: used by the UI too).

export const AUDIT_ACTIONS = {
  "payment.recorded": "Registró un pago",
  "payment.deleted": "Deshizo un pago",
  "charge.voided": "Anuló una cuota",
  "charge.created": "Creó un cobro único",
  "charge.due_moved": "Le dio más tiempo para pagar una cuota",
  "charge.amount_changed": "Cambió el monto de una cuota",
  "charge.split": "Dividió una cuota en partes",
  "payment.edited": "Corrigió un pago",
  "appointment.changed": "Cambió el día, la hora o el servicio de un turno",
  "appointment.price_changed": "Cambió el precio de un turno",
  "appointment.client_changed": "Cambió el cliente de un turno",
  "stay.dates_changed": "Cambió las fechas de un alquiler",
  "enrollment.cancelled": "Canceló una membresía",
  "enrollment.price_changed": "Cambió el precio de una membresía",
  "enrollment.billing_day_changed": "Cambió el día de cobro de una membresía",
  "enrollment.timing_changed": "Cambió cuándo se paga una membresía",
  "enrollment.plan_changed": "Cambió de plan a un socio",
  "settings.profile": "Cambió los datos del negocio",
  "settings.slug": "Cambió el link de reservas",
  "settings.usage": "Cambió qué partes de Agenda usa",
  "settings.team_mode": "Cambió la forma de trabajo",
  "member.invited": "Invitó a una persona",
  "member.invitation_cancelled": "Canceló una invitación",
  "member.role_changed": "Cambió un rol",
  "member.removed": "Quitó a una persona del equipo",
  "data.exported": "Descargó datos",
  "business.deletion_requested": "Pidió eliminar el negocio",
  "business.deletion_cancelled": "Canceló la eliminación del negocio",
  "admin.impersonation_started": "Soporte entró a la cuenta",
  "admin.impersonation_stopped": "Soporte salió de la cuenta",
} as const;

/** Who shows in Actividad when the developer admin acted inside a business. */
export const ADMIN_ACTOR_NAME = "Soporte (admin)";

export type AuditAction = keyof typeof AUDIT_ACTIONS;
