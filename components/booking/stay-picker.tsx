"use client";

import { Loader2Icon } from "lucide-react";
import { es } from "react-day-picker/locale";
import { useEffect, useState, useTransition } from "react";

import type { StayCalendar } from "@/app/[slug]/actions";
import { Calendar } from "@/components/ui/calendar";
import { formatCalendarDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { stayAmount, STAY_UNIT_WORDS, type StayUnit } from "@/lib/service-constants";
import { quoteStay, rangeIsFree, stayUnits, type StayService } from "@/lib/stays";
import { cn } from "@/lib/utils";

export type StayOption = StayService & { id: string; name: string; description: string | null; currency: string };
export type StayRange = { checkIn: string; checkOut: string };

const toDate = (value: string) => new Date(`${value}T12:00:00`);
const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Two calendars for a rental, one tap each: "¿Qué día llegás?" then "¿Qué día
 * te vas?". Taken dates are disabled; the second calendar only enables valid
 * exits (after the entry, within min/max, without crossing a taken night).
 * Shows a live quote; the server prices it again before booking.
 */
export function StayPicker({
  service,
  timeZone,
  value,
  onChange,
  loadCalendar,
}: {
  service: StayOption;
  timeZone: string;
  value: StayRange | null;
  onChange: (range: StayRange | null) => void;
  /** Taken dates from `fromDate` (public page or dashboard action). */
  loadCalendar: (fromDate: string) => Promise<StayCalendar | null>;
}) {
  const [taken, setTaken] = useState<Set<string> | null>(null);
  const [bounds, setBounds] = useState<{ first: string; last: string; lastCheckIn: string } | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(value?.checkIn ?? null);
  const [loading, startLoading] = useTransition();

  function load(fromDate: string) {
    startLoading(async () => {
      const result = await loadCalendar(fromDate);
      if (!result) return;
      setBounds({ first: result.firstDate, last: result.lastDate, lastCheckIn: result.lastCheckIn });
      setTaken((current) => new Set([...(current ?? []), ...result.taken]));
    });
  }

  // First load for this rental.
  useEffect(() => {
    load(value?.checkIn ?? toKey(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  const unit: StayUnit = service.stayUnit;
  const isNight = unit === "night";
  const takenSet = taken ?? new Set<string>();
  const outOfRange = (key: string) => !bounds || key < bounds.first || key > bounds.last;

  /** Can `date` be the entry? (that night/day is free) */
  function validEntry(key: string) {
    return !outOfRange(key) && key <= (bounds?.lastCheckIn ?? key) && !takenSet.has(key);
  }

  /** Can `date` be the exit of a stay starting at `start`? */
  function validExit(start: string, key: string) {
    if (isNight ? key <= start : key < start) return false;
    const units = stayUnits(unit, start, key);
    if (units < service.minStay || (service.maxStay !== null && units > service.maxStay)) return false;
    return rangeIsFree(unit, start, key, takenSet);
  }

  function chooseEntry(date: Date | undefined) {
    if (!date) return;
    const key = toKey(date);
    setCheckIn(key);
    // Keep the exit only if it still makes sense.
    if (value && validExit(key, value.checkOut)) onChange({ checkIn: key, checkOut: value.checkOut });
    else onChange(null);
  }

  function chooseExit(date: Date | undefined) {
    if (!date || !checkIn) return;
    onChange({ checkIn, checkOut: toKey(date) });
  }

  const quote = value ? quoteStay(service, value.checkIn, value.checkOut, timeZone) : null;
  const words = STAY_UNIT_WORDS[unit];

  if (taken === null) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Buscando fechas libres…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Entrada desde las <strong>{service.checkInTime}</strong>, salida hasta las <strong>{service.checkOutTime}</strong>.
        {service.minStay > 1 && ` Mínimo ${stayAmount(unit, service.minStay)}.`}
        {service.maxStay !== null && ` Máximo ${stayAmount(unit, service.maxStay)}.`} Los días tachados ya están ocupados.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CalendarBox
          title={isNight ? "1. ¿Qué día llegás?" : "1. ¿Qué día empieza?"}
          subtitle={checkIn ? formatCalendarDate(checkIn, "EEEE d 'de' MMMM") : "Tocá un día"}
          active={!checkIn}
        >
          <Calendar
            mode="single"
            locale={es}
            selected={checkIn ? toDate(checkIn) : undefined}
            onSelect={chooseEntry}
            disabled={(date) => !validEntry(toKey(date))}
            defaultMonth={checkIn ? toDate(checkIn) : undefined}
            startMonth={bounds ? toDate(bounds.first) : undefined}
            endMonth={bounds ? toDate(bounds.lastCheckIn) : undefined}
            onMonthChange={(month) => load(toKey(new Date(month.getFullYear(), month.getMonth(), 1)))}
            modifiers={{ taken: (date) => takenSet.has(toKey(date)) }}
            modifiersClassNames={{ taken: "line-through opacity-60" }}
          />
        </CalendarBox>
        <CalendarBox
          title={isNight ? "2. ¿Qué día te vas?" : "2. ¿Qué día termina?"}
          subtitle={value ? formatCalendarDate(value.checkOut, "EEEE d 'de' MMMM") : checkIn ? "Tocá un día" : "Primero elegí la entrada"}
          active={!!checkIn && !value}
        >
          <Calendar
            key={checkIn ?? "none"}
            mode="single"
            locale={es}
            selected={value ? toDate(value.checkOut) : undefined}
            onSelect={chooseExit}
            disabled={(date) => !checkIn || !validExit(checkIn, toKey(date))}
            defaultMonth={checkIn ? toDate(checkIn) : undefined}
            startMonth={checkIn ? toDate(checkIn) : bounds ? toDate(bounds.first) : undefined}
            endMonth={bounds ? toDate(bounds.last) : undefined}
            onMonthChange={(month) => load(toKey(new Date(month.getFullYear(), month.getMonth(), 1)))}
            modifiers={{ taken: (date) => takenSet.has(toKey(date)), entry: (date) => toKey(date) === checkIn }}
            modifiersClassNames={{ taken: "line-through opacity-60", entry: "rounded-md ring-2 ring-primary" }}
          />
        </CalendarBox>
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" /> Actualizando fechas…
        </p>
      )}

      {quote?.ok && value && (
        <div className="flex flex-col gap-1 rounded-2xl bg-primary-soft/60 p-4 text-sm" aria-live="polite">
          <span className="font-bold">
            {stayAmount(unit, quote.quote.units)} · {formatMoney(quote.quote.total, service.currency)}
          </span>
          <span className="text-muted-foreground">
            Entrada {formatCalendarDate(value.checkIn, "EEE d/MM")} {service.checkInTime} → salida {formatCalendarDate(value.checkOut, "EEE d/MM")}{" "}
            {service.checkOutTime}
          </span>
          {quote.quote.breakdown.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {quote.quote.breakdown
                .map((part) =>
                  part.label === "month"
                    ? `${part.count} ${part.count === 1 ? "mes" : "meses"}`
                    : part.label === "week"
                      ? `${part.count} ${part.count === 1 ? "semana" : "semanas"}`
                      : `${part.count} ${part.count === 1 ? words[0] : words[1]}`,
                )
                .join(" + ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarBox({ title, subtitle, active, children }: { title: string; subtitle: string; active: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-3", active && "border-primary ring-2 ring-primary/20")} aria-label={title}>
      <div className="flex flex-col px-1">
        <h3 className="font-bold">{title}</h3>
        <span className="text-sm text-muted-foreground first-letter:uppercase">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}
