CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "charges_enrollment_period_unique" UNIQUE("enrollment_id","period_start"),
	CONSTRAINT "charges_status" CHECK (status in ('pending', 'paid', 'void')),
	CONSTRAINT "charges_amount_non_negative" CHECK ("charges"."amount" >= 0),
	CONSTRAINT "charges_period_order" CHECK ("charges"."period_start" < "charges"."period_end")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"bill_from" date NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"paused_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "enrollments_status" CHECK (status in ('active', 'paused', 'cancelled')),
	CONSTRAINT "enrollments_price_non_negative" CHECK ("enrollments"."price" >= 0),
	CONSTRAINT "enrollments_bill_from" CHECK ("enrollments"."bill_from" >= "enrollments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"charge_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_method" CHECK (method in ('efectivo', 'transferencia', 'tarjeta', 'billetera', 'otro'))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"interval_unit" text NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "plans_price_non_negative" CHECK ("plans"."price" >= 0),
	CONSTRAINT "plans_interval_unit" CHECK (interval_unit in ('week', 'month')),
	CONSTRAINT "plans_interval_count" CHECK ("plans"."interval_count" between 1 and 12),
	CONSTRAINT "plans_currency_format" CHECK ("plans"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "business_settings" DROP CONSTRAINT "business_settings_booking_rules";--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "grace_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "payment_reminder_template" text;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_enrollment_fk" FOREIGN KEY ("organization_id","enrollment_id") REFERENCES "public"."enrollments"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_plan_fk" FOREIGN KEY ("organization_id","plan_id") REFERENCES "public"."plans"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_fk" FOREIGN KEY ("organization_id","charge_id") REFERENCES "public"."charges"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charges_org_due_idx" ON "charges" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "charges_org_client_idx" ON "charges" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_running_unique" ON "enrollments" USING btree ("organization_id","client_id","plan_id") WHERE status in ('active', 'paused');--> statement-breakpoint
CREATE INDEX "enrollments_org_status_idx" ON "enrollments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "payments_charge_idx" ON "payments" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "payments_org_paid_idx" ON "payments" USING btree ("organization_id","paid_at");--> statement-breakpoint
CREATE INDEX "plans_org_name_idx" ON "plans" USING btree ("organization_id","name");--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_booking_rules" CHECK ("business_settings"."min_notice_minutes" between 0 and 10080
        and "business_settings"."max_days_ahead" between 1 and 365
        and "business_settings"."slot_interval_minutes" in (5, 10, 15, 20, 30, 45, 60)
        and "business_settings"."buffer_minutes" between 0 and 120
        and "business_settings"."client_cancel_notice_hours" between 0 and 168
        and "business_settings"."grace_days" between 0 and 60);