import { z } from "zod";

// Shared validation schemas for categories
// Used by both router and form components

export const createCategorySchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  name: z
    .string()
    .min(2, "Le nom doit faire au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional(),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const reorderCategoriesSchema = z.object({
  cupId: z.string().min(1),
  categoryIds: z.array(z.string()).min(1, "Au moins une catégorie requise"),
});

// Form-specific schema (without cupId, added by page)
export const categoryFormSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit faire au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .transform((val) => val || undefined), // Convert empty string to undefined
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CategoryFormData = z.infer<typeof categoryFormSchema>;
