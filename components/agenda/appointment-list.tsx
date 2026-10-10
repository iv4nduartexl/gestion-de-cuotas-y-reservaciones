import { ChevronRightIcon, GlobeIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/appointment-status";
import type { AppointmentWithNames } from "@/lib/data/appointments";
import { formatInZone } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Time-ordered turnos (phones, solo businesses, or one person). */
export function AppointmentList({
  turnos,
  timeZone,
  showStaff,
}: {
  turnos: AppointmentWithNames[];
  timeZone: string;
  showStaff: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {turnos.map((turno) => (
        <li key={turno.id}>
          <Link
            href={`/dashboard/agenda/${turno.id}`}
            className={cn(
              "flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40",
              turno.status === "cancelled" && "opacity-60",
            )}
          >
            <span className="flex w-14 shrink-0 flex-col items-center leading-tight">
              <span className="text-lg font-extrabold tabular">{formatInZone(turno.startsAt, timeZone, "HH:mm")}</span>
              <span className="text-xs text-muted-foreground tabular">{formatInZone(turno.endsAt, timeZone, "HH:mm")}</span>
            </span>
            <span className="h-10 w-px bg-border" aria-hidden="true" />
            <EntityAvatar name={turno.clientName} size="sm" className="hidden sm:inline-flex" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("truncate font-bold", turno.status === "cancelled" && "line-through")}>
                {turno.clientName}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {turno.serviceName}
                {showStaff && ` · ${turno.staffName}`}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={STATUS_BADGE[turno.status]}>{STATUS_LABELS[turno.status]}</Badge>
              {turno.source === "online" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <GlobeIcon className="size-3" aria-hidden="true" /> Online
                </span>
              )}
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
