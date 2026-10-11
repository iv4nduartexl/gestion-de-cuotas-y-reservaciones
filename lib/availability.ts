// Availability engine: turns weekly hours, días libres and existing turnos
// into bookable start times. Pure (no database), so it is fully unit-tested
// and runs the same in the booking page, the dashboard and the server-side
// re-check before inserting.

import { formatInZone, zonedToUtc } from "@/lib/datetime";

/** Half-open interval [start, end) in epoch milliseconds. */
export type Interval = { start: number; end: number };

export type StaffAvailability = {
  staffId: string;
  /** Weekly hours, wall-clock in the business time zone. ISO weekday 1 = Monday. */
  rules: { weekday: number; startTime: string; endTime: string }[];
  /** Días libres affecting this person (their own and business-wide). */
  blocks: Interval[];
  /** Their active (pending/confirmed) turnos. */
  busy: Interval[];
};

export type SlotOptions = {
  /** Local calendar dates ("yyyy-MM-dd") to compute. */
  dates: string[];
  timeZone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  /** Free time required after each turno. */
  bufferMinutes: number;
  /** Nothing can start before this instant (now + minimum notice). */
  earliestStart: number;
  /** Nothing can start at or after this instant (end of the booking horizon). */
  latestStart?: number;
};

export type Slot = {
  /** ISO instant (UTC). */
  start: string;
  /** "HH:mm" in the business time zone. */
  time: string;
  /** Staff free for the whole slot. */
  staffIds: string[];
};

export type DaySlots = { date: string; slots: Slot[] };

const MINUTE = 60_000;

/** ISO weekday (1 = Monday ... 7 = Sunday) of a calendar date. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Start times one person can take on one date. A turno starts inside an open
 * block and must end inside an open block of the same day; it may cross a
 * break (e.g. 12 h from 08:00 to 20:00 over the lunch gap). Días libres and
 * existing turnos still block the whole span.
 */
function startsForStaff(person: StaffAvailability, date: string, options: SlotOptions): number[] {
  const duration = options.durationMinutes * MINUTE;
  const step = options.slotIntervalMinutes * MINUTE;
  const buffer = options.bufferMinutes * MINUTE;
  const weekday = isoWeekday(date);
  const windows = person.rules
    .filter((rule) => rule.weekday === weekday)
    .map((rule) => ({
      start: zonedToUtc(date, rule.startTime, options.timeZone).getTime(),
      end: zonedToUtc(date, rule.endTime, options.timeZone).getTime(),
    }))
    .sort((a, b) => a.start - b.start);
  if (windows.length === 0) return [];
  const dayEnd = windows[windows.length - 1].end;
  const endsInsideOpenHours = (end: number) => windows.some((window) => end > window.start && end <= window.end);

  const starts: number[] = [];
  for (const window of windows) {
    for (let start = window.start; start < window.end; start += step) {
      const end = start + duration;
      if (end > dayEnd) break;
      if (!endsInsideOpenHours(end)) continue;
      if (start < options.earliestStart) continue;
      if (options.latestStart !== undefined && start >= options.latestStart) break;

      const slot = { start, end };
      if (person.blocks.some((block) => overlaps(slot, block))) continue;
      // Existing turnos keep their buffer after them, and the new one needs
      // its own buffer before the next turno.
      const withBuffer = { start, end: end + buffer };
      if (person.busy.some((turno) => overlaps(withBuffer, { start: turno.start, end: turno.end + buffer }))) {
        continue;
      }
      starts.push(start);
    }
  }
  return starts;
}

/**
 * Longest turno (in minutes) that fits on any weekday with these hours: from
 * the first opening to the last closing of the day. Used to warn when a
 * service is too long to ever be booked.
 */
export function longestBookableMinutes(rules: { weekday: number; startTime: string; endTime: string }[]): number {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const byDay = new Map<number, { first: number; last: number }>();
  for (const rule of rules) {
    const day = byDay.get(rule.weekday);
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    byDay.set(rule.weekday, day ? { first: Math.min(day.first, start), last: Math.max(day.last, end) } : { first: start, last: end });
  }
  return Math.max(0, ...[...byDay.values()].map((day) => day.last - day.first));
}

/**
 * Bookable start times per date. With several staff members, each slot lists
 * who is free ("Cualquiera" = any of them).
 */
export function computeSlots(staff: StaffAvailability[], options: SlotOptions): DaySlots[] {
  return options.dates.map((date) => {
    const byStart = new Map<number, string[]>();
    for (const person of staff) {
      for (const start of startsForStaff(person, date, options)) {
        const free = byStart.get(start) ?? [];
        if (!free.includes(person.staffId)) free.push(person.staffId);
        byStart.set(start, free);
      }
    }
    const slots = [...byStart.entries()]
      .sort(([a], [b]) => a - b)
      .map(([start, staffIds]) => ({
        start: new Date(start).toISOString(),
        time: formatInZone(new Date(start), options.timeZone, "HH:mm"),
        staffIds,
      }));
    return { date, slots };
  });
}

/** Whether `start` is bookable for `staffId` (server-side re-check before inserting). */
export function isSlotAvailable(
  staff: StaffAvailability[],
  options: SlotOptions,
  date: string,
  start: string,
  staffId: string,
) {
  const day = computeSlots(
    staff.filter((person) => person.staffId === staffId),
    { ...options, dates: [date] },
  )[0];
  return day.slots.some((slot) => slot.start === new Date(start).toISOString());
}

/** For "Cualquiera": the free person with the fewest turnos that day. */
export function pickStaff(freeStaffIds: string[], turnosThatDay: Record<string, number>): string | null {
  if (freeStaffIds.length === 0) return null;
  return [...freeStaffIds].sort(
    (a, b) => (turnosThatDay[a] ?? 0) - (turnosThatDay[b] ?? 0) || a.localeCompare(b),
  )[0];
}
