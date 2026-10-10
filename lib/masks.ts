// Live input masks (Paraguayan formats) that keep the caret in place.

import { formatCi, groupThousands } from "@/lib/document";

/**
 * Reformats `value` and moves the caret so it stays after the same
 * "significant" character (digits/letters) it was after before formatting.
 */
export function reformatWithCaret(
  value: string,
  caret: number,
  format: (raw: string) => string,
  isSignificant: (char: string) => boolean = (char) => /[0-9A-Za-z+]/.test(char),
): { value: string; caret: number } {
  const significantBefore = [...value.slice(0, caret)].filter(isSignificant).length;
  const formatted = format(value);
  let seen = 0;
  let position = 0;
  while (position < formatted.length && seen < significantBefore) {
    if (isSignificant(formatted[position])) seen++;
    position++;
  }
  return { value: formatted, caret: position };
}

/** Guaraníes: "1250000" -> "1.250.000" (digits only, no decimals). */
export function maskGuaranies(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return groupThousands(digits);
}

/**
 * Paraguayan phone, as typed:
 * mobiles "0981 123 456", Asunción landlines "021 123 456", other area codes
 * "0xx 123 456"; international numbers ("+...") are grouped loosely.
 */
export function maskPhone(raw: string): string {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "").slice(0, 15);
    if (digits.startsWith("595")) {
      const national = digits.slice(3);
      const groups = national.startsWith("9")
        ? [national.slice(0, 3), national.slice(3, 6), national.slice(6, 9)]
        : [national.slice(0, 2), national.slice(2, 5), national.slice(5, 9)];
      return ["+595", ...groups].filter(Boolean).join(" ");
    }
    return `+${digits.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const isMobile = digits.startsWith("09") || digits.startsWith("9");
  const head = isMobile ? (digits.startsWith("0") ? 4 : 3) : 3;
  return [digits.slice(0, head), digits.slice(head, head + 3), digits.slice(head + 3)]
    .filter(Boolean)
    .join(" ");
}

/** C.I.: digits get thousand dots; documents with letters stay as typed. */
export function maskCi(raw: string): string {
  const compact = raw.replace(/[\s.]/g, "").toUpperCase().slice(0, 20);
  return /^\d*$/.test(compact) ? formatCi(compact) : compact;
}
