// Phone numbers are stored in E.164 (+595981123456). Paraguay is the default
// country: local formats like "0981 123 456" or "021 123 456" are accepted.

const PY_COUNTRY_CODE = "595";

/** Returns the E.164 form, or null when the input isn't a plausible number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/[\s\-().]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith(PY_COUNTRY_CODE) && digits.length >= 11) {
    // Already includes the country code without "+".
  } else if (digits.startsWith("0")) {
    digits = PY_COUNTRY_CODE + digits.slice(1);
  } else if (/^9\d{8}$/.test(digits)) {
    // Mobile number typed without the leading 0.
    digits = PY_COUNTRY_CODE + digits;
  } else {
    return null;
  }

  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  if (digits.startsWith(PY_COUNTRY_CODE)) {
    const national = digits.slice(PY_COUNTRY_CODE.length);
    if (national.length < 7 || national.length > 9) return null;
  }
  return `+${digits}`;
}

/** "+595981123456" -> "0981 123 456"; other countries are left in E.164. */
export function formatPhone(e164: string): string {
  if (!e164.startsWith(`+${PY_COUNTRY_CODE}`)) return e164;
  const national = `0${e164.slice(PY_COUNTRY_CODE.length + 1)}`;
  if (national.length === 10) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** wa.me link for a stored E.164 number. */
export function whatsappUrl(e164: string, text?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
