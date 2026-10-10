"use server";

import { refresh } from "next/cache";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { deletePayment, PaymentError, recordPayment, voidCharge } from "@/lib/data/charges";
import {
  AlreadyEnrolledError,
  cancelEnrollment,
  enroll,
  pauseEnrollment,
  resumeEnrollment,
} from "@/lib/data/enrollments";
import { InvalidReferenceError } from "@/lib/data/scope";
import { cancelProviderSubscriptions, startProviderSubscription } from "@/lib/payments/subscriptions";
import { todayInZone } from "@/lib/datetime";
import { parseForm } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { enrollmentSchema, paymentSchema } from "@/lib/validation/memberships";

const MEMBERSHIPS = { product: "memberships" } as const;

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
    if (error instanceof PaymentError) {
      const messages = {
        not_found: "Cuota no encontrada.",
        closed: "Esta cuota ya está pagada o anulada.",
        overpaid: "El monto es mayor a lo que se debe.",
        has_payments: "Esta cuota ya tiene pagos.",
      };
      return { errors: { [error.reason === "overpaid" ? "amount" : "form"]: messages[error.reason] } };
    }
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
