/**
 * Anonymization Service
 * Génère les codes anonymes des produits après confirmation du paiement.
 * Format : [INITIALES DE CATÉGORIE][NOMBRE], par exemple CF23 pour « Café Filtre ».
 *
 * ATTENTION — la colonne `cups.anonymization_prefix` n'est PAS lue ici, et ne
 * l'a jamais été depuis le fork : le préfixe est dérivé du nom de la catégorie,
 * pas d'un réglage de la cup. La mutation `cup.updateAnonymizationPrefix`
 * l'écrit encore et refuse même de la modifier « une fois des produits
 * anonymisés », ce qui laisse croire à l'organisateur qu'il pilote quelque
 * chose : régler le préfixe sur « B » ne change aucun code.
 *
 * Le comportement conservé est celui-ci, volontairement : un préfixe unique par
 * cup donnerait à deux produits de catégories différentes des codes voisins
 * (A1, A2, …) alors que les initiales de catégorie disent au juré de quel
 * classement relève l'échantillon qu'il a en main. C'est donc la colonne et sa
 * mutation qui doivent disparaître, pas ce calcul.
 */

import { eq, and, sql } from "drizzle-orm";
import { db as defaultDb } from "~/server/db";
import * as schema from "~/server/db/schema";

type DbClient = typeof defaultDb;

/**
 * Espace de noms des verrous consultatifs d'attribution de code anonyme.
 * Le second argument du verrou est le hachage de la catégorie : deux
 * catégories différentes ne se bloquent pas l'une l'autre.
 */
const ANONYMIZATION_LOCK_NAMESPACE = 4120252;

/**
 * Sérialise l'attribution des codes d'une catégorie pour la durée de la
 * transaction en cours.
 *
 * Sans lui, la séquence « lire les codes pris, tirer un nombre, écrire » est
 * une lecture-puis-écriture non atomique : deux confirmations de paiement
 * simultanées dans la même catégorie peuvent tirer le même nombre, et la
 * contrainte d'unicité (category_id, anonymous_code) fait alors échouer la
 * confirmation entière.
 *
 * Hors transaction, `pg_advisory_xact_lock` est relâché immédiatement : la
 * protection ne vaut que pour les appelants transactionnels, ce qui est le
 * cas de la confirmation de paiement.
 */
async function lockCategoryNumbering(db: DbClient, categoryId: string): Promise<void> {
  // Espace de noms en dur dans le SQL : un paramètre non typé laisserait
  // Postgres hésiter entre les surcharges (bigint) et (int, int).
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(${sql.raw(String(ANONYMIZATION_LOCK_NAMESPACE))}, hashtext(${categoryId}))`
  );
}

/**
 * Generate unique anonymous code for a product within a category
 * Format: [INITIALS][NUMBER] where INITIALS = first letter of each word in category name (uppercase)
 * and NUMBER is a random number, unique within the category
 *
 * @param db - Database client
 * @param cupId - Inutilisé : le préfixe vient de la catégorie, pas de la cup.
 *   Conservé pour ne pas casser les appelants tant que la signature n'est pas
 *   reprise (voir l'avertissement en tête de fichier).
 * @param categoryId - The category ID for numbering scope
 * @returns Anonymous code like CF23 (Café Filtre), EPA87 (Espresso Pur Arabica), etc.
 */
export async function generateAnonymousCode(
  db: DbClient,
  cupId: string,
  categoryId: string
): Promise<string> {
  await lockCategoryNumbering(db, categoryId);

  // Get category name for prefix
  const category = await db.query.categories.findFirst({
    where: (cat, { eq: eqFn }) => eqFn(cat.id, categoryId),
    columns: { name: true },
  });

  const categoryName = category?.name ?? "X";
  // Take first letter of each word, uppercase, remove accents
  const prefix =
    categoryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z]/g, ""))
      .filter((word) => word.length > 0)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "X";

  // Get existing codes for this category to avoid collisions
  const existingCodes = await db
    .select({
      code: schema.products.anonymousCode,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.categoryId, categoryId),
        sql`${schema.products.anonymousCode} IS NOT NULL`
      )
    );

  const usedCodes = new Set(existingCodes.map((r) => r.code));

  // Plage de tirage élargie dès que la catégorie se remplit. L'ancien repli
  // au-delà de 100 produits incrémentait un compteur (101, 102, …), ce qui
  // révélait l'ordre de confirmation des inscriptions ; le tirage reste
  // uniforme quelle que soit la taille de la catégorie.
  const range = Math.max(100, (usedCodes.size + 1) * 2);

  const freeNumbers: number[] = [];
  for (let num = 1; num <= range; num++) {
    if (!usedCodes.has(`${prefix}${num}`)) {
      freeNumbers.push(num);
    }
  }

  // `range` vaut au moins 2 × (codes pris + 1) : la liste n'est jamais vide.
  const picked = freeNumbers[Math.floor(Math.random() * freeNumbers.length)]!;
  return `${prefix}${picked}`;
}

/**
 * Anonymize all products in a registration
 * Called after payment confirmation (Viva webhook or free registration)
 * Idempotent: skips products that already have an anonymous code
 *
 * @param db - Database client
 * @param registrationId - The registration ID to anonymize products for
 * @returns Array of anonymized product IDs with their codes
 */
export async function anonymizeRegistrationProducts(
  db: DbClient,
  registrationId: string
): Promise<Array<{ productId: string; anonymousCode: string }>> {
  // Get registration with products
  const registration = await db.query.registrations.findFirst({
    where: (reg, { eq: eqFn }) => eqFn(reg.id, registrationId),
    with: {
      products: true,
    },
  });

  if (!registration) {
    console.error(`[Anonymization] Registration ${registrationId} not found`);
    return [];
  }

  const cupId = registration.cupId;
  const anonymizedProducts: Array<{ productId: string; anonymousCode: string }> = [];

  // Anonymize each product that doesn't have a code yet
  for (const product of registration.products) {
    // Skip if already anonymized (idempotence)
    if (product.anonymousCode) {
      console.log(
        `[Anonymization] Product ${product.id} already has code ${product.anonymousCode}`
      );
      continue;
    }

    const anonymousCode = await generateAnonymousCode(db, cupId, product.categoryId);

    await db
      .update(schema.products)
      .set({
        anonymousCode,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, product.id));

    console.log(`[Anonymization] Product ${product.id} assigned code ${anonymousCode}`);
    anonymizedProducts.push({ productId: product.id, anonymousCode });
  }

  return anonymizedProducts;
}

/**
 * Check if a cup has any anonymized products
 *
 * Appelée par `cup.updateAnonymizationPrefix`, qui s'en sert pour refuser un
 * changement de préfixe « trop tard », et couverte par son propre bloc de
 * tests. Ce garde-fou protège un réglage qui n'a aucun effet (voir l'en-tête
 * du fichier) : il partira avec la mutation, le jour où l'on tranchera.
 *
 * @param db - Database client
 * @param cupId - The cup ID to check
 * @returns true if any product in this cup has an anonymous code
 */
export async function hasAnonymizedProducts(
  db: DbClient,
  cupId: string
): Promise<boolean> {
  // Get all categories for this cup
  const categories = await db.query.categories.findMany({
    where: (cat, { eq: eqFn }) => eqFn(cat.cupId, cupId),
    columns: { id: true },
  });

  if (categories.length === 0) {
    return false;
  }

  const categoryIds = categories.map((c) => c.id);

  // Check if any product in these categories has an anonymous code
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.products)
    .where(
      and(
        sql`${schema.products.categoryId} IN (${sql.join(
          categoryIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        sql`${schema.products.anonymousCode} IS NOT NULL`
      )
    );

  return (result[0]?.count ?? 0) > 0;
}
