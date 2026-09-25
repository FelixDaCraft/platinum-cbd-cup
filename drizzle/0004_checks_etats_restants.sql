-- Derniers états métier encore stockés en `text` sans garde-fou en base
-- (DO-13, le reste a été posé par 0001).
--
-- Un ADD CONSTRAINT … CHECK valide les lignes existantes : si l'une d'elles
-- porte une valeur hors liste, l'instruction échoue et bloque le déploiement.
-- Les trois colonnes ne sont écrites que par du code qui filtre déjà sur ces
-- listes, mais `historical_results.medal` porte des archives reprises de
-- l'ancien SaaS : c'est celle à vérifier en premier si la migration casse.
ALTER TABLE "rs_generated_posts" ADD CONSTRAINT "rs_generated_posts_format_check" CHECK ("rs_generated_posts"."format" in ('instagram', 'twitter'));--> statement-breakpoint
ALTER TABLE "rs_templates" ADD CONSTRAINT "rs_templates_style_check" CHECK ("rs_templates"."style" in ('classic', 'modern', 'minimal', 'vibrant', 'elegant'));--> statement-breakpoint
ALTER TABLE "historical_results" ADD CONSTRAINT "historical_results_medal_check" CHECK ("historical_results"."medal" in ('gold', 'silver', 'bronze', 'mention', 'none'));