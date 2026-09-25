/**
 * Garde-fous partagés des parcours jurés.
 */

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { db as dbType } from "~/server/db";
import * as schema from "~/server/db/schema";

type DB = typeof dbType;

/**
 * Refuse à un producteur qui concourt de devenir juré d'une édition PUBLIQUE.
 *
 * La règle dépend du type d'édition, et c'est tout l'objet de ce garde-fou :
 *
 *   - `public` : le jury est composé de consommateurs. Un producteur qui a
 *     inscrit des produits n'y a pas sa place, quelle que soit la catégorie.
 *   - `pro` : le panel est choisi à la main par l'organisation, qui s'assure
 *     elle-même que personne ne juge une catégorie où il concourt. On ne
 *     bloque donc pas — et surtout pas au niveau de l'édition entière.
 *
 * Ce second point était le défaut : le contrôle portait sur l'édition sans
 * regarder ni la catégorie ni le type. Sur l'édition 2026, cela excluait les
 * 45 producteurs inscrits d'un jury pro auquel l'organisation pouvait
 * légitimement vouloir les convier — aucun d'eux ne concourt dans plus de
 * trois catégories sur cinq. Un juré invité à la main se voyait refuser son
 * invitation sans que personne comprenne pourquoi.
 *
 * Avoir une ligne `producers` ne suffit pas à faire un producteur : une
 * inscription publique en crée une, vide, avant tout dépôt de produit. C'est
 * le fait de CONCOURIR qui crée le conflit, donc l'existence d'une inscription.
 */
export async function assertProducerMayJudge(
  db: DB,
  userId: string,
  cupId: string
): Promise<void> {
  const cup = await db.query.cups.findFirst({
    where: eq(schema.cups.id, cupId),
    columns: { type: true },
  });

  // Jury professionnel : composition maîtrisée par l'organisation.
  if (cup?.type !== "public") return;

  const producer = await db.query.producers.findFirst({
    where: eq(schema.producers.userId, userId),
    columns: { id: true },
  });

  if (!producer) return;

  const registration = await db.query.registrations.findFirst({
    where: and(
      eq(schema.registrations.cupId, cupId),
      eq(schema.registrations.producerId, producer.id)
    ),
    columns: { id: true },
  });

  if (registration) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Vous concourez à cette édition en tant que producteur : le jury public est réservé aux consommateurs.",
    });
  }
}
