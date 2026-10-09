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

  if (await isCompetingProducer(db, userId, cupId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Vous concourez à cette édition en tant que producteur : le jury public est réservé aux consommateurs.",
    });
  }
}

/** Vrai si l'utilisateur a une inscription (donc concourt) dans la cup. */
export async function isCompetingProducer(
  db: DB,
  userId: string,
  cupId: string
): Promise<boolean> {
  const producer = await db.query.producers.findFirst({
    where: eq(schema.producers.userId, userId),
    columns: { id: true },
  });

  if (!producer) return false;

  const registration = await db.query.registrations.findFirst({
    where: and(
      eq(schema.registrations.cupId, cupId),
      eq(schema.registrations.producerId, producer.id)
    ),
    columns: { id: true },
  });

  return Boolean(registration);
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

/**
 * Même règle que `assertProducerMayJudge`, formulée pour l'organisation
 * quand c'est elle qui place un juré dans le panel public.
 */
export async function assertOrganizerMayPlaceInPanel(
  db: DB,
  userId: string,
  cupId: string,
  panel: JuryPanel
): Promise<void> {
  if (panel !== "public") return;

  if (await isCompetingProducer(db, userId, cupId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Ce juré concourt à cette édition en tant que producteur : il ne peut pas faire partie du jury public.",
    });
  }
}

/** Client de base compatible avec `db` comme avec une transaction. */
export type DbClient = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Aligne `users.role` sur "jury" au moment ou le compte devient jure.
 *
 * Sans cette ecriture la colonne reste sur son defaut "producer" et
 * `user.getRedirectPath` renvoie le jure vers /producer/dashboard, d'ou une
 * double redirection a chaque connexion. On ne degrade jamais un organisateur
 * ni un producteur deja identifie : leur role principal reste le leur, les
 * casquettes secondaires se lisent via les profils.
 */
export async function alignUserRoleToJury(db: DbClient, userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { role: true, isAdmin: true },
  });

  if (!user || user.isAdmin || user.role === "organizer" || user.role === "jury") {
    return;
  }

  const producerProfile = await db.query.producers.findFirst({
    where: eq(schema.producers.userId, userId),
    columns: { id: true },
  });

  if (producerProfile) return;

  await db
    .update(schema.users)
    .set({ role: "jury", updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}
