-- Custom migration (drizzle-kit can't express exclusion constraints).

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- No two availability ranges of the same staff member may overlap on the same
-- weekday. Times are anchored to an arbitrary date to build a range.
ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    "weekday" WITH =,
    tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
  );
--> statement-breakpoint

-- Backfill: every owner of an organization with appointments enabled becomes
-- a staff member (new organizations get this from onboarding).
INSERT INTO "staff" ("organization_id", "name", "member_id")
SELECT m."organization_id", u."name", m."id"
FROM "member" m
JOIN "user" u ON u."id" = m."user_id"
JOIN "business_settings" b ON b."organization_id" = m."organization_id"
WHERE m."role" = 'owner'
  AND b."appointments_enabled"
  AND NOT EXISTS (SELECT 1 FROM "staff" s WHERE s."member_id" = m."id");
