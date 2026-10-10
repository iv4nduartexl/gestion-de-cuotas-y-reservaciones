// Paraguayan cédula de identidad (C.I.): digits shown with thousand dots,
// e.g. 4.567.890. Foreign documents (passports) may contain letters and are
// kept as typed, uppercased.

/** "4.567.890" -> "4567890"; "ab 123-45" -> "AB12345"; "" -> null */
export function normalizeCi(value: string): string | null {
  const compact = value.replace(/[\s.\-]/g, "").toUpperCase();
  return compact === "" ? null : compact;
}

/** "4567890" -> "4.567.890"; non-numeric documents are returned as-is. */
export function formatCi(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  return groupThousands(value);
}

export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
