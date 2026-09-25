-- Reprise de données : le statut hérité « paid » n'existe dans aucun enum du
-- code (grep "paid" sur src/ : zéro occurrence). Il porte les 50 inscriptions
-- des éditions 2023, 2024 et 2025, importées avec leurs scores finaux plutôt
-- que notées sur la plateforme.
--
-- Conséquence observée avant correction : le palmarès public les affiche (il
-- ne filtre pas sur le statut), mais results.ts et widget.ts filtrent sur
-- `status = 'confirmed'` — un producteur médaillé en 2023-2025 ne voyait donc
-- rien dans son widget de distinctions.
--
-- Ces inscriptions sont valides et réglées : « confirmed » est leur état réel.
UPDATE "registrations" SET "status" = 'confirmed' WHERE "status" = 'paid';
--> statement-breakpoint
DROP INDEX "jury_invitation_codes_code_idx";--> statement-breakpoint
DROP INDEX "lab_analyses_product_id_idx";--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "categories_cup_id_idx" ON "categories" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "cup_labels_cup_id_idx" ON "cup_labels" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "rating_criteria_category_id_idx" ON "rating_criteria" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "registrations_producer_id_idx" ON "registrations" USING btree ("producer_id");--> statement-breakpoint
CREATE INDEX "products_registration_id_idx" ON "products" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "products_label_id_idx" ON "products" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "cup_juries_user_id_idx" ON "cup_juries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cup_juries_jury_profile_id_idx" ON "cup_juries" USING btree ("jury_profile_id");--> statement-breakpoint
CREATE INDEX "jury_category_assignments_category_id_idx" ON "jury_category_assignments" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "jury_invitations_user_id_idx" ON "jury_invitations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "public_jury_tokens_cup_id_idx" ON "public_jury_tokens" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "public_jury_tokens_category_id_idx" ON "public_jury_tokens" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "public_jury_tokens_status_idx" ON "public_jury_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "public_jury_tokens_claimed_by_user_id_idx" ON "public_jury_tokens" USING btree ("claimed_by_user_id");--> statement-breakpoint
CREATE INDEX "public_jury_tokens_cup_jury_id_idx" ON "public_jury_tokens" USING btree ("cup_jury_id");--> statement-breakpoint
CREATE INDEX "criterion_scores_criterion_id_idx" ON "criterion_scores" USING btree ("criterion_id");--> statement-breakpoint
CREATE INDEX "product_ratings_jury_id_idx" ON "product_ratings" USING btree ("jury_id");--> statement-breakpoint
CREATE INDEX "cup_sponsors_cup_id_idx" ON "cup_sponsors" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "cup_sponsors_sponsor_id_idx" ON "cup_sponsors" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "articles_status_published_at_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_author_id_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "articles_sponsor_id_idx" ON "articles" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_confirmation_token_idx" ON "newsletter_subscribers" USING btree ("confirmation_token");--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_unsubscribe_token_idx" ON "newsletter_subscribers" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX "rs_generated_posts_cup_sponsor_id_idx" ON "rs_generated_posts" USING btree ("cup_sponsor_id");--> statement-breakpoint
CREATE INDEX "rs_generated_posts_template_id_idx" ON "rs_generated_posts" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "jury_invitation_codes_activated_by_user_id_idx" ON "jury_invitation_codes" USING btree ("activated_by_user_id");--> statement-breakpoint
CREATE INDEX "gallery_images_uploaded_by_idx" ON "gallery_images" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "press_releases_author_id_idx" ON "press_releases" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "lab_analyses_uploaded_by_idx" ON "lab_analyses" USING btree ("uploaded_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" in ('organizer', 'jury', 'producer'));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_status_check" CHECK ("cups"."status" in ('draft', 'published', 'registration_closed', 'rating', 'completed'));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_check" CHECK ("cups"."type" in ('public', 'pro'));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_rating_scale_check" CHECK ("cups"."rating_scale" in ('0-5', '0-10', '0-20', '0-100'));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_currency_check" CHECK ("cups"."currency" in ('EUR', 'USD', 'GBP', 'CHF'));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_results_visibility_check" CHECK ("cups"."results_visibility" in ('podium', 'labels', 'labels_and_podium', 'all'));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_status_check" CHECK ("registrations"."status" in ('pending_payment', 'confirmed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_currency_check" CHECK ("registrations"."currency" in ('EUR', 'USD', 'GBP', 'CHF'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_status_check" CHECK ("products"."status" in ('pending', 'received', 'rating', 'rated'));--> statement-breakpoint
ALTER TABLE "jury_invitations" ADD CONSTRAINT "jury_invitations_status_check" CHECK ("jury_invitations"."status" in ('pending', 'accepted', 'declined', 'expired'));--> statement-breakpoint
ALTER TABLE "jury_profiles" ADD CONSTRAINT "jury_profiles_jury_type_check" CHECK ("jury_profiles"."jury_type" in ('pro', 'public'));--> statement-breakpoint
ALTER TABLE "public_jury_tokens" ADD CONSTRAINT "public_jury_tokens_status_check" CHECK ("public_jury_tokens"."status" in ('available', 'claimed', 'expired'));--> statement-breakpoint
ALTER TABLE "cup_sponsors" ADD CONSTRAINT "cup_sponsors_tier_check" CHECK ("cup_sponsors"."tier" in ('bronze', 'silver', 'gold', 'platinum'));--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_status_check" CHECK ("articles"."status" in ('draft', 'published'));--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_status_check" CHECK ("newsletter_subscribers"."status" in ('pending', 'active', 'unsubscribed'));--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_subject_check" CHECK ("contact_messages"."subject" in ('general', 'registration', 'results', 'sponsorship', 'press', 'technical', 'other'));--> statement-breakpoint
ALTER TABLE "jury_invitation_codes" ADD CONSTRAINT "jury_invitation_codes_status_check" CHECK ("jury_invitation_codes"."status" in ('pending', 'activated', 'revoked', 'expired'));--> statement-breakpoint
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_status_check" CHECK ("press_releases"."status" in ('draft', 'published'));