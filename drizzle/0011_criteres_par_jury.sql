ALTER TABLE "rating_criteria" ADD COLUMN "panel" text DEFAULT 'pro' NOT NULL;--> statement-breakpoint
CREATE INDEX "rating_criteria_category_panel_idx" ON "rating_criteria" USING btree ("category_id","panel");--> statement-breakpoint
ALTER TABLE "rating_criteria" ADD CONSTRAINT "rating_criteria_panel_check" CHECK ("rating_criteria"."panel" in ('pro', 'public'));--> statement-breakpoint
-- Reprise des données : chaque critère existant appartient au jury qui l'a
-- noté. Aucun critère n'a jamais été noté par les deux jurys (vérifié en prod
-- le 2026-10-09) : les éditions historiques avaient une cup par jury.
UPDATE "rating_criteria" rc SET "panel" = 'public'
WHERE EXISTS (
  SELECT 1 FROM "criterion_scores" cs
  JOIN "product_ratings" pr ON pr."id" = cs."product_rating_id"
  JOIN "cup_juries" cj ON cj."id" = pr."jury_id"
  WHERE cs."criterion_id" = rc."id" AND cj."panel" = 'public'
)
AND NOT EXISTS (
  SELECT 1 FROM "criterion_scores" cs
  JOIN "product_ratings" pr ON pr."id" = cs."product_rating_id"
  JOIN "cup_juries" cj ON cj."id" = pr."jury_id"
  WHERE cs."criterion_id" = rc."id" AND cj."panel" = 'pro'
);--> statement-breakpoint
-- Critères jamais notés (éditions en préparation) : ils restent au jury pro
-- et reçoivent une copie pour le jury public, que l'organisateur ajuste
-- ensuite (renommer, supprimer, réordonner).
INSERT INTO "rating_criteria" ("id", "category_id", "panel", "name", "description", "coefficient", "sort_order", "created_at", "updated_at")
SELECT substr(md5(rc."id" || ':public'), 1, 21), rc."category_id", 'public', rc."name", rc."description", rc."coefficient", rc."sort_order", now(), now()
FROM "rating_criteria" rc
WHERE rc."panel" = 'pro'
AND NOT EXISTS (SELECT 1 FROM "criterion_scores" cs WHERE cs."criterion_id" = rc."id");
