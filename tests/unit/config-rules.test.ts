import { describe, expect, it } from "vitest";

import {
  applyFix,
  bookingRuleIssues,
  planIssues,
  scheduleIssues,
  slotServiceIssues,
  stayIssues,
  type StayValues,
} from "@/lib/config-rules";

/** Every fix offered for the first issue must make that issue go away. */
function fixesResolve<T>(values: T, check: (v: T) => { field: string; fixes: { patch: Partial<T> }[] }[]) {
  const [first] = check(values);
  expect(first).toBeDefined();
  expect(first.fixes.length).toBeGreaterThan(0);
  for (const fix of first.fixes) {
    const after = check(applyFix(values, fix as never));
    expect(after.some((i) => i.field === first.field)).toBe(false);
  }
}

describe("schedule rules", () => {
  it("needs an open day, valid and non-overlapping blocks of 30+ minutes", () => {
    expect(scheduleIssues({ days: [] })).toHaveLength(1);
    expect(scheduleIssues({ days: [{ weekday: 1, ranges: [{ start: "08:00", end: "12:00" }] }] })).toEqual([]);
    expect(scheduleIssues({ days: [{ weekday: 1, ranges: [{ start: "12:00", end: "08:00" }] }] })[0].message).toMatch(/antes de abrir/);
    expect(scheduleIssues({ days: [{ weekday: 1, ranges: [{ start: "08:00", end: "08:15" }] }] })[0].message).toMatch(/media hora/);
    expect(
      scheduleIssues({ days: [{ weekday: 2, ranges: [{ start: "08:00", end: "12:00" }, { start: "11:00", end: "18:00" }] }] })[0].message,
    ).toMatch(/se pisan/);
  });
});

describe("turno service rules", () => {
  it("blocks a duration longer than the longest day and offers one that fits", () => {
    expect(slotServiceIssues({ durationMinutes: 60 }, { longestMinutes: 480 })).toEqual([]);
    expect(slotServiceIssues({ durationMinutes: 720 }, { longestMinutes: null })).toEqual([]);
    fixesResolve({ durationMinutes: 720 }, (v) => slotServiceIssues(v, { longestMinutes: 480 }));
    fixesResolve({ durationMinutes: 47 }, (v) => slotServiceIssues(v, { longestMinutes: 480 }));
    expect(slotServiceIssues({ durationMinutes: 1500 }, { longestMinutes: null })[0].message).toMatch(/Por días/);
  });
});

describe("rental rules", () => {
  const ok: StayValues = { stayUnit: "night", checkInTime: "14:00", checkOutTime: "10:00", minStay: 1, maxStay: null, price: 300000, weeklyPrice: 1800000, monthlyPrice: 6000000 };

  it("accepts a sensible rental", () => {
    expect(stayIssues(ok, "PYG")).toEqual([]);
  });

  it("refuses per-day rentals whose exit is before the entry, with fixes", () => {
    const bad: StayValues = { ...ok, stayUnit: "day" };
    expect(stayIssues(bad, "PYG")[0].field).toBe("checkOutTime");
    fixesResolve(bad, (v) => stayIssues(v, "PYG"));
  });

  it("refuses max below min and bundle prices more expensive than single nights", () => {
    fixesResolve<StayValues>({ ...ok, minStay: 5, maxStay: 2 }, (v) => stayIssues(v, "PYG"));
    fixesResolve<StayValues>({ ...ok, weeklyPrice: 2500000 }, (v) => stayIssues(v, "PYG"));
    fixesResolve<StayValues>({ ...ok, monthlyPrice: 9999999 }, (v) => stayIssues(v, "PYG"));
  });
});

describe("plan and booking rules", () => {
  it("needs a price and a sensible period", () => {
    expect(planIssues({ price: 150000, intervalCount: 1 })).toEqual([]);
    expect(planIssues({ price: 0, intervalCount: 1 })).toHaveLength(1);
    fixesResolve({ price: 1, intervalCount: 0 }, planIssues);
  });

  it("keeps notice, cancellation and the slot grid consistent", () => {
    const sane = { minNoticeMinutes: 60, maxDaysAhead: 30, clientCancelNoticeHours: 4, slotIntervalMinutes: 15 };
    expect(bookingRuleIssues(sane, { shortestServiceMinutes: 30 })).toEqual([]);
    fixesResolve({ ...sane, minNoticeMinutes: 10080, maxDaysAhead: 7 }, (v) => bookingRuleIssues(v, { shortestServiceMinutes: null }));
    fixesResolve({ ...sane, clientCancelNoticeHours: 168, maxDaysAhead: 7 }, (v) => bookingRuleIssues(v, { shortestServiceMinutes: null }));
    fixesResolve({ ...sane, slotIntervalMinutes: 60 }, (v) => bookingRuleIssues(v, { shortestServiceMinutes: 20 }));
  });
});
