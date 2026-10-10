import { z } from "zod";

import { DATE_PATTERN } from "@/lib/datetime";
import { INTERVAL_UNITS, MANUAL_PAYMENT_METHODS } from "@/lib/membership-constants";
import { parseMoneyInput } from "@/lib/money";
import { idSchema, optionalText, requiredText } from "./common";

function moneySchema(currency: string, { required = true, positive = false } = {}) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) {
        if (required) ctx.addIssue({ code: "custom", message: "Ingresá un monto." });
        return required ? z.NEVER : null;
      }
      const amount = parseMoneyInput(value, currency);
      if (amount === null || (positive && amount <= 0)) {
        ctx.addIssue({ code: "custom", message: "Monto inválido." });
        return z.NEVER;
      }
      return amount;
    });
}

export function planSchema(currency: string) {
  return z.object({
    name: requiredText(2, 100, "Ingresá el nombre del plan."),
    description: optionalText(300),
    price: moneySchema(currency).pipe(z.number()),
    intervalUnit: z.enum(INTERVAL_UNITS),
    intervalCount: z.coerce.number().int().min(1).max(12),
  });
}
export type PlanInput = z.infer<ReturnType<typeof planSchema>>;

export function enrollmentSchema(currency: string) {
  return z.object({
    clientId: idSchema,
    planId: z.uuid("Elegí un plan."),
    startDate: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    price: moneySchema(currency, { required: false }),
    notes: optionalText(300),
  });
}

export function paymentSchema(currency: string) {
  return z.object({
    amount: moneySchema(currency, { positive: true }).pipe(z.number()),
    method: z.enum(MANUAL_PAYMENT_METHODS, { error: "Elegí cómo pagó." }),
    paidOn: z.string().regex(DATE_PATTERN, "Elegí la fecha."),
    reference: optionalText(100),
  });
}

export const membershipSettingsSchema = z.object({
  graceDays: z.coerce.number().int().min(0).max(60),
  paymentReminderTemplate: optionalText(500),
});
