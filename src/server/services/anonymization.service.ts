/**
 * Anonymization Service
 * Generates unique anonymous codes for products after payment confirmation
 * Format: #[PREFIX][NUMBER] where PREFIX is configurable per cup (A-Z)
 * and NUMBER auto-increments per category
 */

import { eq, and, sql } from "drizzle-orm";
import { db as defaultDb } from "~/server/db";
import * as schema from "~/server/db/schema";

type DbClient = typeof defaultDb;

/**
 * Generate unique anonymous code for a product within a category
 * Format: [INITIALS][NUMBER] where INITIALS = first letter of each word in category name (uppercase)
 * and NUMBER is a random number between 1 and 100, unique within the category
 *
 * @param db - Database client
 * @param cupId - The cup ID (unused, kept for API compatibility)
 * @param categoryId - The category ID for numbering scope
 * @returns Anonymous code like CF23 (Café Filtre), EPA87 (Espresso Pur Arabica), etc.
 */
export async function generateAnonymousCode(
  db: DbClient,
  cupId: string,
  categoryId: string
): Promise<string> {
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

  // Try random numbers 1-100 until we find an unused one
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const num = Math.floor(Math.random() * 100) + 1; // 1 to 100
    const code = `${prefix}${num}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }

  // Fallback: all 1-100 taken, extend range
  let fallback = 101;
  while (usedCodes.has(`${prefix}${fallback}`)) {
    fallback++;
  }
  return `${prefix}${fallback}`;
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
 * Used to prevent changing anonymization prefix after products are anonymized
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
