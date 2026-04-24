import { z } from "zod";

// Import and re-export types from schema to avoid duplication
import {
  cupTypeEnum,
  cupStatusEnum,
  ratingScaleEnum,
  type CupType,
  type CupStatus,
  type RatingScale,
} from "~/server/db/schema/cups";

export { cupTypeEnum, cupStatusEnum, ratingScaleEnum, type CupType, type CupStatus, type RatingScale };

/**
 * Shared Zod schema for cup creation
 * Used by both frontend form and backend router
 */
export const createCupSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom doit faire au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  type: z.enum(cupTypeEnum),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional(),
  ratingScale: z.enum(ratingScaleEnum),
});

export type CreateCupInput = z.infer<typeof createCupSchema>;

/**
 * Shared Zod schema for cup update
 */
export const updateCupSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(3, "Le nom doit faire au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .nullable()
    .optional(),
  ratingScale: z.enum(ratingScaleEnum).optional(),
});

export type UpdateCupInput = z.infer<typeof updateCupSchema>;

/**
 * Rating scale labels for UI display
 */
export const ratingScaleLabels: Record<RatingScale, string> = {
  "0-5": "Notes sur 5 (étoiles)",
  "0-10": "Notes sur 10 (décimal)",
  "0-20": "Notes sur 20 (vingtième)",
  "0-100": "Notes sur 100 (pourcentage)",
};

/**
 * Get min/max values from rating scale
 */
export function getRatingScaleValues(scale: RatingScale): { min: number; max: number } {
  switch (scale) {
    case "0-5":
      return { min: 0, max: 5 };
    case "0-10":
      return { min: 0, max: 10 };
    case "0-20":
      return { min: 0, max: 20 };
    case "0-100":
      return { min: 0, max: 100 };
    default:
      return { min: 0, max: 20 };
  }
}

/**
 * Status label mapping for UI display
 * Shared between cups list and detail pages
 */
export const cupStatusLabels: Record<
  CupStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Brouillon", variant: "secondary" },
  published: { label: "Publiée", variant: "default" },
  registration_closed: { label: "Inscriptions fermées", variant: "outline" },
  rating: { label: "Notation en cours", variant: "default" },
  completed: { label: "Terminée", variant: "outline" },
};

/**
 * Get status label info with fallback for unknown status
 */
export function getStatusLabel(status: string) {
  return (
    cupStatusLabels[status as CupStatus] ?? {
      label: status,
      variant: "outline" as const,
    }
  );
}
