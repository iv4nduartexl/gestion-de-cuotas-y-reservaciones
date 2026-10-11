ALTER TABLE "charges" ALTER COLUMN "enrollment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "period_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "period_end" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "kind" text DEFAULT 'cuota' NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "concept" text;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "parent_charge_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "member_since" date;--> statement-breakpoint
UPDATE "enrollments" SET "member_since" = "start_date";--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_parent_fk" FOREIGN KEY ("organization_id","parent_charge_id") REFERENCES "public"."charges"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_kind" CHECK (kind in ('cuota', 'one_off', 'part'));--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_kind_fields" CHECK (("charges"."kind" = 'cuota' and "charges"."enrollment_id" is not null and "charges"."period_start" is not null and "charges"."period_end" is not null)
        or ("charges"."kind" = 'one_off' and "charges"."concept" is not null and "charges"."period_start" is null)
        or ("charges"."kind" = 'part' and "charges"."concept" is not null and "charges"."parent_charge_id" is not null and "charges"."period_start" is null));