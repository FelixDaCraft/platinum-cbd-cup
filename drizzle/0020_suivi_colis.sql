ALTER TABLE "registrations" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "tracking_number" text;