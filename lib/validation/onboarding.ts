import { z } from "zod";

import { BUSINESS_TYPES, TEAM_MODES } from "@/lib/business-types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { slugSchema } from "@/lib/slug";
import { isValidTimeZone } from "@/lib/timezones";
import { checkbox } from "./common";

export const businessNameSchema = z
  .string()
  .trim()
  .min(2, "Ingresá el nombre del negocio.")
  .max(80, "Usá como máximo 80 caracteres.");

export const timezoneSchema = z
  .string()
  .default(DEFAULT_TIMEZONE)
  .refine(isValidTimeZone, "Zona horaria inválida.");

export const createBusinessSchema = z
  .object({
    businessType: z.enum(BUSINESS_TYPES, { error: "Elegí el tipo de negocio." }),
    name: businessNameSchema,
    // Empty = generate from the name. `customSlug` = the user typed it, so a
    // conflict is reported instead of resolved automatically.
    slug: z.union([z.literal(""), slugSchema]).default(""),
    customSlug: checkbox,
    timezone: timezoneSchema,
    appointmentsEnabled: checkbox,
    membershipsEnabled: checkbox,
    teamMode: z.enum(TEAM_MODES).default("solo"),
  })
  .refine((data) => data.appointmentsEnabled || data.membershipsEnabled, {
    path: ["products"],
    message: "Elegí al menos una opción.",
  });

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
