import { z } from "zod";

// Shared validation schemas for categories
// Used by both router and form components

// Quota d'inscription : entier strictement positif, ou null pour « illimité ».
const quotaSchema = z
  .number()
  .int("Nombre entier attendu")
  .positive("Doit être supérieur à 0")
  .max(10000)
  .nullable();

// Champ de formulaire : vide = illimité.
const quotaFieldSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined || Number.isNaN(val) ? null : Number(val)),
  quotaSchema
);

export const createCategorySchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  name: z
    .string()
    .min(2, "Le nom doit faire au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional(),
  maxProducts: quotaSchema.optional(),
  maxProductsPerProducer: quotaSchema.optional(),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  maxProducts: quotaSchema.optional(),
  maxProductsPerProducer: quotaSchema.optional(),
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
  maxProducts: quotaFieldSchema,
  maxProductsPerProducer: quotaFieldSchema,
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CategoryFormData = z.output<typeof categoryFormSchema>;
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
