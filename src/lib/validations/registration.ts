import { z } from "zod";

/**
 * Registration status enum values
 */
export const registrationStatusEnum = [
  "pending_payment",
  "confirmed",
  "cancelled",
] as const;

/**
 * Product status enum values
 * Must match src/server/db/schema/products.ts productStatusEnum
 */
export const productStatusEnum = ["pending", "received", "rating", "rated"] as const;

/**
 * Schema for starting a registration
 */
export const startRegistrationSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
});

/**
 * Schema for adding a product to a registration
 */
export const addProductSchema = z.object({
  registrationId: z.string().min(1, "Registration ID requis"),
  categoryId: z.string().min(1, "Category ID requis"),
  name: z.string().min(1, "Nom du produit requis").max(200, "Nom trop long"),
  description: z.string().max(1000, "Description trop longue").optional(),
});

/**
 * Schema for updating a product
 */
export const updateProductSchema = z.object({
  productId: z.string().min(1, "Product ID requis"),
  name: z.string().min(1, "Nom du produit requis").max(200, "Nom trop long").optional(),
  description: z.string().max(1000, "Description trop longue").optional(),
});

/**
 * Schema for removing a product
 */
export const removeProductSchema = z.object({
  productId: z.string().min(1, "Product ID requis"),
});

/**
 * Schema for getting registration by ID
 */
export const getRegistrationSchema = z.object({
  registrationId: z.string().min(1, "Registration ID requis"),
});

/**
 * Schema for getting or creating registration for a cup
 */
export const getOrCreateRegistrationSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
});

/**
 * Schema for listing registrations by cup (organizer view)
 * Includes optional filters for status, category, and date range
 */
export const listByCupSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  status: z.enum(["pending_payment", "confirmed", "cancelled"]).optional(),
  categoryId: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

// Type exports
export type StartRegistrationInput = z.infer<typeof startRegistrationSchema>;
export type AddProductInput = z.infer<typeof addProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type RemoveProductInput = z.infer<typeof removeProductSchema>;
export type GetRegistrationInput = z.infer<typeof getRegistrationSchema>;
export type GetOrCreateRegistrationInput = z.infer<typeof getOrCreateRegistrationSchema>;
export type ListByCupInput = z.infer<typeof listByCupSchema>;
