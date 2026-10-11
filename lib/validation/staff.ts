import { z } from "zod";

import { reportIssues, scheduleIssues, type Issue } from "@/lib/config-rules";
import { TIME_PATTERN, timeToMinutes } from "@/lib/datetime";
import { requiredText } from "./common";

export const staffSchema = z.object({
  name: requiredText(2, 100, "Ingresá el nombre."),
  // Optional link to a dashboard user (member id); validated against the
  // tenant in the action.
  memberId: z.preprocess(
    (value) => (typeof value === "string" && value !== "" ? value : null),
    z.string().max(100).nullable(),
  ),
});

export type StaffInput = z.infer<typeof staffSchema>;

const MAX_RANGES_PER_DAY = 6;

const rangeSchema = z
  .object({
    start: z.string().regex(TIME_PATTERN, "Hora inválida."),
    end: z.string().regex(TIME_PATTERN, "Hora inválida."),
  })
  .refine((range) => timeToMinutes(range.start) < timeToMinutes(range.end), {
    message: "La hora de fin debe ser posterior a la de inicio.",
  });

const daySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  ranges: z
    .array(rangeSchema)
    .max(MAX_RANGES_PER_DAY, `Máximo ${MAX_RANGES_PER_DAY} franjas por día.`),
});

/**
 * The weekly schedule editor submits JSON in a hidden "schedule" field:
 * [{ weekday: 1, ranges: [{ start: "08:00", end: "12:00" }] }, ...]
 * Output is a flat list of rules, validated for overlaps per weekday.
 */
export const weeklyScheduleSchema = z.object({
  schedule: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Horario inválido." });
        return z.NEVER;
      }
    })
    .pipe(z.array(daySchema).max(7))
    .superRefine((days, ctx) => {
      // Plain-language rules (at least one day, blocks of 30+ min, no overlaps).
      reportIssues(ctx, scheduleIssues({ days }) as Issue<unknown>[]);
      const seen = new Set<number>();
      for (const day of days) {
        if (seen.has(day.weekday)) {
          ctx.addIssue({ code: "custom", message: "Día repetido." });
          return;
        }
        seen.add(day.weekday);
        const sorted = [...day.ranges].sort(
          (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
        );
        for (let i = 1; i < sorted.length; i++) {
          if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
            ctx.addIssue({
              code: "custom",
              message: "Hay franjas horarias que se superponen.",
              path: [day.weekday],
            });
            return;
          }
        }
      }
    })
    .transform((days) =>
      days.flatMap((day) =>
        day.ranges.map((range) => ({
          weekday: day.weekday,
          startTime: range.start,
          endTime: range.end,
        })),
      ),
    ),
});

export type AvailabilityRuleInput = z.infer<
  typeof weeklyScheduleSchema
>["schedule"][number];
