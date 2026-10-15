ALTER TABLE "registrations" ADD COLUMN "payment_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "last_payment_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "last_payment_failure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "last_payment_failure_code" text;