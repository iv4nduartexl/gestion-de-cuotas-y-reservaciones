import { describe, expect, it } from "vitest";

import { easterSunday, paraguayHolidays } from "@/lib/holidays-py";

describe("Paraguayan holidays", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("Easter %i", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });

  it("includes Holy Thursday/Friday from Easter and fixed dates", () => {
    const holidays = paraguayHolidays(2026);
    expect(holidays).toContainEqual({ date: "2026-04-02", name: "Jueves Santo" });
    expect(holidays).toContainEqual({ date: "2026-04-03", name: "Viernes Santo" });
    expect(holidays).toContainEqual({ date: "2026-05-15", name: "Independencia Nacional" });
    expect(holidays).toHaveLength(12);
    expect(holidays.map((h) => h.date)).toEqual([...holidays.map((h) => h.date)].sort());
  });
});
