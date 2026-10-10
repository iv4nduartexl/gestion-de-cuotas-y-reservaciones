import { describe, expect, it } from "vitest";

import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";

describe("money (PYG, no minor unit)", () => {
  it("formats", () => {
    // Intl uses a non-breaking space after the symbol.
    expect(formatMoney(50000, "PYG")).toBe("Gs.\u00a050.000");
    expect(formatAmountInput(1250000, "PYG")).toBe("1.250.000");
  });

  it.each([
    ["50.000", 50000],
    ["50000", 50000],
    ["Gs. 50.000", 50000],
    ["0", 0],
    [" 1.250.000 ", 1250000],
  ])("parses %j", (input, expected) => {
    expect(parseMoneyInput(input, "PYG")).toBe(expected);
  });

  it.each(["", "abc", "-5", "50,5", "1,2,3"])("rejects %j", (input) => {
    expect(parseMoneyInput(input, "PYG")).toBeNull();
  });
});

describe("money (USD, 2 decimals)", () => {
  it("parses es-PY decimals into cents", () => {
    expect(parseMoneyInput("12,50", "USD")).toBe(1250);
    expect(parseMoneyInput("1.000", "USD")).toBe(100000);
    expect(parseMoneyInput("1,234", "USD")).toBeNull();
  });

  it("formats cents", () => {
    expect(formatMoney(1250, "USD")).toContain("12,50");
  });
});
