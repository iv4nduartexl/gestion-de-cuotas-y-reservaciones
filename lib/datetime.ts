import { TZDate, tz } from "@date-fns/tz";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Wall-clock times (business hours) are stored as "HH:mm[:ss]" strings in the
// business timezone; instants are stored as UTC timestamptz.

/** ISO weekday labels: 1 = Monday ... 7 = Sunday. */
export const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "08:30:00" -> "08:30" */
export function toHHmm(time: string): string {
  return time.slice(0, 5);
}

/** "08:30" -> 510 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts a wall-clock date + time in `timeZone` into a UTC instant.
 * zonedToUtc("2026-10-12", "08:30", "America/Asuncion") -> 2026-10-12T11:30Z
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    new TZDate(year, month - 1, day, hours, minutes, 0, timeZone).getTime(),
  );
}

/** "2026-10-12" + 1 -> "2026-10-13" (calendar arithmetic, no timezone). */
export function addDaysToDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Formats a UTC instant in the business timezone (Spanish locale). */
export function formatInZone(
  instant: Date,
  timeZone: string,
  pattern = "EEE d MMM yyyy, HH:mm",
): string {
  return format(instant, pattern, { in: tz(timeZone), locale: es });
}

/** Today's date ("yyyy-MM-dd") in the given timezone. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd", { in: tz(timeZone) });
}

/** Formats a calendar date string ("yyyy-MM-dd"), independent of timezone. */
export function formatCalendarDate(date: string, pattern = "EEE d MMM yyyy"): string {
  return format(parseISO(date), pattern, { locale: es });
}

/** 90 -> "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
