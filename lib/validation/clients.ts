import { z } from "zod";

import { normalizeCi } from "@/lib/document";
import { normalizePhone } from "@/lib/phone";
import { optionalText, requiredText } from "./common";

export const clientSchema = z.object({
  name: requiredText(2, 100, "Ingresá el nombre del cliente."),
  phone: z
    .string({ error: "Ingresá un teléfono." })
    .trim()
    .min(1, "Ingresá un teléfono.")
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({
          code: "custom",
          message: "Teléfono inválido. Ejemplo: 0981 123 456.",
        });
        return z.NEVER;
      }
      return phone;
    }),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
    z.union([z.literal("").transform(() => null), z.email("Correo inválido.")]),
  ),
  // Stored compact ("4567890"); shown with dots by formatCi().
  documentNumber: z.preprocess(
    (value) => (typeof value === "string" ? normalizeCi(value) : null),
    z
      .string()
      .max(20, "Documento demasiado largo.")
      .regex(/^[0-9A-Z]+$/, "Usá solo números y letras.")
      .nullable(),
  ),
  notes: optionalText(1000),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const clientSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  archived: z.enum(["1"]).optional().catch(undefined),
});
