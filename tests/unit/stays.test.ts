import { describe, expect, it } from "vitest";

import { zonedToUtc } from "@/lib/datetime";
import { occupiedDates, quoteStay, rangeIsFree, stayPrice, stayUnits, type StayService } from "@/lib/stays";

const TZ = "America/Asuncion";
const house: StayService = {
  stayUnit: "night",
  checkInTime: "14:00",
  checkOutTime: "10:00",
  minStay: 2,
  maxStay: 60,
  price: 300000,
  weeklyPrice: 1800000,
  monthlyPrice: 6000000,
};

describe("stays", () => {
  it("counts nights and days", () => {
    expect(stayUnits("night", "2026-10-12", "2026-10-15")).toBe(3);
    expect(stayUnits("day", "2026-10-12", "2026-10-12")).toBe(1);
    expect(stayUnits("day", "2026-10-12", "2026-10-14")).toBe(3);
  });

  it("uses monthly and weekly prices when they apply", () => {
    expect(stayPrice(house, 3).total).toBe(900000);
    expect(stayPrice(house, 7).total).toBe(1800000);
    expect(stayPrice(house, 10)).toEqual({
      total: 1800000 + 900000,
      breakdown: [
        { label: "week", count: 1, amount: 1800000 },
        { label: "unit", count: 3, amount: 900000 },
      ],
    });
    expect(stayPrice(house, 33).total).toBe(6000000 + 900000);
    expect(stayPrice({ ...house, weeklyPrice: null, monthlyPrice: null }, 8).total).toBe(8 * 300000);
  });

  it("quotes with check-in/out hours in the business time zone and enforces limits", () => {
    const result = quoteStay(house, "2026-10-12", "2026-10-15", TZ);
    expect(result).toMatchObject({ ok: true, quote: { units: 3, total: 900000 } });
    if (result.ok) {
      expect(result.quote.startsAt.toISOString()).toBe("2026-10-12T17:00:00.000Z");
      expect(result.quote.endsAt.toISOString()).toBe("2026-10-15T13:00:00.000Z");
    }
    expect(quoteStay(house, "2026-10-12", "2026-10-13", TZ)).toEqual({ ok: false, error: "too_short" });
    expect(quoteStay(house, "2026-10-12", "2026-10-12", TZ)).toEqual({ ok: false, error: "order" });
    expect(quoteStay(house, "2026-10-01", "2026-12-31", TZ)).toEqual({ ok: false, error: "too_long" });
  });

  it("frees the check-out day for the next guest (nights) and blocks every day touched (days)", () => {
    const stay = { start: zonedToUtc("2026-10-12", "14:00", TZ), end: zonedToUtc("2026-10-15", "10:00", TZ) };
    const nights = occupiedDates("night", [stay], TZ);
    expect([...nights]).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(rangeIsFree("night", "2026-10-15", "2026-10-17", nights)).toBe(true);
    expect(rangeIsFree("night", "2026-10-10", "2026-10-13", nights)).toBe(false);

    const days = occupiedDates("day", [{ start: zonedToUtc("2026-10-12", "08:00", TZ), end: zonedToUtc("2026-10-13", "20:00", TZ) }], TZ);
    expect([...days]).toEqual(["2026-10-12", "2026-10-13"]);
    // A business-wide día libre (whole days, midnight to midnight).
    const holiday = occupiedDates("night", [{ start: zonedToUtc("2026-12-25", "00:00", TZ), end: zonedToUtc("2026-12-26", "00:00", TZ) }], TZ);
    expect([...holiday]).toEqual(["2026-12-25"]);
  });
});
