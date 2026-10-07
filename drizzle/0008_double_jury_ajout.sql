-- Cup unique à deux jurys (pro + public) — étape 1/2 : ajout et report.
--
-- Une cup réunissait jusqu'ici un seul jury, désigné par `cups.type`. Elle en
-- réunit désormais deux, chacun avec son classement et ses propres codes
-- anonymes : le producteur s'inscrit une fois.
--
-- Cette migration AJOUTE et RECOPIE, sans rien retirer :
--   - `cup_juries.panel` : le panel du juré dans la cup, reporté depuis le
--     type de sa cup (chaque cup antérieure n'avait qu'un jury) ;
--   - `products.*_pro` / `*_public` : code anonyme, score final et rang,
--     reportés dans les colonnes du panel de la cup du produit.
-- Les anciennes colonnes (`cups.type`, `products.anonymous_code`,
-- `final_score`, `category_rank`) ne partent qu'en 0009, une fois le report
-- en place : 0008 seule est réversible sans perte.
--
-- `label_id` ne bouge pas : il porte désormais le label du jury public (le
-- jury pro n'en décerne pas). Les éditions antérieures à jury pro gardent les
-- labels calculés à l'époque.
--
-- Unicité des codes : par (catégorie, panel). Une catégorie appartient à une
-- seule cup, qui n'avait qu'un panel : le report ne peut pas créer de doublon.

ALTER TABLE "products" ADD COLUMN "anonymous_code_pro" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "anonymous_code_public" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "final_score_pro" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "final_score_public" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_rank_pro" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_rank_public" integer;--> statement-breakpoint

-- Report des résultats dans les colonnes du panel de la cup.
UPDATE "products" AS p
SET "anonymous_code_pro" = p."anonymous_code",
    "final_score_pro" = p."final_score",
    "category_rank_pro" = p."category_rank"
FROM "registrations" AS r
JOIN "cups" AS c ON c."id" = r."cup_id"
WHERE r."id" = p."registration_id" AND c."type" = 'pro';--> statement-breakpoint
UPDATE "products" AS p
SET "anonymous_code_public" = p."anonymous_code",
    "final_score_public" = p."final_score",
    "category_rank_public" = p."category_rank"
FROM "registrations" AS r
JOIN "cups" AS c ON c."id" = r."cup_id"
WHERE r."id" = p."registration_id" AND c."type" = 'public';--> statement-breakpoint

-- Panel des jurés : nullable le temps du report, puis obligatoire.
ALTER TABLE "cup_juries" ADD COLUMN "panel" text;--> statement-breakpoint
UPDATE "cup_juries" AS cj
SET "panel" = c."type"
FROM "cups" AS c
WHERE c."id" = cj."cup_id";--> statement-breakpoint
ALTER TABLE "cup_juries" ALTER COLUMN "panel" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "products" ADD CONSTRAINT "product_anonymous_code_pro_category_unique" UNIQUE("category_id","anonymous_code_pro");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "product_anonymous_code_public_category_unique" UNIQUE("category_id","anonymous_code_public");--> statement-breakpoint
ALTER TABLE "cup_juries" ADD CONSTRAINT "cup_juries_panel_check" CHECK ("cup_juries"."panel" in ('pro', 'public'));
