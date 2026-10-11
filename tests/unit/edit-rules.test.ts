import { describe, expect, it } from "vitest";

import { applyFix, chargeAmountIssues, equalParts, reanchorIssues, splitIssues, type SplitValues } from "@/lib/config-rules";

describe("chargeAmountIssues", () => {
  it("never below what was paid, with a one-tap fix", () => {
    const [found] = chargeAmountIssues({ amount: 30000 }, { paid: 50000, currency: "PYG" });
    expect(found.message).toMatch(/Ya pagó/);
    expect(applyFix({ amount: 30000 }, found.fixes[0]).amount).toBe(50000);
  });

  it("0 means voiding, a missing amount is asked for, a valid one passes", () => {
    expect(chargeAmountIssues({ amount: 0 }, { paid: 0, currency: "PYG" })[0].message).toMatch(/Anular/);
    expect(chargeAmountIssues({ amount: null }, { paid: 0, currency: "PYG" })).toHaveLength(1);
    expect(chargeAmountIssues({ amount: 120000 }, { paid: 50000, currency: "PYG" })).toEqual([]);
  });
});

describe("splitting a cuota", () => {
  it("equal parts add up exactly", () => {
    expect(equalParts(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(equalParts(150000, 2)).toEqual([75000, 75000]);
  });

  it("parts must add up to what's left; the fix spreads it evenly", () => {
    const values: SplitValues = { parts: [{ amount: 50000, dueDate: "2030-01-10" }, { amount: 50000, dueDate: "2030-02-10" }] };
    const [found] = splitIssues(values, { remaining: 150000, currency: "PYG" });
    expect(found.message).toMatch(/faltan/);
    const fixed = applyFix(values, found.fixes[0]);
    expect(fixed.parts.map((p) => p.amount)).toEqual([75000, 75000]);
    expect(splitIssues(fixed, { remaining: 150000, currency: "PYG" })).toEqual([]);
  });

  it("dates go in order (fix: sort) and the count is 2–4", () => {
    const values: SplitValues = { parts: [{ amount: 1000, dueDate: "2030-03-01" }, { amount: 1000, dueDate: "2030-02-01" }] };
    const [found] = splitIssues(values, { remaining: 2000, currency: "PYG" });
    expect(applyFix(values, found.fixes[0]).parts.map((p) => p.dueDate)).toEqual(["2030-02-01", "2030-03-01"]);
    expect(splitIssues({ parts: [{ amount: 2000, dueDate: "2030-02-01" }] }, { remaining: 2000, currency: "PYG" })).toHaveLength(1);
  });
});

describe("reanchorIssues (new billing day)", () => {
  const today = "2030-01-20";
  it("can't be in the past or overlap the period already billed", () => {
    expect(reanchorIssues({ newStart: "2030-01-10" }, { today, billedUntil: "2030-02-05" })[0].fixes[0].patch).toEqual({ newStart: today });
    const [overlap] = reanchorIssues({ newStart: "2030-02-01" }, { today, billedUntil: "2030-02-05" });
    expect(overlap.fixes[0].patch).toEqual({ newStart: "2030-02-05" });
    expect(reanchorIssues({ newStart: "2030-03-01" }, { today, billedUntil: "2030-02-05" })).toEqual([]);
  });
});
