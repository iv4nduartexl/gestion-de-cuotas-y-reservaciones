import { z } from "zod";

import { BUSINESS_TYPES, TEAM_MODES } from "@/lib/business-types";
import { slugSchema } from "@/lib/slug";
import { checkbox } from "./common";
import { businessNameSchema, timezoneSchema } from "./onboarding";

export const businessProfileSchema = z.object({
  name: businessNameSchema,
  slug: slugSchema,
  timezone: timezoneSchema,
});

export const businessUsageSchema = z
  .object({
    businessType: z.enum(BUSINESS_TYPES),
    appointmentsEnabled: checkbox,
    membershipsEnabled: checkbox,
  })
  .refine((data) => data.appointmentsEnabled || data.membershipsEnabled, {
    path: ["products"],
    message: "Elegí al menos una opción.",
  });

export const teamModeSchema = z.object({ teamMode: z.enum(TEAM_MODES) });
