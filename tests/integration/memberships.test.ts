import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { charges, enrollments } from "@/db/schema";
import { createOneOffCharge, getCharge, listCharges, monthSummary, PaymentError, recordPayment, syncCharges, deletePayment, voidCharge } from "@/lib/data/charges";
import { createClient } from "@/lib/data/clients";
import { AlreadyEnrolledError, cancelEnrollment, enroll, pauseEnrollment, resumeEnrollment } from "@/lib/data/enrollments";
import { createPlan, getPlan, listPlans } from "@/lib/data/plans";
import { InvalidReferenceError } from "@/lib/data/scope";
import { isForeignKeyViolation } from "@/lib/db-errors";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

const TODAY = "2026-10-20";
type Tenant = Awaited<ReturnType<typeof createTenant>>;
let a: Tenant;
let b: Tenant;

let phoneSeq = 100;
async function member(t: Tenant, name = "Socio") {
  return createClient(t, { name, phone: `+5959810${phoneSeq++}00`, email: null, documentNumber: null, notes: null });
}

async function monthlyPlan(t: Tenant, price = 150000) {
  return createPlan(t, { name: "Mensual", description: null, price, intervalUnit: "month", intervalCount: 1, billingTiming: "advance" });
}

async function chargesOf(enrollmentId: string) {
  return db.select().from(charges).where(eq(charges.enrollmentId, enrollmentId)).orderBy(charges.periodStart);
}

beforeAll(async () => {
  a = await createTenant("gym-a");
  b = await createTenant("gym-b");
});

describe("enrollment and generation", () => {
  it("generates the cuotas since the start date, plus next week's", async () => {
    const plan = await monthlyPlan(a);
    const client = await member(a);
    const id = await enroll(a, { clientId: client.id, planId: plan.id, startDate: "2026-08-14", price: null, notes: null }, TODAY);
    const rows = await chargesOf(id);
    expect(rows.map((c) => c.dueDate)).toEqual(["2026-08-14", "2026-09-14", "2026-10-14"]);
    expect(rows.every((c) => c.amount === 150000 && c.currency === "PYG")).toBe(true);

    // Idempotent.
    expect(await syncCharges(a, { today: TODAY })).toBe(0);
    expect(await chargesOf(id)).toHaveLength(3);
    // A week later the next cuota appears (7 days ahead).
    expect(await syncCharges(a, { today: "2026-11-08", enrollmentId: id })).toBe(1);
  });

  it("uses the personal price and blocks a duplicate running enrollment", async () => {
    const plan = await monthlyPlan(a, 200000);
    const client = await member(a);
    const id = await enroll(a, { clientId: client.id, planId: plan.id, startDate: TODAY, price: 180000, notes: null }, TODAY);
    expect((await chargesOf(id))[0].amount).toBe(180000);
    await expect(enroll(a, { clientId: client.id, planId: plan.id, startDate: TODAY, price: null, notes: null }, TODAY)).rejects.toBeInstanceOf(AlreadyEnrolledError);
  });

  it("pause stops billing; resume continues from the current period", async () => {
    const plan = await monthlyPlan(a);
    const client = await member(a);
    const id = await enroll(a, { clientId: client.id, planId: plan.id, startDate: "2026-06-05", price: null, notes: null }, "2026-06-30");
    // June, plus July (generated 7 days ahead).
    expect((await chargesOf(id)).map((c) => c.dueDate)).toEqual(["2026-06-05", "2026-07-05"]);
    await pauseEnrollment(a, id, "2026-06-30");
    // July hadn't started: pausing waives it. Nothing is generated while paused.
    expect((await chargesOf(id)).map((c) => c.status)).toEqual(["pending", "void"]);
    expect(await syncCharges(a, { today: "2026-09-20", enrollmentId: id })).toBe(0);
    await resumeEnrollment(a, id, "2026-09-20");
    // Billing continues from September's period; August (paused) is never billed.
    const rows = await chargesOf(id);
    expect(rows.map((c) => `${c.dueDate}:${c.status}`)).toEqual(["2026-06-05:pending", "2026-07-05:void", "2026-09-05:pending"]);
  });

  it("cancelling voids future unpaid cuotas but keeps what is owed", async () => {
    const plan = await monthlyPlan(a);
    const client = await member(a);
    const id = await enroll(a, { clientId: client.id, planId: plan.id, startDate: "2026-09-25", price: null, notes: null }, TODAY);
    expect((await chargesOf(id)).map((c) => c.dueDate)).toEqual(["2026-09-25", "2026-10-25"]);
    await cancelEnrollment(a, id, TODAY);
    const rows = await chargesOf(id);
    expect(rows.map((c) => c.status)).toEqual(["pending", "void"]);
    const [row] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    expect(row.status).toBe("cancelled");
  });
});

describe("payments", () => {
  async function oneCharge(t: Tenant, price = 150000) {
    const plan = await monthlyPlan(t, price);
    const client = await member(t);
    const id = await enroll(t, { clientId: client.id, planId: plan.id, startDate: "2026-10-05", price: null, notes: null }, TODAY);
    return (await chargesOf(id))[0];
  }

  it("partial then final payment marks the cuota paid", async () => {
    const charge = await oneCharge(a);
    let detail = await getCharge(a, charge.id, TODAY);
    expect(detail?.derived).toBe("vencida");

    const partial = await recordPayment(a, { chargeId: charge.id, amount: 50000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    expect(partial).toEqual({ fullyPaid: false, remaining: 100000 });
    detail = await getCharge(a, charge.id, "2026-10-05");
    expect(detail?.derived).toBe("parcial");
    expect(detail?.amountPaid).toBe(50000);

    await expect(
      recordPayment(a, { chargeId: charge.id, amount: 150000, method: "efectivo", paidOn: TODAY, reference: null, userId: null }),
    ).rejects.toMatchObject({ reason: "overpaid" });

    const final = await recordPayment(a, { chargeId: charge.id, amount: 100000, method: "transferencia", paidOn: TODAY, reference: "TRX-1", userId: null });
    expect(final.fullyPaid).toBe(true);
    detail = await getCharge(a, charge.id, TODAY);
    expect(detail).toMatchObject({ derived: "pagada", status: "paid", amountPaid: 150000 });
    expect(detail?.paidAt).not.toBeNull();
    expect(detail?.payments).toHaveLength(2);

    // Undo the last payment: the cuota reopens.
    await deletePayment(a, detail!.payments[1].id);
    expect((await getCharge(a, charge.id, TODAY))?.status).toBe("pending");
  });

  it("concurrent payments can't overpay (row lock)", async () => {
    const charge = await oneCharge(a, 100000);
    const results = await Promise.allSettled([
      recordPayment(a, { chargeId: charge.id, amount: 80000, method: "efectivo", paidOn: TODAY, reference: null, userId: null }),
      recordPayment(a, { chargeId: charge.id, amount: 80000, method: "efectivo", paidOn: TODAY, reference: null, userId: null }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getCharge(a, charge.id, TODAY))?.amountPaid).toBe(80000);
  });

  it("voiding is only allowed without payments", async () => {
    const charge = await oneCharge(a);
    await voidCharge(a, charge.id);
    expect((await getCharge(a, charge.id, TODAY))?.derived).toBe("anulada");
    await expect(recordPayment(a, { chargeId: charge.id, amount: 1, method: "efectivo", paidOn: TODAY, reference: null, userId: null })).rejects.toBeInstanceOf(PaymentError);

    const other = await oneCharge(a);
    await recordPayment(a, { chargeId: other.id, amount: 1000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    await expect(voidCharge(a, other.id)).rejects.toMatchObject({ reason: "has_payments" });
  });

  it("filters and summary", async () => {
    const overdue = await listCharges(a, { filter: "vencidas", today: TODAY });
    expect(overdue.rows.every((r) => r.derived === "vencida")).toBe(true);
    expect(overdue.rows.length).toBeGreaterThan(0);
    const summary = await monthSummary(a, TODAY);
    expect(summary.collected).toBeGreaterThan(0);
    expect(summary.overdueCount).toBe(overdue.total);
    expect(summary.activeMembers).toBeGreaterThan(0);
  });
});

describe("tenant isolation", () => {
  it("plans, enrollments, cuotas and payments stay inside their business", async () => {
    const plan = await monthlyPlan(a);
    const clientA = await member(a);
    const id = await enroll(a, { clientId: clientA.id, planId: plan.id, startDate: "2026-10-01", price: null, notes: null }, TODAY);
    const [charge] = await chargesOf(id);

    expect(await getPlan(b, plan.id)).toBeNull();
    expect((await listPlans(b)).map((p) => p.id)).not.toContain(plan.id);
    expect(await getCharge(b, charge.id, TODAY)).toBeNull();
    expect((await listCharges(b, { filter: "todas", today: TODAY })).rows.map((r) => r.id)).not.toContain(charge.id);
    await expect(
      recordPayment(b, { chargeId: charge.id, amount: 1000, method: "efectivo", paidOn: TODAY, reference: null, userId: null }),
    ).rejects.toMatchObject({ reason: "not_found" });
    await expect(voidCharge(b, charge.id)).rejects.toBeInstanceOf(PaymentError);
    expect(await pauseEnrollment(b, id, TODAY)).toBe(false);

    // Enrolling another business's client or plan is rejected.
    const clientB = await member(b);
    await expect(enroll(a, { clientId: clientB.id, planId: plan.id, startDate: TODAY, price: null, notes: null }, TODAY)).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  it("composite FKs reject cross-tenant rows", async () => {
    const planB = await monthlyPlan(b);
    const clientA = await member(a);
    const error = await db
      .insert(enrollments)
      .values({ organizationId: a.organization.id, clientId: clientA.id, planId: planB.id, startDate: TODAY, billFrom: TODAY, price: 1, currency: "PYG" })
      .then(() => null, (e: unknown) => e);
    expect(isForeignKeyViolation(error)).toBe(true);
    const rows = await db.select().from(enrollments).where(and(eq(enrollments.organizationId, a.organization.id), eq(enrollments.planId, planB.id)));
    expect(rows).toHaveLength(0);
  });
});

describe("one-off charges (Nuevo cobro)", () => {
  it("creates a one-off charge that lists, pays and searches like a cuota", async () => {
    const client = await member(a, "Matriculado");
    const id = await createOneOffCharge(a, { clientId: client.id, concept: "Matrícula", amount: 80000, dueDate: TODAY, note: null });
    const charge = await getCharge(a, id, TODAY);
    expect(charge).toMatchObject({ kind: "one_off", enrollmentId: null, periodStart: null, planName: "Matrícula", derived: "pendiente" });
    const { rows } = await listCharges(a, { filter: "todas", q: "matríc", today: TODAY });
    expect(rows.map((r) => r.id)).toContain(id);
    expect((await recordPayment(a, { chargeId: id, amount: 80000, method: "efectivo", paidOn: TODAY, reference: null, userId: null })).fullyPaid).toBe(true);
  });

  it("rolls back a new client when the charge fails in the same transaction", async () => {
    const phone = "+595981777001";
    await expect(
      db.transaction(async (tx) => {
        const client = await createClient(a, { name: "Medio Hecho", phone, email: null, documentNumber: null, notes: null }, tx);
        await createOneOffCharge(b, { clientId: client.id, concept: "Matrícula", amount: 1000, dueDate: TODAY, note: null }, tx);
      }),
    ).rejects.toBeInstanceOf(InvalidReferenceError);
    // Nothing was kept: the phone is free again.
    const again = await createClient(a, { name: "Medio Hecho", phone, email: null, documentNumber: null, notes: null });
    expect(again.phone).toBe(phone);
  });

  it("another business can't charge or see the client", async () => {
    const client = await member(a);
    await expect(createOneOffCharge(b, { clientId: client.id, concept: "X", amount: 1000, dueDate: TODAY, note: null })).rejects.toBeInstanceOf(
      InvalidReferenceError,
    );
    const id = await createOneOffCharge(a, { clientId: client.id, concept: "Clase suelta", amount: 30000, dueDate: TODAY, note: null });
    expect(await getCharge(b, id, TODAY)).toBeNull();
  });

  it("the database refuses a cuota without a period or a one-off without a concept", async () => {
    const client = await member(a);
    const base = { organizationId: a.organization.id, clientId: client.id, dueDate: TODAY, amount: 1000, currency: "PYG" };
    await expect(db.insert(charges).values({ ...base, kind: "one_off" })).rejects.toThrow();
    await expect(db.insert(charges).values({ ...base, kind: "cuota" })).rejects.toThrow();
  });
});
