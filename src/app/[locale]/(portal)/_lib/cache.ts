import type { Cup } from "~/server/db/schema/cups";

/**
 * Fraîcheur des lectures publiques mises en cache.
 *
 * Le contenu du portail (éditions publiées, palmarès, catégories) change
 * quelques fois par an, mais chaque visite — et chaque passage de robot —
 * déclenchait jusqu'ici 5 à 10 requêtes SQL sur un serveur mono-process.
 * Une minute de retard est invisible pour un visiteur et divise la charge
 * par le nombre de vues de la minute.
 */
export const PORTAL_REVALIDATE = 60;

/**
 * Étiquettes de cache partagées.
 *
 * Elles permettront une invalidation immédiate le jour où les mutations
 * serveur (cup.update, publishResults, article.publish…) appelleront
 * `revalidateTag` — ces routeurs sont hors du périmètre de ce lot, d'où le
 * repli sur la seule expiration par durée en attendant.
 */
export const PORTAL_CACHE_TAGS = {
  cups: "cups",
  results: "results",
  articles: "articles",
  sponsors: "sponsors",
  press: "press",
} as const;

/**
 * `unstable_cache` sérialise ce qu'il stocke en JSON : les colonnes
 * `timestamp` ressortent en chaîne ISO alors que Drizzle les type `Date`.
 * Tout appel de méthode (`registrationCloseAt.getTime()` dans le compte à
 * rebours des éditions) planterait donc au deuxième affichage, celui servi
 * par le cache. Les lignes relues sont repassées ici pour retrouver la forme
 * annoncée par leur type.
 */
function toDate(value: Date | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value as unknown as string);
}

export function reviveCupDates(cup: Cup): Cup {
  return {
    ...cup,
    registrationOpenAt: toDate(cup.registrationOpenAt),
    registrationCloseAt: toDate(cup.registrationCloseAt),
    ratingStartAt: toDate(cup.ratingStartAt),
    ratingEndAt: toDate(cup.ratingEndAt),
    ratingsLockedAt: toDate(cup.ratingsLockedAt),
    eventDate: toDate(cup.eventDate),
    resultsPublishedAt: toDate(cup.resultsPublishedAt),
    createdAt: toDate(cup.createdAt)!,
    updatedAt: toDate(cup.updatedAt)!,
  };
}
