// The rule book: does a configuration make sense? Pure and shared by the
// wizards (to block "Siguiente" and offer one-tap fixes) and by the server
// validation (so a hand-crafted request can't save nonsense either).
// Messages are plain Spanish for non-technical owners.

import { formatDuration, timeToMinutes } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import type { StayUnit } from "@/lib/service-constants";
import { STAY_UNIT_WORDS } from "@/lib/service-constants";
import { stayPrice } from "@/lib/stays";

export type Fix<T> = { label: string; patch: Partial<T> };
export type Issue<T> = { field: Extract<keyof T, string> | "form"; message: string; fixes: Fix<T>[] };

const issue = <T,>(field: Issue<T>["field"], message: string, fixes: Fix<T>[] = []): Issue<T> => ({ field, message, fixes });

// ── Schedule ────────────────────────────────────────────────────────────

export type ScheduleDay = { weekday: number; ranges: { start: string; end: string }[] };
export type ScheduleValues = { days: ScheduleDay[] };

const MIN_BLOCK_MINUTES = 30;
const DAY_NAMES = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function scheduleIssues(values: ScheduleValues): Issue<ScheduleValues>[] {
  const issues: Issue<ScheduleValues>[] = [];
  const open = values.days.filter((day) => day.ranges.length > 0);
  if (open.length === 0) {
    issues.push(issue<ScheduleValues>("days", "Elegí al menos un día en el que atendés: si no, nadie va a poder reservar."));
  }
  for (const day of open) {
    const name = DAY_NAMES[day.weekday];
    const sorted = [...day.ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (const range of sorted) {
      const length = timeToMinutes(range.end) - timeToMinutes(range.start);
      if (length <= 0) {
        issues.push(issue<ScheduleValues>("days", `El ${name} cerrás (${range.end}) antes de abrir (${range.start}). Revisá las horas.`));
      } else if (length < MIN_BLOCK_MINUTES) {
        issues.push(issue<ScheduleValues>("days", `El ${name} hay un horario de solo ${length} minutos (${range.start} a ${range.end}). Tiene que durar al menos media hora.`));
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
        issues.push(issue<ScheduleValues>("days", `El ${name} hay dos horarios que se pisan (${sorted[i - 1].start}–${sorted[i - 1].end} y ${sorted[i].start}–${sorted[i].end}).`));
      }
    }
  }
  return issues;
}

// ── Turno services ("Por horario") ─────────────────────────────────────

export type SlotServiceValues = { durationMinutes: number };

/**
 * `longestMinutes`: the longest turno the people who do it could take on any
 * day (null = they have no hours yet, which the wizard explains separately).
 */
export function slotServiceIssues(values: SlotServiceValues, { longestMinutes }: { longestMinutes: number | null }): Issue<SlotServiceValues>[] {
  const issues: Issue<SlotServiceValues>[] = [];
  const minutes = values.durationMinutes;
  if (!Number.isFinite(minutes) || minutes < 5) {
    issues.push(issue<SlotServiceValues>("durationMinutes", "Elegí cuánto dura: al menos 5 minutos."));
  } else if (minutes > 24 * 60) {
    issues.push(issue<SlotServiceValues>("durationMinutes", "Un turno puede durar como mucho 24 horas. Para alquileres de varios días, elegí “Por días”."));
  } else if (minutes % 5 !== 0) {
    const rounded = Math.round(minutes / 5) * 5;
    issues.push(issue<SlotServiceValues>("durationMinutes", "Usá minutos de 5 en 5.", [{ label: `Usar ${formatDuration(rounded)}`, patch: { durationMinutes: rounded } }]));
  } else if (longestMinutes !== null && longestMinutes > 0 && minutes > longestMinutes) {
    const fits = Math.floor(longestMinutes / 5) * 5;
    issues.push(
      issue<SlotServiceValues>(
        "durationMinutes",
        `Dura ${formatDuration(minutes)}, pero tu día más largo es de ${formatDuration(longestMinutes)}: nadie podría reservarlo. Acortalo o ampliá tu horario.`,
        [{ label: `Usar ${formatDuration(fits)}`, patch: { durationMinutes: fits } }],
      ),
    );
  }
  return issues;
}

// ── Rentals ("Por días") ────────────────────────────────────────────────

export type StayValues = {
  stayUnit: StayUnit;
  checkInTime: string;
  checkOutTime: string;
  minStay: number;
  maxStay: number | null;
  price: number;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
};

export function stayIssues(values: StayValues, currency: string): Issue<StayValues>[] {
  const issues: Issue<StayValues>[] = [];
  const money = (amount: number) => formatMoney(amount, currency);
  const [one, many] = STAY_UNIT_WORDS[values.stayUnit];

  // Per day, a one-day booking starts and ends the same day.
  if (values.stayUnit === "day" && timeToMinutes(values.checkOutTime) <= timeToMinutes(values.checkInTime)) {
    const later = Math.min(23 * 60 + 55, timeToMinutes(values.checkInTime) + 8 * 60);
    const laterTime = `${String(Math.floor(later / 60)).padStart(2, "0")}:${String(later % 60).padStart(2, "0")}`;
    issues.push(
      issue<StayValues>(
        "checkOutTime",
        `Si cobrás por día, la salida tiene que ser después de la entrada el mismo día (entra ${values.checkInTime}, sale ${values.checkOutTime}). Si se quedan a dormir, cobrá por noche.`,
        [
          { label: `Salida a las ${laterTime}`, patch: { checkOutTime: laterTime } },
          { label: "Cobrar por noche", patch: { stayUnit: "night" } },
        ],
      ),
    );
  }
  if (!Number.isInteger(values.minStay) || values.minStay < 1) {
    issues.push(issue<StayValues>("minStay", `El mínimo tiene que ser al menos 1 ${one}.`, [{ label: `Mínimo 1 ${one}`, patch: { minStay: 1 } }]));
  }
  if (values.maxStay !== null && values.maxStay < values.minStay) {
    issues.push(
      issue<StayValues>("maxStay", `El máximo (${values.maxStay} ${many}) es menor que el mínimo (${values.minStay}).`, [
        { label: `Máximo ${values.minStay} ${values.minStay === 1 ? one : many}`, patch: { maxStay: values.minStay } },
        { label: "Sin máximo", patch: { maxStay: null } },
      ]),
    );
  }
  if (!(values.price > 0)) {
    issues.push(issue<StayValues>("price", `Poné el precio por ${one}.`));
    return issues;
  }
  if (values.weeklyPrice !== null && values.weeklyPrice > 7 * values.price) {
    issues.push(
      issue<StayValues>("weeklyPrice", `El precio por semana (${money(values.weeklyPrice)}) sale más caro que 7 ${many} sueltas (${money(7 * values.price)}).`, [
        { label: "Quitar precio por semana", patch: { weeklyPrice: null } },
        { label: `Usar ${money(7 * values.price)}`, patch: { weeklyPrice: 7 * values.price } },
      ]),
    );
  }
  if (values.monthlyPrice !== null) {
    const withoutMonth = stayPrice({ price: values.price, weeklyPrice: values.weeklyPrice, monthlyPrice: null }, 30).total;
    if (values.monthlyPrice > withoutMonth) {
      issues.push(
        issue<StayValues>("monthlyPrice", `El precio por mes (${money(values.monthlyPrice)}) sale más caro que pagar 30 ${many} (${money(withoutMonth)}).`, [
          { label: "Quitar precio por mes", patch: { monthlyPrice: null } },
          { label: `Usar ${money(withoutMonth)}`, patch: { monthlyPrice: withoutMonth } },
        ]),
      );
    }
  }
  return issues;
}

// ── Plans ───────────────────────────────────────────────────────────────

export type PlanValues = { price: number; intervalCount: number };

export function planIssues(values: PlanValues): Issue<PlanValues>[] {
  const issues: Issue<PlanValues>[] = [];
  if (!(values.price > 0)) issues.push(issue<PlanValues>("price", "Poné cuánto se cobra en cada cuota."));
  if (!Number.isInteger(values.intervalCount) || values.intervalCount < 1 || values.intervalCount > 365) {
    issues.push(issue<PlanValues>("intervalCount", "Elegí cada cuánto se cobra: un número entre 1 y 365.", [{ label: "Cada 1", patch: { intervalCount: 1 } }]));
  }
  return issues;
}

// ── Online booking rules ────────────────────────────────────────────────

export type BookingRuleValues = {
  minNoticeMinutes: number;
  maxDaysAhead: number;
  clientCancelNoticeHours: number;
  slotIntervalMinutes: number;
};

const INTERVALS = [5, 10, 15, 20, 30, 45, 60];

export function bookingRuleIssues(values: BookingRuleValues, { shortestServiceMinutes }: { shortestServiceMinutes: number | null }): Issue<BookingRuleValues>[] {
  const issues: Issue<BookingRuleValues>[] = [];
  if (values.minNoticeMinutes >= values.maxDaysAhead * 24 * 60) {
    issues.push(
      issue<BookingRuleValues>("minNoticeMinutes", "Pedís más anticipación que los días que dejás reservar: nadie podría reservar nunca.", [
        { label: "Anticipación de 1 hora", patch: { minNoticeMinutes: 60 } },
      ]),
    );
  }
  if (values.clientCancelNoticeHours >= values.maxDaysAhead * 24) {
    issues.push(
      issue<BookingRuleValues>("clientCancelNoticeHours", "El plazo para cancelar es más largo que los días que dejás reservar: nadie podría cancelar online.", [
        { label: "Hasta 4 horas antes", patch: { clientCancelNoticeHours: 4 } },
      ]),
    );
  }
  if (shortestServiceMinutes !== null && values.slotIntervalMinutes > shortestServiceMinutes) {
    const fit = [...INTERVALS].reverse().find((interval) => interval <= shortestServiceMinutes) ?? 5;
    issues.push(
      issue<BookingRuleValues>(
        "slotIntervalMinutes",
        `Ofrecés horarios cada ${values.slotIntervalMinutes} minutos, pero tenés servicios de ${shortestServiceMinutes}: quedarían huecos sin usar entre turnos.`,
        [{ label: `Cada ${fit} minutos`, patch: { slotIntervalMinutes: fit } }],
      ),
    );
  }
  return issues;
}

// ── Cuotas: changing what is owed ───────────────────────────────────────

export type ChargeAmountValues = { amount: number | null };

/** A new total for a cuota: never below what was already paid. */
export function chargeAmountIssues(values: ChargeAmountValues, { paid, currency }: { paid: number; currency: string }): Issue<ChargeAmountValues>[] {
  if (values.amount === null || !Number.isInteger(values.amount)) return [issue<ChargeAmountValues>("amount", "Escribí el nuevo monto.")];
  if (values.amount < paid) {
    return [
      issue<ChargeAmountValues>("amount", `Ya pagó ${formatMoney(paid, currency)}: el monto no puede ser menor a eso.`, [
        { label: `Dejar ${formatMoney(paid, currency)} (queda pagada)`, patch: { amount: paid } },
      ]),
    ];
  }
  if (values.amount === 0) return [issue<ChargeAmountValues>("amount", "Para no cobrarla, usá “Anular” en vez de poner 0.")];
  return [];
}

export type SplitPart = { amount: number | null; dueDate: string };
export type SplitValues = { parts: SplitPart[] };
export const MAX_SPLIT_PARTS = 4;

/** `total` in `count` integer parts that add up exactly (the first one takes the remainder). */
export function equalParts(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? total - base * count : 0));
}

/** Splitting what's left of a cuota: 2–4 parts that add up to it, each with a due date, in order. */
export function splitIssues(values: SplitValues, { remaining, currency }: { remaining: number; currency: string }): Issue<SplitValues>[] {
  const issues: Issue<SplitValues>[] = [];
  const { parts } = values;
  const evenly = (count: number) => {
    const amounts = equalParts(remaining, count);
    return { parts: parts.slice(0, count).map((part, i) => ({ ...part, amount: amounts[i] })) };
  };
  if (parts.length < 2 || parts.length > MAX_SPLIT_PARTS) {
    issues.push(issue<SplitValues>("parts", `Se puede dividir en 2 a ${MAX_SPLIT_PARTS} partes.`));
    return issues;
  }
  if (remaining < parts.length) {
    issues.push(issue<SplitValues>("parts", "Lo que falta pagar es muy poco para dividirlo."));
    return issues;
  }
  if (parts.some((part) => part.amount === null || !Number.isInteger(part.amount) || part.amount <= 0)) {
    issues.push(issue<SplitValues>("parts", "Cada parte tiene que tener un monto.", [{ label: "Repartir en partes iguales", patch: evenly(parts.length) }]));
  } else {
    const sum = parts.reduce((total, part) => total + (part.amount ?? 0), 0);
    if (sum !== remaining) {
      const diff = remaining - sum;
      issues.push(
        issue<SplitValues>(
          "parts",
          `Las partes suman ${formatMoney(sum, currency)} y falta pagar ${formatMoney(remaining, currency)} (${diff > 0 ? "faltan" : "sobran"} ${formatMoney(Math.abs(diff), currency)}).`,
          [{ label: "Repartir en partes iguales", patch: evenly(parts.length) }],
        ),
      );
    }
  }
  if (parts.some((part) => !part.dueDate)) {
    issues.push(issue<SplitValues>("parts", "Elegí cuándo vence cada parte."));
  } else if (parts.some((part, i) => i > 0 && part.dueDate < parts[i - 1].dueDate)) {
    issues.push(
      issue<SplitValues>("parts", "Las fechas tienen que ir en orden: cada parte vence después de la anterior.", [
        { label: "Ordenar por fecha", patch: { parts: [...parts].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) } },
      ]),
    );
  }
  return issues;
}

// ── Memberships: changing the billing day ───────────────────────────────

export type ReanchorValues = { newStart: string };

/**
 * A new billing day starts a new period. It can't be in the past, and it
 * can't start before the period already billed ends (that would charge the
 * same days twice).
 */
export function reanchorIssues(values: ReanchorValues, { today, billedUntil }: { today: string; billedUntil: string | null }): Issue<ReanchorValues>[] {
  if (!values.newStart) return [issue<ReanchorValues>("newStart", "Elegí desde qué día cobra.")];
  if (values.newStart < today) return [issue<ReanchorValues>("newStart", "Tiene que ser hoy o más adelante.", [{ label: "Desde hoy", patch: { newStart: today } }])];
  if (billedUntil && values.newStart < billedUntil) {
    return [
      issue<ReanchorValues>("newStart", "Ese día ya está cubierto por la cuota actual: le cobrarías dos veces los mismos días.", [
        { label: "Cuando termina la cuota actual", patch: { newStart: billedUntil } },
      ]),
    ];
  }
  return [];
}

/** Applies a fix to the current values (used by the wizards' fix buttons). */
export function applyFix<T>(values: T, fix: Fix<T>): T {
  return { ...values, ...fix.patch };
}

/** Adds rule issues to a Zod refinement context (server-side enforcement). */
export function reportIssues(ctx: { addIssue: (issue: { code: "custom"; message: string; path: (string | number)[] }) => void }, issues: Issue<unknown>[]) {
  for (const found of issues) ctx.addIssue({ code: "custom", message: found.message, path: found.field === "form" ? [] : [found.field] });
}
