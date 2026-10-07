/**
 * Anonymization Service
 * Génère les codes anonymes des produits après confirmation du paiement : un
 * code par panel de jury (pro, public), tirés séparément.
 * Format : [INITIALES DE CATÉGORIE][NOMBRE], par exemple CF23 pour « Café Filtre ».
 *
 * Le préfixe vient du nom de la catégorie, pas d'un réglage de la cup : un
 * préfixe unique par cup donnerait à deux produits de catégories différentes
 * des codes voisins (A1, A2, …), alors que les initiales de catégorie disent
 * au juré de quel classement relève l'échantillon qu'il a en main.
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

/** Initiales du nom de catégorie, sans accents : « Café Filtre » -> « CF ». */
function categoryPrefix(categoryName: string): string {
  return (
    categoryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z]/g, ""))
      .filter((word) => word.length > 0)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "X"
  );
}

/**
 * Codes déjà pris dans une catégorie, TOUS PANELS CONFONDUS : un même code ne
 * désigne jamais deux échantillons différents en réception, même si chaque
 * juré ne voit que les codes de son panel.
 */
async function usedCodesInCategory(db: DbClient, categoryId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      pro: schema.products.anonymousCodePro,
      public: schema.products.anonymousCodePublic,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.categoryId, categoryId),
        sql`(${schema.products.anonymousCodePro} IS NOT NULL OR ${schema.products.anonymousCodePublic} IS NOT NULL)`
      )
    );

  const used = new Set<string>();
  for (const row of rows) {
    if (row.pro) used.add(row.pro);
    if (row.public) used.add(row.public);
  }
  return used;
}

/** Tire un code libre, uniformément, et le marque comme pris dans `used`. */
function drawCode(prefix: string, used: Set<string>): string {
  // Plage de tirage élargie dès que la catégorie se remplit. L'ancien repli
  // au-delà de 100 produits incrémentait un compteur (101, 102, …), ce qui
  // révélait l'ordre de confirmation des inscriptions ; le tirage reste
  // uniforme quelle que soit la taille de la catégorie.
  const range = Math.max(100, (used.size + 1) * 2);

  const freeNumbers: number[] = [];
  for (let num = 1; num <= range; num++) {
    if (!used.has(`${prefix}${num}`)) {
      freeNumbers.push(num);
    }
  }

  // `range` vaut au moins 2 × (codes pris + 1) : la liste n'est jamais vide.
  const picked = freeNumbers[Math.floor(Math.random() * freeNumbers.length)]!;
  const code = `${prefix}${picked}`;
  used.add(code);
  return code;
}

export interface PanelCodes {
  pro: string;
  public: string;
}

/**
 * Tire les deux codes anonymes d'un produit, un par panel de jury.
 * Format : [INITIALES DE CATÉGORIE][NOMBRE], ex. CF23 pour « Café Filtre ».
 * Les deux nombres sont tirés indépendamment : rien ne permet de déduire le
 * code public d'un produit de son code pro.
 *
 * À appeler dans une transaction : le verrou de catégorie n'y tient que
 * jusqu'au commit.
 */
export async function generateAnonymousCodes(
  db: DbClient,
  categoryId: string
): Promise<PanelCodes> {
  await lockCategoryNumbering(db, categoryId);

  const category = await db.query.categories.findFirst({
    where: (cat, { eq: eqFn }) => eqFn(cat.id, categoryId),
    columns: { name: true },
  });

  const prefix = categoryPrefix(category?.name ?? "X");
  const used = await usedCodesInCategory(db, categoryId);

  return { pro: drawCode(prefix, used), public: drawCode(prefix, used) };
}

/**
 * Anonymise tous les produits d'une inscription : deux codes par produit.
 * Appelé à la confirmation du paiement (webhook Viva ou inscription gratuite).
 * Idempotent : un code déjà posé n'est jamais remplacé, seul le manquant est
 * tiré.
 *
 * @returns les produits anonymisés et leurs codes
 */
export async function anonymizeRegistrationProducts(
  db: DbClient,
  registrationId: string
): Promise<Array<{ productId: string; codes: PanelCodes }>> {
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

  const anonymizedProducts: Array<{ productId: string; codes: PanelCodes }> = [];

  for (const product of registration.products) {
    if (product.anonymousCodePro && product.anonymousCodePublic) {
      continue;
    }

    const drawn = await generateAnonymousCodes(db, product.categoryId);
    const codes: PanelCodes = {
      pro: product.anonymousCodePro ?? drawn.pro,
      public: product.anonymousCodePublic ?? drawn.public,
    };

    await db
      .update(schema.products)
      .set({
        anonymousCodePro: codes.pro,
        anonymousCodePublic: codes.public,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, product.id));

    console.log(
      `[Anonymization] Product ${product.id} assigned codes pro=${codes.pro} public=${codes.public}`
    );
    anonymizedProducts.push({ productId: product.id, codes });
  }

  return anonymizedProducts;
}
