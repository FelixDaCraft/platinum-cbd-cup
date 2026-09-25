CREATE TYPE "public"."activity_action" AS ENUM('user_login', 'user_logout', 'user_signup', 'password_reset', 'email_change', 'admin_create_organizer', 'admin_suspend_organization', 'admin_reactivate_organization', 'admin_toggle_admin', 'admin_update_plan_config', 'organization_created', 'organization_updated', 'subscription_created', 'subscription_updated', 'subscription_cancelled', 'cup_created', 'cup_updated', 'cup_published', 'cup_completed', 'cup_deleted', 'registration_created', 'registration_confirmed', 'registration_cancelled', 'product_created', 'product_updated', 'product_received', 'rating_submitted', 'results_published', 'results_sent', 'jury_invited', 'jury_joined', 'jury_removed', 'other');--> statement-breakpoint
CREATE TYPE "public"."contact_message_status" AS ENUM('unread', 'read', 'replied', 'archived');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'producer' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"deletion_requested_at" timestamp,
	"deletion_scheduled_for" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"default_price_per_product" integer,
	"currency" text DEFAULT 'EUR',
	"rating_scale" text DEFAULT '0-20' NOT NULL,
	"registration_open_at" timestamp,
	"registration_close_at" timestamp,
	"rating_start_at" timestamp,
	"rating_end_at" timestamp,
	"ratings_locked_at" timestamp,
	"ratings_locked_by" text,
	"payment_provider" text,
	"payment_config_encrypted" text,
	"payment_configured_at" timestamp,
	"anonymization_prefix" text DEFAULT 'A',
	"pdf_logo_url" text,
	"pdf_intro_text" text,
	"banner_url" text,
	"public_page_description" text,
	"gallery_urls" text,
	"event_date" timestamp,
	"event_location" text,
	"contact_email" text,
	"website_url" text,
	"results_published_at" timestamp,
	"results_visibility" text DEFAULT 'labels',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"price_override" integer,
	"rating_scale_min" integer DEFAULT 1 NOT NULL,
	"rating_scale_max" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cup_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"name" text NOT NULL,
	"min_score" real NOT NULL,
	"max_score" real,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text,
	"icon" text,
	"condition" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"coefficient" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"brand_name" text NOT NULL,
	"logo" text,
	"siret" text,
	"website" text,
	"phone" text,
	"address" text,
	"notify_on_product_status_change" boolean DEFAULT true NOT NULL,
	"notify_on_cup_updates" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "producer_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"producer_id" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR',
	"payment_order_code" text,
	"payment_transaction_id" text,
	"stripe_payment_intent_id" text,
	"invoice_number" text,
	"invoice_generated_at" timestamp,
	"invoice_url" text,
	"synthesis_email_sent_at" timestamp,
	"synthesis_email_error" text,
	"synthesis_email_attempts" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "registration_producer_cup_unique" UNIQUE("cup_id","producer_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_at_registration" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"anonymous_code" text,
	"received_at" timestamp,
	"final_score" numeric(5, 2),
	"label_id" text,
	"category_rank" integer,
	"excluded_from_results" boolean DEFAULT false NOT NULL,
	"disqualified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_anonymous_code_category_unique" UNIQUE("category_id","anonymous_code")
);
--> statement-breakpoint
CREATE TABLE "cup_juries" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"user_id" text NOT NULL,
	"jury_profile_id" text,
	"invitation_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notify_on_assignment" boolean DEFAULT true NOT NULL,
	"notify_on_reminder" boolean DEFAULT true NOT NULL,
	"last_reminder_at" timestamp,
	"reminder_count" text DEFAULT '0',
	"rating_sheet_sent_at" timestamp,
	"samples_received_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cup_jury_cup_user_unique" UNIQUE("cup_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "jury_category_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_jury_id" text NOT NULL,
	"category_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jury_category_assignment_unique" UNIQUE("cup_jury_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "jury_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"custom_message" text,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"sent_at" timestamp,
	"last_reminder_at" timestamp,
	"reminder_count" text DEFAULT '0',
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jury_invitations_token_unique" UNIQUE("token"),
	CONSTRAINT "jury_invitation_cup_email_unique" UNIQUE("cup_id","email")
);
--> statement-breakpoint
CREATE TABLE "jury_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"jury_type" text DEFAULT 'pro' NOT NULL,
	"expertise" text,
	"bio" text,
	"display_name" text,
	"show_on_public_results" boolean DEFAULT false NOT NULL,
	"notify_on_invitation" boolean DEFAULT true NOT NULL,
	"notify_on_assignment" boolean DEFAULT true NOT NULL,
	"notify_on_reminder" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jury_profile_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "public_jury_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"category_id" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"claimed_by_user_id" text,
	"cup_jury_id" text,
	"claimed_at" timestamp,
	"batch_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_jury_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "criterion_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"product_rating_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "criterion_score_rating_criterion_unique" UNIQUE("product_rating_id","criterion_id")
);
--> statement-breakpoint
CREATE TABLE "product_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"jury_id" text NOT NULL,
	"comment" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_rating_product_jury_unique" UNIQUE("product_id","jury_id")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" "activity_action" NOT NULL,
	"description" text NOT NULL,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_about" (
	"id" text PRIMARY KEY NOT NULL,
	"history" text,
	"mission" text,
	"values" text,
	"gallery_images" json DEFAULT '[]'::json,
	"team_members" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_about_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"hero_style" text DEFAULT 'banner',
	"hero_tagline" text,
	"mission_style" text DEFAULT 'quote',
	"values_display" text DEFAULT 'cards',
	"team_card_size" text DEFAULT 'large',
	"show_team_social_links" boolean DEFAULT true,
	"gallery_columns" text DEFAULT '3',
	"enable_gallery_lightbox" boolean DEFAULT true,
	"section_style" text DEFAULT 'alternating',
	"enable_animations" boolean DEFAULT true,
	"show_stats" boolean DEFAULT false,
	"stats_year_founded" text,
	"stats_cups_organized" text,
	"stats_judges_count" text,
	"stats_custom_label_1" text,
	"stats_custom_value_1" text,
	"stats_custom_label_2" text,
	"stats_custom_value_2" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cup_sponsors" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"sponsor_id" text NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"display_order" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"description" text,
	"website" text,
	"social_links" json DEFAULT '{}'::json,
	"gallery" json DEFAULT '[]'::json,
	"testimonials" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"sponsor_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" json NOT NULL,
	"cover_image" text,
	"category" text,
	"category_color" text,
	"tags" json DEFAULT '[]'::json,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmation_token" text,
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"unsubscribe_token" text,
	"source" text DEFAULT 'portal',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rs_generated_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_sponsor_id" text NOT NULL,
	"template_id" text,
	"format" text DEFAULT 'instagram' NOT NULL,
	"image_url" text,
	"caption" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rs_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"style" text DEFAULT 'classic' NOT NULL,
	"text_template" text DEFAULT 'Bienvenue à {sponsor.name} comme sponsor {sponsor.level} de {cup.name} !' NOT NULL,
	"caption_template" text DEFAULT 'Nous sommes ravis d''accueillir {sponsor.name} comme partenaire {sponsor.level} de {cup.name} ! Merci pour votre soutien. #sponsor #{cup.hashtag}',
	"colors" json DEFAULT '{"background":"#1a1a2e","text":"#ffffff","accent":"#f59e0b"}'::json,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "contact_message_status" DEFAULT 'unread' NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"replied_at" timestamp,
	"replied_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jury_invitation_code_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "jury_code_category_unique" UNIQUE("code_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "jury_invitation_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"cup_id" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"destination" text,
	"activated_by_user_id" text,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jury_invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gallery_images" (
	"id" text PRIMARY KEY NOT NULL,
	"uploaded_by" text NOT NULL,
	"title" text NOT NULL,
	"alt" text,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"width" integer,
	"height" integer,
	"file_size" integer,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "press_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"cover_image_url" text,
	"pdf_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "press_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"media_kit_url" text,
	"media_kit_file_name" text,
	"press_email" text,
	"press_phone" text,
	"show_press_releases" text DEFAULT 'true' NOT NULL,
	"show_gallery" text DEFAULT 'true' NOT NULL,
	"show_media_kit" text DEFAULT 'true' NOT NULL,
	"show_contact" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cupmetrics_historical_cups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"edition" text,
	"event_date" timestamp,
	"description" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"imported_by" text,
	"products_count" integer DEFAULT 0,
	"producers_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cupmetrics_historical_producers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"linked_producer_id" text,
	"linked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cupmetrics_historical_results" (
	"id" text PRIMARY KEY NOT NULL,
	"historical_cup_id" text NOT NULL,
	"historical_producer_id" text NOT NULL,
	"product_name" text NOT NULL,
	"category" text,
	"medal" text DEFAULT 'none',
	"rank" integer,
	"score" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"pdf_url" text NOT NULL,
	"pdf_filename" text NOT NULL,
	"lab_name" text NOT NULL,
	"analysis_number" text,
	"sfp_code" text,
	"serial" text,
	"product_description" text,
	"sample_type" text,
	"method_name" text,
	"received_at" text,
	"approved_at" text,
	"terpenes_total" numeric(5, 2),
	"computed_terpene_sum" numeric(5, 2),
	"terpenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"parser_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lab_analyses_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_ratings_locked_by_users_id_fk" FOREIGN KEY ("ratings_locked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_labels" ADD CONSTRAINT "cup_labels_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_criteria" ADD CONSTRAINT "rating_criteria_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_label_id_cup_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."cup_labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_juries" ADD CONSTRAINT "cup_juries_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_juries" ADD CONSTRAINT "cup_juries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_juries" ADD CONSTRAINT "cup_juries_jury_profile_id_jury_profiles_id_fk" FOREIGN KEY ("jury_profile_id") REFERENCES "public"."jury_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_juries" ADD CONSTRAINT "cup_juries_invitation_id_jury_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."jury_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ADD CONSTRAINT "jury_category_assignments_cup_jury_id_cup_juries_id_fk" FOREIGN KEY ("cup_jury_id") REFERENCES "public"."cup_juries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ADD CONSTRAINT "jury_category_assignments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ADD CONSTRAINT "jury_category_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitations" ADD CONSTRAINT "jury_invitations_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitations" ADD CONSTRAINT "jury_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_profiles" ADD CONSTRAINT "jury_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ADD CONSTRAINT "public_jury_tokens_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ADD CONSTRAINT "public_jury_tokens_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ADD CONSTRAINT "public_jury_tokens_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ADD CONSTRAINT "public_jury_tokens_cup_jury_id_cup_juries_id_fk" FOREIGN KEY ("cup_jury_id") REFERENCES "public"."cup_juries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_product_rating_id_product_ratings_id_fk" FOREIGN KEY ("product_rating_id") REFERENCES "public"."product_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_criterion_id_rating_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."rating_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_jury_id_cup_juries_id_fk" FOREIGN KEY ("jury_id") REFERENCES "public"."cup_juries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cup_sponsors" ADD CONSTRAINT "cup_sponsors_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rs_generated_posts" ADD CONSTRAINT "rs_generated_posts_template_id_rs_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rs_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitation_code_categories" ADD CONSTRAINT "jury_invitation_code_categories_code_id_jury_invitation_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."jury_invitation_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitation_code_categories" ADD CONSTRAINT "jury_invitation_code_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ADD CONSTRAINT "jury_invitation_codes_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ADD CONSTRAINT "jury_invitation_codes_activated_by_user_id_users_id_fk" FOREIGN KEY ("activated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ADD CONSTRAINT "cupmetrics_historical_producers_linked_producer_id_producers_id_fk" FOREIGN KEY ("linked_producer_id") REFERENCES "public"."producers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_results" ADD CONSTRAINT "cupmetrics_historical_results_historical_cup_id_cupmetrics_historical_cups_id_fk" FOREIGN KEY ("historical_cup_id") REFERENCES "public"."cupmetrics_historical_cups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_results" ADD CONSTRAINT "cupmetrics_historical_results_historical_producer_id_cupmetrics_historical_producers_id_fk" FOREIGN KEY ("historical_producer_id") REFERENCES "public"."cupmetrics_historical_producers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyses" ADD CONSTRAINT "lab_analyses_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyses" ADD CONSTRAINT "lab_analyses_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contact_messages_status" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contact_messages_created" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jury_invitation_code_categories_code_id_idx" ON "jury_invitation_code_categories" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "jury_invitation_code_categories_category_id_idx" ON "jury_invitation_code_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "jury_invitation_codes_cup_id_idx" ON "jury_invitation_codes" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "jury_invitation_codes_code_idx" ON "jury_invitation_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "jury_invitation_codes_status_idx" ON "jury_invitation_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jury_invitation_codes_destination_idx" ON "jury_invitation_codes" USING btree ("destination");--> statement-breakpoint
CREATE INDEX "idx_press_releases_status" ON "press_releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lab_analyses_terpenes_total_idx" ON "lab_analyses" USING btree ("terpenes_total");--> statement-breakpoint
CREATE INDEX "lab_analyses_product_id_idx" ON "lab_analyses" USING btree ("product_id");