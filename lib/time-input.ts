// Helpers for the clock time picker (pure, unit-tested).

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** "HH:mm" from hour/minute numbers, clamped to a valid 24 h time. */
export function toTime(hour: number, minute: number) {
  const h = Math.min(23, Math.max(0, Math.trunc(hour) || 0));
  const m = Math.min(59, Math.max(0, Math.trunc(minute) || 0));
  return `${pad2(h)}:${pad2(m)}`;
}

/** Parses "1430", "14:30", "14.30", "9" or "9:5" into "HH:mm", or null. */
export function parseTime(text: string): string | null {
  const cleaned = text.trim();
  const match = /^(\d{1,2})(?:[:.h ]?(\d{1,2}))?$/.exec(cleaned) ?? /^(\d{2})(\d{2})$/.exec(cleaned);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return toTime(hour, minute);
}

/**
 * Dial hit-test. Angle in degrees from 12 o'clock, clockwise; `inner` = the
 * inner ring. Hours: outer ring 1–12, inner ring 13–23 and 00 (like Android).
 */
export function hourFromDial(angle: number, inner: boolean) {
  const position = Math.round((((angle % 360) + 360) % 360) / 30) % 12; // 0 = top
  if (inner) return position === 0 ? 0 : position + 12;
  return position === 0 ? 12 : position;
}

/** Minutes from the dial angle, snapped to `step` minutes. */
export function minuteFromDial(angle: number, step = 5) {
  const raw = ((((angle % 360) + 360) % 360) / 360) * 60;
  return (Math.round(raw / step) * step) % 60;
}

/** Position of an hour on the dial: angle (deg) and ring. */
export function dialPositionForHour(hour: number) {
  const inner = hour === 0 || hour > 12;
  return { angle: ((hour % 12) * 30) % 360, inner };
}

/**
 * Typing into an hour or minute box: digits go into a 2-digit buffer that
 * starts empty on focus (it never appends to the previous value). Returns the
 * new buffer and, once the number is complete, the value to commit.
 * Hours: "2" waits (20–23), "21" commits, "3"–"9" commit as 03–09.
 * Minutes: "1" waits, "15" commits, "6"–"9" commit as 06–09.
 */
export function nextBuffer(buffer: string, digit: string, part: "hour" | "minute"): { buffer: string; commit?: string } {
  const max = part === "hour" ? 23 : 59;
  const firstMax = part === "hour" ? 2 : 5;
  const typed = buffer + digit;
  if (typed.length === 1) {
    return Number(typed) > firstMax ? { buffer: "", commit: pad2(Number(typed)) } : { buffer: typed };
  }
  const value = Number(typed.slice(-2));
  if (value <= max) return { buffer: "", commit: pad2(value) };
  // e.g. "25" for an hour: start over with the new digit.
  return nextBuffer("", digit, part);
}
