import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditEvents, clients, reminders } from "@/db/schema";
import { listAuditEvents, recordAudit } from "@/lib/audit";
import { bookAppointment } from "@/lib/booking";
import { getAppointment } from "@/lib/data/appointments";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import { createClient, setClientArchived } from "@/lib/data/clients";
import { getEmailPreference, setEmailOptOut } from "@/lib/data/email-preferences";
import { enroll, listClientEnrollments } from "@/lib/data/enrollments";
import { createPlan } from "@/lib/data/plans";
import { createService } from "@/lib/data/services";
import { updateBusinessProfile } from "@/lib/data/settings";
import { redirectedSlug, slugOwner } from "@/lib/data/slugs";
import { createStaff } from "@/lib/data/staff";
import { zonedToUtc } from "@/lib/datetime";
import { planRemindersFor } from "@/lib/jobs/plan-reminders";
import { createUnsubscribeToken } from "@/lib/unsubscribe";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

const NOW = new Date("2030-01-07T12:00:00Z");
const TODAY = "2030-01-07";
let seq = 0;
type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function newClient(t: Tenant, email: string | null = null) {
  seq++;
  return createClient(t, { name: `Persona ${seq}`, phone: `+5959818${String(seq).padStart(5, "0")}`, email, documentNumber: null, notes: null });
}

let a: Tenant;
let b: Tenant;
beforeAll(async () => {
  a = await createTenant("fixes-a");
  b = await createTenant("fixes-b");
});

describe("archiving a client", () => {
  it("pauses their memberships so no cuota reminders are planned", async () => {
    const client = await newClient(a);
    const plan = await createPlan(a, { name: "Mensual", description: null, price: 100000, intervalUnit: "month", intervalCount: 1 });
    await enroll(a, { clientId: client.id, planId: plan.id, startDate: "2030-01-09", price: null, notes: null }, TODAY);

    const result = await setClientArchived(a, client.id, true, TODAY);
    expect(result).toEqual({ ok: true, pausedMemberships: 1 });
    const [membership] = await listClientEnrollments(a, client.id);
    expect(membership.status).toBe("paused");

    await planRemindersFor(a, NOW);
    const planned = await db.select().from(reminders).where(eq(reminders.clientId, client.id));
    expect(planned).toHaveLength(0);
  });
});

describe("changing the public link", () => {
  it("keeps the old slug as a redirect that nobody else can take", async () => {
    const old = a.settings.slug;
    const next = `${old}-nuevo`;
    await updateBusinessProfile(a, { name: a.organization.name, slug: next, timezone: a.settings.timezone });
    expect(await redirectedSlug(old)).toBe(next);
    expect(await slugOwner(old)).toBe(a.organization.id);
    expect(await slugOwner(old)).not.toBe(b.organization.id);

    // Taking the old link back makes it current again (no self-redirect).
    await updateBusinessProfile(a, { name: a.organization.name, slug: old, timezone: a.settings.timezone });
    expect(await redirectedSlug(old)).toBeNull();
    expect(await redirectedSlug(next)).toBe(old);
  });
});

describe("public booking with someone else's phone", () => {
  it("keeps the stored client name and remembers the typed one", async () => {
    const person = await createStaff(b, { name: "Ana", memberId: null });
    await replaceWeeklySchedule(b, person.id, [{ weekday: 1, startTime: "08:00", endTime: "12:00" }]);
    const service = await createService(b, { name: "Corte", description: null, durationMinutes: 30, price: 50000, staffIds: [person.id] });
    const owner = await createClient(b, { name: "María Real", phone: "+595981777001", email: null, documentNumber: null, notes: null });

    const booked = await bookAppointment(b, {
      serviceId: service.id,
      staffChoice: "any",
      start: zonedToUtc("2030-01-14", "09:00", "America/Asuncion").toISOString(),
      client: { name: "Otra Persona", phone: "+595981777001" },
      status: "confirmed",
      source: "online",
      withManageToken: true,
      now: NOW,
    });
    const turno = await getAppointment(b, booked.id);
    expect(turno).toMatchObject({ clientId: owner.id, clientName: "María Real", bookedName: "Otra Persona" });
  });
});

describe("email opt-out", () => {
  it("unsubscribes through the signed link and routes reminders to WhatsApp", async () => {
    const client = await newClient(a, "baja@example.com");
    const token = createUnsubscribeToken(client.id, process.env.BETTER_AUTH_SECRET!);
    expect(await getEmailPreference(token)).toMatchObject({ clientId: client.id, optedOutAt: null });
    expect(await setEmailOptOut(token, true)).toBe(true);
    const [row] = await db.select().from(clients).where(eq(clients.id, client.id));
    expect(row.emailOptOutAt).not.toBeNull();
    expect(await setEmailOptOut(`${token}x`, true)).toBe(false);
  });
});

describe("audit log", () => {
  it("records events per business", async () => {
    await recordAudit({ organization: a.organization, user: { id: "u1", name: "Ana" } as never }, "charge.voided", { type: "charge", id: "x" });
    const events = await listAuditEvents(a);
    expect(events[0]).toMatchObject({ action: "charge.voided", actorName: "Ana", targetId: "x" });
    expect((await listAuditEvents(b)).some((event) => event.targetId === "x")).toBe(false);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.organizationId, a.organization.id))).not.toHaveLength(0);
  });
});
