/**
 * Quotas d'inscription par catégorie.
 *
 * Deux limites, réglées par catégorie (null = illimité) :
 *  - `maxProducts` : places de la catégorie, tous producteurs confondus ;
 *  - `maxProductsPerProducer` : produits qu'un même producteur peut y inscrire.
 *
 * Une place est OCCUPÉE par le produit d'une inscription confirmée (payée), ou
 * RÉSERVÉE par celui d'une inscription dont le paiement est en cours
 * (`registrations.payment_reserved_until` dans le futur). Un panier qui n'a pas
 * encore ouvert de paiement ne retient rien : de deux producteurs qui visent la
 * dernière place, c'est le premier à passer au paiement qui la garde, et le
 * second voit la catégorie complète. Si le paiement échoue ou est abandonné,
 * la réservation tombe (annulation de la commande ou expiration) et la place
 * redevient libre.
 */

import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import type { db as defaultDb } from "~/server/db";

type DbClient = typeof defaultDb;
/** Client Drizzle au sein d'une transaction en cours. */
type TxClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/**
 * Durée de la réservation prise à l'ouverture du paiement : la durée de vie de
 * la commande Viva (`paymentTimeout`, 30 minutes) plus une marge. La
 * réservation doit survivre à la commande, sinon un paiement réglé à la
 * dernière seconde pourrait aboutir sur une place déjà rendue à un autre.
 */
export const PAYMENT_ORDER_TIMEOUT_SECONDS = 1800;
export const PAYMENT_RESERVATION_MS = (PAYMENT_ORDER_TIMEOUT_SECONDS + 300) * 1000;

/**
 * Espace de noms des verrous consultatifs de quota. Distinct de celui de
 * l'anonymisation : les deux ne doivent pas se bloquer l'un l'autre.
 */
const QUOTA_LOCK_NAMESPACE = 4120253;

/**
 * Sérialise les réservations d'une catégorie pour la durée de la transaction.
 * Sans lui, deux ouvertures de paiement simultanées liraient chacune une
 * place libre et la prendraient toutes les deux.
 *
 * Les catégories sont verrouillées dans un ordre stable (tri des ids) pour
 * que deux paniers multi-catégories ne s'interbloquent pas.
 */
export async function lockCategoryQuotas(
  tx: TxClient | DbClient,
  categoryIds: string[]
): Promise<void> {
  for (const categoryId of [...new Set(categoryIds)].sort()) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${sql.raw(String(QUOTA_LOCK_NAMESPACE))}, hashtext(${categoryId}))`
    );
  }
}

/**
 * Places occupées ou réservées, par catégorie d'une cup.
 *
 * @param excludeRegistrationId - inscription à ne pas compter, typiquement
 *   celle du producteur qui demande : ses propres produits sont comptés à
 *   part, depuis son panier.
 */
export async function getCategoryOccupancy(
  db: TxClient | DbClient,
  cupId: string,
  excludeRegistrationId?: string
): Promise<Map<string, number>> {
  const rows = await db.execute<{ category_id: string; taken: number }>(sql`
    SELECT p.category_id, count(*)::int AS taken
    FROM products p
    JOIN registrations r ON r.id = p.registration_id
    WHERE r.cup_id = ${cupId}
      AND (
        r.status = 'confirmed'
        OR (r.status = 'pending_payment' AND r.payment_reserved_until > now())
      )
      ${excludeRegistrationId ? sql`AND r.id <> ${excludeRegistrationId}` : sql``}
    GROUP BY p.category_id
  `);

  return new Map(rows.rows.map((row) => [row.category_id, Number(row.taken)]));
}

export interface CategoryQuota {
  id: string;
  name: string;
  maxProducts: number | null;
  maxProductsPerProducer: number | null;
}

/**
 * Vérifie qu'un panier tient dans les quotas de ses catégories.
 *
 * @param cart - nombre de produits du panier par catégorie, produit en cours
 *   d'ajout compris.
 * @param occupancy - places prises par les AUTRES inscriptions
 *   (`getCategoryOccupancy` avec l'inscription du panier exclue).
 * @param heldByProducer - produits déjà réglés par le même producteur sur la
 *   cup, dans ses inscriptions précédentes (`getProducerPaidProducts`) : le
 *   maximum par producteur porte sur toutes ses commandes, pas sur le seul
 *   panier en cours.
 * @throws TRPCError CONFLICT avec un message lisible par le producteur.
 */
export function assertCartWithinQuotas(
  categories: CategoryQuota[],
  cart: Map<string, number>,
  occupancy: Map<string, number>,
  heldByProducer: Map<string, number> = new Map()
): void {
  for (const category of categories) {
    const wanted = cart.get(category.id) ?? 0;
    if (wanted === 0) continue;

    const held = heldByProducer.get(category.id) ?? 0;
    if (
      category.maxProductsPerProducer !== null &&
      wanted + held > category.maxProductsPerProducer
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          held > 0
            ? `Vous ne pouvez inscrire que ${category.maxProductsPerProducer} produit(s) dans la catégorie « ${category.name} », et vous en avez déjà ${held}.`
            : `Vous ne pouvez inscrire que ${category.maxProductsPerProducer} produit(s) dans la catégorie « ${category.name} ».`,
      });
    }

    if (category.maxProducts !== null) {
      const remaining = category.maxProducts - (occupancy.get(category.id) ?? 0);
      if (wanted > remaining) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            remaining <= 0
              ? `La catégorie « ${category.name} » est complète.`
              : `Il ne reste que ${remaining} place(s) dans la catégorie « ${category.name} ».`,
        });
      }
    }
  }
}

/**
 * Produits déjà réglés par un producteur sur une cup, par catégorie, hors
 * panier en cours (ses inscriptions confirmées : première commande et
 * commandes complémentaires).
 */
export async function getProducerPaidProducts(
  db: TxClient | DbClient,
  cupId: string,
  producerId: string,
  excludeRegistrationId: string
): Promise<Map<string, number>> {
  const rows = await db.execute<{ category_id: string; held: number }>(sql`
    SELECT p.category_id, count(*)::int AS held
    FROM products p
    JOIN registrations r ON r.id = p.registration_id
    WHERE r.cup_id = ${cupId}
      AND r.producer_id = ${producerId}
      AND r.status = 'confirmed'
      AND r.id <> ${excludeRegistrationId}
    GROUP BY p.category_id
  `);

  return new Map(rows.rows.map((row) => [row.category_id, Number(row.held)]));
}

/** Compte les produits d'un panier par catégorie. */
export function countByCategory(products: Array<{ categoryId: string }>): Map<string, number> {
  const cart = new Map<string, number>();
  for (const product of products) {
    cart.set(product.categoryId, (cart.get(product.categoryId) ?? 0) + 1);
  }
  return cart;
}
