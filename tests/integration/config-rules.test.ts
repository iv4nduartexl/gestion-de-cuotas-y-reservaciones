import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { services } from "@/db/schema";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import { getPublicCatalog } from "@/lib/data/public";
import { createService, findServiceProblems } from "@/lib/data/services";
import { createStaff } from "@/lib/data/staff";
import { serviceSchema } from "@/lib/validation/services";
import { planSchema } from "@/lib/validation/memberships";
import { weeklyScheduleSchema } from "@/lib/validation/staff";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

type Tenant = Awaited<ReturnType<typeof createTenant>>;
let t: Tenant;

beforeAll(async () => {
  t = await createTenant("rules");
});

describe("the server refuses configurations that can't work", () => {
  it("rejects a per-day rental whose exit is before the entry", () => {
    const result = serviceSchema("PYG").safeParse({
      bookingType: "stay",
      name: "Quincho",
      price: "100.000",
      stayUnit: "day",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      minStay: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects schedules with no open day or tiny blocks, and plans without a price", () => {
    const empty = JSON.stringify([1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, ranges: [] })));
    expect(weeklyScheduleSchema.safeParse({ schedule: empty }).success).toBe(false);
    const tiny = JSON.stringify([{ weekday: 1, ranges: [{ start: "08:00", end: "08:10" }] }]);
    expect(weeklyScheduleSchema.safeParse({ schedule: tiny }).success).toBe(false);
    expect(planSchema("PYG").safeParse({ name: "Gratis", price: "0", intervalUnit: "month", intervalCount: "1", billingTiming: "advance" }).success).toBe(false);
  });
});

describe("services saved before the rules", () => {
  it("are flagged and hidden from the booking page", async () => {
    const person = await createStaff(t, { name: "Ana", memberId: null });
    await replaceWeeklySchedule(t, person.id, [{ weekday: 1, startTime: "08:00", endTime: "16:00" }]);
    const fine = await createService(t, { bookingType: "slot", name: "Corte", description: null, durationMinutes: 30, price: 50000, staffIds: [person.id] });
    const tooLong = await createService(t, { bookingType: "slot", name: "Jornada", description: null, durationMinutes: 600, price: 900000, staffIds: [person.id] });
    // A rental stored with nonsense hours (as older versions allowed).
    const [broken] = await db
      .insert(services)
      .values({
        organizationId: t.organization.id,
        name: "Quincho viejo",
        bookingType: "stay",
        price: 100000,
        currency: "PYG",
        stayUnit: "day",
        checkInTime: "14:00",
        checkOutTime: "10:00",
        minStay: 1,
      })
      .returning();

    const problems = await findServiceProblems(t);
    expect(problems.has(fine.id)).toBe(false);
    expect(problems.get(tooLong.id)).toMatch(/nadie podría reservarlo/);
    expect(problems.get(broken.id)).toMatch(/la salida tiene que ser después de la entrada/);

    const catalog = await getPublicCatalog(t);
    expect(catalog.services.map((s) => s.id)).toEqual([fine.id]);
    expect(catalog.stays).toEqual([]);
  });
});
