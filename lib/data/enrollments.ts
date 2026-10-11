import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, notExists, sql, type SQL } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { charges, clients, enrollments, payments, plans } from "@/db/schema";
import { currentPeriodStart, periodStart } from "@/lib/billing";
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
        memberSince: input.startDate,
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
