import { DEFAULT_LOCALE } from "@/lib/constants";

// Money is stored as an integer in the currency's minor unit
// (PYG has no minor unit, so 50000 means Gs. 50.000).

export function currencyFractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 0
  );
}

/** formatMoney(50000, "PYG") -> "Gs. 50.000" */
export function formatMoney(amount: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
  }).format(amount / 10 ** digits);
}

/**
 * Parses user input in es-PY format ("." thousands, "," decimals) into minor
 * units. parseMoneyInput("50.000", "PYG") -> 50000. Returns null if invalid.
 */
export function parseMoneyInput(input: string, currency: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned) || cleaned.includes("-")) return null;

  const digits = currencyFractionDigits(currency);
  const [integerPart, decimalPart = "", ...rest] = cleaned
    .replaceAll(".", "")
    .split(",");
  if (rest.length > 0) return null;
  if (decimalPart.length > digits) return null;

  const minor = Number(integerPart || "0") * 10 ** digits +
    Number(decimalPart.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Amount for an input field, without currency symbol: 50000 -> "50.000". */
export function formatAmountInput(amount: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
}

/** Short prefix for money inputs: "Gs." for guaraníes, else the ISO code. */
export function currencyPrefix(currency: string): string {
  return currency === "PYG" ? "Gs." : currency;
}
