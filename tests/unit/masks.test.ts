import { describe, expect, it } from "vitest";

import { formatCi, normalizeCi } from "@/lib/document";
import { maskCi, maskGuaranies, maskPhone, reformatWithCaret } from "@/lib/masks";
import { normalizePhone } from "@/lib/phone";

describe("maskGuaranies", () => {
  it.each([
    ["1250000", "1.250.000"],
    ["1.250.000", "1.250.000"],
    ["50000", "50.000"],
    ["999", "999"],
    ["0050", "50"],
    ["", ""],
    ["Gs. 75 000", "75.000"],
  ])("%j -> %j", (input, expected) => {
    expect(maskGuaranies(input)).toBe(expected);
  });
});

describe("maskPhone", () => {
  it.each([
    ["0981123456", "0981 123 456"],
    ["0981 12", "0981 12"],
    ["981123456", "981 123 456"],
    ["021123456", "021 123 456"],
    ["+595981123456", "+595 981 123 456"],
    ["+59521123456", "+595 21 123 456"],
    ["+5491112345678", "+549 111 234 567 8"],
  ])("%j -> %j", (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it("masked values still normalize to E.164", () => {
    expect(normalizePhone(maskPhone("0981123456"))).toBe("+595981123456");
    expect(normalizePhone(maskPhone("+595981123456"))).toBe("+595981123456");
    expect(normalizePhone(maskPhone("021123456"))).toBe("+59521123456");
  });
});

describe("C.I.", () => {
  it("masks numeric IDs with dots and keeps passports", () => {
    expect(maskCi("4567890")).toBe("4.567.890");
    expect(maskCi("4.567.89")).toBe("456.789");
    expect(maskCi("ab123")).toBe("AB123");
  });

  it("normalizes for storage and formats for display", () => {
    expect(normalizeCi("4.567.890")).toBe("4567890");
    expect(normalizeCi(" ")).toBeNull();
    expect(normalizeCi("ab-12 345")).toBe("AB12345");
    expect(formatCi("4567890")).toBe("4.567.890");
    expect(formatCi("AB12345")).toBe("AB12345");
  });
});

describe("reformatWithCaret", () => {
  it("keeps the caret after the same digit when dots are inserted", () => {
    // User typed "1250000" with the caret at the end.
    expect(reformatWithCaret("1250000", 7, maskGuaranies)).toEqual({ value: "1.250.000", caret: 9 });
    // Caret after "12" in "12500".
    expect(reformatWithCaret("12500", 2, maskGuaranies)).toEqual({ value: "12.500", caret: 2 });
    // Deleting a digit in the middle: "1.25.000" with caret after "5" (index 4).
    expect(reformatWithCaret("1.25.000", 4, maskGuaranies)).toEqual({ value: "125.000", caret: 3 });
  });
});
