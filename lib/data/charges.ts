import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sql, sum, type SQL } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { charges, clients, enrollments, payments, plans, reminders } from "@/db/schema";
import { addDays, chargeStatus, overdueCutoff, periodsFor, type DerivedChargeStatus, type Grace } from "@/lib/billing";
import { chargeAmountIssues, splitIssues, type SplitPart } from "@/lib/config-rules";
import { zonedToUtc } from "@/lib/datetime";
import type { PaymentMethod } from "@/lib/membership-constants";
import { InvalidReferenceError, likePattern, PAGE_SIZE, type TenantScope } from "./scope";

/** How far ahead cuotas are generated, so next week's dues are visible. */
export const GENERATE_AHEAD_DAYS = 7;

export class PaymentError extends Error {
  constructor(public reason: "not_found" | "closed" | "overpaid" | "has_payments" | "invalid") {
    super(`Payment rejected: ${reason}`);
    this.name = "PaymentError";
  }
}

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(charges.organizationId, ctx.organization.id), ...conditions);
}

/** The business's tolerance before a cuota is overdue. */
export function graceOf(settings: Pick<TenantScope["settings"], "graceCount" | "graceUnit">): Grace {
  return { count: settings.graceCount, unit: settings.graceUnit };
}

/**
 * Creates the cuotas of active enrollments due up to `today + 7 days`.
 * Idempotent: (enrollment, period start) is unique, so re-runs insert nothing.
 */
export async function syncCharges(
  ctx: TenantScope,
  { today, enrollmentId, until: untilOverride }: { today: string; enrollmentId?: string; /** Generate dues up to this date instead. */ until?: string },
  exec: Executor = db,
) {
  const rows = await exec
    .select({
      id: enrollments.id,
      clientId: enrollments.clientId,
      startDate: enrollments.startDate,
      billFrom: enrollments.billFrom,
      billingTiming: enrollments.billingTiming,
      firstDueDate: enrollments.firstDueDate,
      price: enrollments.price,
      currency: enrollments.currency,
      intervalUnit: plans.intervalUnit,
      intervalCount: plans.intervalCount,
    })
    .from(enrollments)
    .innerJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
    .where(
      and(
        eq(enrollments.organizationId, ctx.organization.id),
        eq(enrollments.status, "active"),
        enrollmentId ? eq(enrollments.id, enrollmentId) : undefined,
      ),
    );

  const until = untilOverride ?? addDays(today, GENERATE_AHEAD_DAYS);
  const values = rows.flatMap((enrollment) =>
    periodsFor({
      startDate: enrollment.startDate,
      billFrom: enrollment.billFrom,
      unit: enrollment.intervalUnit,
      count: enrollment.intervalCount,
      until,
      timing: enrollment.billingTiming,
      firstDueDate: enrollment.firstDueDate,
    }).map((period) => ({
      organizationId: ctx.organization.id,
      enrollmentId: enrollment.id,
      clientId: enrollment.clientId,
      ...period,
      amount: enrollment.price,
      currency: enrollment.currency,
    })),
  );
  if (values.length === 0) return 0;
  const inserted = await exec
    .insert(charges)
    .values(values)
    .onConflictDoNothing({ target: [charges.enrollmentId, charges.periodStart] })
    .returning({ id: charges.id });
  return inserted.length;
}

/** A one-off charge (matrícula, deuda vieja, clase suelta), not tied to a plan. */
export async function createOneOffCharge(
  ctx: TenantScope,
  input: { clientId: string; concept: string; amount: number; dueDate: string; note: string | null },
  exec: Executor = db,
) {
  const [client] = await exec
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.organization.id), eq(clients.id, input.clientId), isNull(clients.archivedAt)));
  if (!client) throw new InvalidReferenceError("clientId");
  const [row] = await exec
    .insert(charges)
    .values({
      organizationId: ctx.organization.id,
      kind: "one_off",
      clientId: client.id,
      concept: input.concept,
      dueDate: input.dueDate,
      amount: input.amount,
      currency: ctx.settings.currency,
      note: input.note,
    })
    .returning({ id: charges.id });
  return row.id;
}

const paidSubquery = sql<number>`coalesce((
  select sum(${payments.amount})::int from ${payments} where ${payments.chargeId} = ${charges.id}
), 0)`;

/** What the charge is for: the plan's name, or the concept of a one-off charge or part. */
const chargeLabel = sql<string>`coalesce(${charges.concept}, ${plans.name}, 'Cobro')`;

const chargeColumns = {
  id: charges.id,
  kind: charges.kind,
  concept: charges.concept,
  parentChargeId: charges.parentChargeId,
  enrollmentId: charges.enrollmentId,
  clientId: charges.clientId,
  periodStart: charges.periodStart,
  periodEnd: charges.periodEnd,
  dueDate: charges.dueDate,
  amount: charges.amount,
  currency: charges.currency,
  status: charges.status,
  paidAt: charges.paidAt,
  note: charges.note,
  amountPaid: paidSubquery,
  clientName: clients.name,
  clientPhone: clients.phone,
  /** Plan name, or the concept of a one-off charge or part. */
  planName: chargeLabel,
};

function joined() {
  return db
    .select(chargeColumns)
    .from(charges)
    .innerJoin(clients, and(eq(clients.id, charges.clientId), eq(clients.organizationId, charges.organizationId)))
    .leftJoin(enrollments, and(eq(enrollments.id, charges.enrollmentId), eq(enrollments.organizationId, charges.organizationId)))
    .leftJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)));
}

type ChargeRow = Awaited<ReturnType<ReturnType<typeof joined>["where"]>>[number];
export type ChargeWithStatus = ChargeRow & { derived: DerivedChargeStatus; remaining: number };

function withStatus(ctx: TenantScope, today: string) {
  return (row: ChargeRow): ChargeWithStatus => ({
    ...row,
    derived: chargeStatus(row, row.amountPaid, today, graceOf(ctx.settings)),
    remaining: Math.max(0, row.amount - row.amountPaid),
  });
}

export type ChargeFilter = "vencidas" | "por-cobrar" | "pagadas" | "todas";

export async function listCharges(
  ctx: TenantScope,
  { filter, q = "", page = 1, today }: { filter: ChargeFilter; q?: string; page?: number; today: string },
) {
  const overdueBefore = overdueCutoff(today, graceOf(ctx.settings)); // due < this → overdue
  const search = q.trim();
  const digits = search.replace(/\D/g, "").replace(/^0+/, "");
  const where = scoped(
    ctx,
    filter === "vencidas" ? and(eq(charges.status, "pending"), lt(charges.dueDate, overdueBefore)) : undefined,
    filter === "por-cobrar" ? and(eq(charges.status, "pending"), gte(charges.dueDate, overdueBefore)) : undefined,
    filter === "pagadas" ? eq(charges.status, "paid") : undefined,
    search
      ? or(
          ilike(clients.name, likePattern(search)),
          ilike(chargeLabel, likePattern(search)),
          digits.length >= 3 ? ilike(clients.phone, likePattern(digits)) : undefined,
        )
      : undefined,
  );
  const order =
    filter === "pagadas" ? [desc(charges.paidAt)] : filter === "todas" ? [desc(charges.dueDate)] : [asc(charges.dueDate)];

  const [rows, [{ total }]] = await Promise.all([
    joined()
      .where(where)
      .orderBy(...order, asc(clients.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(charges)
      .innerJoin(clients, and(eq(clients.id, charges.clientId), eq(clients.organizationId, charges.organizationId)))
      .leftJoin(enrollments, and(eq(enrollments.id, charges.enrollmentId), eq(enrollments.organizationId, charges.organizationId)))
      .leftJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
      .where(where),
  ]);
  return { rows: rows.map(withStatus(ctx, today)), total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCharge(ctx: TenantScope, id: string, today: string) {
  const [row] = await joined().where(scoped(ctx, eq(charges.id, id)));
  if (!row) return null;
  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.organizationId, ctx.organization.id), eq(payments.chargeId, id)))
    .orderBy(asc(payments.paidAt));
  return { ...withStatus(ctx, today)(row), payments: paymentRows };
}

export async function listClientCharges(ctx: TenantScope, clientId: string, today: string) {
  const rows = await joined()
    .where(scoped(ctx, eq(charges.clientId, clientId)))
    .orderBy(desc(charges.dueDate))
    .limit(36);
  return rows.map(withStatus(ctx, today));
}

/** Totals for the cuotas dashboard (local calendar month of `today`). */
export async function monthSummary(ctx: TenantScope, today: string) {
  const org = ctx.organization.id;
  const tz = ctx.settings.timezone;
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + "-01";
  const overdueBefore = overdueCutoff(today, graceOf(ctx.settings));

  const [[collected], [toCollect], [overdue], [members]] = await Promise.all([
    db
      .select({ total: sum(payments.amount).mapWith(Number) })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, org),
          gte(payments.paidAt, zonedToUtc(monthStart, "00:00", tz)),
          lt(payments.paidAt, zonedToUtc(nextMonth, "00:00", tz)),
        ),
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${charges.amount} - ${paidSubquery}), 0)::int` })
      .from(charges)
      .where(scoped(ctx, eq(charges.status, "pending"), gte(charges.dueDate, overdueBefore), lt(charges.dueDate, nextMonth))),
    db
      .select({ n: count(), total: sql<number>`coalesce(sum(${charges.amount} - ${paidSubquery}), 0)::int` })
      .from(charges)
      .where(scoped(ctx, eq(charges.status, "pending"), lt(charges.dueDate, overdueBefore))),
    db
      .select({ n: sql<number>`count(distinct ${enrollments.clientId})::int` })
      .from(enrollments)
      .where(and(eq(enrollments.organizationId, org), eq(enrollments.status, "active"))),
  ]);
  return {
    collected: collected.total ?? 0,
    toCollect: toCollect.total,
    overdueCount: overdue.n,
    overdueAmount: overdue.total,
    activeMembers: members.n,
  };
}

/**
 * Records a (possibly partial) payment. The cuota row is locked, so two
 * simultaneous payments can never exceed what is owed.
 */
export async function recordPayment(
  ctx: TenantScope,
  input: {
    chargeId: string;
    amount: number;
    method: PaymentMethod;
    paidOn: string;
    reference: string | null;
    userId: string | null;
    /** Online payments: provider id and its payment id. */
    provider?: string;
    externalId?: string;
    /** Exact payment time reported by a provider (overrides paidOn). */
    paidAtInstant?: Date;
  },
) {
  return db.transaction(async (tx) => {
    const [charge] = await tx
      .select({ id: charges.id, clientId: charges.clientId, amount: charges.amount, currency: charges.currency, status: charges.status })
      .from(charges)
      .where(scoped(ctx, eq(charges.id, input.chargeId)))
      .for("update");
    if (!charge) throw new PaymentError("not_found");
    if (charge.status !== "pending") throw new PaymentError("closed");

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
      .from(payments)
      .where(eq(payments.chargeId, charge.id));
    const remaining = charge.amount - paid;
    if (input.amount > remaining) throw new PaymentError("overpaid");

    // Noon local time on the chosen day: unambiguous in every time zone.
    const paidAt = input.paidAtInstant ?? zonedToUtc(input.paidOn, "12:00", ctx.settings.timezone);
    await tx.insert(payments).values({
      organizationId: ctx.organization.id,
      chargeId: charge.id,
      clientId: charge.clientId,
      amount: input.amount,
      currency: charge.currency,
      paidAt,
      method: input.method,
      reference: input.reference,
      provider: input.provider ?? null,
      externalId: input.externalId ?? null,
      recordedByUserId: input.userId,
    });
    const fullyPaid = input.amount === remaining;
    if (fullyPaid) await tx.update(charges).set({ status: "paid", paidAt }).where(eq(charges.id, charge.id));
    return { fullyPaid, remaining: remaining - input.amount };
  });
}

/** Undo: removes a payment and reopens the cuota if it is no longer covered. */
/** Undoes a payment. Returns what was deleted (for the audit log), or null. */
export async function deletePayment(ctx: TenantScope, paymentId: string) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select({ id: payments.id, chargeId: payments.chargeId, amount: payments.amount, currency: payments.currency, method: payments.method })
      .from(payments)
      .where(and(eq(payments.organizationId, ctx.organization.id), eq(payments.id, paymentId)));
    if (!payment) return null;
    await tx.select({ id: charges.id }).from(charges).where(eq(charges.id, payment.chargeId)).for("update");
    await tx.delete(payments).where(eq(payments.id, payment.id));
    await tx
      .update(charges)
      .set({ status: "pending", paidAt: null })
      .where(and(eq(charges.id, payment.chargeId), eq(charges.status, "paid")));
    return payment;
  });
}

/** Waives a cuota (only if nothing was paid towards it). */
export async function voidCharge(ctx: TenantScope, id: string) {
  return db.transaction(async (tx) => {
    const [charge] = await tx.select({ id: charges.id }).from(charges).where(scoped(ctx, eq(charges.id, id), eq(charges.status, "pending"))).for("update");
    if (!charge) throw new PaymentError("closed");
    const [{ n }] = await tx.select({ n: count() }).from(payments).where(eq(payments.chargeId, id));
    if (n > 0) throw new PaymentError("has_payments");
    await tx.update(charges).set({ status: "void" }).where(eq(charges.id, id));
  });
}

/** Overdue cuotas count + amount, for Inicio. */
export async function overdueSummary(ctx: TenantScope, today: string) {
  const overdueBefore = overdueCutoff(today, graceOf(ctx.settings));
  const [row] = await db
    .select({ n: count(), total: sql<number>`coalesce(sum(${charges.amount} - ${paidSubquery}), 0)::int` })
    .from(charges)
    .where(scoped(ctx, eq(charges.status, "pending"), lt(charges.dueDate, overdueBefore)));
  return { count: row.n, amount: row.total };
}

/** Pending cuotas of a set of clients, e.g. member badges. */
export async function pendingByClient(ctx: TenantScope, clientIds: string[], today: string) {
  if (clientIds.length === 0) return [];
  const rows = await joined().where(scoped(ctx, inArray(charges.clientId, clientIds), eq(charges.status, "pending"), lte(charges.dueDate, today)));
  return rows.map(withStatus(ctx, today));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Locks a pending charge of this business and returns it with what was paid. */
async function lockPending(tx: Tx, ctx: TenantScope, id: string) {
  const [charge] = await tx.select().from(charges).where(scoped(ctx, eq(charges.id, id))).for("update");
  if (!charge) throw new PaymentError("not_found");
  if (charge.status !== "pending") throw new PaymentError("closed");
  const [{ paid }] = await tx
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .where(eq(payments.chargeId, charge.id));
  return { charge, paid };
}

/** Reminders planned (or sent) for the old due date or amount no longer apply. */
async function resetChargeReminders(tx: Tx, chargeId: string) {
  await tx.delete(reminders).where(eq(reminders.chargeId, chargeId));
}

/** "Darle más tiempo": a new due date for a pending cuota. */
export async function moveDueDate(ctx: TenantScope, id: string, dueDate: string) {
  return db.transaction(async (tx) => {
    const { charge } = await lockPending(tx, ctx, id);
    await tx.update(charges).set({ dueDate }).where(eq(charges.id, id));
    await resetChargeReminders(tx, id);
    return { before: charge.dueDate };
  });
}

/** A new total (discount, surcharge). Never below what was paid; equal to it closes the cuota. */
export async function changeChargeAmount(ctx: TenantScope, id: string, amount: number) {
  return db.transaction(async (tx) => {
    const { charge, paid } = await lockPending(tx, ctx, id);
    if (chargeAmountIssues({ amount }, { paid, currency: charge.currency }).length > 0) throw new PaymentError("invalid");
    const fullyPaid = amount === paid;
    await tx
      .update(charges)
      .set({ amount, ...(fullyPaid && { status: "paid" as const, paidAt: new Date() }) })
      .where(eq(charges.id, id));
    await resetChargeReminders(tx, id);
    return { before: charge.amount, fullyPaid };
  });
}

/**
 * Splits what's left of a cuota into parts. The cuota keeps the first part
 * (plus whatever was already paid); the others become linked charges of kind
 * "part" with their own due dates.
 */
export async function splitCharge(ctx: TenantScope, id: string, parts: SplitPart[], label: string) {
  return db.transaction(async (tx) => {
    const { charge, paid } = await lockPending(tx, ctx, id);
    const remaining = charge.amount - paid;
    if (splitIssues({ parts }, { remaining, currency: charge.currency }).length > 0) throw new PaymentError("invalid");
    const [first, ...rest] = parts as { amount: number; dueDate: string }[];
    await tx.update(charges).set({ amount: paid + first.amount, dueDate: first.dueDate }).where(eq(charges.id, id));
    const created = await tx
      .insert(charges)
      .values(
        rest.map((part, i) => ({
          organizationId: ctx.organization.id,
          kind: "part" as const,
          enrollmentId: charge.enrollmentId,
          clientId: charge.clientId,
          concept: `${label} · parte ${i + 2} de ${parts.length}`,
          parentChargeId: charge.id,
          dueDate: part.dueDate,
          amount: part.amount,
          currency: charge.currency,
        })),
      )
      .returning({ id: charges.id });
    await resetChargeReminders(tx, id);
    return { createdIds: created.map((row) => row.id) };
  });
}

/**
 * Fixes a payment (amount, method, date, reference). The cuota can't end up
 * overpaid, and it opens or closes according to the new total paid.
 */
export async function updatePayment(
  ctx: TenantScope,
  paymentId: string,
  input: { amount: number; method: PaymentMethod; paidOn: string; reference: string | null },
) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.organizationId, ctx.organization.id), eq(payments.id, paymentId)));
    if (!payment) throw new PaymentError("not_found");
    // Online payments come from the provider: they can be undone, not edited.
    if (payment.provider) throw new PaymentError("closed");
    const [charge] = await tx.select().from(charges).where(eq(charges.id, payment.chargeId)).for("update");
    if (!charge || charge.status === "void") throw new PaymentError("closed");
    const [{ others }] = await tx
      .select({ others: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.chargeId, charge.id), sql`${payments.id} <> ${payment.id}`));
    if (others + input.amount > charge.amount) throw new PaymentError("overpaid");

    const paidAt = zonedToUtc(input.paidOn, "12:00", ctx.settings.timezone);
    await tx
      .update(payments)
      .set({ amount: input.amount, method: input.method, paidAt, reference: input.reference })
      .where(eq(payments.id, payment.id));
    const fullyPaid = others + input.amount === charge.amount;
    await tx
      .update(charges)
      .set(fullyPaid ? { status: "paid", paidAt: charge.paidAt ?? paidAt } : { status: "pending", paidAt: null })
      .where(eq(charges.id, charge.id));
    return { before: { amount: payment.amount, method: payment.method }, chargeId: charge.id, fullyPaid };
  });
}

export async function getPayment(ctx: TenantScope, paymentId: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.organizationId, ctx.organization.id), eq(payments.id, paymentId)));
  return row ?? null;
}
