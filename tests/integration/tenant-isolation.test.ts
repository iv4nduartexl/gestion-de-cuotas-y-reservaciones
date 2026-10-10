import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { availabilityRules, blockedSlots, serviceStaff } from "@/db/schema";
import { getWeeklySchedule, replaceWeeklySchedule } from "@/lib/data/availability";
import {
  createBlockedSlot,
  deleteBlockedSlot,
  getBlockedSlot,
  listUpcomingBlockedSlots,
} from "@/lib/data/blocked-slots";
import {
  createClient,
  getClient,
  listClients,
  setClientArchived,
  updateClient,
} from "@/lib/data/clients";
import { InvalidReferenceError } from "@/lib/data/scope";
import { createService, getService, listServices, updateService } from "@/lib/data/services";
import { createStaff, getStaff, listStaff, updateStaff } from "@/lib/data/staff";
import { isExclusionViolation, isForeignKeyViolation, isUniqueViolation } from "@/lib/db-errors";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

type Tenant = Awaited<ReturnType<typeof createTenant>>;
let a: Tenant;
let b: Tenant;

const clientInput = (phone: string) => ({
  name: "Cliente",
  phone,
  email: null,
  documentNumber: null,
  notes: null,
});
const serviceInput = (staffIds: string[] = []) => ({
  name: "Corte",
  description: null,
  durationMinutes: 30,
  price: 50000,
  staffIds,
});

beforeAll(async () => {
  a = await createTenant("alpha");
  b = await createTenant("beta");
});

async function expectRejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

describe("clients", () => {
  it("are invisible and immutable across tenants", async () => {
    const client = await createClient(a, clientInput("+595981000001"));

    expect(await getClient(a, client.id)).not.toBeNull();
    expect(await getClient(b, client.id)).toBeNull();
    expect((await listClients(b)).rows.map((row) => row.id)).not.toContain(client.id);
    expect(await updateClient(b, client.id, clientInput("+595981000099"))).toBeNull();
    expect((await setClientArchived(b, client.id, true, "2030-01-07")).ok).toBe(false);

    const unchanged = await getClient(a, client.id);
    expect(unchanged?.phone).toBe("+595981000001");
    expect(unchanged?.archivedAt).toBeNull();
  });

  it("phone is unique per tenant, not globally", async () => {
    await createClient(a, clientInput("+595981000002"));
    await createClient(b, clientInput("+595981000002"));
    const error = await expectRejection(createClient(a, clientInput("+595981000002")));
    expect(isUniqueViolation(error, "clients_org_phone_unique")).toBe(true);
  });

  it("search matches local phone formats", async () => {
    await createClient(a, { ...clientInput("+595971555444"), name: "Zoe Search" });
    const { rows } = await listClients(a, { q: "0971 555" });
    expect(rows.map((row) => row.name)).toContain("Zoe Search");
    expect((await listClients(b, { q: "0971 555" })).rows).toHaveLength(0);
  });
});

describe("staff and services", () => {
  it("cannot assign another tenant's staff to a service", async () => {
    const foreignStaff = await createStaff(b, { name: "Ajeno", memberId: null });
    const error = await expectRejection(createService(a, serviceInput([foreignStaff.id])));
    expect(error).toBeInstanceOf(InvalidReferenceError);
  });

  it("composite FKs reject cross-tenant rows even if the app layer is bypassed", async () => {
    const service = await createService(a, serviceInput());
    const foreignStaff = await createStaff(b, { name: "Ajeno 2", memberId: null });
    const error = await expectRejection(
      db.insert(serviceStaff).values({
        organizationId: a.organization.id,
        serviceId: service.id,
        staffId: foreignStaff.id,
      }),
    );
    expect(isForeignKeyViolation(error)).toBe(true);
  });

  it("are invisible and immutable across tenants", async () => {
    const person = await createStaff(a, { name: "Pedro", memberId: null });
    const service = await createService(a, serviceInput([person.id]));

    expect(await getStaff(b, person.id)).toBeNull();
    expect(await getService(b, service.id)).toBeNull();
    expect((await listStaff(b)).map((row) => row.id)).not.toContain(person.id);
    expect((await listServices(b)).map((row) => row.id)).not.toContain(service.id);
    expect(await updateStaff(b, person.id, { name: "X", memberId: null })).toBeNull();
    expect(await updateService(b, service.id, serviceInput())).toBeNull();

    expect((await getService(a, service.id))?.staffIds).toEqual([person.id]);
  });

  it("uses the tenant's currency, not caller input", async () => {
    const usdTenant = { ...a, settings: { ...a.settings, currency: "USD" } };
    const service = await createService(usdTenant, serviceInput());
    expect(service.currency).toBe("USD");
  });

  it("solo mode assigns every service to the business's own staff", async () => {
    const solo = await createTenant("solo", { teamMode: "solo" });
    const owner = await createStaff(solo, { name: "Dueña", memberId: solo.memberId });
    const foreign = await createStaff(b, { name: "Ajeno solo", memberId: null });

    // The form sends no staff (or a forged foreign id): both resolve to the owner.
    const service = await createService(solo, serviceInput([]));
    expect((await getService(solo, service.id))?.staffIds).toEqual([owner.id]);
    const forged = await createService(solo, serviceInput([foreign.id]));
    expect((await getService(solo, forged.id))?.staffIds).toEqual([owner.id]);
  });

  it("cannot link a member of another tenant", async () => {
    const error = await expectRejection(createStaff(a, { name: "X", memberId: b.memberId }));
    expect(error).toBeInstanceOf(InvalidReferenceError);
  });
});

describe("availability", () => {
  it("replaces the weekly schedule and stays tenant-scoped", async () => {
    const person = await createStaff(a, { name: "Horario", memberId: null });
    await replaceWeeklySchedule(a, person.id, [
      { weekday: 1, startTime: "08:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "18:00" },
    ]);
    await replaceWeeklySchedule(a, person.id, [
      { weekday: 2, startTime: "09:00", endTime: "17:00" },
    ]);
    expect(await getWeeklySchedule(a, person.id)).toEqual([
      { weekday: 2, startTime: "09:00", endTime: "17:00" },
    ]);

    expect(await getWeeklySchedule(b, person.id)).toEqual([]);
    const error = await expectRejection(
      replaceWeeklySchedule(b, person.id, [{ weekday: 3, startTime: "08:00", endTime: "09:00" }]),
    );
    expect(error).toBeInstanceOf(InvalidReferenceError);
    expect(await getWeeklySchedule(a, person.id)).toHaveLength(1);
  });

  it("the exclusion constraint rejects overlapping ranges", async () => {
    const person = await createStaff(a, { name: "Overlap", memberId: null });
    const error = await expectRejection(
      db.insert(availabilityRules).values([
        { organizationId: a.organization.id, staffId: person.id, weekday: 1, startTime: "08:00", endTime: "12:00" },
        { organizationId: a.organization.id, staffId: person.id, weekday: 1, startTime: "11:00", endTime: "13:00" },
      ]),
    );
    expect(isExclusionViolation(error)).toBe(true);
  });

  it("rejects rules pointing at another tenant's staff", async () => {
    const foreignStaff = await createStaff(b, { name: "Ajeno 3", memberId: null });
    const error = await expectRejection(
      db.insert(availabilityRules).values({
        organizationId: a.organization.id,
        staffId: foreignStaff.id,
        weekday: 1,
        startTime: "08:00",
        endTime: "09:00",
      }),
    );
    expect(isForeignKeyViolation(error)).toBe(true);
  });
});

describe("blocked slots", () => {
  const future = (hours: number) => new Date(Date.now() + hours * 3_600_000);

  it("are tenant-scoped, including business-wide blocks", async () => {
    const person = await createStaff(a, { name: "Bloqueado", memberId: null });
    const own = await createBlockedSlot(a, {
      staffId: person.id,
      startsAt: future(1),
      endsAt: future(2),
      reason: "Turno médico",
    });
    const holiday = await createBlockedSlot(a, {
      staffId: null,
      startsAt: future(24),
      endsAt: future(48),
      reason: "Feriado",
    });

    const forPerson = (await listUpcomingBlockedSlots(a, { staffId: person.id })).map((s) => s.id);
    expect(forPerson).toEqual(expect.arrayContaining([own.id, holiday.id]));

    const forB = (await listUpcomingBlockedSlots(b)).map((s) => s.id);
    expect(forB).not.toContain(own.id);
    expect(forB).not.toContain(holiday.id);
    expect(await getBlockedSlot(b, own.id)).toBeNull();
    expect(await expectRejection(deleteBlockedSlot(b, own.id))).toBeInstanceOf(InvalidReferenceError);
    expect(await getBlockedSlot(a, own.id)).not.toBeNull();
  });

  it("cannot target another tenant's staff", async () => {
    const foreignStaff = await createStaff(b, { name: "Ajeno 4", memberId: null });
    const error = await expectRejection(
      createBlockedSlot(a, { staffId: foreignStaff.id, startsAt: future(1), endsAt: future(2), reason: null }),
    );
    expect(error).toBeInstanceOf(InvalidReferenceError);

    const dbError = await expectRejection(
      db.insert(blockedSlots).values({
        organizationId: a.organization.id,
        staffId: foreignStaff.id,
        startsAt: future(1),
        endsAt: future(2),
      }),
    );
    expect(isForeignKeyViolation(dbError)).toBe(true);
  });
});
