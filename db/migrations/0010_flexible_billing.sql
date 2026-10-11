ALTER TABLE "business_settings" DROP CONSTRAINT "business_settings_booking_rules";--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT "plans_interval_unit";--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT "plans_interval_count";--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "grace_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "grace_unit" text DEFAULT 'day' NOT NULL;--> statement-breakpoint
-- Keep every business's current tolerance (it was always in days).
UPDATE "business_settings" SET "grace_count" = "grace_days", "grace_unit" = 'day';--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "billing_timing" text DEFAULT 'advance' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "first_due_date" date;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "billing_timing" text DEFAULT 'advance' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_grace" CHECK (("business_settings"."grace_unit" = 'day' and "business_settings"."grace_count" between 0 and 365)
        or ("business_settings"."grace_unit" = 'week' and "business_settings"."grace_count" between 0 and 52)
        or ("business_settings"."grace_unit" = 'month' and "business_settings"."grace_count" between 0 and 12));--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_booking_rules" CHECK ("business_settings"."min_notice_minutes" between 0 and 10080
        and "business_settings"."max_days_ahead" between 1 and 365
        and "business_settings"."slot_interval_minutes" in (5, 10, 15, 20, 30, 45, 60)
        and "business_settings"."buffer_minutes" between 0 and 120
        and "business_settings"."client_cancel_notice_hours" between 0 and 168

        and "business_settings"."remind_charges_days_before" between 0 and 30
        and "business_settings"."remind_charges_days_after" between 0 and 30);--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_billing_timing" CHECK (billing_timing in ('advance', 'arrears'));--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_first_due" CHECK ("enrollments"."first_due_date" is null or "enrollments"."first_due_date" >= "enrollments"."start_date");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_billing_timing" CHECK (billing_timing in ('advance', 'arrears'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_interval_unit" CHECK (interval_unit in ('day', 'week', 'month', 'year'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_interval_count" CHECK ("plans"."interval_count" between 1 and 365);