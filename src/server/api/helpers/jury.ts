/**
 * Garde-fous partagés des parcours jurés.
 */

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { db as dbType } from "~/server/db";
import * as schema from "~/server/db/schema";
import type { JuryPanel } from "~/server/db/schema/juries";

type DB = typeof dbType;

/**
 * Refuse à un producteur qui concourt de devenir juré du panel PUBLIC.
 *
 * La règle dépend du panel rejoint, et c'est tout l'objet de ce garde-fou :
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
  cupId: string,
  panel: JuryPanel
): Promise<void> {
  // Jury professionnel : composition maîtrisée par l'organisation.
  if (panel !== "public") return;

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

/**
 * Refuse qu'un juré déjà membre d'un panel de la cup en rejoigne l'autre.
 *
 * Un utilisateur n'a qu'une ligne `cup_juries` par cup, donc un seul panel :
 * ses notes comptent dans le classement de ce panel. Le laisser entrer par la
 * porte de l'autre (un juré pro qui active un code public, par exemple) lui
 * ouvrirait des catégories sous le mauvais panel et mélangerait les deux
 * classements.
 */
export async function assertSamePanel(
  db: DB,
  userId: string,
  cupId: string,
  panel: JuryPanel
): Promise<void> {
  const membership = await db.query.cupJuries.findFirst({
    where: and(eq(schema.cupJuries.cupId, cupId), eq(schema.cupJuries.userId, userId)),
    columns: { panel: true },
  });

  if (membership && membership.panel !== panel) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        membership.panel === "pro"
          ? "Vous êtes déjà juré professionnel de cette édition : vous ne pouvez pas rejoindre aussi le jury public."
          : "Vous êtes déjà juré public de cette édition : vous ne pouvez pas rejoindre aussi le jury professionnel.",
    });
  }
}

/** Contrôles d'entrée dans un panel : conflit d'intérêts et panel unique. */
export async function assertMayJoinPanel(
  db: DB,
  userId: string,
  cupId: string,
  panel: JuryPanel
): Promise<void> {
  await assertSamePanel(db, userId, cupId, panel);
  await assertProducerMayJudge(db, userId, cupId, panel);
}
