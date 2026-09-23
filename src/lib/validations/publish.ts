import type { db as dbType } from "~/server/db";

/**
 * Result of pre-publication validation
 */
export interface PublishValidationResult {
  canPublish: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate if a cup can be published
 * Requirements (errors - block publication):
 * - At least one category must exist
 * - At least one rating criterion must exist (in any category)
 *
 * Warnings (non-blocking):
 * - Payment processor not configured
 *
 * @param cupId - The cup ID to validate
 * @param db - Database instance
 * @returns Validation result with canPublish flag, errors, and warnings
 */
export async function canPublishCup(
  cupId: string,
  db: typeof dbType,
  /**
   * Whether the payment processor is configured. Passed in by the caller so
   * this stays a pure validation function with no environment access.
   */
  paymentConfigured = false
): Promise<PublishValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get cup data to check payment configuration
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq }) => eq(cups.id, cupId),
  });

  // Check for categories
  const categories = await db.query.categories.findMany({
    where: (categories, { eq }) => eq(categories.cupId, cupId),
  });

  if (categories.length === 0) {
    errors.push("Au moins une catégorie est requise");
  }

  // Check for rating criteria (in any of the cup's categories)
  if (categories.length > 0) {
    const categoryIds = categories.map((c) => c.id);

    const criteria = await db.query.ratingCriteria.findFirst({
      where: (ratingCriteria, { inArray }) =>
        inArray(ratingCriteria.categoryId, categoryIds),
    });

    if (!criteria) {
      errors.push("Au moins un critère de notation est requis");
    }
  }

  // Check payment configuration (warning, not blocking).
  // Payments are configured globally through the VIVA_* environment
  // variables, not per cup — only warn when the cup actually charges.
  if (cup && cup.defaultPricePerProduct && cup.defaultPricePerProduct > 0) {
    if (!paymentConfigured) {
      warnings.push("Aucun processeur de paiement configuré. Les paiements ne fonctionneront pas.");
    }
  }

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
  };
}
