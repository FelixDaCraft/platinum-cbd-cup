import { z } from "zod";

/**
 * Schema for creating a new rating criterion
 */
export const createCriterionSchema = z.object({
  categoryId: z.string().min(1, "Category ID requis"),
  name: z.string().min(1, "Nom du critère requis").max(100, "Nom trop long (max 100 caractères)"),
  description: z.string().max(500, "Description trop longue (max 500 caractères)").optional(),
  coefficient: z
    .number()
    .int("Le coefficient doit être un entier")
    .min(1, "Coefficient minimum: 1")
    .max(10, "Coefficient maximum: 10")
    .default(1),
});

/**
 * Schema for updating an existing rating criterion
 */
export const updateCriterionSchema = z
  .object({
    criterionId: z.string().min(1, "Criterion ID requis"),
    name: z.string().min(1, "Nom du critère requis").max(100, "Nom trop long (max 100 caractères)").optional(),
    description: z.string().max(500, "Description trop longue (max 500 caractères)").nullish(),
    coefficient: z
      .number()
      .int("Le coefficient doit être un entier")
      .min(1, "Coefficient minimum: 1")
      .max(10, "Coefficient maximum: 10")
      .optional(),
  });

/**
 * Schema for reordering criteria within a category
 */
export const reorderCriteriaSchema = z.object({
  categoryId: z.string().min(1, "Category ID requis"),
  criterionIds: z.array(z.string()).min(1, "Au moins un critère requis"),
});

/**
 * Schema for duplicating criteria from one category to another
 */
export const duplicateCriteriaSchema = z.object({
  sourceCategoryId: z.string().min(1, "Source category ID requis"),
  targetCategoryId: z.string().min(1, "Target category ID requis"),
});

/**
 * Schema for initializing default criteria
 */
export const initializeDefaultCriteriaSchema = z.object({
  categoryId: z.string().min(1, "Category ID requis"),
});

/**
 * Schema for importing criteria from another cup (cross-cup, same organization)
 */
export const importCriteriaFromCupSchema = z.object({
  targetCategoryId: z.string().min(1, "Target category ID requis"),
  criteriaIds: z.array(z.string()).min(1, "Au moins un critère à importer"),
});

/**
 * Default criteria for new categories
 * These are typical evaluation criteria for product competitions
 */
export const DEFAULT_CRITERIA = [
  { name: "Aspect visuel", description: "Apparence générale du produit", coefficient: 1 },
  { name: "Arôme", description: "Odeurs et parfums", coefficient: 2 },
  { name: "Goût", description: "Saveurs en bouche", coefficient: 2 },
  { name: "Effet", description: "Ressenti global", coefficient: 2 },
] as const;

/**
 * Type for a default criterion
 */
export type DefaultCriterion = (typeof DEFAULT_CRITERIA)[number];

/**
 * Helper function to format coefficient display
 */
export function formatCoefficient(coefficient: number): string {
  return `×${coefficient}`;
}

/**
 * Calculate weighted score from ratings
 * Score = Σ(note × coefficient) / Σ(coefficients)
 */
export function calculateWeightedScore(
  ratings: Array<{ criterionCoefficient: number; score: number }>
): number {
  if (ratings.length === 0) return 0;

  const totalWeighted = ratings.reduce(
    (sum, r) => sum + r.score * r.criterionCoefficient,
    0
  );
  const totalCoefficients = ratings.reduce(
    (sum, r) => sum + r.criterionCoefficient,
    0
  );

  if (totalCoefficients === 0) return 0;

  return totalWeighted / totalCoefficients;
}
