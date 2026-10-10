-- The composite FK from reminders needs this unique key first (moved up by hand).
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"appointment_id" uuid,
	"charge_id" uuid,
	"client_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_kind_appointment_unique" UNIQUE("kind","appointment_id"),
	CONSTRAINT "reminders_kind_charge_unique" UNIQUE("kind","charge_id"),
	CONSTRAINT "reminders_kind" CHECK (kind in ('appointment_24h', 'appointment_2h', 'charge_upcoming', 'charge_due', 'charge_overdue')),
	CONSTRAINT "reminders_channel" CHECK (channel in ('email', 'whatsapp_manual', 'whatsapp_api', 'sms')),
	CONSTRAINT "reminders_status" CHECK (status in ('pending', 'sent', 'done_manually', 'skipped', 'failed')),
	CONSTRAINT "reminders_one_target" CHECK (("reminders"."appointment_id" is null) <> ("reminders"."charge_id" is null))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "payment_events_external_unique" UNIQUE("provider","external_event_id")
);
--> statement-breakpoint
CREATE TABLE "payment_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_accounts_org_provider_unique" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "provider_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_subscriptions_external_unique" UNIQUE("provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "business_settings" DROP CONSTRAINT "business_settings_booking_rules";--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "remind_appointments24h" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "remind_appointments2h" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "remind_charges_days_before" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "remind_charges_on_due" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "remind_charges_days_after" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "appointment_reminder_template" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_charge_fk" FOREIGN KEY ("organization_id","charge_id") REFERENCES "public"."charges"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_accounts" ADD CONSTRAINT "payment_provider_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_enrollment_fk" FOREIGN KEY ("organization_id","enrollment_id") REFERENCES "public"."enrollments"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("status","channel","scheduled_for");--> statement-breakpoint
CREATE INDEX "reminders_org_scheduled_idx" ON "reminders" USING btree ("organization_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "payment_events_received_idx" ON "payment_events" USING btree ("received_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_external_unique" UNIQUE("provider","external_id");--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_booking_rules" CHECK ("business_settings"."min_notice_minutes" between 0 and 10080
        and "business_settings"."max_days_ahead" between 1 and 365
        and "business_settings"."slot_interval_minutes" in (5, 10, 15, 20, 30, 45, 60)
        and "business_settings"."buffer_minutes" between 0 and 120
        and "business_settings"."client_cancel_notice_hours" between 0 and 168
        and "business_settings"."grace_days" between 0 and 60
        and "business_settings"."remind_charges_days_before" between 0 and 30
        and "business_settings"."remind_charges_days_after" between 0 and 30);