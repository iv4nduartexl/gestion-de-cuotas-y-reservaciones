// Paraguayan national holidays (Ley 6531/2020 and amendments). Some are moved
// by decree in a given year; the UI reminds users to check them.

export type Holiday = { date: string; name: string };

/** Easter Sunday (Gregorian, anonymous algorithm) as "yyyy-MM-dd". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d + days));
  return value.toISOString().slice(0, 10);
}

export function paraguayHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (monthDay: string, name: string) => ({ date: `${year}-${monthDay}`, name });
  return [
    fixed("01-01", "Año Nuevo"),
    fixed("03-01", "Día de los Héroes"),
    { date: shift(easter, -3), name: "Jueves Santo" },
    { date: shift(easter, -2), name: "Viernes Santo" },
    fixed("05-01", "Día del Trabajador"),
    fixed("05-14", "Independencia Nacional"),
    fixed("05-15", "Independencia Nacional"),
    fixed("06-12", "Paz del Chaco"),
    fixed("08-15", "Fundación de Asunción"),
    fixed("09-29", "Victoria de Boquerón"),
    fixed("12-08", "Virgen de Caacupé"),
    fixed("12-25", "Navidad"),
  ];
}
