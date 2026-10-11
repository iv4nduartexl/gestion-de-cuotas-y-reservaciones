import { describe, expect, it } from "vitest";

import { canTransition } from "@/lib/appointment-status";
import {
  computeSlots,
  isoWeekday,
  isSlotAvailable,
  longestBookableMinutes,
  pickStaff,
  type SlotOptions,
  type StaffAvailability,
} from "@/lib/availability";
import { zonedToUtc } from "@/lib/datetime";

const TZ = "America/Asuncion"; // UTC-3, no DST
const MONDAY = "2026-10-12";
const at = (date: string, time: string, tz = TZ) => zonedToUtc(date, time, tz).getTime();

function person(overrides: Partial<StaffAvailability> = {}): StaffAvailability {
  return {
    staffId: "ana",
    rules: [
      { weekday: 1, startTime: "08:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "18:00" },
    ],
    blocks: [],
    busy: [],
    ...overrides,
  };
}

function options(overrides: Partial<SlotOptions> = {}): SlotOptions {
  return {
    dates: [MONDAY],
    timeZone: TZ,
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    bufferMinutes: 0,
    earliestStart: 0,
    ...overrides,
  };
}

const times = (staff: StaffAvailability[], opts: SlotOptions) =>
  computeSlots(staff, opts)[0].slots.map((slot) => slot.time);

describe("long turnos", () => {
  it("can cross the lunch break when they start and end inside opening hours", () => {
    // 08–12 + 14–18: a 9 h turno fits from 08:00 to 17:00 (and 09:00 to 18:00).
    const result = times([person()], options({ durationMinutes: 9 * 60 }));
    expect(result).toEqual(["08:00", "08:30", "09:00"]);
    // A 1 h turno can't end in the gap (11:30 → 12:30)...
    expect(times([person()], options({ durationMinutes: 60 }))).not.toContain("11:30");
    // ...but a 3 h one starting 11:30 ends at 14:30, inside the afternoon.
    expect(times([person()], options({ durationMinutes: 180 }))).toContain("11:30");
  });

  it("offers nothing when the service is longer than the whole day", () => {
    expect(times([person()], options({ durationMinutes: 11 * 60 }))).toEqual([]);
    expect(longestBookableMinutes(person().rules)).toBe(10 * 60);
  });

  it("still respects días libres and turnos inside the span", () => {
    const lunchMeeting = { start: at(MONDAY, "12:30"), end: at(MONDAY, "13:00") };
    // The block is in the gap, but a long turno would cover it.
    expect(times([person({ blocks: [lunchMeeting] })], options({ durationMinutes: 9 * 60 }))).toEqual([]);
  });
});

describe("computeSlots", () => {
  it("walks split shifts in 24 h local time", () => {
    const result = times([person()], options());
    expect(result[0]).toBe("08:00");
    expect(result).toContain("11:30");
    expect(result).not.toContain("12:00");
    expect(result).toContain("14:00");
    expect(result.at(-1)).toBe("17:30");
    expect(result).toHaveLength(16);
  });

  it("returns UTC instants for the business time zone", () => {
    const [first] = computeSlots([person()], options())[0].slots;
    expect(first.start).toBe("2026-10-12T11:00:00.000Z");
  });

  it("only fits services that end inside the window", () => {
    const result = times([person()], options({ durationMinutes: 90 }));
    expect(result).toContain("10:30");
    expect(result).not.toContain("11:00");
  });

  it("has no slots on closed days", () => {
    expect(times([person()], options({ dates: ["2026-10-13"] }))).toEqual([]);
  });

  it("skips existing turnos and respects the buffer after them", () => {
    const busy = [{ start: at(MONDAY, "09:00"), end: at(MONDAY, "09:30") }];
    const noBuffer = times([person({ busy })], options());
    expect(noBuffer).not.toContain("09:00");
    expect(noBuffer).toContain("08:30");
    expect(noBuffer).toContain("09:30");

    const withBuffer = times([person({ busy })], options({ bufferMinutes: 15, slotIntervalMinutes: 15 }));
    expect(withBuffer).not.toContain("08:30"); // 08:30–09:00 + 15 min buffer hits 09:00
    expect(withBuffer).toContain("08:15");
    expect(withBuffer).not.toContain("09:30"); // existing turno's buffer
    expect(withBuffer).toContain("09:45");
  });

  it("removes días libres, including all-day and multi-day blocks", () => {
    const allDay = [{ start: at(MONDAY, "00:00"), end: at("2026-10-13", "00:00") }];
    expect(times([person({ blocks: allDay })], options())).toEqual([]);

    const crossingMidnight = [{ start: at("2026-10-11", "20:00"), end: at(MONDAY, "10:00") }];
    const result = times([person({ blocks: crossingMidnight })], options());
    expect(result[0]).toBe("10:00");
  });

  it("applies minimum notice and the booking horizon", () => {
    const result = times([person()], options({ earliestStart: at(MONDAY, "10:10") }));
    expect(result[0]).toBe("10:30");
    const limited = times([person()], options({ latestStart: at(MONDAY, "09:00") }));
    expect(limited).toEqual(["08:00", "08:30"]);
  });

  it("handles DST zones (New York, spring forward)", () => {
    const ny = "America/New_York";
    // 2026-03-08 is a Sunday; clocks jump from 02:00 to 03:00.
    const sunday = person({ rules: [{ weekday: 7, startTime: "09:00", endTime: "10:00" }] });
    const [first] = computeSlots([sunday], options({ dates: ["2026-03-08"], timeZone: ny }))[0].slots;
    expect(first.start).toBe("2026-03-08T13:00:00.000Z"); // 09:00 EDT = UTC-4
    expect(first.time).toBe("09:00");
  });

  it("merges staff for 'Cualquiera' and lists who is free", () => {
    const ana = person({ staffId: "ana", busy: [{ start: at(MONDAY, "08:00"), end: at(MONDAY, "08:30") }] });
    const beto = person({ staffId: "beto" });
    const slots = computeSlots([ana, beto], options())[0].slots;
    expect(slots.find((slot) => slot.time === "08:00")?.staffIds).toEqual(["beto"]);
    expect(slots.find((slot) => slot.time === "08:30")?.staffIds.sort()).toEqual(["ana", "beto"]);
  });
});

describe("helpers", () => {
  it("isoWeekday", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
  });

  it("isSlotAvailable re-checks one person", () => {
    const start = new Date(at(MONDAY, "09:00")).toISOString();
    expect(isSlotAvailable([person()], options(), MONDAY, start, "ana")).toBe(true);
    expect(isSlotAvailable([person()], options(), MONDAY, start, "beto")).toBe(false);
    const offGrid = new Date(at(MONDAY, "09:10")).toISOString();
    expect(isSlotAvailable([person()], options(), MONDAY, offGrid, "ana")).toBe(false);
  });

  it("pickStaff prefers the least busy person", () => {
    expect(pickStaff(["ana", "beto"], { ana: 3, beto: 1 })).toBe("beto");
    expect(pickStaff(["ana", "beto"], {})).toBe("ana");
    expect(pickStaff([], {})).toBeNull();
  });

  it("status transitions", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("pending", "completed")).toBe(false);
  });
});

describe("calendar export", async () => {
  const { buildIcs, googleCalendarUrl } = await import("@/lib/ics");
  const event = {
    uid: "abc",
    start: new Date("2026-10-12T13:00:00Z"),
    end: new Date("2026-10-12T13:30:00Z"),
    summary: "Corte, Barbería Don Pedro",
    location: "Av. España 123; Asunción",
    now: new Date("2026-10-01T00:00:00Z"),
  };

  it("builds a valid ICS event in UTC with escaped text", () => {
    const ics = buildIcs(event);
    expect(ics).toContain("DTSTART:20261012T130000Z");
    expect(ics).toContain("DTEND:20261012T133000Z");
    expect(ics).toContain("SUMMARY:Corte\\, Barbería Don Pedro");
    expect(ics).toContain("LOCATION:Av. España 123\\; Asunción");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it("builds a Google Calendar link", () => {
    expect(googleCalendarUrl(event)).toContain("dates=20261012T130000Z%2F20261012T133000Z");
  });
});

describe("turnoTiming", async () => {
  const { turnoTiming } = await import("@/lib/appointment-status");
  const now = new Date("2026-10-12T12:00:00Z");
  it("allows cancelling until the notice window", () => {
    const in5h = new Date(now.getTime() + 5 * 3_600_000);
    expect(turnoTiming({ status: "confirmed", startsAt: in5h }, 4, now)).toEqual({ active: true, upcoming: true, canCancel: true });
    expect(turnoTiming({ status: "confirmed", startsAt: in5h }, 6, now).canCancel).toBe(false);
    expect(turnoTiming({ status: "cancelled", startsAt: in5h }, 4, now).upcoming).toBe(false);
    expect(turnoTiming({ status: "pending", startsAt: new Date(now.getTime() - 1) }, 0, now).upcoming).toBe(false);
  });
});
