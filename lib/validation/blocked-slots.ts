import { z } from "zod";

import {
  addDaysToDate,
  DATE_PATTERN,
  TIME_PATTERN,
  timeToMinutes,
  zonedToUtc,
} from "@/lib/datetime";
import { checkbox, idSchema, optionalText } from "./common";

export const blockedSlotSchema = z
  .object({
    // "" = whole business
    staffId: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      idSchema.nullable(),
    ),
    startDate: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    endDate: z.string().regex(DATE_PATTERN, "Elegí una fecha."),
    allDay: checkbox,
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: optionalText(200),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
    if (data.allDay) return;
    if (!data.startTime || !TIME_PATTERN.test(data.startTime)) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Hora inválida." });
    }
    if (!data.endTime || !TIME_PATTERN.test(data.endTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Hora inválida." });
    }
    if (
      data.startTime &&
      data.endTime &&
      data.startDate === data.endDate &&
      timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora de fin debe ser posterior a la de inicio.",
      });
    }
  });

export type BlockedSlotInput = z.infer<typeof blockedSlotSchema>;

/** Converts the business-local form values into a UTC [startsAt, endsAt) range. */
export function toInstantRange(input: BlockedSlotInput, timeZone: string) {
  if (input.allDay) {
    return {
      startsAt: zonedToUtc(input.startDate, "00:00", timeZone),
      endsAt: zonedToUtc(addDaysToDate(input.endDate, 1), "00:00", timeZone),
    };
  }
  return {
    startsAt: zonedToUtc(input.startDate, input.startTime!, timeZone),
    endsAt: zonedToUtc(input.endDate, input.endTime!, timeZone),
  };
}
