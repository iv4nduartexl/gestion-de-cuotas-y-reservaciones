// Appointment statuses and allowed transitions. No dependencies: shared by the
// schema, server and client code.

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy the slot (enforced by the exclusion constraint). */
export const ACTIVE_STATUSES = ["pending", "confirmed"] as const satisfies readonly AppointmentStatus[];

export const APPOINTMENT_SOURCES = ["online", "dashboard"] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const CANCELLED_BY = ["client", "business"] as const;

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: ["confirmed"],
  no_show: ["confirmed"],
  cancelled: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: AppointmentStatus) {
  return TRANSITIONS[from];
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Completado",
  no_show: "No vino",
};

export const STATUS_BADGE: Record<AppointmentStatus, "warning" | "info" | "neutral" | "success" | "coral"> = {
  pending: "warning",
  confirmed: "info",
  cancelled: "neutral",
  completed: "success",
  no_show: "coral",
};

/** Whether a turno is still ahead and whether the client may still cancel it online. */
export function turnoTiming(
  turno: { status: AppointmentStatus; startsAt: Date },
  cancelNoticeHours: number,
  now: Date = new Date(),
) {
  const active = (ACTIVE_STATUSES as readonly AppointmentStatus[]).includes(turno.status);
  const upcoming = active && turno.startsAt.getTime() > now.getTime();
  const canCancel = upcoming && now.getTime() < turno.startsAt.getTime() - cancelNoticeHours * 3_600_000;
  return { active, upcoming, canCancel };
}
