/**
 * Commandes d'un producteur sur une cup.
 *
 * Un producteur peut régler plusieurs fois pour une même cup : sa première
 * inscription, puis des commandes complémentaires, chacune avec sa facture.
 * Les résultats, eux, se présentent par producteur : une synthèse, un e-mail,
 * tous ses produits. Ce module rassemble les inscriptions confirmées qui
 * forment ce tout.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "~/server/db";
import * as schema from "~/server/db/schema";

type DbClient = typeof defaultDb;

/**
 * Inscriptions confirmées du même producteur sur la même cup que
 * `registrationId`, elle comprise, de la plus ancienne à la plus récente.
 * Vide si l'inscription n'existe pas.
 */
export async function getProducerCupRegistrationIds(
  db: DbClient,
  registrationId: string
): Promise<string[]> {
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { cupId: true, producerId: true },
  });
  if (!registration) return [];

  const siblings = await db.query.registrations.findMany({
    where: and(
      eq(schema.registrations.cupId, registration.cupId),
      eq(schema.registrations.producerId, registration.producerId),
      eq(schema.registrations.status, "confirmed")
    ),
    columns: { id: true },
    orderBy: [asc(schema.registrations.createdAt)],
  });

  const ids = siblings.map((s) => s.id);
  return ids.includes(registrationId) ? ids : [registrationId, ...ids];
}

/** Produits de plusieurs inscriptions, avec catégorie et label. */
export async function getProductsOfRegistrations(db: DbClient, registrationIds: string[]) {
  if (registrationIds.length === 0) return [];
  return db.query.products.findMany({
    where: inArray(schema.products.registrationId, registrationIds),
    with: { category: true, label: true },
  });
}
