-- Custom migration (drizzle-kit can't express exclusion constraints).
-- Rentals ("stay" bookings) have no staff: no two active stays of the same
-- service (the property) may overlap. Same guarantee as appointments_no_overlap
-- gives to staff turnos, even when two clients book the same dates at once.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_stays_no_overlap"
  EXCLUDE USING gist (
    "service_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("kind" = 'stay' AND "status" IN ('pending', 'confirmed'));
