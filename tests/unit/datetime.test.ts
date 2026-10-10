import { describe, expect, it } from "vitest";

import {
  addDaysToDate,
  formatDuration,
  formatInZone,
  timeToMinutes,
  toHHmm,
  zonedToUtc,
} from "@/lib/datetime";

describe("zonedToUtc", () => {
  it("converts Asunción wall time (UTC-3, no DST since 2024)", () => {
    expect(zonedToUtc("2026-10-12", "08:30", "America/Asuncion").toISOString()).toBe(
      "2026-10-12T11:30:00.000Z",
    );
    expect(zonedToUtc("2026-01-15", "08:30", "America/Asuncion").toISOString()).toBe(
      "2026-01-15T11:30:00.000Z",
    );
  });

  it("handles DST in zones that still use it", () => {
    // New York: EST (UTC-5) in January, EDT (UTC-4) in July.
    expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(zonedToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("round-trips with formatInZone", () => {
    const instant = zonedToUtc("2026-10-12", "17:45", "America/Asuncion");
    expect(formatInZone(instant, "America/Asuncion", "yyyy-MM-dd HH:mm")).toBe(
      "2026-10-12 17:45",
    );
  });
});

describe("helpers", () => {
  it("adds calendar days across month/year boundaries", () => {
    expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("parses and formats times", () => {
    expect(toHHmm("08:30:00")).toBe("08:30");
    expect(timeToMinutes("08:30")).toBe(510);
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
  });

  it("formats in Spanish", () => {
    expect(
      formatInZone(new Date("2026-10-12T11:30:00Z"), "America/Asuncion", "EEEE HH:mm"),
    ).toBe("lunes 08:30");
  });
});
