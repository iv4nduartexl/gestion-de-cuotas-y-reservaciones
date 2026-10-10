import { z } from "zod";

import { parseMoneyInput } from "@/lib/money";
import { idSchema, optionalText, requiredText } from "./common";

export const SERVICE_DURATIONS = [
  5, 10, 15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360,
  480, 600, 720,
];

/** `currency` comes from the tenant's business settings, never the form. */
export function serviceSchema(currency: string) {
  return z.object({
    name: requiredText(2, 100, "Ingresá el nombre del servicio."),
    description: optionalText(500),
    durationMinutes: z.coerce
      .number({ error: "Elegí una duración." })
      .int()
      .min(5, "La duración mínima es 5 minutos.")
      .max(720, "La duración máxima es 12 horas.")
      .refine((value) => value % 5 === 0, "Usá múltiplos de 5 minutos."),
    price: z
      .string({ error: "Ingresá un precio." })
      .trim()
      .min(1, "Ingresá un precio.")
      .transform((value, ctx) => {
        const amount = parseMoneyInput(value, currency);
        if (amount === null) {
          ctx.addIssue({ code: "custom", message: "Precio inválido." });
          return z.NEVER;
        }
        return amount;
      }),
    staffIds: z.array(idSchema).max(200).default([]),
  });
}

export type ServiceInput = z.infer<ReturnType<typeof serviceSchema>>;
