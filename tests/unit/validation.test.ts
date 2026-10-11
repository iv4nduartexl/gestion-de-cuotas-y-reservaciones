import { describe, expect, it } from "vitest";

import { slugify, slugSchema } from "@/lib/slug";
import { blockedSlotSchema, toInstantRange } from "@/lib/validation/blocked-slots";
import { clientSchema } from "@/lib/validation/clients";
import { serviceSchema } from "@/lib/validation/services";
import { weeklyScheduleSchema } from "@/lib/validation/staff";

const schedule = (days: unknown) => weeklyScheduleSchema.safeParse({ schedule: JSON.stringify(days) });

describe("weeklyScheduleSchema", () => {
  it("accepts split shifts and flattens them", () => {
    const result = schedule([
      { weekday: 1, ranges: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
      { weekday: 7, ranges: [] },
    ]);
    expect(result.success && result.data.schedule).toEqual([
      { weekday: 1, startTime: "08:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "18:00" },
    ]);
  });

  it("allows ranges that touch", () => {
    expect(
      schedule([{ weekday: 2, ranges: [{ start: "08:00", end: "12:00" }, { start: "12:00", end: "13:00" }] }]).success,
    ).toBe(true);
  });

  it.each([
    ["overlapping ranges", [{ weekday: 1, ranges: [{ start: "08:00", end: "12:00" }, { start: "11:00", end: "13:00" }] }]],
    ["end before start", [{ weekday: 1, ranges: [{ start: "12:00", end: "08:00" }] }]],
    ["invalid weekday", [{ weekday: 8, ranges: [] }]],
    ["invalid time", [{ weekday: 1, ranges: [{ start: "25:00", end: "26:00" }] }]],
    ["repeated weekday", [{ weekday: 1, ranges: [] }, { weekday: 1, ranges: [] }]],
  ])("rejects %s", (_, days) => {
    expect(schedule(days).success).toBe(false);
  });

  it("rejects malformed JSON", () => {
    expect(weeklyScheduleSchema.safeParse({ schedule: "{nope" }).success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("normalizes phone and empty optionals", () => {
    const result = clientSchema.parse({
      name: "  Ana Pérez ",
      phone: "0981 123 456",
      email: " Ana@Example.com ",
      documentNumber: "",
      notes: "",
    });
    expect(result).toEqual({
      name: "Ana Pérez",
      phone: "+595981123456",
      email: "ana@example.com",
      documentNumber: null,
      notes: null,
    });
  });

  it("stores the C.I. without dots", () => {
    const result = clientSchema.parse({ name: "Ana", phone: "0981 123 456", documentNumber: "4.567.890" });
    expect(result.documentNumber).toBe("4567890");
  });

  it("rejects an invalid phone", () => {
    expect(clientSchema.safeParse({ name: "Ana", phone: "123" }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("parses PYG price and duration", () => {
    const result = serviceSchema("PYG").parse({
      name: "Corte",
      durationMinutes: "45",
      price: "50.000",
    });
    expect(result).toMatchObject({ durationMinutes: 45, price: 50000, staffIds: [] });
  });

  it("rejects durations that aren't multiples of 5", () => {
    expect(serviceSchema("PYG").safeParse({ name: "Corte", durationMinutes: "47", price: "1" }).success).toBe(false);
  });

  it("allows turnos up to 24 h and sends longer ones to rentals", () => {
    expect(serviceSchema("PYG").safeParse({ name: "Jornada", durationMinutes: "1440", price: "1" }).success).toBe(true);
    const tooLong = serviceSchema("PYG").safeParse({ name: "Semana", durationMinutes: "1445", price: "1" });
    expect(tooLong.success).toBe(false);
  });

  it("parses rentals with check-in/out and optional weekly price", () => {
    const result = serviceSchema("PYG").parse({
      bookingType: "stay",
      name: "Casa de campo",
      price: "300.000",
      stayUnit: "night",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      minStay: "2",
      maxStay: "",
      weeklyPrice: "1.800.000",
      monthlyPrice: "",
    });
    expect(result).toMatchObject({ bookingType: "stay", price: 300000, minStay: 2, maxStay: undefined, weeklyPrice: 1800000, monthlyPrice: null });
    const bad = serviceSchema("PYG").safeParse({ bookingType: "stay", name: "Casa", price: "1", stayUnit: "night", checkInTime: "14:00", checkOutTime: "10:00", minStay: "5", maxStay: "2" });
    expect(bad.success).toBe(false);
  });
});

describe("blocked slots", () => {
  it("converts an all-day range to [midnight, next midnight) in the business zone", () => {
    const input = blockedSlotSchema.parse({
      staffId: "",
      startDate: "2026-12-24",
      endDate: "2026-12-25",
      allDay: "true",
    });
    const range = toInstantRange(input, "America/Asuncion");
    expect(range.startsAt.toISOString()).toBe("2026-12-24T03:00:00.000Z");
    expect(range.endsAt.toISOString()).toBe("2026-12-26T03:00:00.000Z");
  });

  it("requires end after start on the same day", () => {
    expect(
      blockedSlotSchema.safeParse({
        startDate: "2026-12-24",
        endDate: "2026-12-24",
        allDay: "false",
        startTime: "12:00",
        endTime: "08:00",
      }).success,
    ).toBe(false);
  });
});

describe("slugs", () => {
  it("slugifies Spanish names", () => {
    expect(slugify("Peluquería Doña Ana")).toBe("peluqueria-dona-ana");
  });

  it("rejects reserved and malformed slugs", () => {
    expect(slugSchema.safeParse("dashboard").success).toBe(false);
    expect(slugSchema.safeParse("-abc").success).toBe(false);
    expect(slugSchema.safeParse("mi-barberia").success).toBe(true);
  });
});
