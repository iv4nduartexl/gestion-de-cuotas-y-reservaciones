import { CalendarDaysIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/appointment-status";
import type { AppointmentWithNames } from "@/lib/data/appointments";
import { formatInZone } from "@/lib/datetime";

export function TodayCard({
  turnos,
  timeZone,
  pending,
}: {
  turnos: AppointmentWithNames[];
  timeZone: string;
  pending: number;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CalendarDaysIcon className="size-5 text-primary" aria-hidden="true" /> Próximos turnos de hoy
        </h2>
        {pending > 0 && <Badge variant="warning">{pending} por confirmar</Badge>}
      </div>
      {turnos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No te quedan turnos por hoy.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {turnos.map((turno) => (
            <li key={turno.id}>
              <Link href={`/dashboard/agenda/${turno.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                <span className="w-12 font-extrabold tabular">{formatInZone(turno.startsAt, timeZone, "HH:mm")}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{turno.clientName}</span>
                  <span className="truncate text-xs text-muted-foreground">{turno.serviceName}</span>
                </span>
                {turno.status === "pending" && <Badge variant={STATUS_BADGE[turno.status]}>{STATUS_LABELS[turno.status]}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/agenda" className="flex items-center gap-1 text-sm font-semibold text-primary">
        Ver agenda completa <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
