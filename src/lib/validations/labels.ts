import { z } from "zod";
import type { RatingScale } from "~/server/db/schema/cups";

// Shared validation schemas for cup labels
// Used by both router and form components

/**
 * Label range interface for overlap validation
 */
export interface LabelRange {
  id?: string;
  name: string;
  minScore: number;
  maxScore: number | null; // null = no upper limit
}

/**
 * ⚠️ IMPORTANT: Labels are 100% CUSTOMIZABLE
 * These defaults are just SUGGESTIONS that organizers can modify completely.
 * Organizers can create any labels they want: "Excellence", "Coup de Cœur", etc.
 */

/**
 * Default label suggestions for scale 0-5 (étoiles)
 */
export const DEFAULT_LABELS_5 = [
  { name: "Mention", minScore: 3, maxScore: 3, color: "#CD7F32", sortOrder: 0, icon: null, condition: "Score ≥ 3/5", isPublic: true },
  { name: "Médaille", minScore: 4, maxScore: 4, color: "#C0C0C0", sortOrder: 1, icon: null, condition: "Score ≥ 4/5", isPublic: true },
  { name: "Excellence", minScore: 5, maxScore: null, color: "#FFD700", sortOrder: 2, icon: null, condition: "Score = 5/5", isPublic: true },
] as const;

/**
 * Default label suggestions for scale 0-10 (décimal)
 */
export const DEFAULT_LABELS_10 = [
  { name: "Mention", minScore: 5, maxScore: 6, color: "#CD7F32", sortOrder: 0, icon: null, condition: "Score ≥ 5/10", isPublic: true },
  { name: "Médaille", minScore: 7, maxScore: 8, color: "#C0C0C0", sortOrder: 1, icon: null, condition: "Score ≥ 7/10", isPublic: true },
  { name: "Excellence", minScore: 9, maxScore: null, color: "#FFD700", sortOrder: 2, icon: null, condition: "Score ≥ 9/10", isPublic: true },
] as const;

/**
 * Default label suggestions for scale 0-20 (vingtième)
 */
export const DEFAULT_LABELS_20 = [
  { name: "Mention", minScore: 10, maxScore: 13, color: "#CD7F32", sortOrder: 0, icon: null, condition: "Score ≥ 10/20", isPublic: true },
  { name: "Médaille", minScore: 14, maxScore: 16, color: "#C0C0C0", sortOrder: 1, icon: null, condition: "Score ≥ 14/20", isPublic: true },
  { name: "Excellence", minScore: 17, maxScore: null, color: "#FFD700", sortOrder: 2, icon: null, condition: "Score ≥ 17/20", isPublic: true },
] as const;

/**
 * Default label suggestions for scale 0-100 (pourcentage)
 */
export const DEFAULT_LABELS_100 = [
  { name: "Mention", minScore: 50, maxScore: 69, color: "#CD7F32", sortOrder: 0, icon: null, condition: "Score ≥ 50%", isPublic: true },
  { name: "Médaille", minScore: 70, maxScore: 84, color: "#C0C0C0", sortOrder: 1, icon: null, condition: "Score ≥ 70%", isPublic: true },
  { name: "Excellence", minScore: 85, maxScore: null, color: "#FFD700", sortOrder: 2, icon: null, condition: "Score ≥ 85%", isPublic: true },
] as const;

/**
 * Get default labels based on rating scale
 */
export function getDefaultLabels(ratingScale: RatingScale) {
  switch (ratingScale) {
    case "0-5": return DEFAULT_LABELS_5;
    case "0-10": return DEFAULT_LABELS_10;
    case "0-20": return DEFAULT_LABELS_20;
    case "0-100": return DEFAULT_LABELS_100;
    default: return DEFAULT_LABELS_20;
  }
}

/**
 * ========================================
 * CENTRALIZED RATING SCALE CONFIGURATION
 * ========================================
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for rating scales!
 *
 * DO NOT create scaleMap or similar objects elsewhere in the codebase.
 * Always import and use these functions:
 * - getMaxScoreForScale(ratingScale) - Get max value for a scale
 * - convertScoreToScale(score, ratingScale) - Convert 0-100 to scale
 * - formatScoreForScale(score, ratingScale) - Get formatted string "X/Y"
 *
 * If you see any `scaleMap` variable elsewhere, it's LEGACY CODE that
 * should be refactored to use these centralized functions.
 *
 * Valid rating scales must match the RatingScale type from schema/cups.ts:
 * - "0-5": 5-star scale
 * - "0-10": Decimal scale
 * - "0-20": Vingtième scale (French grading)
 * - "0-100": Percentage scale
 */
export const RATING_SCALE_MAP: Record<string, number> = {
  "0-5": 5,
  "0-10": 10,
  "0-20": 20,
  "0-100": 100,
} as const;

/**
 * Get max score value for a rating scale
 *
 * @param ratingScale The rating scale string
 * @returns The maximum value for that scale
 * @throws Console warning if scale is not recognized (returns 100 as safe default)
 */
export function getMaxScoreForScale(ratingScale: RatingScale | string | null | undefined): number {
  if (!ratingScale) {
    console.warn(`[SCORE WARNING] No rating scale provided, using 100 as default`);
    return 100;
  }

  const max = RATING_SCALE_MAP[ratingScale];
  if (max === undefined) {
    console.error(`[SCORE ERROR] Unknown rating scale "${ratingScale}" - this is a bug! Valid scales: ${Object.keys(RATING_SCALE_MAP).join(", ")}`);
    // Return 100 (percentage) as the safest default - scores are stored as 0-100
    return 100;
  }

  return max;
}

/**
 * Check if a rating scale is valid
 */
export function isValidRatingScale(ratingScale: string | null | undefined): ratingScale is RatingScale {
  return ratingScale !== null && ratingScale !== undefined && ratingScale in RATING_SCALE_MAP;
}

/**
 * Format score for display in the organizer's chosen scale
 * Scores are stored in the original scale defined by the organizer
 *
 * @param score The stored score (in the cup's scale)
 * @param ratingScale The cup's rating scale ("0-5", "0-10", "0-20", "0-100")
 * @returns Formatted string like "8.5/10" or "17.0/20"
 */
export function formatScoreForScale(
  score: number | null | undefined,
  ratingScale: RatingScale
): string {
  if (score === null || score === undefined) {
    return "N/A";
  }

  const maxScale = getMaxScoreForScale(ratingScale);
  // Score is already in the correct scale, just format it
  return `${score.toFixed(1)}/${maxScale}`;
}

/**
 * Get score value (scores are stored in the original scale)
 * Use this when you need just the numeric value, not formatted string
 *
 * @param score The stored score (already in the cup's scale)
 * @param ratingScale The cup's rating scale (e.g., "0-10", "0-20") - kept for API compatibility
 * @returns The score as-is (already in the cup's scale)
 */
export function convertScoreToScale(
  score: number | null | undefined,
  ratingScale: RatingScale | string | null | undefined
): number | null {
  if (score === null || score === undefined) {
    return null;
  }

  // Score is already in the correct scale, return as-is
  return score;
}

// Legacy export for backwards compatibility
export const DEFAULT_LABELS = DEFAULT_LABELS_10;

/**
 * Predefined color palette for simplified label color selection
 */
export const LABEL_COLOR_PALETTE = [
  { name: "Bronze", hex: "#CD7F32" },
  { name: "Argent", hex: "#C0C0C0" },
  { name: "Or", hex: "#FFD700" },
  { name: "Platine", hex: "#E5E4E2" },
  { name: "Bleu", hex: "#3B82F6" },
  { name: "Vert", hex: "#22C55E" },
  { name: "Rouge", hex: "#EF4444" },
  { name: "Violet", hex: "#8B5CF6" },
] as const;

// Hex color regex pattern
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/**
 * Schema for creating a new label
 * Includes refinement to ensure minScore < maxScore
 * Supports decimal scores (1 decimal place) for precise ranges
 */
export const createLabelSchema = z
  .object({
    cupId: z.string().min(1, "Cup ID requis"),
    name: z
      .string()
      .min(1, "Nom du label requis")
      .max(50, "Nom trop long (max 50 caractères)"),
    minScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100"),
    maxScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100")
      .nullable()
      .optional(),
    color: z
      .string()
      .regex(hexColorRegex, "Couleur hex invalide (format: #RRGGBB)")
      .optional(),
    icon: z
      .string()
      .max(500, "URL icône trop longue (max 500 caractères)")
      .nullable()
      .optional(),
    condition: z
      .string()
      .max(100, "Condition trop longue (max 100 caractères)")
      .nullable()
      .optional(),
    isPublic: z.boolean().optional().default(true),
  })
  .refine(
    (data) =>
      data.maxScore === null ||
      data.maxScore === undefined ||
      data.minScore < data.maxScore,
    {
      message: "Le score minimum doit être inférieur au score maximum",
      path: ["maxScore"],
    }
  );

/**
 * Schema for updating an existing label
 * Supports decimal scores (1 decimal place) for precise ranges
 */
export const updateLabelSchema = z
  .object({
    labelId: z.string().min(1, "Label ID requis"),
    name: z
      .string()
      .min(1, "Nom du label requis")
      .max(50, "Nom trop long (max 50 caractères)")
      .optional(),
    minScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100")
      .optional(),
    maxScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100")
      .nullable()
      .optional(),
    color: z
      .string()
      .regex(hexColorRegex, "Couleur hex invalide (format: #RRGGBB)")
      .nullable()
      .optional(),
    icon: z
      .string()
      .max(500, "URL icône trop longue (max 500 caractères)")
      .nullable()
      .optional(),
    condition: z
      .string()
      .max(100, "Condition trop longue (max 100 caractères)")
      .nullable()
      .optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Only validate if both minScore and maxScore are provided
      if (data.minScore === undefined || data.maxScore === undefined) {
        return true;
      }
      return (
        data.maxScore === null || data.minScore < data.maxScore
      );
    },
    {
      message: "Le score minimum doit être inférieur au score maximum",
      path: ["maxScore"],
    }
  );

/**
 * Schema for reordering labels
 */
export const reorderLabelsSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  labelIds: z.array(z.string()).min(1, "Au moins un label requis"),
});

/**
 * Form-specific schema (without cupId, added by page)
 * Supports decimal scores (1 decimal place) for precise ranges
 */
export const labelFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nom du label requis")
      .max(50, "Nom trop long (max 50 caractères)"),
    minScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100"),
    maxScore: z
      .number()
      .min(0, "Score minimum: 0")
      .max(100, "Score maximum: 100")
      .nullable(),
    color: z
      .string()
      .regex(hexColorRegex, "Couleur hex invalide")
      .nullable(),
    icon: z
      .string()
      .max(500, "URL icône trop longue")
      .nullable(),
    condition: z
      .string()
      .max(100, "Condition trop longue")
      .nullable(),
    isPublic: z.boolean().default(true),
  })
  .refine((data) => data.maxScore === null || data.minScore < data.maxScore, {
    message: "Le score minimum doit être inférieur au score maximum",
    path: ["maxScore"],
  });

/**
 * Check if two label ranges overlap (inclusive bounds)
 * maxScore null means "up to scale max"
 *
 * Overlap = at least one common point
 * Adjacent OK: 7-8.49 and 8.5-10 (no common point)
 *
 * @param a First label range
 * @param b Second label range
 * @param scaleMax Maximum value of the rating scale (10 or 20)
 * @returns true if ranges overlap
 */
export function rangesOverlap(a: LabelRange, b: LabelRange, scaleMax: number = 10): boolean {
  const aMax = a.maxScore ?? scaleMax;
  const bMax = b.maxScore ?? scaleMax;

  // No overlap if one range ends STRICTLY before the other starts
  // aMax < b.minScore means: last point of A is before first point of B
  return !(aMax < b.minScore || bMax < a.minScore);
}

/**
 * Validate that a new/updated label doesn't overlap with existing labels
 *
 * @param existingLabels Array of existing labels
 * @param newLabel The new or updated label to validate
 * @param scaleMax Maximum value of the rating scale (10 or 20)
 * @returns { valid: true } or { valid: false, conflictWith: "Name of conflicting label" }
 */
export function validateLabelRanges(
  existingLabels: LabelRange[],
  newLabel: LabelRange,
  scaleMax: number = 10
): { valid: boolean; conflictWith?: string } {
  for (const existing of existingLabels) {
    // Skip if comparing the same label (for update operations)
    if (existing.id && existing.id === newLabel.id) continue;

    if (rangesOverlap(existing, newLabel, scaleMax)) {
      return { valid: false, conflictWith: existing.name };
    }
  }
  return { valid: true };
}

/**
 * Format a score for display (removes unnecessary decimals)
 * @param score The score to format
 * @returns Formatted string like "3" or "3.5"
 */
function formatScore(score: number): string {
  // If score is a whole number, show without decimals
  if (Number.isInteger(score)) {
    return score.toString();
  }
  // Otherwise show with 1 decimal
  return score.toFixed(1);
}

/**
 * Format a label range for display
 * @param minScore Minimum score (supports decimals)
 * @param maxScore Maximum score (null for no upper limit, supports decimals)
 * @returns Formatted string like "3-3.9 pts" or "17+ pts"
 */
export function formatLabelRange(
  minScore: number,
  maxScore: number | null
): string {
  if (maxScore === null) {
    return `${formatScore(minScore)}+ pts`;
  }
  return `${formatScore(minScore)}-${formatScore(maxScore)} pts`;
}

// Type exports
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type ReorderLabelsInput = z.infer<typeof reorderLabelsSchema>;
export type LabelFormData = z.infer<typeof labelFormSchema>;
