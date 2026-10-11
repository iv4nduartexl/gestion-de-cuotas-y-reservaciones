// The schedule wizard's model: a few simple answers ("qué días", "de qué
// hora a qué hora", "¿cortás al mediodía?", "¿algún día distinto?") turned
// into weekly blocks. Pure, so it is unit-tested and shared by the wizard.

import { scheduleIssues, type Issue, type ScheduleDay } from "@/lib/config-rules";
import { timeToMinutes } from "@/lib/datetime";

export type ScheduleWizardValues = {
  days: number[];
  open: string;
  close: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
  /** Days with their own hours (no break), e.g. Saturday 08:00–12:00. */
  special: Record<number, { open: string; close: string }>;
};

export const DEFAULT_SCHEDULE: ScheduleWizardValues = {
  days: [1, 2, 3, 4, 5],
  open: "08:00",
  close: "18:00",
  hasBreak: true,
  breakStart: "12:00",
  breakEnd: "14:00",
  special: {},
};

/** The weekly blocks the answers describe. */
export function buildSchedule(values: ScheduleWizardValues): ScheduleDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    if (!values.days.includes(weekday)) return { weekday, ranges: [] };
    const special = values.special[weekday];
    if (special) return { weekday, ranges: [{ start: special.open, end: special.close }] };
    if (values.hasBreak) {
      return {
        weekday,
        ranges: [
          { start: values.open, end: values.breakStart },
          { start: values.breakEnd, end: values.close },
        ],
      };
    }
    return { weekday, ranges: [{ start: values.open, end: values.close }] };
  });
}

/**
 * Turns saved rules back into answers. `representable` is false when the
 * schedule has details the wizard can't express (e.g. three blocks a day,
 * different breaks per day): then the day-by-day editor is offered instead.
 */
export function fromRules(rules: { weekday: number; startTime: string; endTime: string }[]): {
  values: ScheduleWizardValues;
  representable: boolean;
} {
  if (rules.length === 0) return { values: DEFAULT_SCHEDULE, representable: true };
  const byDay = new Map<number, { start: string; end: string }[]>();
  for (const rule of rules) {
    const list = byDay.get(rule.weekday) ?? [];
    list.push({ start: rule.startTime, end: rule.endTime });
    byDay.set(rule.weekday, list.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)));
  }
  const days = [...byDay.keys()].sort();
  // The most common pattern is the "base"; other days become special days.
  const patterns = new Map<string, number>();
  for (const ranges of byDay.values()) {
    const key = JSON.stringify(ranges);
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  const base = JSON.parse([...patterns.entries()].sort((a, b) => b[1] - a[1])[0][0]) as { start: string; end: string }[];
  let representable = base.length <= 2;
  const values: ScheduleWizardValues = {
    days,
    open: base[0].start,
    close: base[base.length - 1].end,
    hasBreak: base.length === 2,
    breakStart: base.length === 2 ? base[0].end : DEFAULT_SCHEDULE.breakStart,
    breakEnd: base.length === 2 ? base[1].start : DEFAULT_SCHEDULE.breakEnd,
    special: {},
  };
  for (const [weekday, ranges] of byDay) {
    if (JSON.stringify(ranges) === JSON.stringify(base)) continue;
    if (ranges.length !== 1) representable = false;
    values.special[weekday] = { open: ranges[0].start, close: ranges[ranges.length - 1].end };
  }
  return { values, representable };
}

/** Problems for one wizard step, with fixes. */
export function scheduleStepIssues(step: "dias" | "horario" | "corte" | "distinto", values: ScheduleWizardValues): Issue<ScheduleWizardValues>[] {
  const issues: Issue<ScheduleWizardValues>[] = [];
  const minutes = timeToMinutes;
  if (step === "dias" && values.days.length === 0) {
    issues.push({ field: "days", message: "Elegí al menos un día en el que atendés.", fixes: [{ label: "Lunes a viernes", patch: { days: [1, 2, 3, 4, 5] } }] });
  }
  if (step === "horario" && minutes(values.close) - minutes(values.open) < 30) {
    issues.push({
      field: "close",
      message: `Cerrás (${values.close}) antes de abrir (${values.open}) o con muy poco tiempo. Tiene que haber al menos media hora.`,
      fixes: [{ label: "De 08:00 a 18:00", patch: { open: "08:00", close: "18:00" } }],
    });
  }
  if (step === "corte" && values.hasBreak) {
    const inside = minutes(values.open) < minutes(values.breakStart) && minutes(values.breakEnd) < minutes(values.close);
    if (!inside || minutes(values.breakEnd) <= minutes(values.breakStart)) {
      issues.push({
        field: "breakStart",
        message: `El corte (${values.breakStart} a ${values.breakEnd}) tiene que quedar dentro de tu horario (${values.open} a ${values.close}) y terminar después de empezar.`,
        fixes: [
          { label: "Corte de 12:00 a 14:00", patch: { breakStart: "12:00", breakEnd: "14:00" } },
          { label: "No corto", patch: { hasBreak: false } },
        ],
      });
    }
  }
  if (step === "distinto") {
    for (const [weekday, hours] of Object.entries(values.special)) {
      if (minutes(hours.close) - minutes(hours.open) < 30) {
        const rest = { ...values.special };
        delete rest[Number(weekday)];
        issues.push({
          field: "special",
          message: `Un día distinto cierra antes de abrir (${hours.open} a ${hours.close}).`,
          fixes: [{ label: "Que sea igual a los demás", patch: { special: rest } }],
        });
      }
    }
  }
  // Last safety net: the full schedule must pass the rule book.
  if (issues.length === 0 && step === "distinto") {
    for (const found of scheduleIssues({ days: buildSchedule(values) })) {
      issues.push({ field: "special", message: found.message, fixes: [] });
    }
  }
  return issues;
}

const LONG_DAYS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** "Lunes a viernes de 08:00 a 12:00 y de 14:00 a 18:00 · sábado de 08:00 a 12:00". */
export function describeSchedule(days: ScheduleDay[]) {
  const open = days.filter((day) => day.ranges.length > 0);
  if (open.length === 0) return "Cerrado todos los días";
  const groups: { weekdays: number[]; text: string }[] = [];
  for (const day of open) {
    const text = day.ranges.map((range) => `de ${range.start} a ${range.end}`).join(" y ");
    const last = groups.at(-1);
    if (last && last.text === text && last.weekdays.at(-1) === day.weekday - 1) last.weekdays.push(day.weekday);
    else groups.push({ weekdays: [day.weekday], text });
  }
  return groups
    .map((group) => {
      const first = LONG_DAYS[group.weekdays[0]];
      const label =
        group.weekdays.length === 1
          ? first
          : group.weekdays.length === 2
            ? `${first} y ${LONG_DAYS[group.weekdays[1]]}`
            : `${first} a ${LONG_DAYS[group.weekdays.at(-1)!]}`;
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${group.text}`;
    })
    .join(" · ");
}
