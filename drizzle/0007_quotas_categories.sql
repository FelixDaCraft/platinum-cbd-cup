-- Quotas d'inscription par catégorie et réservation des places au paiement.
--
-- `categories.max_products` : places de la catégorie, tous producteurs
-- confondus. `categories.max_products_per_producer` : produits qu'un même
-- producteur peut y inscrire. NULL = illimité, ce qui laisse toutes les
-- catégories existantes sans limite.
--
-- `registrations.payment_reserved_until` : échéance de la réservation prise à
-- l'ouverture du paiement Viva. Tant qu'elle court, les produits de
-- l'inscription comptent dans les quotas comme s'ils étaient payés.
--
-- Purement additive : aucune donnée réécrite, aucun verrou long.
ALTER TABLE "categories" ADD COLUMN "max_products" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "max_products_per_producer" integer;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "payment_reserved_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_max_products_check" CHECK ("categories"."max_products" is null or "categories"."max_products" > 0);--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_max_products_per_producer_check" CHECK ("categories"."max_products_per_producer" is null or "categories"."max_products_per_producer" > 0);