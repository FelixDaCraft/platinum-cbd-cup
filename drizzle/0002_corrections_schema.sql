-- Corrections de schéma rendues possibles par le passage de `drizzle-kit push`
-- à `drizzle-kit migrate` (constats d'audit DO-12, DO-14, DO-17, DO-19, DO-24,
-- CM-24).
--
-- Trois précautions que drizzle-kit ne sait pas générer et qui ont été ajoutées
-- à la main ici :
--   1. `USING … AT TIME ZONE 'UTC'` sur chaque passage en timestamptz. Les
--      valeurs existantes ont été écrites par l'application, qui tourne en UTC
--      dans son conteneur : c'est ainsi qu'il faut les relire. Sans la clause,
--      Postgres les interpréterait dans le fuseau de la session qui applique la
--      migration.
--   2. `DROP DEFAULT` avant chaque changement de type texte→entier/booléen :
--      Postgres refuse de convertir tout seul un défaut `'0'` en `0`.
--   3. Purge des lignes orphelines avant chaque `ADD CONSTRAINT … FOREIGN KEY`,
--      qui échouerait sinon et bloquerait le déploiement.
--
-- Deux effets à connaître avant application :
--   - chaque `SET DATA TYPE` réécrit intégralement la table sous verrou ACCESS
--     EXCLUSIVE : à passer hors trafic ;
--   - les DELETE d'orphelins et les DROP COLUMN en fin de fichier sont
--     irréversibles. `cups.payment_config_encrypted` est censée contenir des
--     clés d'API chiffrées : vérifier son contenu avant, il n'y aura pas de
--     seconde chance.
ALTER TABLE "accounts" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone USING "access_token_expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone USING "refresh_token_expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "deletion_requested_at" SET DATA TYPE timestamp with time zone USING "deletion_requested_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "deletion_scheduled_for" SET DATA TYPE timestamp with time zone USING "deletion_scheduled_for" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "registration_open_at" SET DATA TYPE timestamp with time zone USING "registration_open_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "registration_close_at" SET DATA TYPE timestamp with time zone USING "registration_close_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "rating_start_at" SET DATA TYPE timestamp with time zone USING "rating_start_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "rating_end_at" SET DATA TYPE timestamp with time zone USING "rating_end_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "ratings_locked_at" SET DATA TYPE timestamp with time zone USING "ratings_locked_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "event_date" SET DATA TYPE timestamp with time zone USING "event_date" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "results_published_at" SET DATA TYPE timestamp with time zone USING "results_published_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_labels" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_labels" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_labels" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_labels" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "rating_criteria" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "rating_criteria" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "rating_criteria" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "rating_criteria" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "producers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "producers" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "producers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "producers" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "invoice_generated_at" SET DATA TYPE timestamp with time zone USING "invoice_generated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "synthesis_email_sent_at" SET DATA TYPE timestamp with time zone USING "synthesis_email_sent_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "received_at" SET DATA TYPE timestamp with time zone USING "received_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "last_reminder_at" SET DATA TYPE timestamp with time zone USING "last_reminder_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "reminder_count" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "reminder_count" SET DATA TYPE integer USING NULLIF("reminder_count", '')::integer;
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "reminder_count" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "rating_sheet_sent_at" SET DATA TYPE timestamp with time zone USING "rating_sheet_sent_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "samples_received_at" SET DATA TYPE timestamp with time zone USING "samples_received_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "joined_at" SET DATA TYPE timestamp with time zone USING "joined_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "joined_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "last_activity_at" SET DATA TYPE timestamp with time zone USING "last_activity_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ALTER COLUMN "assigned_at" SET DATA TYPE timestamp with time zone USING "assigned_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ALTER COLUMN "assigned_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_category_assignments" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone USING "sent_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "last_reminder_at" SET DATA TYPE timestamp with time zone USING "last_reminder_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "reminder_count" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "reminder_count" SET DATA TYPE integer USING NULLIF("reminder_count", '')::integer;
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "reminder_count" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "accepted_at" SET DATA TYPE timestamp with time zone USING "accepted_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "declined_at" SET DATA TYPE timestamp with time zone USING "declined_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitations" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_profiles" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_profiles" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_profiles" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_profiles" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "claimed_at" SET DATA TYPE timestamp with time zone USING "claimed_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "criterion_scores" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "criterion_scores" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "criterion_scores" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "criterion_scores" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "submitted_at" SET DATA TYPE timestamp with time zone USING "submitted_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "product_ratings" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "gallery_images" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "gallery_images" SET DATA TYPE jsonb USING "gallery_images"::jsonb;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "gallery_images" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "team_members" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "team_members" SET DATA TYPE jsonb USING "team_members"::jsonb;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "team_members" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "organization_about" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "portal_about_settings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "portal_about_settings" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "portal_about_settings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "portal_about_settings" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ALTER COLUMN "display_order" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ALTER COLUMN "display_order" SET DATA TYPE integer USING COALESCE(NULLIF("display_order", '')::integer, 0);
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ALTER COLUMN "display_order" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "social_links" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "social_links" SET DATA TYPE jsonb USING "social_links"::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "social_links" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "gallery" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "gallery" SET DATA TYPE jsonb USING "gallery"::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "gallery" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "testimonials" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "testimonials" SET DATA TYPE jsonb USING "testimonials"::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "testimonials" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "content" SET DATA TYPE jsonb USING "content"::jsonb;
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "tags" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "tags" SET DATA TYPE jsonb USING "tags"::jsonb;
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone USING "published_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "confirmed_at" SET DATA TYPE timestamp with time zone USING "confirmed_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "unsubscribed_at" SET DATA TYPE timestamp with time zone USING "unsubscribed_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "rs_generated_posts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "rs_generated_posts" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "colors" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "colors" SET DATA TYPE jsonb USING "colors"::jsonb;
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "colors" SET DEFAULT '{"background":"#1a1a2e","text":"#ffffff","accent":"#f59e0b"}'::jsonb;
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "rs_templates" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "replied_at" SET DATA TYPE timestamp with time zone USING "replied_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "activated_at" SET DATA TYPE timestamp with time zone USING "activated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "gallery_images" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "gallery_images" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "gallery_images" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "gallery_images" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "press_releases" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone USING "published_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "press_releases" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "press_releases" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "press_releases" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "press_releases" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_press_releases" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_press_releases" SET DATA TYPE boolean USING ("show_press_releases" = 'true');
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_press_releases" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_gallery" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_gallery" SET DATA TYPE boolean USING ("show_gallery" = 'true');
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_gallery" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_media_kit" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_media_kit" SET DATA TYPE boolean USING ("show_media_kit" = 'true');
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_media_kit" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_contact" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_contact" SET DATA TYPE boolean USING ("show_contact" = 'true');
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "show_contact" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "press_settings" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "event_date" SET DATA TYPE timestamp with time zone USING "event_date" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "imported_at" SET DATA TYPE timestamp with time zone USING "imported_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "imported_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ALTER COLUMN "linked_at" SET DATA TYPE timestamp with time zone USING "linked_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_results" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_results" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "lab_analyses" ALTER COLUMN "uploaded_at" SET DATA TYPE timestamp with time zone USING "uploaded_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "lab_analyses" ALTER COLUMN "uploaded_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "lab_analyses" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "lab_analyses" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
-- Sponsors rattachés à une cup supprimée : la contrainte les refuserait et
-- ferait échouer tout le déploiement. DESTRUCTIF, sans retour en arrière.
DELETE FROM "cup_sponsors" WHERE NOT EXISTS (SELECT 1 FROM "cups" WHERE "cups"."id" = "cup_sponsors"."cup_id");
--> statement-breakpoint
ALTER TABLE "cup_sponsors" ADD CONSTRAINT "cup_sponsors_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Idem pour les visuels générés : purge APRÈS celle de cup_sponsors
-- ci-dessus, qui vient d'en produire de nouveaux. DESTRUCTIF.
DELETE FROM "rs_generated_posts" WHERE NOT EXISTS (SELECT 1 FROM "cup_sponsors" WHERE "cup_sponsors"."id" = "rs_generated_posts"."cup_sponsor_id");
--> statement-breakpoint
ALTER TABLE "rs_generated_posts" ADD CONSTRAINT "rs_generated_posts_cup_sponsor_id_cup_sponsors_id_fk" FOREIGN KEY ("cup_sponsor_id") REFERENCES "public"."cup_sponsors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Colonne nullable : on délie au lieu de supprimer, le message reste lisible.
UPDATE "contact_messages" SET "replied_by" = NULL WHERE "replied_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "contact_messages"."replied_by");
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Les archives doivent survivre à la suppression du compte importateur.
UPDATE "cupmetrics_historical_cups" SET "imported_by" = NULL WHERE "imported_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "cupmetrics_historical_cups"."imported_by");
--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_cups" ADD CONSTRAINT "cupmetrics_historical_cups_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cups" DROP COLUMN "payment_provider";
--> statement-breakpoint
ALTER TABLE "cups" DROP COLUMN "payment_config_encrypted";
--> statement-breakpoint
ALTER TABLE "cups" DROP COLUMN "payment_configured_at";
--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "rating_scale_min";
--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "rating_scale_max";
