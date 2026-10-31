import { z } from "zod";
import { juryPanelEnum } from "~/lib/enums";

/** Jury qui note un critère : chaque jury a sa propre grille. */
export const criterionPanelSchema = z.enum(juryPanelEnum);

/**
 * Schema for creating a new rating criterion
 */
export const createCriterionSchema = z.object({
  categoryId: z.string().min(1, "Category ID requis"),
  panel: criterionPanelSchema,
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
    /** Déplacer le critère vers l'autre jury (avant la notation uniquement). */
    panel: criterionPanelSchema.optional(),
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
  /** L'ordre se règle jury par jury. */
  panel: criterionPanelSchema,
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
  /** Jury à initialiser ; sans précision, les deux jurys sans critère. */
  panel: criterionPanelSchema.optional(),
});

/**
 * Schema for importing criteria from another cup (cross-cup, same organization)
 */
export const importCriteriaFromCupSchema = z.object({
  targetCategoryId: z.string().min(1, "Target category ID requis"),
  /** Jury de destination des critères importés. */
  panel: criterionPanelSchema,
  criteriaIds: z.array(z.string()).min(1, "Au moins un critère à importer"),
});

/**
 * Grilles proposées par défaut à une catégorie vide, une par jury. Elles
 * reprennent la grille réelle des fleurs : le jury pro note la qualité
 * technique (9 critères), le jury public une grille allégée (5 critères).
 * L'effet n'est pas un critère. L'organisateur ajuste ensuite (pour le hash,
 * couleur et texture remplacent trim et trichomes).
 */
export const DEFAULT_CRITERIA = {
  pro: [
    { name: "VISUEL trim", description: "Qualité de la manucure.", coefficient: 1 },
    { name: "VISUEL trichomes", description: "Quantité et état des trichomes (abîmés, couleur…).", coefficient: 1 },
    { name: "VISUEL général", description: "Présence ou absence de corps étrangers, moisissures, insectes, graines…", coefficient: 2 },
    { name: "ODEUR puissance", description: "Puissance de l'odeur.", coefficient: 1 },
    { name: "ODEUR qualité", description: "Odeur agréable, homogène…", coefficient: 1 },
    { name: "ODEUR originalité", description: "Déjà senti une fleur similaire ou odeur totalement nouvelle.", coefficient: 2 },
    { name: "GOÛT qualité", description: "Goût agréable, homogène…", coefficient: 2 },
    { name: "GOÛT fidélité", description: "Fidèle à l'odeur.", coefficient: 2 },
    { name: "GOÛT persistance", description: "Reste en bouche.", coefficient: 2 },
  ],
  public: [
    { name: "VISUEL général", description: "Présence ou absence de corps étrangers, moisissures… Résineuse ou non.", coefficient: 1 },
    { name: "ODEUR puissance", description: "Puissance de l'odeur.", coefficient: 1 },
    { name: "ODEUR originalité", description: "Déjà senti une fleur similaire ou odeur nouvelle.", coefficient: 2 },
    { name: "GOÛT puissance", description: "Puissance du goût.", coefficient: 2 },
    { name: "GOÛT originalité", description: "Déjà goûté une fleur similaire ou goût nouveau.", coefficient: 2 },
  ],
} as const satisfies Record<
  "pro" | "public",
  readonly { name: string; description: string; coefficient: number }[]
>;

/**
 * Type for a default criterion
 */
export type DefaultCriterion = (typeof DEFAULT_CRITERIA)[keyof typeof DEFAULT_CRITERIA][number];

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
