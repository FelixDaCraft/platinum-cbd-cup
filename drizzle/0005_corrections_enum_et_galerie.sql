-- Purge des valeurs d'enum héritées du SaaS multi-tenant (DO-18) et passage de
-- la galerie publique en jsonb (DO-17).
--
-- Deux corrections apportées à la main au SQL généré :
--
--   1. `USING NULLIF("gallery_urls", '')::jsonb` sur la conversion de la
--      galerie. drizzle-kit produisait un `SET DATA TYPE jsonb` nu : Postgres
--      n'a pas de conversion implicite de text vers jsonb, l'instruction
--      échoue et bloque tout le déploiement. Le `NULLIF` couvre la chaîne
--      vide, que `''::jsonb` refuserait alors qu'elle signifie « pas de
--      galerie ».
--
--   2. Rien à corriger sur l'enum, mais il faut comprendre ce que fait le
--      détour par `text` : la colonne repasse en texte, l'ancien type est
--      supprimé, le nouveau créé, puis la colonne y est reconvertie. Ce
--      dernier cast ÉCHOUE si une ligne porte l'une des huit valeurs
--      retirées. C'est voulu : mieux vaut un déploiement qui s'arrête qu'un
--      journal d'audit tronqué en silence. Vérifié sur le dump du 24/09 :
--      zéro ligne concernée, sur les huit valeurs.
--
-- Les valeurs retirées : admin_suspend_organization, admin_reactivate_organization,
-- admin_update_plan_config, organization_created, organization_updated,
-- subscription_created, subscription_updated, subscription_cancelled.
-- Rejouée le 25/09/2026 sur une base restaurée depuis le dump de production
-- du 24/09 : chaîne 0000 -> 0006 appliquée en 3 s, second passage idempotent,
-- effectifs inchangés (140 users, 285 produits, 1237 notations, 7366 scores,
-- 185 inscriptions). Contrôles préalables : gallery_urls NULL sur les 9 cups,
-- zéro ligne de journal portant une des huit valeurs retirées. Après coup :
-- écriture jsonb acceptée et relue comme tableau, « subscription_created »
-- bien refusée par le nouveau type.
ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."activity_action";--> statement-breakpoint
CREATE TYPE "public"."activity_action" AS ENUM('user_login', 'user_logout', 'user_signup', 'password_reset', 'email_change', 'admin_create_organizer', 'admin_toggle_admin', 'cup_created', 'cup_updated', 'cup_published', 'cup_completed', 'cup_deleted', 'registration_created', 'registration_confirmed', 'registration_cancelled', 'product_created', 'product_updated', 'product_received', 'rating_submitted', 'results_published', 'results_sent', 'jury_invited', 'jury_joined', 'jury_removed', 'other');--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE "public"."activity_action" USING "action"::"public"."activity_action";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "gallery_urls" SET DATA TYPE jsonb USING NULLIF("gallery_urls", '')::jsonb;
