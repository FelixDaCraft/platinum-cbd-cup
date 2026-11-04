ALTER TABLE "registrations" ADD COLUMN "shipment_group_id" text;--> statement-breakpoint
CREATE INDEX "registrations_shipment_group_idx" ON "registrations" USING btree ("shipment_group_id");