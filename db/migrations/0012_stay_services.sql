ALTER TABLE "services" DROP CONSTRAINT "services_duration_range";--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "duration_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "staff_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "booking_type" text DEFAULT 'slot' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "stay_unit" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "check_in_time" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "check_out_time" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "min_stay" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "max_stay" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "weekly_price" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "monthly_price" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "kind" text DEFAULT 'slot' NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_org_service_starts_idx" ON "appointments" USING btree ("organization_id","service_id","starts_at");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_stay_fields" CHECK ("services"."booking_type" = 'slot'
        or ("services"."stay_unit" in ('night', 'day')
          and "services"."check_in_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and "services"."check_out_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and "services"."min_stay" between 1 and 366
          and ("services"."max_stay" is null or "services"."max_stay" between "services"."min_stay" and 366)
          and ("services"."weekly_price" is null or "services"."weekly_price" >= 0)
          and ("services"."monthly_price" is null or "services"."monthly_price" >= 0)));--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_booking_type" CHECK ("services"."booking_type" in ('slot', 'stay'));--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_duration_range" CHECK (("services"."booking_type" = 'slot' and "services"."duration_minutes" between 5 and 1440 and "services"."duration_minutes" % 5 = 0)
        or ("services"."booking_type" = 'stay' and "services"."duration_minutes" is null));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_kind" CHECK (("appointments"."kind" = 'slot' and "appointments"."staff_id" is not null) or ("appointments"."kind" = 'stay' and "appointments"."staff_id" is null));