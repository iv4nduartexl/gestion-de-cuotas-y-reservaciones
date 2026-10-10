export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** Shown first in time-zone pickers, with friendly Spanish names. */
export const FEATURED_TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
];

export function timeZoneLabel(timeZone: string) {
  return (
    FEATURED_TIME_ZONES.find((zone) => zone.value === timeZone)?.label ??
    timeZone.replaceAll("_", " ")
  );
}
