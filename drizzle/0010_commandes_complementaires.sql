-- Commandes complémentaires : un producteur peut régler plusieurs fois pour
-- une même cup.
--
-- L'unicité (cup, producteur) bloquait tout ajout de produit après un premier
-- paiement : l'inscription confirmée n'est plus modifiable, et il n'était pas
-- possible d'en ouvrir une seconde. Chaque paiement devient une inscription,
-- avec sa propre facture.
--
-- Reste unique : le panier en cours. L'index partiel n'admet qu'une
-- inscription `pending_payment` par (cup, producteur), celle que
-- `registration.getOrCreate` retrouve. Les données existantes y satisfont
-- d'office (l'ancienne contrainte était plus stricte).
--
-- Non destructive : la contrainte retirée est remplacée par une plus large.
ALTER TABLE "registrations" DROP CONSTRAINT "registration_producer_cup_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_one_pending_per_producer_cup" ON "registrations" USING btree ("cup_id","producer_id") WHERE "registrations"."status" = 'pending_payment';--> statement-breakpoint
CREATE INDEX "registrations_cup_producer_idx" ON "registrations" USING btree ("cup_id","producer_id");