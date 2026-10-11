// Service kinds (no dependencies: shared by the schema, server and client).

/** "slot": turnos by the hour (cortes, consultas). "stay": by days/nights (alquileres). */
export const BOOKING_TYPES = ["slot", "stay"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

/** How a stay is counted and priced. */
export const STAY_UNITS = ["night", "day"] as const;
export type StayUnit = (typeof STAY_UNITS)[number];

export const STAY_UNIT_WORDS: Record<StayUnit, [string, string]> = {
  night: ["noche", "noches"],
  day: ["día", "días"],
};

export function stayAmount(unit: StayUnit, count: number) {
  const [one, many] = STAY_UNIT_WORDS[unit];
  return `${count} ${count === 1 ? one : many}`;
}

/** Longest turno by the hour: a full day. Longer → use a "por días" service. */
export const MAX_SLOT_MINUTES = 24 * 60;
/** Longest stay that can be booked in one go. */
export const MAX_STAY_UNITS = 366;
