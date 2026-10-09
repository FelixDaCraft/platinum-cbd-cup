ALTER TABLE "categories" ADD COLUMN "target_pro_jurors" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "target_public_jurors" integer;--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ADD COLUMN "samples_included" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_target_pro_jurors_check" CHECK ("categories"."target_pro_jurors" is null or "categories"."target_pro_jurors" > 0);--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_target_public_jurors_check" CHECK ("categories"."target_public_jurors" is null or "categories"."target_public_jurors" > 0);