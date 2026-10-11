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

/** Public booking of a rental ("Por días" service). */
export const publicStayBookingSchema = z
  .object({
    serviceId: idSchema,
    checkIn: z.string().regex(DATE_PATTERN, "Elegí la fecha de entrada."),
    checkOut: z.string().regex(DATE_PATTERN, "Elegí la fecha de salida."),
    name: requiredText(2, 100, "Ingresá tu nombre."),
    phone: phoneSchema,
    notes: optionalText(300),
    website: z.string().max(0).optional().or(z.literal("")),
  })
  .refine((data) => data.checkOut >= data.checkIn, { path: ["checkOut"], message: "La salida tiene que ser después de la entrada." });

export const stayCalendarQuerySchema = z.object({
  serviceId: idSchema,
  fromDate: z.string().regex(DATE_PATTERN),
});

export const availabilityQuerySchema = z.object({
  serviceId: idSchema,
  staffChoice,
  fromDate: z.string().regex(DATE_PATTERN),
});

/** Dashboard forms: an existing client, or a new one with name and phone. */
function requireClient(data: { clientId: string; newClientName: string | null; newClientPhone: string }, ctx: z.RefinementCtx) {
  if (data.clientId) return;
  if (!data.newClientName || data.newClientName.length < 2) {
    ctx.addIssue({ code: "custom", path: ["client"], message: "Elegí un cliente o cargá uno nuevo." });
  } else if (!normalizePhone(data.newClientPhone)) {
    ctx.addIssue({ code: "custom", path: ["newClientPhone"], message: "Teléfono inválido. Ejemplo: 0981 123 456." });
  }
}

const clientFields = {
  clientId: z.union([z.literal(""), idSchema]).default(""),
  newClientName: optionalText(100),
  newClientPhone: z.string().trim().default(""),
};

/** Dashboard "Nuevo turno". */
export const dashboardBookingSchema = z
  .object({
    ...clientFields,
    serviceId: idSchema,
    staffChoice,
    date: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    start: z.string().default(""),
    manualTime: z.preprocess((v) => v === "true" || v === "on", z.boolean()),
    time: z.string().default(""),
    notes: optionalText(300),
  })
  .superRefine((data, ctx) => {
    requireClient(data, ctx);
    if (data.manualTime) {
      if (!TIME_PATTERN.test(data.time)) ctx.addIssue({ code: "custom", path: ["time"], message: "Elegí una hora." });
      if (data.staffChoice === "any") ctx.addIssue({ code: "custom", path: ["staffChoice"], message: "Elegí una persona." });
    } else if (!data.start) {
      ctx.addIssue({ code: "custom", path: ["start"], message: "Elegí un horario." });
    }
  });

/** Dashboard rental booking. The price is parsed with the rental's currency. */
export const dashboardStayBookingSchema = z
  .object({
    ...clientFields,
    serviceId: idSchema,
    checkIn: z.string().regex(DATE_PATTERN, "Elegí la fecha de entrada."),
    checkOut: z.string().regex(DATE_PATTERN, "Elegí la fecha de salida."),
    price: z.string().trim().default(""),
    notes: optionalText(300),
  })
  .superRefine((data, ctx) => {
    requireClient(data, ctx);
    if (data.checkOut < data.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "La salida tiene que ser después de la entrada." });
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
