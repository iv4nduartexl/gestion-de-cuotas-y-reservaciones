-- Custom migration (drizzle-kit can't express exclusion constraints).
-- No two active turnos (pending/confirmed) of the same staff member may
-- overlap. This is what makes double booking impossible, even when two
-- clients submit the same slot at the same moment.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed'));
