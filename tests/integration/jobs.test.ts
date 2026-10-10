import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { appointments, payments, providerSubscriptions, reminders } from "@/db/schema";
import { getCharge, recordPayment } from "@/lib/data/charges";
import { createClient } from "@/lib/data/clients";
import { enroll } from "@/lib/data/enrollments";
import { createPlan } from "@/lib/data/plans";
import { createService } from "@/lib/data/services";
import { createStaff } from "@/lib/data/staff";
import { setAppointmentStatus } from "@/lib/data/appointments";
import { CHANNELS } from "@/lib/messaging/channels";
import { planRemindersFor } from "@/lib/jobs/plan-reminders";
import { runScheduledJobs } from "@/lib/jobs/run";
import { MAX_ATTEMPTS, sendDueReminders, skipStaleReminders } from "@/lib/jobs/send-reminders";
import { FAKE_SIGNATURE_HEADER, signFakePayload } from "@/lib/payments/fake";
import { processWebhook } from "@/lib/payments/webhooks";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();
afterEach(() => vi.restoreAllMocks());

// Fixed clock: 2030-01-07 12:00 UTC = 09:00 in Asunción.
const NOW = new Date("2030-01-07T12:00:00Z");
const TODAY = "2030-01-07";
const HOUR = 3_600_000;
let seq = 0;

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function client(t: Tenant, email: string | null) {
  seq++;
  return createClient(t, { name: `Cliente ${seq}`, phone: `+5959817${String(seq).padStart(5, "0")}`, email, documentNumber: null, notes: null });
}

async function turno(t: Tenant, clientId: string, startsAt: Date) {
  const person = await createStaff(t, { name: `Staff ${++seq}`, memberId: null });
  const service = await createService(t, { name: "Corte", description: null, durationMinutes: 30, price: 50000, staffIds: [person.id] });
  const [row] = await db
    .insert(appointments)
    .values({
      organizationId: t.organization.id,
      clientId,
      serviceId: service.id,
      staffId: person.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status: "confirmed",
      source: "dashboard",
      price: 50000,
      currency: "PYG",
    })
    .returning();
  return row;
}

async function remindersOf(t: Tenant) {
  return db.select().from(reminders).where(eq(reminders.organizationId, t.organization.id));
}

let a: Tenant;
let b: Tenant;
beforeAll(async () => {
  a = await createTenant("remind-a");
  b = await createTenant("remind-b");
});

describe("planning and sending reminders", () => {
  it("plans turno reminders once, by channel, and sends the email ones", async () => {
    const withEmail = await client(a, "ana@example.com");
    const withoutEmail = await client(a, null);
    const t1 = await turno(a, withEmail.id, new Date(NOW.getTime() + 24 * HOUR));
    const t2 = await turno(a, withoutEmail.id, new Date(NOW.getTime() + 20 * HOUR));

    expect(await planRemindersFor(a, NOW)).toBe(2);
    expect(await planRemindersFor(a, NOW)).toBe(0); // idempotent
    const rows = await remindersOf(a);
    expect(rows.find((r) => r.appointmentId === t1.id)?.channel).toBe("email");
    expect(rows.find((r) => r.appointmentId === t2.id)?.channel).toBe("whatsapp_manual");

    const send = vi.spyOn(CHANNELS.email, "send");
    const result = await sendDueReminders(NOW);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(send.mock.calls.some(([message]) => message.to === "ana@example.com" && message.subject.includes("mañana"))).toBe(true);
    const [sent] = await db.select().from(reminders).where(eq(reminders.appointmentId, t1.id));
    expect(sent.status).toBe("sent");
    // Manual WhatsApp reminders are never auto-sent.
    const [manual] = await db.select().from(reminders).where(eq(reminders.appointmentId, t2.id));
    expect(manual.status).toBe("pending");

    // Cancelling the turno makes its pending reminder obsolete.
    await setAppointmentStatus(a, t2.id, "cancelled");
    await skipStaleReminders(NOW);
    const [skipped] = await db.select().from(reminders).where(eq(reminders.appointmentId, t2.id));
    expect(skipped.status).toBe("skipped");
  });

  it("plans cuota reminders and skips them once paid", async () => {
    const member = await client(a, null);
    const plan = await createPlan(a, { name: "Mensual", description: null, price: 150000, intervalUnit: "month", intervalCount: 1 });
    const enrollmentId = await enroll(a, { clientId: member.id, planId: plan.id, startDate: "2030-01-10", price: null, notes: null }, TODAY);
    expect(await planRemindersFor(a, NOW)).toBe(1);
    const [row] = await db.select().from(reminders).where(eq(reminders.clientId, member.id));
    expect(row).toMatchObject({ kind: "charge_upcoming", channel: "whatsapp_manual" });

    const [chargeRow] = await db.execute<{ id: string }>(sql`select id from charges where enrollment_id = ${enrollmentId}`).then((r) => r.rows);
    await recordPayment(a, { chargeId: chargeRow.id, amount: 150000, method: "efectivo", paidOn: TODAY, reference: null, userId: null });
    await skipStaleReminders(NOW);
    const [after] = await db.select().from(reminders).where(eq(reminders.id, row.id));
    expect(after.status).toBe("skipped");
  });

  it("retries failed emails, then marks them failed", async () => {
    const withEmail = await client(a, "falla@example.com");
    const t = await turno(a, withEmail.id, new Date(NOW.getTime() + 22 * HOUR));
    await planRemindersFor(a, NOW);
    vi.spyOn(CHANNELS.email, "send").mockResolvedValue({ ok: false, error: "SMTP caído" });
    for (let i = 0; i < MAX_ATTEMPTS; i++) await sendDueReminders(NOW);
    const [row] = await db.select().from(reminders).where(eq(reminders.appointmentId, t.id));
    expect(row).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, lastError: "SMTP caído" });
  });

  it("reminders stay inside their business", async () => {
    const other = await client(b, null);
    await turno(b, other.id, new Date(NOW.getTime() + 24 * HOUR));
    await planRemindersFor(b, NOW);
    const aRows = await remindersOf(a);
    expect(aRows.some((r) => r.clientId === other.id)).toBe(false);
  });
});

describe("scheduled job runner", () => {
  it("runs everything and refuses a concurrent run", async () => {
    const report = await runScheduledJobs(NOW);
    expect(report.ran).toBe(true);

    // Hold the lock in another transaction: the job must not run.
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('agenda:scheduled-jobs'))`);
      const concurrent = await runScheduledJobs(NOW);
      expect(concurrent).toEqual({ ran: false, reason: "already_running" });
    });
  });
});

describe("payment webhooks (fake provider)", () => {
  const secret = process.env.FAKE_PROVIDER_SECRET!;
  function webhook(payload: object, signature?: string) {
    const body = JSON.stringify(payload);
    return new Request("http://localhost/api/payments/webhook/fake", {
      method: "POST",
      body,
      headers: { [FAKE_SIGNATURE_HEADER]: signature ?? signFakePayload(body, secret) },
    });
  }

  async function subscribed(t: Tenant, startDate: string) {
    const member = await client(t, null);
    const plan = await createPlan(t, { name: "Online", description: null, price: 100000, intervalUnit: "month", intervalCount: 1 });
    const enrollmentId = await enroll(t, { clientId: member.id, planId: plan.id, startDate, price: null, notes: null }, "2030-01-07");
    const externalId = `fake_sub_${++seq}`;
    await db.insert(providerSubscriptions).values({ organizationId: t.organization.id, enrollmentId, provider: "fake", externalId, status: "active" });
    return { enrollmentId, externalId };
  }

  it("records the payment on the oldest unpaid cuotas, once", async () => {
    const { enrollmentId, externalId } = await subscribed(a, "2029-12-01"); // Dec + Jan cuotas
    const event = { id: `evt_${++seq}`, type: "payment.succeeded", subscriptionId: externalId, amount: 150000, currency: "PYG", paidAt: "2030-01-07T15:00:00Z", paymentId: "pay_1" };

    const first = await processWebhook("fake", webhook(event));
    expect(first).toEqual({ status: 200, body: { received: true } });
    const rows = await db.execute<{ id: string; due_date: string }>(sql`select id, due_date from charges where enrollment_id = ${enrollmentId} order by due_date`).then((r) => r.rows);
    const dec = await getCharge(a, rows[0].id, "2030-01-07");
    const jan = await getCharge(a, rows[1].id, "2030-01-07");
    expect(dec).toMatchObject({ status: "paid", amountPaid: 100000 });
    expect(jan).toMatchObject({ status: "pending", amountPaid: 50000, derived: "vencida" });
    expect(dec?.payments[0]).toMatchObject({ method: "online", provider: "fake", externalId: "pay_1" });

    // The same event again (provider retry) is a no-op.
    expect(await processWebhook("fake", webhook(event))).toEqual({ status: 200, body: { duplicate: true } });
    const count = await db.select({ n: sql<number>`count(*)::int` }).from(payments).where(eq(payments.provider, "fake"));
    expect(count[0].n).toBe(2);
  });

  it("rejects bad signatures and unknown providers", async () => {
    const event = { id: "evt_bad", type: "other" };
    expect((await processWebhook("fake", webhook(event, "deadbeef"))).status).toBe(401);
    expect((await processWebhook("nope", webhook(event))).status).toBe(404);
    expect((await processWebhook("manual", webhook(event))).status).toBe(404);
    const huge = new Request("http://localhost/api/payments/webhook/fake", { method: "POST", body: "x", headers: { "content-length": String(100_000) } });
    expect((await processWebhook("fake", huge)).status).toBe(413);
  });

  it("unknown subscriptions don't touch any business; cancellation cancels the enrollment", async () => {
    const result = await processWebhook("fake", webhook({ id: `evt_${++seq}`, type: "payment.succeeded", subscriptionId: "fake_sub_unknown", amount: 1000, currency: "PYG", paidAt: "2030-01-07T15:00:00Z", paymentId: "pay_x" }));
    expect(result.body).toMatchObject({ note: "Suscripción desconocida" });

    const { enrollmentId, externalId } = await subscribed(b, "2030-01-07");
    await processWebhook("fake", webhook({ id: `evt_${++seq}`, type: "subscription.cancelled", subscriptionId: externalId }));
    const status = await db.execute<{ status: string }>(sql`select status from enrollments where id = ${enrollmentId}`).then((r) => r.rows[0].status);
    expect(status).toBe("cancelled");
    const [subscription] = await db.select().from(providerSubscriptions).where(and(eq(providerSubscriptions.externalId, externalId)));
    expect(subscription.status).toBe("cancelled");
  });
});
