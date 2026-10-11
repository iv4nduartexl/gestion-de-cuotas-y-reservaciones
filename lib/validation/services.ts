import { z } from "zod";

import { TIME_PATTERN } from "@/lib/datetime";
import { reportIssues, stayIssues, type Issue } from "@/lib/config-rules";
import { parseMoneyInput } from "@/lib/money";
import { MAX_SLOT_MINUTES, MAX_STAY_UNITS, STAY_UNITS } from "@/lib/service-constants";
import { idSchema, optionalText, requiredText } from "./common";

/** Quick picks shown as chips in the service form (any multiple of 5 works). */
export const SERVICE_DURATION_CHIPS = [30, 60, 90, 120, 240, 480, 720, 1440];

function money(currency: string, { required }: { required: boolean }) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) {
        if (required) ctx.addIssue({ code: "custom", message: "Ingresá un precio." });
        return required ? z.NEVER : null;
      }
      const amount = parseMoneyInput(value, currency);
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: "Precio inválido." });
        return z.NEVER;
      }
      return amount;
    });
}

const units = (label: string) =>
  z.coerce
    .number({ error: `Ingresá ${label}.` })
    .int("Ingresá un número entero.")
    .min(1, "Tiene que ser al menos 1.")
    .max(MAX_STAY_UNITS, `Como máximo ${MAX_STAY_UNITS}.`);

/**
 * Service form. "slot" services are turnos by the hour (up to 24 h); "stay"
 * services are rentals by nights/days. `currency` comes from the tenant's
 * business settings, never the form.
 */
export function serviceSchema(currency: string) {
  const common = {
    name: requiredText(2, 100, "Ingresá el nombre del servicio."),
    description: optionalText(500),
    price: money(currency, { required: true }).pipe(z.number()),
  };
  const byType = z.discriminatedUnion("bookingType", [
    z.object({
      ...common,
      bookingType: z.literal("slot"),
      durationMinutes: z.coerce
        .number({ error: "Ingresá cuánto dura." })
        .int()
        .min(5, "La duración mínima es 5 minutos.")
        .max(MAX_SLOT_MINUTES, "Para más de 24 horas, elegí “Por días”.")
        .refine((value) => value % 5 === 0, "Usá múltiplos de 5 minutos."),
      staffIds: z.array(idSchema).max(200).default([]),
    }),
    z
      .object({
        ...common,
        bookingType: z.literal("stay"),
        stayUnit: z.enum(STAY_UNITS),
        checkInTime: z.string().regex(TIME_PATTERN, "Elegí la hora de entrada."),
        checkOutTime: z.string().regex(TIME_PATTERN, "Elegí la hora de salida."),
        minStay: units("la estadía mínima"),
        maxStay: z.preprocess((value) => (value === "" || value === null ? undefined : value), units("la estadía máxima").optional()),
        weeklyPrice: money(currency, { required: false }),
        monthlyPrice: money(currency, { required: false }),
      })
      .superRefine((data, ctx) =>
        reportIssues(
          ctx,
          stayIssues({ ...data, maxStay: data.maxStay ?? null }, currency) as Issue<unknown>[],
        ),
      ),
  ]);
  // Forms that don't send the type are turno services (the original kind).
  return z.preprocess(
    (value) => (value && typeof value === "object" && !("bookingType" in value) ? { ...value, bookingType: "slot" } : value),
    byType,
  );
}

export type ServiceInput = z.infer<ReturnType<typeof serviceSchema>>;
