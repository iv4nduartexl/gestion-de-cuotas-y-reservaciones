import { describe, expect, it } from "vitest";

import { applyFix } from "@/lib/config-rules";
import { buildSchedule, DEFAULT_SCHEDULE, describeSchedule, fromRules, scheduleStepIssues, type ScheduleWizardValues } from "@/lib/schedule-wizard";

describe("schedule wizard", () => {
  it("builds weekdays with a lunch break and a special Saturday", () => {
    const days = buildSchedule({ ...DEFAULT_SCHEDULE, days: [1, 2, 3, 4, 5, 6], special: { 6: { open: "08:00", close: "12:00" } } });
    expect(days[0].ranges).toEqual([
      { start: "08:00", end: "12:00" },
      { start: "14:00", end: "18:00" },
    ]);
    expect(days[5].ranges).toEqual([{ start: "08:00", end: "12:00" }]);
    expect(days[6].ranges).toEqual([]);
    expect(describeSchedule(days)).toBe("Lunes a viernes de 08:00 a 12:00 y de 14:00 a 18:00 · Sábado de 08:00 a 12:00");
  });

  it("reads saved rules back into answers", () => {
    const rules = buildSchedule({ ...DEFAULT_SCHEDULE, days: [1, 2, 6], special: { 6: { open: "09:00", close: "13:00" } } }).flatMap((day) =>
      day.ranges.map((range) => ({ weekday: day.weekday, startTime: range.start, endTime: range.end })),
    );
    const { values, representable } = fromRules(rules);
    expect(representable).toBe(true);
    expect(values).toMatchObject({ days: [1, 2, 6], open: "08:00", close: "18:00", hasBreak: true, special: { 6: { open: "09:00", close: "13:00" } } });
    const intricate = fromRules([
      { weekday: 1, startTime: "08:00", endTime: "10:00" },
      { weekday: 1, startTime: "11:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "18:00" },
    ]);
    expect(intricate.representable).toBe(false);
  });

  it("blocks nonsense with fixes that work", () => {
    const cases: [Parameters<typeof scheduleStepIssues>[0], ScheduleWizardValues][] = [
      ["dias", { ...DEFAULT_SCHEDULE, days: [] }],
      ["horario", { ...DEFAULT_SCHEDULE, open: "18:00", close: "08:00" }],
      ["corte", { ...DEFAULT_SCHEDULE, breakStart: "19:00", breakEnd: "20:00" }],
      ["distinto", { ...DEFAULT_SCHEDULE, special: { 6: { open: "12:00", close: "08:00" } } }],
    ];
    for (const [step, values] of cases) {
      const [problem] = scheduleStepIssues(step, values);
      expect(problem).toBeDefined();
      for (const fix of problem.fixes) expect(scheduleStepIssues(step, applyFix(values, fix))).toEqual([]);
    }
    expect(scheduleStepIssues("corte", DEFAULT_SCHEDULE)).toEqual([]);
  });
});
