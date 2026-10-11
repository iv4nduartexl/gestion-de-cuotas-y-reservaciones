import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { charges, enrollments, reminders } from "@/db/schema";
import {
  AppointmentClosedError,
  bookAppointment,
  bookStay,
  changeAppointment,
  changeStayDates,
  SlotUnavailableError,
} from "@/lib/booking";
import {
  changeAppointmentClient,
  getAppointment,
  setAppointmentStatus,
  updateAppointmentPrice,
} from "@/lib/data/appointments";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import {
  changeChargeAmount,
  getCharge,
  moveDueDate,
  PaymentError,
  recordPayment,
  splitCharge,
  updatePayment,
} from "@/lib/data/charges";
import { createClient } from "@/lib/data/clients";
import { changeBillingDay, changeBillingTiming, changeEnrollmentPrice, changePlan, enroll } from "@/lib/data/enrollments";
import { createPlan } from "@/lib/data/plans";
import { createService } from "@/lib/data/services";
import { createStaff } from "@/lib/data/staff";
import { zonedToUtc } from "@/lib/datetime";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

const MONDAY = "2030-01-07";
const at = (time: string) => zonedToUtc(MONDAY, time, "America/Asuncion").toISOString();
type Tenant = Awaited<ReturnType<typeof createTenant>>;
let t: Tenant;
let other: Tenant;
let serviceId: string;
let longServiceId: string;
let staffId: string;
let seq = 0;
const person = () => ({ name: `Persona ${++seq}`, phone: `+5959817${String(seq).padStart(5, "0")}` });
async function member(tenant: Tenant) {
  return createClient(tenant, { ...person(), email: null, documentNumber: null, notes: null });
}
async function turno(start: string) {
  return bookAppointment(t, { serviceId, staffChoice: "any", start, client: person(), status: "confirmed", source: "dashboard" });
}

beforeAll(async () => {
  t = await createTenant("edits");
  other = await createTenant("edits-other");
  const ana = await createStaff(t, { name: "Ana", memberId: null });
  staffId = ana.id;
  await replaceWeeklySchedule(t, ana.id, [{ weekday: 1, startTime: "08:00", endTime: "12:00" }]);
  const base = { description: null, bookingType: "slot" as const, staffIds: [ana.id] };
  serviceId = (await createService(t, { ...base, name: "Corte", durationMinutes: 30, price: 50000 })).id;
  longServiceId = (await createService(t, { ...base, name: "Color", durationMinutes: 60, price: 120000 })).id;
});

describe("changing a turno", () => {
  it("moves to a free time (its own time doesn't block it) and resets its reminders", async () => {
    const booked = await turno(at("08:00"));
    await db.insert(reminders).values({
      organizationId: t.organization.id,
      kind: "appointment_24h",
      appointmentId: booked.id,
      clientId: (await getAppointment(t, booked.id))!.clientId,
      scheduledFor: new Date(),
      channel: "whatsapp_manual",
    });
    // 08:15 overlaps its own 08:00–08:30: fine when moving itself.
    const { after } = await changeAppointment(t, booked.id, { serviceId, staffChoice: staffId, start: at("08:15"), manualTime: true });
    expect(after.startsAt.toISOString()).toBe(at("08:15"));
    expect(await db.select().from(reminders).where(eq(reminders.appointmentId, booked.id))).toHaveLength(0);
  });

  it("refuses a time taken by another turno, and a new service brings its duration and price", async () => {
    const first = await turno(at("10:00"));
    const second = await turno(at("11:00"));
    await expect(changeAppointment(t, second.id, { serviceId, staffChoice: "any", start: at("10:00") })).rejects.toBeInstanceOf(SlotUnavailableError);
    const { after } = await changeAppointment(t, first.id, { serviceId: longServiceId, staffChoice: "any", start: at("10:00") });
    expect(after.endsAt.toISOString()).toBe(at("11:00"));
    expect(after.price).toBe(120000);
  });

  it("can't move a cancelled turno; price and client can be fixed, inside the business only", async () => {
    const booked = await turno(at("09:00"));
    await setAppointmentStatus(t, booked.id, "cancelled");
    await expect(changeAppointment(t, booked.id, { serviceId, staffChoice: "any", start: at("09:30") })).rejects.toBeInstanceOf(AppointmentClosedError);
    expect(await updateAppointmentPrice(t, booked.id, 1000)).toBeNull();

    const live = await turno(at("09:30"));
    expect(await updateAppointmentPrice(t, live.id, 40000)).toEqual({ before: 50000 });
    const someone = await member(t);
    expect(await changeAppointmentClient(t, live.id, someone.id)).toBeTruthy();
    expect((await getAppointment(t, live.id))!.clientId).toBe(someone.id);
    // Another business's client or turno: nothing happens.
    expect(await changeAppointmentClient(t, live.id, (await member(other)).id)).toBeNull();
    expect(await updateAppointmentPrice(other, live.id, 1)).toBeNull();
  });
});

describe("changing a rental's dates", () => {
  it("re-quotes (or keeps the price) and ignores its own nights", async () => {
    const house = await createService(t, {
      bookingType: "stay",
      name: "Cabaña",
      description: null,
      price: 300000,
      stayUnit: "night",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      minStay: 2,
      maxStay: 30,
      weeklyPrice: null,
      monthlyPrice: null,
    });
    const stay = await bookStay(t, { serviceId: house.id, checkIn: "2030-02-01", checkOut: "2030-02-04", client: person(), status: "confirmed", source: "dashboard" });
    const blocker = await bookStay(t, { serviceId: house.id, checkIn: "2030-02-10", checkOut: "2030-02-12", client: person(), status: "confirmed", source: "dashboard" });
    // Overlaps its own nights: fine.
    const moved = await changeStayDates(t, stay.id, { checkIn: "2030-02-02", checkOut: "2030-02-04", keepPrice: false });
    expect(moved.after.price).toBe(600000);
    const kept = await changeStayDates(t, stay.id, { checkIn: "2030-02-02", checkOut: "2030-02-06", keepPrice: true });
    expect(kept.after.price).toBe(600000);
    await expect(changeStayDates(t, stay.id, { checkIn: "2030-02-08", checkOut: "2030-02-11", keepPrice: false })).rejects.toBeInstanceOf(SlotUnavailableError);
    expect(blocker.id).toBeTruthy();
  });
});

describe("changing a cuota", () => {
  const TODAY = "2030-03-20";
  async function owed(amount = 150000) {
    const plan = await createPlan(t, { name: `Plan ${++seq}`, description: null, price: amount, intervalUnit: "month", intervalCount: 1, billingTiming: "advance" });
    const client = await member(t);
    const enrollmentId = await enroll(t, { clientId: client.id, planId: plan.id, startDate: "2030-03-01", price: null, notes: null }, TODAY);
    const [charge] = await db.select().from(charges).where(eq(charges.enrollmentId, enrollmentId));
    return { charge, enrollmentId, plan, client };
  }

  it("more time: it stops being overdue", async () => {
    const { charge } = await owed();
    expect((await getCharge(t, charge.id, TODAY))!.derived).toBe("vencida");
    await moveDueDate(t, charge.id, "2030-04-05");
    expect((await getCharge(t, charge.id, TODAY))!.derived).toBe("pendiente");
  });

  it("a new amount never below what was paid; equal to it closes the cuota", async () => {
    const { charge } = await owed();
    await recordPayment(t, { chargeId: charge.id, amount: 50000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    await expect(changeChargeAmount(t, charge.id, 40000)).rejects.toBeInstanceOf(PaymentError);
    expect(await changeChargeAmount(t, charge.id, 50000)).toMatchObject({ fullyPaid: true });
    expect((await getCharge(t, charge.id, TODAY))!.status).toBe("paid");
  });

  it("splits what's left into linked parts that add up", async () => {
    const { charge } = await owed(150000);
    await recordPayment(t, { chargeId: charge.id, amount: 30000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    const parts = [
      { amount: 40000, dueDate: "2030-03-25" },
      { amount: 40000, dueDate: "2030-04-25" },
      { amount: 40000, dueDate: "2030-05-25" },
    ];
    await expect(splitCharge(t, charge.id, [parts[0], parts[1]], "X")).rejects.toBeInstanceOf(PaymentError);
    const { createdIds } = await splitCharge(t, charge.id, parts, "Plan");
    expect(createdIds).toHaveLength(2);
    const original = (await getCharge(t, charge.id, TODAY))!;
    expect(original).toMatchObject({ amount: 70000, remaining: 40000, dueDate: "2030-03-25" });
    const part = (await getCharge(t, createdIds[1], TODAY))!;
    expect(part).toMatchObject({ kind: "part", parentChargeId: charge.id, amount: 40000, planName: "Plan · parte 3 de 3" });
  });

  it("a payment can be fixed, never above what's owed, and the cuota reopens", async () => {
    const { charge } = await owed(100000);
    await recordPayment(t, { chargeId: charge.id, amount: 100000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    const [payment] = (await getCharge(t, charge.id, TODAY))!.payments;
    await expect(updatePayment(t, payment.id, { amount: 120000, method: "efectivo", paidOn: TODAY, reference: null })).rejects.toBeInstanceOf(PaymentError);
    await updatePayment(t, payment.id, { amount: 60000, method: "transferencia", paidOn: TODAY, reference: "123" });
    const after = (await getCharge(t, charge.id, TODAY))!;
    expect(after).toMatchObject({ status: "pending", amountPaid: 60000 });
    await expect(updatePayment(other, payment.id, { amount: 1, method: "efectivo", paidOn: TODAY, reference: null })).rejects.toBeInstanceOf(PaymentError);
  });
});

describe("changing a membership", () => {
  const TODAY = "2030-03-20";
  async function membership(startDate = "2030-03-05") {
    const plan = await createPlan(t, { name: `Mensual ${++seq}`, description: null, price: 100000, intervalUnit: "month", intervalCount: 1, billingTiming: "advance" });
    const client = await member(t);
    const id = await enroll(t, { clientId: client.id, planId: plan.id, startDate, price: null, notes: null }, TODAY);
    return { id, plan, client };
  }
  const cuotas = (enrollmentId: string) =>
    db.select().from(charges).where(and(eq(charges.enrollmentId, enrollmentId), eq(charges.kind, "cuota"))).orderBy(charges.periodStart);

  it("a new price changes only unpaid cuotas from today on", async () => {
    const { id } = await membership("2030-02-05");
    // Feb (past, unpaid) and Mar (past, unpaid) exist; generate up to April too.
    await changeEnrollmentPrice(t, id, 90000, "2030-03-01");
    const rows = await cuotas(id);
    expect(rows.find((c) => c.dueDate === "2030-02-05")!.amount).toBe(100000);
    expect(rows.find((c) => c.dueDate === "2030-03-05")!.amount).toBe(90000);
  });

  it("a new billing day starts after the current period, keeping 'socio desde'", async () => {
    const { id } = await membership("2030-03-05");
    await expect(changeBillingDay(t, id, "2030-04-01", TODAY)).rejects.toThrow();
    await changeBillingDay(t, id, "2030-04-10", TODAY);
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    expect(enrollment).toMatchObject({ startDate: "2030-04-10", memberSince: "2030-03-05" });
    // Generate a month ahead: Mar 5 stays, the next one is Apr 10 (not Apr 5).
    const { syncCharges } = await import("@/lib/data/charges");
    await syncCharges(t, { today: "2030-04-10", enrollmentId: id });
    expect((await cuotas(id)).map((c) => c.dueDate)).toEqual(["2030-03-05", "2030-04-10"]);
  });

  it("paying at the end from now on moves the next due date", async () => {
    const { id } = await membership("2030-03-05");
    await changeBillingTiming(t, id, "arrears", TODAY);
    const { syncCharges } = await import("@/lib/data/charges");
    await syncCharges(t, { today: "2030-05-01", enrollmentId: id });
    // Mar (advance) stays; Apr 5–May 5 is now due at its end.
    expect((await cuotas(id)).map((c) => c.dueDate)).toEqual(["2030-03-05", "2030-05-05"]);
  });

  it("changing plan ends the old one at the switch and starts the new one, in one go", async () => {
    const { id, client } = await membership("2030-03-05");
    const target = await createPlan(t, { name: "Premium", description: null, price: 200000, intervalUnit: "month", intervalCount: 1, billingTiming: "advance" });
    const { newId } = await changePlan(t, id, { planId: target.id, from: "2030-04-05", price: null }, TODAY);
    const [old] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    const [fresh] = await db.select().from(enrollments).where(eq(enrollments.id, newId));
    expect(old.status).toBe("cancelled");
    expect(fresh).toMatchObject({ clientId: client.id, planId: target.id, startDate: "2030-04-05", memberSince: "2030-03-05", status: "active" });
    expect((await cuotas(id)).map((c) => c.dueDate)).toEqual(["2030-03-05"]);
  });
});
