/**
 * Cup-specific helpers
 * Single-tenant: no organization scoping.
 */

import { TRPCError } from "@trpc/server";
import { ERROR_MESSAGES } from "~/lib/errors";
import type { db as dbType } from "~/server/db";
import * as schema from "~/server/db/schema";

type DB = typeof dbType;

// ============================================
// TYPES
// ============================================

export type Cup = typeof schema.cups.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type Product = typeof schema.products.$inferSelect;
export type Registration = typeof schema.registrations.$inferSelect;

// ============================================
// CUP HELPERS
// ============================================

/**
 * Get cup by ID
 * @throws NOT_FOUND if cup doesn't exist
 */
export async function getCupOrThrow(db: DB, cupId: string): Promise<Cup> {
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq }) => eq(cups.id, cupId),
  });

  if (!cup) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.CUP_NOT_FOUND,
    });
  }

  return cup;
}

/**
 * Get cup by ID (public access)
 * Only returns non-draft cups
 * @throws NOT_FOUND if cup doesn't exist or is in draft status
 */
export async function getPublicCupOrThrow(db: DB, cupId: string): Promise<Cup> {
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq }) => eq(cups.id, cupId),
  });

  if (!cup || cup.status === "draft") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.CUP_NOT_FOUND,
    });
  }

  return cup;
}

/**
 * Verify cup status allows specific operation
 */
export function requireCupStatus(
  cup: Cup,
  allowedStatuses: Cup["status"][],
  errorMessage: string
): void {
  if (!allowedStatuses.includes(cup.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errorMessage,
    });
  }
}

// ============================================
// CATEGORY HELPERS
// ============================================

/**
 * Get category by ID with cup verification
 * @throws NOT_FOUND if category doesn't exist or doesn't belong to cup
 */
export async function getCategoryOrThrow(
  db: DB,
  categoryId: string,
  cupId: string
): Promise<Category> {
  const category = await db.query.categories.findFirst({
    where: (categories, { eq, and }) =>
      and(eq(categories.id, categoryId), eq(categories.cupId, cupId)),
  });

  if (!category) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.CATEGORY_NOT_FOUND,
    });
  }

  return category;
}

// ============================================
// PRODUCT HELPERS
// ============================================

/**
 * Get product by ID
 * @throws NOT_FOUND if product doesn't exist
 */
export async function getProductOrThrow(
  db: DB,
  productId: string
): Promise<Product> {
  const product = await db.query.products.findFirst({
    where: (products, { eq }) => eq(products.id, productId),
  });

  if (!product) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
    });
  }

  return product;
}

// ============================================
// REGISTRATION HELPERS
// ============================================

/**
 * Get registration by ID with optional cup verification
 */
export async function getRegistrationOrThrow(
  db: DB,
  registrationId: string,
  cupId?: string
): Promise<Registration> {
  const registration = await db.query.registrations.findFirst({
    where: cupId
      ? (reg, { eq, and }) =>
          and(eq(reg.id, registrationId), eq(reg.cupId, cupId))
      : (reg, { eq }) => eq(reg.id, registrationId),
  });

  if (!registration) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.REGISTRATION_NOT_FOUND,
    });
  }

  return registration;
}
