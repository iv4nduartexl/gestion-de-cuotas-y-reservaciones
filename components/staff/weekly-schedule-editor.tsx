"use client";

import { PlusIcon, WandSparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { TimeSelect } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import { timeToMinutes, WEEKDAYS } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type Range = { start: string; end: string };
type Schedule = Record<number, Range[]>;

const MORNING: Range = { start: "08:00", end: "12:00" };
const AFTERNOON: Range = { start: "14:00", end: "18:00" };

function toSchedule(rules: { weekday: number; startTime: string; endTime: string }[]) {
  const schedule: Schedule = {};
  for (const { value } of WEEKDAYS) schedule[value] = [];
  for (const rule of rules) schedule[rule.weekday].push({ start: rule.startTime, end: rule.endTime });
  return schedule;
}

function preset(days: number[], ranges: Range[]): Schedule {
  const schedule: Schedule = {};
  for (const { value } of WEEKDAYS) schedule[value] = days.includes(value) ? ranges.map((r) => ({ ...r })) : [];
  return schedule;
}

const PRESETS: { label: string; build: () => Schedule }[] = [
  { label: "Lun a vie · 08–12 y 14–18", build: () => preset([1, 2, 3, 4, 5], [MORNING, AFTERNOON]) },
  { label: "Lun a sáb · 08–18", build: () => preset([1, 2, 3, 4, 5, 6], [{ start: "08:00", end: "18:00" }]) },
  { label: "Lun a sáb · 09–20", build: () => preset([1, 2, 3, 4, 5, 6], [{ start: "09:00", end: "20:00" }]) },
];

function overlaps(ranges: Range[]) {
  const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return sorted.some((range, i) => i > 0 && timeToMinutes(range.start) < timeToMinutes(sorted[i - 1].end));
}

export function WeeklyScheduleEditor({
  action,
  rules,
  disabled = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  rules: { weekday: number; startTime: string; endTime: string }[];
  disabled?: boolean;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const [schedule, setSchedule] = useState<Schedule>(() => toSchedule(rules));

  const update = (weekday: number, ranges: Range[]) =>
    setSchedule((current) => ({ ...current, [weekday]: ranges }));

  const copyMondayToWeekdays = () =>
    setSchedule((current) => {
      const next = { ...current };
      for (const weekday of [2, 3, 4, 5]) next[weekday] = current[1].map((r) => ({ ...r }));
      return next;
    });

  const payload = JSON.stringify(WEEKDAYS.map(({ value }) => ({ weekday: value, ranges: schedule[value] })));
  const openDays = WEEKDAYS.filter(({ value }) => schedule[value].length > 0).length;

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <input type="hidden" name="schedule" value={payload} />
      {state.errors?.form && <FormMessage type="error">{state.errors.form}</FormMessage>}

      {!disabled && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <WandSparklesIcon className="size-4" aria-hidden="true" /> Atajos
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Button key={item.label} type="button" variant="soft" size="sm" onClick={() => setSchedule(item.build())}>
                {item.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={copyMondayToWeekdays}>
              Copiar lunes a martes–viernes
            </Button>
          </div>
        </div>
      )}

      <fieldset disabled={disabled || pending} className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
        <legend className="sr-only">Horario semanal</legend>
        {WEEKDAYS.map(({ value: weekday, label }) => {
          const ranges = schedule[weekday];
          const open = ranges.length > 0;
          const hasOverlap = overlaps(ranges);
          return (
            <div
              key={weekday}
              data-testid={`weekday-${weekday}`}
              className={cn(
                "grid gap-3 p-4 transition-colors sm:grid-cols-[11rem_1fr] sm:items-start",
                !open && "bg-muted/40",
              )}
            >
              <label className="flex cursor-pointer items-center gap-3 sm:pt-2">
                <Switch
                  checked={open}
                  onCheckedChange={(checked) => update(weekday, checked ? [{ ...MORNING }, { ...AFTERNOON }] : [])}
                  aria-label={`${label}: ${open ? "abierto" : "cerrado"}`}
                />
                <span className="flex flex-col leading-tight">
                  <span className="font-bold">{label}</span>
                  <span className={cn("text-xs font-semibold", open ? "text-success" : "text-muted-foreground")}>
                    {open ? "Abierto" : "Cerrado"}
                  </span>
                </span>
              </label>

              {open ? (
                <div className="flex flex-col gap-2">
                  {ranges.map((range, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <TimeSelect
                        aria-label={`${label}: desde`}
                        value={range.start}
                        onChange={(start) =>
                          update(weekday, ranges.map((r, i) => (i === index ? { ...r, start } : r)))
                        }
                      />
                      <span className="text-sm text-muted-foreground">a</span>
                      <TimeSelect
                        aria-label={`${label}: hasta`}
                        value={range.end}
                        onChange={(end) => update(weekday, ranges.map((r, i) => (i === index ? { ...r, end } : r)))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar franja de ${label}`}
                        onClick={() => update(weekday, ranges.filter((_, i) => i !== index))}
                      >
                        <XIcon />
                      </Button>
                      {timeToMinutes(range.end) <= timeToMinutes(range.start) && (
                        <span className="text-xs font-semibold text-destructive">El fin debe ser después del inicio</span>
                      )}
                    </div>
                  ))}
                  {hasOverlap && (
                    <span className="text-xs font-semibold text-destructive">Estas franjas se superponen.</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-primary"
                    onClick={() => {
                      const last = ranges.at(-1);
                      update(weekday, [...ranges, last ? { ...AFTERNOON } : { ...MORNING }]);
                    }}
                  >
                    <PlusIcon /> Agregar franja
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground sm:pt-2.5">No se toman turnos este día.</span>
              )}
            </div>
          );
        })}
      </fieldset>

      {!disabled && (
        <div className="sticky bottom-24 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 pl-4 shadow-lift backdrop-blur md:bottom-6">
          <span className="text-sm text-muted-foreground">
            {openDays === 0 ? "Todos los días cerrados" : `${openDays} día${openDays === 1 ? "" : "s"} abierto${openDays === 1 ? "" : "s"}`}
          </span>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar horario"}
          </Button>
        </div>
      )}
    </form>
  );
}
