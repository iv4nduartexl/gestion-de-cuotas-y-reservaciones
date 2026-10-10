// Audit actions and their Spanish labels (no dependencies: used by the UI too).

export const AUDIT_ACTIONS = {
  "payment.recorded": "Registró un pago",
  "payment.deleted": "Deshizo un pago",
  "charge.voided": "Anuló una cuota",
  "enrollment.cancelled": "Canceló una membresía",
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
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
