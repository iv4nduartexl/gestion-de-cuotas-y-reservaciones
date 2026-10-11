import { CalendarOffIcon } from "lucide-react";
import Link from "next/link";

import { deleteBlockedSlotAction } from "@/app/dashboard/schedule/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { addDaysToDate, formatCalendarDate, formatInZone } from "@/lib/datetime";

type Slot = {
  id: string;
  staffId: string | null;
  staffName: string | null;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
};

function describeRange(slot: Slot, timeZone: string) {
  const startTime = formatInZone(slot.startsAt, timeZone, "HH:mm");
  const endTime = formatInZone(slot.endsAt, timeZone, "HH:mm");
  const startDay = formatInZone(slot.startsAt, timeZone, "yyyy-MM-dd");
  const endDay = formatInZone(slot.endsAt, timeZone, "yyyy-MM-dd");
  const dayLabel = (day: string) => formatCalendarDate(day, "EEE dd/MM/yyyy");

  if (startTime === "00:00" && endTime === "00:00") {
    // All-day: the stored end is midnight of the following day.
    const lastDay = addDaysToDate(endDay, -1);
    return {
      day: formatCalendarDate(startDay, "d"),
      month: formatCalendarDate(startDay, "MMM"),
      text: lastDay === startDay ? `${dayLabel(startDay)} · todo el día` : `${dayLabel(startDay)} → ${dayLabel(lastDay)}`,
    };
  }
  return {
    day: formatCalendarDate(startDay, "d"),
    month: formatCalendarDate(startDay, "MMM"),
    text:
      startDay === endDay
        ? `${dayLabel(startDay)} · ${startTime} a ${endTime}`
        : `${dayLabel(startDay)} ${startTime} → ${dayLabel(endDay)} ${endTime}`,
  };
}

export function BlockedSlotList({
  slots,
  timeZone,
  canDelete,
  showWho,
  editHref,
}: {
  slots: Slot[];
  timeZone: string;
  canDelete: (slot: Slot) => boolean;
  showWho: boolean;
  /** Where "Editar" goes (only for slots the user can manage). */
  editHref?: (slot: Slot) => string;
}) {
  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
        <CalendarOffIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        No hay días libres próximos. Agregá vacaciones, trámites o feriados para que nadie reserve esos días.
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
      {slots.map((slot) => {
        const range = describeRange(slot, timeZone);
        return (
          <li key={slot.id} className="flex flex-wrap items-center gap-4 p-4">
            <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-coral-soft text-coral-foreground">
              <span className="text-lg leading-none font-extrabold">{range.day}</span>
              <span className="text-xs font-bold uppercase">{range.month}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold first-letter:uppercase">{range.text}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {showWho &&
                  (slot.staffId ? (
                    <Badge variant="neutral">{slot.staffName}</Badge>
                  ) : (
                    <Badge variant="info">Todo el negocio</Badge>
                  ))}
                {slot.reason}
              </span>
            </div>
            {canDelete(slot) && editHref && (
              <Link href={editHref(slot)} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Editar día libre ${range.text}`}>
                Editar
              </Link>
            )}
            {canDelete(slot) && (
              <ConfirmActionButton
                action={deleteBlockedSlotAction.bind(null, slot.id)}
                label="Quitar"
                size="sm"
                variant="ghost"
                title="¿Quitar este día libre?"
                description="Esos horarios vuelven a estar disponibles para reservas."
                confirmLabel="Quitar"
                successMessage="Día libre quitado"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
