"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import {
  changeChargeAmount,
  createOneOffCharge,
  deletePayment,
  getCharge,
  moveDueDate,
  PaymentError,
  recordPayment,
  splitCharge,
  updatePayment,
  voidCharge,
} from "@/lib/data/charges";
import type { SplitPart } from "@/lib/config-rules";
import { createClient } from "@/lib/data/clients";
import {
  AlreadyEnrolledError,
  cancelEnrollment,
  changeBillingDay,
  changeBillingTiming,
  changeEnrollmentPrice,
  changePlan,
  EnrollmentChangeError,
  enroll,
  getEnrollment,
  pauseEnrollment,
  resumeEnrollment,
} from "@/lib/data/enrollments";
import { InvalidReferenceError } from "@/lib/data/scope";
import { cancelProviderSubscriptions, startProviderSubscription } from "@/lib/payments/subscriptions";
import { DATE_PATTERN, todayInZone } from "@/lib/datetime";
import { isUniqueViolation } from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { clientSchema } from "@/lib/validation/clients";
import {
  enrollmentSchema,
  enrollmentTermsSchema,
  newChargeSchema,
  oneOffChargeSchema,
  paymentSchema,
} from "@/lib/validation/memberships";

const MEMBERSHIPS = { product: "memberships" } as const;

const PAYMENT_MESSAGES: Record<PaymentError["reason"], string> = {
  not_found: "Cuota no encontrada.",
  closed: "Esta cuota ya está pagada o anulada.",
  overpaid: "El monto es mayor a lo que se debe.",
  has_payments: "Esta cuota ya tiene pagos.",
  invalid: "Revisá los datos: algo no cierra.",
};

function paymentErrorState(error: PaymentError): ActionState {
  return { errors: { [error.reason === "overpaid" ? "amount" : "form"]: PAYMENT_MESSAGES[error.reason] } };
}

export async function recordPaymentAction(
  chargeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ payment: ["create"] }, MEMBERSHIPS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(chargeId);
  if (!id) return { errors: { form: "Cuota no encontrada." } };
  const parsed = parseForm(paymentSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };

  try {
    const result = await recordPayment(ctx, { chargeId: id, ...parsed.data, userId: ctx.user.id });
    await recordAudit(ctx, "payment.recorded", { type: "charge", id }, { amount: parsed.data.amount, method: parsed.data.method });
    refresh();
    return {
      message: result.fullyPaid
        ? "Pago registrado: cuota al día"
        : `Pago registrado. Falta ${formatMoney(result.remaining, ctx.settings.currency)}`,
    };
  } catch (error) {
    if (error instanceof PaymentError) return paymentErrorState(error);
    throw error;
  }
}

export async function deletePaymentAction(paymentId: string) {
  const ctx = await authorizeAction({ payment: ["delete"] }, MEMBERSHIPS);
  const id = parseId(paymentId);
  if (!ctx || !id) return;
  const deleted = await deletePayment(ctx, id);
  if (deleted) {
    await recordAudit(ctx, "payment.deleted", { type: "charge", id: deleted.chargeId }, {
      amount: deleted.amount,
      currency: deleted.currency,
      method: deleted.method,
    });
  }
  refresh();
}

export async function voidChargeAction(chargeId: string): Promise<string | undefined> {
  const ctx = await authorizeAction({ payment: ["void"] }, MEMBERSHIPS);
  const id = parseId(chargeId);
  if (!ctx || !id) return;
  try {
    await voidCharge(ctx, id);
    await recordAudit(ctx, "charge.voided", { type: "charge", id });
  } catch (error) {
    if (error instanceof PaymentError) return "No se puede anular: ya tiene pagos o está cerrada.";
    throw error;
  }
  refresh();
}

export async function enrollAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ enrollment: ["create"] }, MEMBERSHIPS);
  if (!ctx) return FORBIDDEN;
  formData.set("clientId", clientId);
  const parsed = parseForm(enrollmentSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };
  try {
    const enrollmentId = await enroll(ctx, parsed.data, todayInZone(ctx.settings.timezone));
    // Automatic billing when the business connected an online provider (none yet).
    await startProviderSubscription(ctx, enrollmentId);
  } catch (error) {
    if (error instanceof AlreadyEnrolledError) return { errors: { planId: "Ya está inscripto en este plan." } };
    if (error instanceof InvalidReferenceError) return { errors: { form: "El plan o la persona ya no están disponibles." } };
    throw error;
  }
  refresh();
  return { message: "Inscripción creada" };
}

const ENROLLMENT_ACTIONS = {
  pause: { run: pauseEnrollment, message: "Membresía pausada" },
  resume: { run: resumeEnrollment, message: "Membresía reactivada" },
  cancel: { run: cancelEnrollment, message: "Membresía cancelada" },
} as const;

export async function changeEnrollmentAction(enrollmentId: string, action: keyof typeof ENROLLMENT_ACTIONS) {
  const ctx = await authorizeAction({ enrollment: ["update"] }, MEMBERSHIPS);
  const id = parseId(enrollmentId);
  if (!ctx || !id || !(action in ENROLLMENT_ACTIONS)) return;
  const ok = await ENROLLMENT_ACTIONS[action].run(ctx, id, todayInZone(ctx.settings.timezone));
  if (ok && action === "cancel") {
    await cancelProviderSubscriptions(ctx, id);
    await recordAudit(ctx, "enrollment.cancelled", { type: "enrollment", id });
  }
  refresh();
  return ok ? ENROLLMENT_ACTIONS[action].message : undefined;
}

/** Thrown inside the "Nuevo cobro" transaction to roll it back with a field error. */
class ChargeFlowError extends Error {
  constructor(public errors: FieldErrors) {
    super("Charge flow rejected");
  }
}

/**
 * "Nuevo cobro": creates the client (if new) and the enrollment or one-off
 * charge in one transaction, so a failed step never leaves half of it saved.
 */
export async function createChargeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ enrollment: ["create"], client: ["create"] }, MEMBERSHIPS);
  if (!ctx) return FORBIDDEN;
  const currency = ctx.settings.currency;
  const base = parseForm(newChargeSchema, formData);
  const client = base.success && base.data.clientId ? null : parseForm(clientSchema, formData);
  const what = base.success ? base.data.what : null;
  const terms = what === "plan" ? parseForm(enrollmentTermsSchema(currency), formData) : null;
  const oneOff = what === "one_off" ? parseForm(oneOffChargeSchema(currency), formData) : null;
  const errors = {
    ...(base.success ? {} : base.errors),
    ...(client && !client.success ? client.errors : {}),
    ...(terms && !terms.success ? terms.errors : {}),
    ...(oneOff && !oneOff.success ? oneOff.errors : {}),
  };
  if (Object.keys(errors).length > 0 || !base.success) return { errors };

  const today = todayInZone(ctx.settings.timezone);
  let clientId: string;
  let enrollmentId: string | null = null;
  try {
    clientId = await db.transaction(async (tx) => {
      let id = base.data.clientId;
      if (!id && client?.success) {
        try {
          id = (await createClient(ctx, client.data, tx)).id;
        } catch (error) {
          if (isUniqueViolation(error, "clients_org_phone_unique")) {
            throw new ChargeFlowError({ phone: "Ya existe alguien con ese teléfono. Volvé atrás y buscalo por nombre." });
          }
          throw error;
        }
      }
      if (terms?.success) {
        enrollmentId = await enroll(ctx, { ...terms.data, clientId: id }, today, tx);
      } else if (oneOff?.success) {
        await createOneOffCharge(ctx, { clientId: id, ...oneOff.data }, tx);
      }
      return id;
    });
  } catch (error) {
    if (error instanceof ChargeFlowError) return { errors: error.errors };
    if (error instanceof AlreadyEnrolledError) return { errors: { planId: "Ya está inscripto en este plan." } };
    if (error instanceof InvalidReferenceError) return { errors: { form: "El plan o la persona ya no están disponibles. Recargá la página." } };
    throw error;
  }
  // Automatic billing when the business connected an online provider (none yet).
  if (enrollmentId) await startProviderSubscription(ctx, enrollmentId);
  if (what === "one_off" && oneOff?.success) {
    await recordAudit(ctx, "charge.created", { type: "client", id: clientId }, { concept: oneOff.data.concept, amount: oneOff.data.amount });
  }
  redirect(withFlash(`/dashboard/clients/${clientId}`, what === "plan" ? "inscripcion-creada" : "cobro-creado"));
}

// ── Changing a cuota (owners/admins: "enrollment:update") ───────────────

const CHARGE_EDIT = { enrollment: ["update"] } as const;

/** "Darle más tiempo": a new due date. */
export async function moveDueDateAction(chargeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction(CHARGE_EDIT, MEMBERSHIPS);
  const id = parseId(chargeId);
  if (!ctx || !id) return FORBIDDEN;
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!DATE_PATTERN.test(dueDate)) return { errors: { dueDate: "Elegí la nueva fecha." } };
  try {
    const { before } = await moveDueDate(ctx, id, dueDate);
    await recordAudit(ctx, "charge.due_moved", { type: "charge", id }, { from: before, to: dueDate });
  } catch (error) {
    if (error instanceof PaymentError) return paymentErrorState(error);
    throw error;
  }
  redirect(withFlash(`/dashboard/cuotas/${id}`, "cuota-cambiada"));
}

/** A new total for the cuota (discount or surcharge). */
export async function changeChargeAmountAction(chargeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction(CHARGE_EDIT, MEMBERSHIPS);
  const id = parseId(chargeId);
  if (!ctx || !id) return FORBIDDEN;
  const amount = parseMoneyInput(String(formData.get("amount") ?? ""), ctx.settings.currency);
  if (amount === null) return { errors: { amount: "Escribí el nuevo monto." } };
  try {
    const { before } = await changeChargeAmount(ctx, id, amount);
    await recordAudit(ctx, "charge.amount_changed", { type: "charge", id }, { from: before, to: amount });
  } catch (error) {
    if (error instanceof PaymentError) {
      return error.reason === "invalid" ? { errors: { amount: "El monto no puede ser menor a lo que ya pagó, ni 0." } } : paymentErrorState(error);
    }
    throw error;
  }
  redirect(withFlash(`/dashboard/cuotas/${id}`, "cuota-cambiada"));
}

/** "Dividir en partes": what's left, in 2–4 parts with their own due dates. */
export async function splitChargeAction(chargeId: string, parts: SplitPart[]): Promise<ActionState> {
  const ctx = await authorizeAction(CHARGE_EDIT, MEMBERSHIPS);
  const id = parseId(chargeId);
  if (!ctx || !id || !Array.isArray(parts)) return FORBIDDEN;
  const clean = parts.slice(0, 5).map((part) => ({
    amount: Number.isInteger(part?.amount) ? part.amount : null,
    dueDate: typeof part?.dueDate === "string" && DATE_PATTERN.test(part.dueDate) ? part.dueDate : "",
  }));
  const charge = await getCharge(ctx, id, todayInZone(ctx.settings.timezone));
  if (!charge) return { errors: { form: "Cuota no encontrada." } };
  try {
    await splitCharge(ctx, id, clean, charge.planName);
    await recordAudit(ctx, "charge.split", { type: "charge", id }, { parts: clean.length, remaining: charge.remaining });
  } catch (error) {
    if (error instanceof PaymentError) {
      return error.reason === "invalid" ? { errors: { parts: "Las partes tienen que sumar lo que falta pagar." } } : paymentErrorState(error);
    }
    throw error;
  }
  redirect(withFlash(`/dashboard/cuotas/${id}`, "cuota-dividida"));
}

/** Fixes a payment recorded by hand (amount, method, date, reference). */
export async function updatePaymentAction(paymentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ payment: ["delete"] }, MEMBERSHIPS);
  const id = parseId(paymentId);
  if (!ctx || !id) return FORBIDDEN;
  const parsed = parseForm(paymentSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };
  let chargeId: string;
  try {
    const result = await updatePayment(ctx, id, parsed.data);
    chargeId = result.chargeId;
    await recordAudit(ctx, "payment.edited", { type: "charge", id: chargeId }, {
      from: result.before,
      to: { amount: parsed.data.amount, method: parsed.data.method },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return error.reason === "closed" ? { errors: { form: "Este pago no se puede editar (es online o la cuota está anulada)." } } : paymentErrorState(error);
    }
    throw error;
  }
  redirect(withFlash(`/dashboard/cuotas/${chargeId}`, "pago-editado"));
}

// ── Changing a membership ───────────────────────────────────────────────

async function editableEnrollment(enrollmentId: string) {
  const ctx = await authorizeAction({ enrollment: ["update"] }, MEMBERSHIPS);
  const id = parseId(enrollmentId);
  if (!ctx || !id) return null;
  const enrollment = await getEnrollment(ctx, id);
  if (!enrollment || enrollment.status === "cancelled") return null;
  return { ctx, enrollment, today: todayInZone(ctx.settings.timezone) };
}

const membershipHref = (clientId: string, id: string) => `/dashboard/clients/${clientId}/membresia/${id}`;

/** "Precio desde ahora": the membership and its unpaid cuotas from today on. */
export async function changeEnrollmentPriceAction(enrollmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableEnrollment(enrollmentId);
  if (!found) return FORBIDDEN;
  const { ctx, enrollment, today } = found;
  const price = parseMoneyInput(String(formData.get("price") ?? ""), enrollment.currency);
  if (price === null || price <= 0) return { errors: { price: "Escribí el nuevo precio." } };
  const { before, updatedCuotas } = await changeEnrollmentPrice(ctx, enrollment.id, price, today);
  await recordAudit(ctx, "enrollment.price_changed", { type: "enrollment", id: enrollment.id }, { from: before, to: price, updatedCuotas });
  redirect(withFlash(membershipHref(enrollment.clientId, enrollment.id), "membresia-cambiada"));
}

/** "Día de cobro": periods follow a new day from `newStart` on. */
export async function changeBillingDayAction(enrollmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableEnrollment(enrollmentId);
  if (!found) return FORBIDDEN;
  const { ctx, enrollment, today } = found;
  const newStart = String(formData.get("newStart") ?? "");
  if (!DATE_PATTERN.test(newStart)) return { errors: { newStart: "Elegí desde qué día cobra." } };
  try {
    const { before } = await changeBillingDay(ctx, enrollment.id, newStart, today);
    await recordAudit(ctx, "enrollment.billing_day_changed", { type: "enrollment", id: enrollment.id }, { from: before, to: newStart });
  } catch (error) {
    if (error instanceof EnrollmentChangeError) {
      return { errors: { newStart: error.reason === "invalid" ? "Esa fecha se superpone con la cuota actual o ya pasó." : "La membresía no está activa." } };
    }
    throw error;
  }
  redirect(withFlash(membershipHref(enrollment.clientId, enrollment.id), "membresia-cambiada"));
}

/** "Cuándo paga" from now on. */
export async function changeBillingTimingAction(enrollmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableEnrollment(enrollmentId);
  if (!found) return FORBIDDEN;
  const { ctx, enrollment, today } = found;
  const timing = formData.get("billingTiming");
  if (timing !== "advance" && timing !== "arrears") return { errors: { billingTiming: "Elegí cuándo paga." } };
  try {
    const { before } = await changeBillingTiming(ctx, enrollment.id, timing, today);
    await recordAudit(ctx, "enrollment.timing_changed", { type: "enrollment", id: enrollment.id }, { from: before, to: timing });
  } catch (error) {
    if (error instanceof EnrollmentChangeError) return { errors: { form: "La membresía ya no está activa." } };
    throw error;
  }
  redirect(withFlash(membershipHref(enrollment.clientId, enrollment.id), "membresia-cambiada"));
}

/** "Cambiar de plan": ends this membership at `startDate` and starts the new plan that day. */
export async function changePlanAction(enrollmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await editableEnrollment(enrollmentId);
  if (!found) return FORBIDDEN;
  const { ctx, enrollment, today } = found;
  const parsed = parseForm(enrollmentTermsSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };
  const terms = parsed.data;
  if (terms.startDate < today) return { errors: { startDate: "El cambio tiene que ser desde hoy o más adelante." } };
  try {
    const { before, newId } = await changePlan(
      ctx,
      enrollment.id,
      { planId: terms.planId, from: terms.startDate, price: terms.price, firstCuota: terms.firstCuota, firstDueDate: terms.firstDueDate },
      today,
    );
    await recordAudit(ctx, "enrollment.plan_changed", { type: "enrollment", id: newId }, { fromPlan: before, toPlan: terms.planId, from: terms.startDate });
  } catch (error) {
    if (error instanceof EnrollmentChangeError) {
      return { errors: error.reason === "same_plan" ? { planId: "Ya está en ese plan: elegí otro." } : { startDate: "Revisá la fecha del cambio." } };
    }
    if (error instanceof AlreadyEnrolledError) return { errors: { planId: "Ya tiene otra membresía activa en ese plan." } };
    if (error instanceof InvalidReferenceError) return { errors: { planId: "Ese plan ya no está disponible." } };
    throw error;
  }
  redirect(withFlash(`/dashboard/clients/${enrollment.clientId}`, "plan-cambiado"));
}
