import { z } from "zod";

import { planIssues, reportIssues, type Issue } from "@/lib/config-rules";
import { DATE_PATTERN } from "@/lib/datetime";
import {
  BILLING_TIMINGS,
  GRACE_UNITS,
  INTERVAL_UNITS,
  MANUAL_PAYMENT_METHODS,
  MAX_GRACE,
  MAX_INTERVAL_COUNT,
} from "@/lib/membership-constants";
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
  return z
    .object({
      name: requiredText(2, 100, "Ingresá el nombre del plan."),
      description: optionalText(300),
      price: moneySchema(currency).pipe(z.number()),
      intervalUnit: z.enum(INTERVAL_UNITS),
      intervalCount: z.coerce
        .number({ error: "Ingresá cada cuánto se cobra." })
        .int("Ingresá un número entero.")
        .min(1, "Tiene que ser al menos 1.")
        .max(MAX_INTERVAL_COUNT, `Como máximo ${MAX_INTERVAL_COUNT}.`),
      billingTiming: z.enum(BILLING_TIMINGS),
    })
    .superRefine((data, ctx) => reportIssues(ctx, planIssues(data) as Issue<unknown>[]));
}
export type PlanInput = z.infer<ReturnType<typeof planSchema>>;

/** When the first cuota is due (enroll form). */
export const FIRST_CUOTA_CHOICES = ["start", "end", "date", "free"] as const;
export type FirstCuotaChoice = (typeof FIRST_CUOTA_CHOICES)[number];

/** An enrollment's terms (plan, since when, first cuota), without the client. */
function enrollmentTerms(currency: string) {
  return z.object({
    planId: z.uuid("Elegí un plan."),
    startDate: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    price: moneySchema(currency, { required: false }),
    notes: optionalText(300),
    firstCuota: z.enum(FIRST_CUOTA_CHOICES).default("start"),
    firstDueDate: z.preprocess((value) => (value === "" ? undefined : value), z.string().regex(DATE_PATTERN).optional()),
  });
}

function withFirstDueChecks<S extends z.ZodType<{ startDate: string; firstCuota: FirstCuotaChoice; firstDueDate?: string }>>(schema: S) {
  return schema
    .refine((data) => data.firstCuota !== "date" || !!data.firstDueDate, {
      path: ["firstDueDate"],
      message: "Elegí la fecha de la primera cuota.",
    })
    .refine((data) => data.firstCuota !== "date" || !data.firstDueDate || data.firstDueDate >= data.startDate, {
      path: ["firstDueDate"],
      message: "No puede ser antes de la fecha de inicio.",
    });
}

export function enrollmentSchema(currency: string) {
  return withFirstDueChecks(enrollmentTerms(currency).extend({ clientId: idSchema }));
}

/** "Nuevo cobro" → a plan, for a client chosen (or created) in the same flow. */
export function enrollmentTermsSchema(currency: string) {
  return withFirstDueChecks(enrollmentTerms(currency));
}

/** "Nuevo cobro" → something charged once: matrícula, deuda vieja, clase suelta. */
export function oneOffChargeSchema(currency: string) {
  return z.object({
    concept: requiredText(2, 100, "Escribí qué le cobrás."),
    amount: moneySchema(currency, { positive: true }).pipe(z.number()),
    dueDate: z.string().regex(DATE_PATTERN, "Elegí hasta cuándo tiene para pagar."),
    note: optionalText(300),
  });
}

/** "Nuevo cobro": who (existing or new) and what (a plan or a one-off charge). */
export const newChargeSchema = z.object({
  clientId: z.union([z.literal(""), idSchema]).default(""),
  what: z.enum(["plan", "one_off"], { error: "Elegí qué le cobrás." }),
});

export function paymentSchema(currency: string) {
  return z.object({
    amount: moneySchema(currency, { positive: true }).pipe(z.number()),
    method: z.enum(MANUAL_PAYMENT_METHODS, { error: "Elegí cómo pagó." }),
    paidOn: z.string().regex(DATE_PATTERN, "Elegí la fecha."),
    reference: optionalText(100),
  });
}

export const membershipSettingsSchema = z
  .object({
    graceCount: z.coerce.number({ error: "Ingresá un número." }).int("Ingresá un número entero.").min(0, "No puede ser negativo."),
    graceUnit: z.enum(GRACE_UNITS),
    paymentReminderTemplate: optionalText(500),
  })
  .refine((data) => data.graceCount <= MAX_GRACE[data.graceUnit], {
    path: ["graceCount"],
    message: "Es demasiado: hasta 365 días, 52 semanas o 12 meses.",
  });
