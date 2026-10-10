import Link from "next/link";

import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { STATUS_LABELS } from "@/lib/appointment-status";
import type { AppointmentWithNames } from "@/lib/data/appointments";
import { formatInZone, timeToMinutes } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { STATUS_BLOCK } from "./status-style";

const HOUR_HEIGHT = 72; // px

type Column = {
  id: string;
  name: string;
  /** Working hours that day, "HH:mm" (to shade the rest). */
  hours: { start: string; end: string }[];
};

/** Day view with one column per person (team businesses, wide screens). */
export function DayGrid({
  columns,
  turnos,
  timeZone,
  fromHour,
  toHour,
}: {
  columns: Column[];
  turnos: AppointmentWithNames[];
  timeZone: string;
  fromHour: number;
  toHour: number;
}) {
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const height = hours.length * HOUR_HEIGHT;
  const minuteToY = (minutes: number) => ((minutes - fromHour * 60) / 60) * HOUR_HEIGHT;
  const localMinutes = (date: Date) => timeToMinutes(formatInZone(date, timeZone, "HH:mm"));

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(10rem, 1fr))` }}>
        <div className="sticky top-0 z-10 border-b bg-card" />
        {columns.map((column) => (
          <div key={column.id} className="sticky top-0 z-10 flex items-center gap-2 border-b border-l bg-card px-3 py-3">
            <EntityAvatar name={column.name} size="sm" />
            <span className="truncate text-sm font-bold">{column.name}</span>
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-muted-foreground tabular"
              style={{ top: (hour - fromHour) * HOUR_HEIGHT }}
            >
              {hour > fromHour && `${String(hour).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>

        {columns.map((column) => (
          <div key={column.id} className="relative border-l bg-muted/50" style={{ height }}>
            {/* Working hours are white; the rest stays shaded. */}
            {column.hours.map((range) => (
              <div
                key={range.start}
                className="absolute inset-x-0 bg-card"
                style={{
                  top: Math.max(0, minuteToY(timeToMinutes(range.start))),
                  height: minuteToY(timeToMinutes(range.end)) - Math.max(0, minuteToY(timeToMinutes(range.start))),
                }}
              />
            ))}
            {hours.map((hour) => (
              <div
                key={hour}
                className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                style={{ top: (hour - fromHour) * HOUR_HEIGHT }}
              />
            ))}
            {turnos
              .filter((turno) => turno.staffId === column.id && turno.status !== "cancelled")
              .map((turno) => {
                const top = minuteToY(localMinutes(turno.startsAt));
                const blockHeight = Math.max(28, minuteToY(localMinutes(turno.endsAt)) - top - 2);
                return (
                  <Link
                    key={turno.id}
                    href={`/dashboard/agenda/${turno.id}`}
                    title={`${STATUS_LABELS[turno.status]}: ${turno.clientName}, ${turno.serviceName}`}
                    className={cn(
                      "absolute inset-x-1.5 flex flex-col overflow-hidden rounded-xl border px-2.5 py-1.5 text-xs shadow-soft transition-transform hover:z-10 hover:scale-[1.02]",
                      STATUS_BLOCK[turno.status],
                    )}
                    style={{ top: top + 1, height: blockHeight }}
                  >
                    <span className="font-bold tabular">
                      {formatInZone(turno.startsAt, timeZone, "HH:mm")} · {turno.clientName}
                    </span>
                    {blockHeight > 40 && <span className="truncate opacity-80">{turno.serviceName}</span>}
                  </Link>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
