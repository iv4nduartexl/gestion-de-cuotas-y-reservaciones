import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { DATE_PATTERN, TIME_PATTERN } from "@/lib/datetime";
import { idSchema, optionalText, requiredText } from "./common";

const phoneSchema = z
  .string({ error: "Ingresá tu teléfono." })
  .trim()
  .min(1, "Ingresá tu teléfono.")
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Teléfono inválido. Ejemplo: 0981 123 456." });
      return z.NEVER;
    }
    return phone;
  });

const staffChoice = z.union([z.literal("any"), idSchema]);

/** Public booking form (no account). */
export const publicBookingSchema = z.object({
  serviceId: idSchema,
  staffChoice,
  start: z.iso.datetime({ offset: true, error: "Elegí un horario." }),
  name: requiredText(2, 100, "Ingresá tu nombre."),
  phone: phoneSchema,
  notes: optionalText(300),
  // Honeypot: real people never fill it (it is hidden from them).
  website: z.string().max(0).optional().or(z.literal("")),
});

export const availabilityQuerySchema = z.object({
  serviceId: idSchema,
  staffChoice,
  fromDate: z.string().regex(DATE_PATTERN),
});

/** Dashboard "Nuevo turno". */
export const dashboardBookingSchema = z
  .object({
    clientId: z.union([z.literal(""), idSchema]).default(""),
    newClientName: optionalText(100),
    newClientPhone: z.string().trim().default(""),
    serviceId: idSchema,
    staffChoice,
    date: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    start: z.string().default(""),
    manualTime: z.preprocess((v) => v === "true" || v === "on", z.boolean()),
    time: z.string().default(""),
    notes: optionalText(300),
  })
  .superRefine((data, ctx) => {
    if (!data.clientId) {
      if (!data.newClientName || data.newClientName.length < 2) {
        ctx.addIssue({ code: "custom", path: ["client"], message: "Elegí un cliente o cargá uno nuevo." });
      } else if (!normalizePhone(data.newClientPhone)) {
        ctx.addIssue({ code: "custom", path: ["newClientPhone"], message: "Teléfono inválido. Ejemplo: 0981 123 456." });
      }
    }
    if (data.manualTime) {
      if (!TIME_PATTERN.test(data.time)) ctx.addIssue({ code: "custom", path: ["time"], message: "Elegí una hora." });
      if (data.staffChoice === "any") ctx.addIssue({ code: "custom", path: ["staffChoice"], message: "Elegí una persona." });
    } else if (!data.start) {
      ctx.addIssue({ code: "custom", path: ["start"], message: "Elegí un horario." });
    }
  });

export const bookingRulesSchema = z.object({
  autoConfirmBookings: z.preprocess((v) => v === "true" || v === "on", z.boolean()),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  slotIntervalMinutes: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 45, 60].includes(v)),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  clientCancelNoticeHours: z.coerce.number().int().min(0).max(168),
});

export const publicProfileSchema = z.object({
  publicPhone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.union([
      z.literal("").transform(() => null),
      z.string().transform((value, ctx) => {
        const phone = normalizePhone(value);
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "Teléfono inválido. Ejemplo: 0981 123 456." });
          return z.NEVER;
        }
        return phone;
      }),
    ]),
  ),
  address: optionalText(200),
  description: optionalText(300),
});
