import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["0981 123 456", "+595981123456"],
    ["0981-123-456", "+595981123456"],
    ["(0981) 123456", "+595981123456"],
    ["981123456", "+595981123456"],
    ["595981123456", "+595981123456"],
    ["+595 981 123 456", "+595981123456"],
    ["00595981123456", "+595981123456"],
    ["021 123 456", "+59521123456"],
    ["+54 9 11 1234 5678", "+5491112345678"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "123", "0981", "+0981123456", "09811234567890123"])(
    "rejects %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("formatPhone", () => {
  it("formats Paraguayan mobiles and landlines", () => {
    expect(formatPhone("+595981123456")).toBe("0981 123 456");
    expect(formatPhone("+59521123456")).toBe("021 123 456");
  });

  it("leaves foreign numbers in E.164", () => {
    expect(formatPhone("+5491112345678")).toBe("+5491112345678");
  });

  it("round-trips through normalizePhone", () => {
    expect(normalizePhone(formatPhone("+595981123456"))).toBe("+595981123456");
  });
});
