/**
 * Participants à annoncer sur les réseaux sociaux de la cup.
 *
 * Alimente InstaPlanner, qui prépare une publication « participant » par
 * marque inscrite et la soumet à validation humaine avant toute mise en ligne.
 * Une marque y figure dès qu'elle a au moins une inscription confirmée
 * (payée, gratuite ou importée) à une cup en cours.
 *
 * Minimisation des données (RGPD) : seuls le nom de la marque, son site, son
 * compte Instagram, ses catégories et, avec le consentement média, son logo et sa photo d'équipe
 * sortent de la cup. Les noms de produits restent internes : associés à la
 * marque sur une publication, ils lèveraient l'anonymat de la dégustation.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { db as Database } from "~/server/db";
import {
  categories,
  cups,
  producers,
  products,
  registrations,
  type CupStatus,
} from "~/server/db/schema";

/** Cups dont les participants sont encore à annoncer. */
export const SOCIAL_ACTIVE_CUP_STATUSES: readonly CupStatus[] = [
  "published",
  "registration_closed",
  "rating",
];

/** Une ligne par produit d'une inscription confirmée (ou par inscription sans produit). */
export type SocialParticipantRow = {
  cupId: string;
  cupName: string;
  producerId: string;
  brandName: string;
  website: string | null;
  instagram: string | null;
  logo: string | null;
  teamPhoto: string | null;
  mediaConsentAt: Date | null;
  categoryName: string | null;
  confirmedAt: Date;
};

export type SocialParticipant = {
  /** Identifiant stable côté InstaPlanner : une publication par marque et par cup. */
  externalId: string;
  cup: { id: string; name: string };
  brandName: string;
  website: string | null;
  /** Compte Instagram sans @, pour la mention sur la publication */
  instagram: string | null;
  categories: string[];
  mediaConsent: boolean;
  logoUrl: string | null;
  teamPhotoUrl: string | null;
  firstConfirmedAt: string;
};

function absoluteUrl(baseUrl: string, path: string | null): string | null {
  if (!path) return null;
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Regroupe les lignes par marque et par cup. Les visuels ne sont donnés
 * qu'avec le consentement en cours : un consentement retiré laisse les
 * fichiers sur le disque, mais ils ne doivent plus être diffusés.
 */
export function toSocialParticipants(
  rows: SocialParticipantRow[],
  baseUrl: string
): SocialParticipant[] {
  const byKey = new Map<
    string,
    { row: SocialParticipantRow; categories: Set<string>; firstConfirmedAt: Date }
  >();

  for (const row of rows) {
    const key = `${row.cupId}:${row.producerId}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { row, categories: new Set(), firstConfirmedAt: row.confirmedAt };
      byKey.set(key, entry);
    }
    if (row.categoryName) entry.categories.add(row.categoryName);
    if (row.confirmedAt < entry.firstConfirmedAt) entry.firstConfirmedAt = row.confirmedAt;
  }

  return [...byKey.entries()]
    .map(([externalId, { row, categories: names, firstConfirmedAt }]) => {
      const mediaConsent = row.mediaConsentAt !== null;
      return {
        externalId,
        cup: { id: row.cupId, name: row.cupName },
        brandName: row.brandName,
        website: row.website,
        instagram: row.instagram,
        categories: [...names].sort((a, b) => a.localeCompare(b, "fr")),
        mediaConsent,
        logoUrl: mediaConsent ? absoluteUrl(baseUrl, row.logo) : null,
        teamPhotoUrl: mediaConsent ? absoluteUrl(baseUrl, row.teamPhoto) : null,
        firstConfirmedAt: firstConfirmedAt.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        a.firstConfirmedAt.localeCompare(b.firstConfirmedAt) ||
        a.externalId.localeCompare(b.externalId)
    );
}

/**
 * Lit les inscriptions confirmées d'une cup donnée, ou à défaut de toutes les
 * cups en cours (`SOCIAL_ACTIVE_CUP_STATUSES`).
 */
export async function listSocialParticipants(
  database: typeof Database,
  options: { cupId?: string; baseUrl: string }
): Promise<SocialParticipant[]> {
  const cupFilter = options.cupId
    ? eq(cups.id, options.cupId)
    : inArray(cups.status, [...SOCIAL_ACTIVE_CUP_STATUSES]);

  const rows = await database
    .select({
      cupId: cups.id,
      cupName: cups.name,
      producerId: producers.id,
      brandName: producers.brandName,
      website: producers.website,
      instagram: producers.instagram,
      logo: producers.logo,
      teamPhoto: producers.teamPhoto,
      mediaConsentAt: producers.mediaConsentAt,
      categoryName: categories.name,
      // Pas de date de confirmation dédiée : la facture est émise à la
      // confirmation d'un paiement, la création fait foi pour le gratuit.
      confirmedAt: sql<Date>`coalesce(${registrations.invoiceGeneratedAt}, ${registrations.createdAt})`.mapWith(
        (value: string | Date) => new Date(value)
      ),
    })
    .from(registrations)
    .innerJoin(producers, eq(producers.id, registrations.producerId))
    .innerJoin(cups, eq(cups.id, registrations.cupId))
    .leftJoin(products, eq(products.registrationId, registrations.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(registrations.status, "confirmed"), cupFilter))
    .orderBy(asc(registrations.createdAt));

  return toSocialParticipants(rows, options.baseUrl);
}
