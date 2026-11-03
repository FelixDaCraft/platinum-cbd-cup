-- Traductions des contenus en base (site multilingue).
--
-- Purement additive : une colonne jsonb `translations` (défaut '{}') sur les
-- catégories, critères, labels, articles et documents légaux, et
-- `users.locale` (langue des e-mails envoyés hors requête). Aucune donnée
-- existante n'est modifiée ; les traductions sont injectées ensuite par
-- `pnpm tsx scripts/import-translations.ts --apply`.

ALTER TABLE "users" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cup_labels" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rating_criteria" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;