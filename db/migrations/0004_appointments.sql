CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"internal_notes" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancellation_reason" text,
	"manage_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_manageTokenHash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "appointments_time_order" CHECK ("appointments"."starts_at" < "appointments"."ends_at"),
	CONSTRAINT "appointments_status" CHECK (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
	CONSTRAINT "appointments_source" CHECK (source in ('online', 'dashboard')),
	CONSTRAINT "appointments_cancelled_by" CHECK (cancelled_by is null or cancelled_by in ('client', 'business')),
	CONSTRAINT "appointments_price_non_negative" CHECK ("appointments"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"ip_hash" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "auto_confirm_bookings" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "min_notice_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "max_days_ahead" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "slot_interval_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "client_cancel_notice_hours" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "public_phone" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_fk" FOREIGN KEY ("organization_id","service_id") REFERENCES "public"."services"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_fk" FOREIGN KEY ("organization_id","staff_id") REFERENCES "public"."staff"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attempts" ADD CONSTRAINT "booking_attempts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_org_starts_idx" ON "appointments" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_org_staff_starts_idx" ON "appointments" USING btree ("organization_id","staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_org_client_starts_idx" ON "appointments" USING btree ("organization_id","client_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_attempts_ip_idx" ON "booking_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "booking_attempts_phone_idx" ON "booking_attempts" USING btree ("organization_id","phone","created_at");--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_booking_rules" CHECK ("business_settings"."min_notice_minutes" between 0 and 10080
        and "business_settings"."max_days_ahead" between 1 and 365
        and "business_settings"."slot_interval_minutes" in (5, 10, 15, 20, 30, 45, 60)
        and "business_settings"."buffer_minutes" between 0 and 120
        and "business_settings"."client_cancel_notice_hours" between 0 and 168);