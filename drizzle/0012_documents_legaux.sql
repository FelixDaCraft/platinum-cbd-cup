CREATE TABLE "legal_documents" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"lede" text,
	"content" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "legal_documents_slug_check" CHECK ("legal_documents"."slug" in ('reglement'))
);
--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;