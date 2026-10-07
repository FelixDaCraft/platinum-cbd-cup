-- Cup unique à deux jurys (pro + public) — étape 2/2 : retrait.
--
-- Retire les colonnes à panel unique, dont 0008 a reporté le contenu dans
-- `products.*_pro` / `*_public` et `cup_juries.panel`.
--
-- DESTRUCTIF : `cups.type` disparaît. L'information n'est pas perdue — le
-- panel d'une édition antérieure se lit sur ses jurés (`cup_juries.panel`) et
-- sur la colonne où se trouvent ses résultats.

ALTER TABLE "products" DROP CONSTRAINT "product_anonymous_code_category_unique";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_type_check";--> statement-breakpoint
ALTER TABLE "cups" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "anonymous_code";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "final_score";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "category_rank";
