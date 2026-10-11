import { describe, expect, it } from "vitest";

import { dialPositionForHour, hourFromDial, minuteFromDial, nextBuffer, parseTime, toTime } from "@/lib/time-input";

describe("time input", () => {
  it.each([
    ["14:30", "14:30"],
    ["1430", "14:30"],
    ["9", "09:00"],
    ["9:5", "09:05"],
    ["14.30", "14:30"],
    ["24:00", null],
    ["12:75", null],
    ["abc", null],
  ])("parses %s", (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it("clamps numbers", () => {
    expect(toTime(25, -3)).toBe("23:00");
  });

  it("maps the dial like a 24 h clock", () => {
    expect(hourFromDial(0, false)).toBe(12);
    expect(hourFromDial(0, true)).toBe(0);
    expect(hourFromDial(90, false)).toBe(3);
    expect(hourFromDial(90, true)).toBe(15);
    expect(hourFromDial(359, true)).toBe(0);
    expect(minuteFromDial(92)).toBe(15);
    expect(minuteFromDial(357)).toBe(0);
    expect(dialPositionForHour(15)).toEqual({ angle: 90, inner: true });
    expect(dialPositionForHour(0)).toEqual({ angle: 0, inner: true });
    expect(dialPositionForHour(12)).toEqual({ angle: 0, inner: false });
  });
});

describe("typing digits", () => {
  const type = (digits: string, part: "hour" | "minute") => {
    let buffer = "";
    let commit: string | undefined;
    for (const digit of digits) ({ buffer, commit = commit } = nextBuffer(buffer, digit, part) as { buffer: string; commit?: string });
    return { buffer, commit };
  };

  it.each([
    ["21", "hour", "21"],
    ["15", "hour", "15"],
    ["9", "hour", "09"],
    ["08", "hour", "08"],
    ["15", "minute", "15"],
    ["7", "minute", "07"],
    ["45", "minute", "45"],
  ] as const)("%s → %s %s", (digits, part, expected) => {
    expect(type(digits, part).commit).toBe(expected);
  });

  it("waits for a second digit when the first could start a bigger number", () => {
    expect(nextBuffer("", "2", "hour")).toEqual({ buffer: "2" });
    expect(nextBuffer("", "1", "minute")).toEqual({ buffer: "1" });
    // "25" can't be an hour: start over with the 5.
    expect(nextBuffer("2", "5", "hour")).toEqual({ buffer: "", commit: "05" });
  });
});
