import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, notExists, sql, type SQL } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { charges, clients, enrollments, payments, plans } from "@/db/schema";
import { addInterval, currentPeriodStart, periodStart } from "@/lib/billing";
import { reanchorIssues } from "@/lib/config-rules";
import type { BillingTiming } from "@/lib/membership-constants";
import type { FirstCuotaChoice } from "@/lib/validation/memberships";
import { isUniqueViolation } from "@/lib/db-errors";
import { syncCharges } from "./charges";
import { InvalidReferenceError, type TenantScope } from "./scope";

export class AlreadyEnrolledError extends Error {
  constructor() {
    super("Client already has a running enrollment in this plan");
    this.name = "AlreadyEnrolledError";
  }
}

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(enrollments.organizationId, ctx.organization.id), ...conditions);
}

export async function listClientEnrollments(ctx: TenantScope, clientId: string) {
  return db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      startDate: enrollments.startDate,
      memberSince: enrollments.memberSince,
      price: enrollments.price,
      currency: enrollments.currency,
      planId: plans.id,
      planName: plans.name,
      intervalUnit: plans.intervalUnit,
      intervalCount: plans.intervalCount,
      billingTiming: enrollments.billingTiming,
    })
    .from(enrollments)
    .innerJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
    .where(scoped(ctx, eq(enrollments.clientId, clientId)))
    .orderBy(sql`case ${enrollments.status} when 'active' then 0 when 'paused' then 1 else 2 end`, desc(enrollments.startDate));
}

export async function getEnrollment(ctx: TenantScope, id: string) {
  const [row] = await db.select().from(enrollments).where(scoped(ctx, eq(enrollments.id, id)));
  return row ?? null;
}

/** Enrolls a client in a plan and generates the cuotas due so far. */
export async function enroll(
  ctx: TenantScope,
  input: {
    clientId: string;
    planId: string;
    startDate: string;
    price: number | null;
    notes: string | null;
    /** When the first cuota is due; defaults to the plan's timing. */
    firstCuota?: FirstCuotaChoice;
    firstDueDate?: string;
    /** Changing plan: keep "socio desde" of the previous enrollment. */
    memberSince?: string;
  },
  today: string,
  exec: Executor = db,
) {
  const org = ctx.organization.id;
  const [plan] = await exec
    .select()
    .from(plans)
    .where(and(eq(plans.organizationId, org), eq(plans.id, input.planId), isNull(plans.archivedAt)));
  if (!plan) throw new InvalidReferenceError("planId");
  const [client] = await exec
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, org), eq(clients.id, input.clientId), isNull(clients.archivedAt)));
  if (!client) throw new InvalidReferenceError("clientId");

  // "start" / "end" choose the timing; "date" keeps the plan's timing with a
  // custom first due date; "free" skips the first period entirely.
  const choice = input.firstCuota ?? (plan.billingTiming === "arrears" ? "end" : "start");
  const billingTiming = choice === "end" ? "arrears" : choice === "start" || choice === "free" ? "advance" : plan.billingTiming;
  const firstDueDate = choice === "date" ? (input.firstDueDate ?? null) : null;
  const billFrom = choice === "free" ? periodStart(input.startDate, plan.intervalUnit, plan.intervalCount, 1) : input.startDate;

  let id: string;
  try {
    const [row] = await exec
      .insert(enrollments)
      .values({
        organizationId: org,
        clientId: client.id,
        planId: plan.id,
        startDate: input.startDate,
        memberSince: input.memberSince ?? input.startDate,
        billFrom,
        billingTiming,
        firstDueDate,
        price: input.price ?? plan.price,
        currency: plan.currency,
        notes: input.notes,
      })
      .returning({ id: enrollments.id });
    id = row.id;
  } catch (error) {
    if (isUniqueViolation(error, "enrollments_running_unique")) throw new AlreadyEnrolledError();
    throw error;
  }
  await syncCharges(ctx, { today, enrollmentId: id }, exec);
  return id;
}

/** Voids future cuotas (starting after `today`) that have no payments. */
async function voidFutureUnpaid(tx: Pick<typeof db, "update">, ctx: TenantScope, enrollmentId: string, today: string) {
  await tx
    .update(charges)
    .set({ status: "void" })
    .where(
      and(
        eq(charges.organizationId, ctx.organization.id),
        eq(charges.enrollmentId, enrollmentId),
        eq(charges.status, "pending"),
        gt(charges.periodStart, today),
        notExists(db.select({ one: sql`1` }).from(payments).where(eq(payments.chargeId, charges.id))),
      ),
    );
}

export async function pauseEnrollment(ctx: TenantScope, id: string, today: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(enrollments)
      .set({ status: "paused", pausedAt: new Date() })
      .where(scoped(ctx, eq(enrollments.id, id), eq(enrollments.status, "active")))
      .returning({ id: enrollments.id });
    if (!row) return false;
    await voidFutureUnpaid(tx, ctx, id, today);
    return true;
  });
}

/** Resumes billing from the current period; paused periods are not billed. */
export async function resumeEnrollment(ctx: TenantScope, id: string, today: string) {
  const enrollment = await getEnrollment(ctx, id);
  if (!enrollment || enrollment.status !== "paused") return false;
  const [plan] = await db.select().from(plans).where(eq(plans.id, enrollment.planId));
  const billFrom = currentPeriodStart(enrollment.startDate, plan.intervalUnit, plan.intervalCount, today);
  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({ status: "active", pausedAt: null, billFrom: billFrom > enrollment.billFrom ? billFrom : enrollment.billFrom })
      .where(scoped(ctx, eq(enrollments.id, id)));
    // Voided-on-pause cuotas from here on are regenerated by syncCharges.
    await tx
      .delete(charges)
      .where(
        and(
          eq(charges.organizationId, ctx.organization.id),
          eq(charges.enrollmentId, id),
          eq(charges.status, "void"),
          gt(charges.periodStart, today),
          notExists(db.select({ one: sql`1` }).from(payments).where(eq(payments.chargeId, charges.id))),
        ),
      );
  });
  await syncCharges(ctx, { today, enrollmentId: id });
  return true;
}

export async function cancelEnrollment(ctx: TenantScope, id: string, today: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(enrollments)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(scoped(ctx, eq(enrollments.id, id), inArray(enrollments.status, ["active", "paused"])))
      .returning({ id: enrollments.id });
    if (!row) return false;
    await voidFutureUnpaid(tx, ctx, id, today);
    return true;
  });
}

/** Clients that can be enrolled (for pickers). */
export async function listEnrollableClients(ctx: TenantScope) {
  return db
    .select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.organization.id), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
}

// ── Changing a membership ───────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Thrown when a change doesn't make sense (e.g. a billing day in the past). */
export class EnrollmentChangeError extends Error {
  constructor(public reason: "not_found" | "invalid" | "same_plan") {
    super(`Enrollment change rejected: ${reason}`);
    this.name = "EnrollmentChangeError";
  }
}

async function lockRunning(tx: Tx, ctx: TenantScope, id: string, statuses: ("active" | "paused")[] = ["active"]) {
  const [row] = await tx
    .select()
    .from(enrollments)
    .where(scoped(ctx, eq(enrollments.id, id), inArray(enrollments.status, statuses)))
    .for("update");
  if (!row) throw new EnrollmentChangeError("not_found");
  const [plan] = await tx.select().from(plans).where(eq(plans.id, row.planId));
  return { enrollment: row, plan };
}

/** Unpaid cuotas of this enrollment starting from `from` (no payments): replaced by new ones. */
async function deleteUnpaidFrom(tx: Tx, ctx: TenantScope, enrollmentId: string, from: string) {
  await tx
    .delete(charges)
    .where(
      and(
        eq(charges.organizationId, ctx.organization.id),
        eq(charges.enrollmentId, enrollmentId),
        eq(charges.kind, "cuota"),
        inArray(charges.status, ["pending", "void"]),
        sql`${charges.periodStart} >= ${from}`,
        notExists(db.select({ one: sql`1` }).from(payments).where(eq(payments.chargeId, charges.id))),
      ),
    );
}

/** End of the period that contains `today` (what is already being billed). */
export function currentPeriodEnd(enrollment: { startDate: string }, plan: { intervalUnit: Parameters<typeof periodStart>[1]; intervalCount: number }, today: string) {
  const start = currentPeriodStart(enrollment.startDate, plan.intervalUnit, plan.intervalCount, today);
  return addInterval(start, plan.intervalUnit, plan.intervalCount);
}

/**
 * "Precio desde ahora": the membership's price and every unpaid cuota due
 * from today on (without payments) change; past and paid ones don't.
 */
export async function changeEnrollmentPrice(ctx: TenantScope, id: string, price: number, today: string) {
  return db.transaction(async (tx) => {
    const { enrollment } = await lockRunning(tx, ctx, id, ["active", "paused"]);
    await tx.update(enrollments).set({ price }).where(eq(enrollments.id, id));
    const updated = await tx
      .update(charges)
      .set({ amount: price })
      .where(
        and(
          eq(charges.organizationId, ctx.organization.id),
          eq(charges.enrollmentId, id),
          eq(charges.kind, "cuota"),
          eq(charges.status, "pending"),
          sql`${charges.dueDate} >= ${today}`,
          notExists(db.select({ one: sql`1` }).from(payments).where(eq(payments.chargeId, charges.id))),
        ),
      )
      .returning({ id: charges.id });
    return { before: enrollment.price, updatedCuotas: updated.length };
  });
}

/**
 * "Día de cobro": from `newStart` on, periods (and dues) follow the new day.
 * The current period stays billed as it was; the new start can't overlap it.
 */
export async function changeBillingDay(ctx: TenantScope, id: string, newStart: string, today: string) {
  const result = await db.transaction(async (tx) => {
    const { enrollment, plan } = await lockRunning(tx, ctx, id);
    const billedUntil = currentPeriodEnd(enrollment, plan, today);
    if (reanchorIssues({ newStart }, { today, billedUntil }).length > 0) throw new EnrollmentChangeError("invalid");
    // Make sure the current period's cuota exists (with "a período vencido" it is due at its end).
    await syncCharges(ctx, { today, enrollmentId: id, until: billedUntil }, tx);
    await deleteUnpaidFrom(tx, ctx, id, billedUntil);
    await tx
      .update(enrollments)
      .set({ startDate: newStart, billFrom: newStart, firstDueDate: null, memberSince: enrollment.memberSince ?? enrollment.startDate })
      .where(eq(enrollments.id, id));
    return { before: enrollment.startDate };
  });
  await syncCharges(ctx, { today, enrollmentId: id });
  return result;
}

/** "Cuándo paga" from now on: at the start or at the end of each period. */
export async function changeBillingTiming(ctx: TenantScope, id: string, timing: BillingTiming, today: string) {
  const result = await db.transaction(async (tx) => {
    const { enrollment, plan } = await lockRunning(tx, ctx, id, ["active", "paused"]);
    if (enrollment.billingTiming === timing) return { before: timing };
    // Cuotas of the periods still to come follow the new timing.
    await deleteUnpaidFrom(tx, ctx, id, currentPeriodEnd(enrollment, plan, today));
    await tx.update(enrollments).set({ billingTiming: timing, firstDueDate: null }).where(eq(enrollments.id, id));
    return { before: enrollment.billingTiming };
  });
  await syncCharges(ctx, { today, enrollmentId: id });
  return result;
}

/**
 * "Cambiar de plan": the current membership ends at `from` (its cuotas from
 * then on, unpaid, are removed) and a new one starts that day, keeping
 * "socio desde". All in one transaction.
 */
export async function changePlan(
  ctx: TenantScope,
  id: string,
  input: { planId: string; from: string; price: number | null; firstCuota?: FirstCuotaChoice; firstDueDate?: string },
  today: string,
) {
  return db.transaction(async (tx) => {
    const { enrollment } = await lockRunning(tx, ctx, id, ["active", "paused"]);
    if (enrollment.planId === input.planId) throw new EnrollmentChangeError("same_plan");
    if (input.from < today) throw new EnrollmentChangeError("invalid");
    // Bill the old plan up to the change (e.g. the current period "a período vencido").
    if (enrollment.status === "active") await syncCharges(ctx, { today, enrollmentId: id, until: input.from }, tx);
    await deleteUnpaidFrom(tx, ctx, id, input.from);
    await tx.update(enrollments).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(enrollments.id, id));
    const newId = await enroll(
      ctx,
      {
        clientId: enrollment.clientId,
        planId: input.planId,
        startDate: input.from,
        price: input.price,
        notes: enrollment.notes,
        firstCuota: input.firstCuota,
        firstDueDate: input.firstDueDate,
        memberSince: enrollment.memberSince ?? enrollment.startDate,
      },
      today,
      tx,
    );
    return { before: enrollment.planId, newId };
  });
}
