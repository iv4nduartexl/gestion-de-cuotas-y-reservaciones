ALTER TABLE "business_settings" ADD COLUMN "business_type" text DEFAULT 'otro' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "team_mode" text DEFAULT 'solo' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_type" CHECK (business_type in ('barberia', 'salon', 'clinica', 'estetica', 'gimnasio', 'academia', 'otro'));--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_team_mode" CHECK (team_mode in ('solo', 'team'));--> statement-breakpoint
-- Businesses created before guided onboarding already manage staff: keep it visible.
UPDATE "business_settings" SET "team_mode" = 'team' WHERE "created_at" < now();
