import type { AppointmentStatus } from "@/lib/appointment-status";

/** Block colors in the agenda grid/list, by status. */
export const STATUS_BLOCK: Record<AppointmentStatus, string> = {
  pending: "border-warning/60 border-dashed bg-warning-soft text-warning-foreground",
  confirmed: "border-primary/30 bg-primary-soft text-primary-soft-foreground",
  completed: "border-success/30 bg-success-soft text-success-foreground",
  no_show: "border-coral/40 bg-coral-soft text-coral-foreground",
  cancelled: "border-border bg-muted text-muted-foreground line-through",
};
