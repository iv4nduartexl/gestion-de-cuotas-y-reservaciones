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

/** Start times one person can take on one date. */
function startsForStaff(person: StaffAvailability, date: string, options: SlotOptions): number[] {
  const duration = options.durationMinutes * MINUTE;
  const step = options.slotIntervalMinutes * MINUTE;
  const buffer = options.bufferMinutes * MINUTE;
  const weekday = isoWeekday(date);
  const starts: number[] = [];

  for (const rule of person.rules) {
    if (rule.weekday !== weekday) continue;
    const windowStart = zonedToUtc(date, rule.startTime, options.timeZone).getTime();
    const windowEnd = zonedToUtc(date, rule.endTime, options.timeZone).getTime();

    for (let start = windowStart; start + duration <= windowEnd; start += step) {
      if (start < options.earliestStart) continue;
      if (options.latestStart !== undefined && start >= options.latestStart) break;

      const slot = { start, end: start + duration };
      if (person.blocks.some((block) => overlaps(slot, block))) continue;
      // Existing turnos keep their buffer after them, and the new one needs
      // its own buffer before the next turno.
      const withBuffer = { start, end: start + duration + buffer };
      if (person.busy.some((turno) => overlaps(withBuffer, { start: turno.start, end: turno.end + buffer }))) {
        continue;
      }
      starts.push(start);
    }
  }
  return starts;
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
