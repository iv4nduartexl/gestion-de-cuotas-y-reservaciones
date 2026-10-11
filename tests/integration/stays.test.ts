import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { appointments } from "@/db/schema";
import { bookAppointment, bookStay, getAvailability, listBookableServices, SlotUnavailableError, StayRulesError } from "@/lib/booking";
import { getAppointment } from "@/lib/data/appointments";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import { createService } from "@/lib/data/services";
import { createStaff } from "@/lib/data/staff";
import { listStayServices, loadOccupiedDates } from "@/lib/data/stays";
import { isExclusionViolation } from "@/lib/db-errors";
import { zonedToUtc } from "@/lib/datetime";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

const NOW = new Date("2030-01-01T12:00:00Z");
type Tenant = Awaited<ReturnType<typeof createTenant>>;
let t: Tenant;
let houseId: string;
let seq = 0;
const guest = () => ({ name: `Huésped ${++seq}`, phone: `+5959819${String(seq).padStart(5, "0")}` });

beforeAll(async () => {
  t = await createTenant("stays");
  const house = await createService(t, {
    bookingType: "stay",
    name: "Casa de campo",
    description: null,
    price: 300000,
    stayUnit: "night",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    minStay: 2,
    maxStay: 60,
    weeklyPrice: 1800000,
    monthlyPrice: null,
  });
  houseId = house.id;
});

describe("rentals", () => {
  it("are listed apart from turno services", async () => {
    expect((await listStayServices(t)).map((s) => s.id)).toContain(houseId);
    expect((await listBookableServices(t)).map((s) => s.id)).not.toContain(houseId);
  });

  it("price on the server and block overlapping dates", async () => {
    const booked = await bookStay(t, {
      serviceId: houseId,
      checkIn: "2030-02-01",
      checkOut: "2030-02-08",
      client: guest(),
      status: "confirmed",
      source: "online",
      withManageToken: true,
      now: NOW,
    });
    // 7 nights use the weekly price.
    expect(booked.quote).toMatchObject({ units: 7, total: 1800000 });
    const turno = await getAppointment(t, booked.id);
    expect(turno).toMatchObject({ kind: "stay", staffId: null, staffName: null, price: 1800000 });

    await expect(
      bookStay(t, { serviceId: houseId, checkIn: "2030-02-05", checkOut: "2030-02-10", client: guest(), status: "confirmed", source: "online", now: NOW }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    // The check-out day is free for the next guest.
    const next = await bookStay(t, { serviceId: houseId, checkIn: "2030-02-08", checkOut: "2030-02-10", client: guest(), status: "confirmed", source: "online", now: NOW });
    expect(next.quote.total).toBe(600000);

    const taken = await loadOccupiedDates(t, (await listStayServices(t))[0], "2030-02-01", "2030-02-12");
    expect([...taken]).toEqual(["2030-02-01", "2030-02-02", "2030-02-03", "2030-02-04", "2030-02-05", "2030-02-06", "2030-02-07", "2030-02-08", "2030-02-09"]);
  });

  it("enforce the rental's rules", async () => {
    await expect(
      bookStay(t, { serviceId: houseId, checkIn: "2030-03-01", checkOut: "2030-03-02", client: guest(), status: "confirmed", source: "online", now: NOW }),
    ).rejects.toMatchObject({ reason: "too_short" });
    await expect(
      bookStay(t, { serviceId: houseId, checkIn: "2029-12-20", checkOut: "2029-12-23", client: guest(), status: "confirmed", source: "online", now: NOW }),
    ).rejects.toBeInstanceOf(StayRulesError);
  });

  it("are protected by the database even if two bookings race", async () => {
    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.serviceId, houseId))
      .limit(1);
    let error: unknown = null;
    try {
      await db.insert(appointments).values({ ...existing, id: undefined, manageTokenHash: null });
    } catch (caught) {
      error = caught;
    }
    expect(isExclusionViolation(error)).toBe(true);
  });
});

describe("long turnos", () => {
  it("can be booked across the lunch break", async () => {
    const person = await createStaff(t, { name: "Ana", memberId: null });
    await replaceWeeklySchedule(t, person.id, [
      { weekday: 1, startTime: "08:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "20:00" },
    ]);
    const service = await createService(t, { bookingType: "slot", name: "Jornada", description: null, durationMinutes: 720, price: 1500000, staffIds: [person.id] });
    const bookable = (await listBookableServices(t)).find((s) => s.id === service.id)!;
    const [day] = await getAvailability(t, bookable, "any", "2030-01-07", 1, { online: true, now: NOW });
    expect(day.slots.map((slot) => slot.time)).toEqual(["08:00"]);
    const booked = await bookAppointment(t, {
      serviceId: service.id,
      staffChoice: "any",
      start: zonedToUtc("2030-01-07", "08:00", "America/Asuncion").toISOString(),
      client: guest(),
      status: "confirmed",
      source: "online",
      now: NOW,
    });
    expect(booked.id).toBeTruthy();
  });
});
