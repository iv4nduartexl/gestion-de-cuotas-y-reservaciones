import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { appointments } from "@/db/schema";
import { bookAppointment, BookingReferenceError, getAvailability, listBookableServices, SlotUnavailableError } from "@/lib/booking";
import { getAppointment, listAppointmentsBetween, setAppointmentStatus } from "@/lib/data/appointments";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import { hashIp, isRateLimited, LIMITS, recordAttempt } from "@/lib/data/booking-limits";
import { createClient, getClient, listClients, setClientArchived } from "@/lib/data/clients";
import { createService, setServiceArchived } from "@/lib/data/services";
import { createStaff } from "@/lib/data/staff";
import { zonedToUtc } from "@/lib/datetime";
import { isForeignKeyViolation } from "@/lib/db-errors";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

// Fixed clock: Tuesday 2030-01-01. Bookings target Monday 2030-01-07 (Asunción).
const NOW = new Date("2030-01-01T12:00:00Z");
const MONDAY = "2030-01-07";
const at = (time: string) => zonedToUtc(MONDAY, time, "America/Asuncion").toISOString();

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function setupBusiness(label: string, staffNames = ["Ana"]) {
  const tenant = await createTenant(label);
  const people = [];
  for (const name of staffNames) {
    const person = await createStaff(tenant, { name, memberId: null });
    await replaceWeeklySchedule(tenant, person.id, [{ weekday: 1, startTime: "08:00", endTime: "12:00" }]);
    people.push(person);
  }
  const service = await createService(tenant, {
    name: "Corte",
    description: null,
    durationMinutes: 30,
    price: 50000,
    staffIds: people.map((p) => p.id),
  });
  return { tenant, people, service };
}

function online(tenant: Tenant, serviceId: string, start: string, phone = "+595981000001", staffChoice = "any") {
  return bookAppointment(tenant, {
    serviceId,
    staffChoice,
    start,
    client: { name: "Cliente Web", phone },
    status: "confirmed",
    source: "online",
    withManageToken: true,
    now: NOW,
  });
}

let a: Awaited<ReturnType<typeof setupBusiness>>;
let b: Awaited<ReturnType<typeof setupBusiness>>;

beforeAll(async () => {
  a = await setupBusiness("turnos-a");
  b = await setupBusiness("turnos-b");
});

describe("booking", () => {
  it("books a free slot, snapshots the price and creates the client by phone", async () => {
    const booked = await online(a.tenant, a.service.id, at("08:00"), "+595981000010");
    expect(booked.token).toBeTruthy();
    const turno = await getAppointment(a.tenant, booked.id);
    expect(turno).toMatchObject({ status: "confirmed", source: "online", price: 50000, currency: "PYG", staffId: a.people[0].id });
    expect((await listClients(a.tenant, { q: "0981 000 010" })).rows).toHaveLength(1);

    // The slot disappears from availability.
    const service = (await listBookableServices(a.tenant)).find((s) => s.id === a.service.id)!;
    const [day] = await getAvailability(a.tenant, service, "any", MONDAY, 1, { online: true, now: NOW });
    expect(day.slots.map((s) => s.time)).not.toContain("08:00");
    expect(day.slots.map((s) => s.time)).toContain("08:30");
  });

  it("two concurrent bookings for the same slot: exactly one succeeds", async () => {
    const results = await Promise.allSettled([
      online(a.tenant, a.service.id, at("09:00"), "+595981000020"),
      online(a.tenant, a.service.id, at("09:00"), "+595981000021"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(SlotUnavailableError);
  });

  it("the database rejects overlaps even when the app check is bypassed", async () => {
    const first = await online(a.tenant, a.service.id, at("10:00"), "+595981000030");
    const turno = (await getAppointment(a.tenant, first.id))!;
    const overlap = db.insert(appointments).values({
      organizationId: a.tenant.organization.id,
      clientId: turno.clientId,
      serviceId: turno.serviceId,
      staffId: turno.staffId,
      startsAt: new Date(at("10:15")),
      endsAt: new Date(at("10:45")),
      status: "confirmed",
      source: "dashboard",
      price: 1,
      currency: "PYG",
    });
    await expect(overlap).rejects.toMatchObject({ cause: { code: "23P01" } });
  });

  it("cancelling frees the slot; a no-show too", async () => {
    const first = await online(a.tenant, a.service.id, at("11:00"), "+595981000040");
    await expect(online(a.tenant, a.service.id, at("11:00"), "+595981000041")).rejects.toBeInstanceOf(SlotUnavailableError);
    await setAppointmentStatus(a.tenant, first.id, "cancelled", { cancelledBy: "client" });
    const again = await online(a.tenant, a.service.id, at("11:00"), "+595981000041");
    expect(again.id).toBeTruthy();
    const cancelled = await getAppointment(a.tenant, first.id);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: "client" });
  });

  it("rejects off-grid times, closed days and minimum notice", async () => {
    await expect(online(a.tenant, a.service.id, at("08:10"))).rejects.toBeInstanceOf(SlotUnavailableError);
    const tuesday = zonedToUtc("2030-01-08", "09:00", "America/Asuncion").toISOString();
    await expect(online(a.tenant, a.service.id, tuesday)).rejects.toBeInstanceOf(SlotUnavailableError);
    const soon = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    await expect(online(a.tenant, a.service.id, soon)).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("reuses an existing client by phone and restores archived ones", async () => {
    const existing = await createClient(a.tenant, { name: "María", phone: "+595981000050", email: null, documentNumber: null, notes: null });
    await setClientArchived(a.tenant, existing.id, true, "2030-01-07");
    const booked = await online(a.tenant, a.service.id, at("08:30"), "+595981000050");
    const turno = await getAppointment(a.tenant, booked.id);
    expect(turno?.clientId).toBe(existing.id);
    expect(turno?.clientName).toBe("María");
    expect((await getClient(a.tenant, existing.id))?.archivedAt).toBeNull();
  });

  it("can't book another business's service or staff, nor archived services", async () => {
    await expect(online(a.tenant, b.service.id, at("09:30"))).rejects.toBeInstanceOf(BookingReferenceError);
    await expect(online(a.tenant, a.service.id, at("09:30"), "+595981000060", b.people[0].id)).rejects.toBeInstanceOf(BookingReferenceError);

    const archived = await createService(a.tenant, { name: "Viejo", description: null, durationMinutes: 30, price: 1, staffIds: [a.people[0].id] });
    await setServiceArchived(a.tenant, archived.id, true);
    await expect(online(a.tenant, archived.id, at("09:30"))).rejects.toBeInstanceOf(BookingReferenceError);
  });

  it("'Cualquiera' goes to the least busy free person", async () => {
    const team = await setupBusiness("turnos-team", ["Ana", "Beto"]);
    const first = await online(team.tenant, team.service.id, at("08:00"), "+595981000070");
    const second = await online(team.tenant, team.service.id, at("08:00"), "+595981000071");
    const staffIds = [
      (await getAppointment(team.tenant, first.id))!.staffId,
      (await getAppointment(team.tenant, second.id))!.staffId,
    ];
    expect(new Set(staffIds).size).toBe(2);
    await expect(online(team.tenant, team.service.id, at("08:00"), "+595981000072")).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("appointments are tenant-scoped", async () => {
    const booked = await online(b.tenant, b.service.id, at("08:00"), "+595981000080");
    expect(await getAppointment(a.tenant, booked.id)).toBeNull();
    expect(await setAppointmentStatus(a.tenant, booked.id, "cancelled")).toBeNull();
    const day = await listAppointmentsBetween(a.tenant, { from: new Date(at("00:00")), to: new Date(at("23:59")) });
    expect(day.map((t) => t.id)).not.toContain(booked.id);
    expect((await getAppointment(b.tenant, booked.id))?.status).toBe("confirmed");
  });

  it("composite FKs reject a turno mixing two businesses", async () => {
    const client = await createClient(b.tenant, { name: "Ajeno", phone: "+595981000090", email: null, documentNumber: null, notes: null });
    const insert = db.insert(appointments).values({
      organizationId: a.tenant.organization.id,
      clientId: client.id,
      serviceId: a.service.id,
      staffId: a.people[0].id,
      startsAt: new Date(at("11:30")),
      endsAt: new Date(at("12:00")),
      status: "confirmed",
      source: "dashboard",
      price: 1,
      currency: "PYG",
    });
    const error = await insert.then(() => null, (e: unknown) => e);
    expect(isForeignKeyViolation(error)).toBe(true);
  });
});

describe("rate limits", () => {
  it("limits attempts per IP and per phone", async () => {
    const ip = hashIp(`203.0.113.${Math.floor(Math.random() * 200)}`);
    for (let i = 0; i < LIMITS.perIp.max; i++) await recordAttempt(a.tenant, ip, null);
    expect(await isRateLimited(a.tenant, ip, null)).toBe(true);
    expect(await isRateLimited(a.tenant, hashIp("198.51.100.1"), null)).toBe(false);

    const phone = "+595981777777";
    for (let i = 0; i < LIMITS.perPhone.max; i++) await recordAttempt(a.tenant, hashIp(`10.0.0.${i}`), phone);
    expect(await isRateLimited(a.tenant, hashIp("10.0.0.99"), phone)).toBe(true);
    expect(await isRateLimited(b.tenant, hashIp("10.0.0.99"), phone)).toBe(false);
  });
});
