ALTER TABLE "business_settings" DROP CONSTRAINT "business_settings_booking_rules";--> statement-breakpoint
ALTER TABLE "business_settings" DROP COLUMN "grace_days";--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_booking_rules" CHECK ("business_settings"."min_notice_minutes" between 0 and 10080
        and "business_settings"."max_days_ahead" between 1 and 365
        and "business_settings"."slot_interval_minutes" in (5, 10, 15, 20, 30, 45, 60)
        and "business_settings"."buffer_minutes" between 0 and 120
        and "business_settings"."client_cancel_notice_hours" between 0 and 168
        and "business_settings"."remind_charges_days_before" between 0 and 30
        and "business_settings"."remind_charges_days_after" between 0 and 30);