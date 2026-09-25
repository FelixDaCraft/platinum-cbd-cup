-- Retrait du préfixe `cupmetrics_` sur les trois tables d'archives (CM-23,
-- DO-18). Ces tables portent les palmarès des éditions antérieures : le
-- renommage doit rester un RENAME. Un DROP + CREATE, que drizzle-kit propose
-- quand il ne reconnaît pas la correspondance, détruirait les archives.
--
-- drizzle-kit avait généré un DROP CONSTRAINT + ADD CONSTRAINT pour chaque clé
-- étrangère (Postgres ne renomme pas les contraintes avec leur table). Réécrit
-- en RENAME CONSTRAINT : recréer une FK revalide toute la table sous verrou,
-- pour un simple changement de nom.
--
-- Postgres tronque les identifiants à 63 octets : deux de ces noms dépassent et
-- l'application émettra un NOTICE de troncature. C'est sans effet, la troncature
-- s'applique des deux côtés du RENAME comme elle s'est appliquée à la création.
ALTER TABLE "cupmetrics_historical_cups" RENAME TO "historical_cups";--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_producers" RENAME TO "historical_producers";--> statement-breakpoint
ALTER TABLE "cupmetrics_historical_results" RENAME TO "historical_results";--> statement-breakpoint
ALTER TABLE "historical_cups" RENAME CONSTRAINT "cupmetrics_historical_cups_imported_by_users_id_fk" TO "historical_cups_imported_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "historical_producers" RENAME CONSTRAINT "cupmetrics_historical_producers_linked_producer_id_producers_id_fk" TO "historical_producers_linked_producer_id_producers_id_fk";--> statement-breakpoint
ALTER TABLE "historical_results" RENAME CONSTRAINT "cupmetrics_historical_results_historical_cup_id_cupmetrics_historical_cups_id_fk" TO "historical_results_historical_cup_id_historical_cups_id_fk";--> statement-breakpoint
ALTER TABLE "historical_results" RENAME CONSTRAINT "cupmetrics_historical_results_historical_producer_id_cupmetrics_historical_producers_id_fk" TO "historical_results_historical_producer_id_historical_producers_id_fk";
