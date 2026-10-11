// One-line descriptions of a service for lists and headers.

import { formatDuration } from "@/lib/datetime";
import { STAY_UNIT_WORDS, type BookingType, type StayUnit } from "@/lib/service-constants";

export function serviceSummary(service: {
  bookingType: BookingType;
  durationMinutes: number | null;
  stayUnit: StayUnit | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}) {
  if (service.bookingType === "stay" && service.stayUnit) {
    return `Por ${STAY_UNIT_WORDS[service.stayUnit][0]} · entrada ${service.checkInTime} · salida ${service.checkOutTime}`;
  }
  return formatDuration(service.durationMinutes ?? 0);
}

/** "Gs. 300.000 por noche" / "Gs. 50.000". */
export function priceSuffix(service: { bookingType: BookingType; stayUnit: StayUnit | null }) {
  return service.bookingType === "stay" && service.stayUnit ? ` por ${STAY_UNIT_WORDS[service.stayUnit][0]}` : "";
}
