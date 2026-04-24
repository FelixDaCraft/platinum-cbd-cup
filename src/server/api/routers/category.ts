import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, max, asc, count, inArray } from "drizzle-orm";

import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import { Errors } from "~/lib/errors";
import * as schema from "~/server/db/schema";
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from "~/lib/validations/category";

export const categoryRouter = createTRPCRouter({
  /**
   * Create a new category for a cup
   */
  create: organizerProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });
      if (!cup) Errors.cupNotFound();

      // Calculate next sortOrder
      const maxOrderResult = await ctx.db
        .select({ maxOrder: max(schema.categories.sortOrder) })
        .from(schema.categories)
        .where(eq(schema.categories.cupId, input.cupId));
      const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

      const categoryId = nanoid();
      const [category] = await ctx.db
        .insert(schema.categories)
        .values({
          id: categoryId,
          cupId: input.cupId,
          name: input.name,
          description: input.description ?? null,
          sortOrder: nextOrder,
        })
        .returning();

      return category;
    }),

  /**
   * List all categories for a cup (sorted by sortOrder)
   */
  list: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });
      if (!cup) Errors.cupNotFound();

      const categories = await ctx.db.query.categories.findMany({
        where: (categories, { eq: eqFn }) => eqFn(categories.cupId, input.cupId),
        orderBy: (categories) => [asc(categories.sortOrder)],
      });

      return categories;
    }),

  /**
   * Update a category
   */
  update: organizerProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.query.categories.findFirst({
        where: (categories, { eq: eqFn }) => eqFn(categories.id, input.id),
      });
      if (!category) Errors.categoryNotFound();

      const updateData: Partial<typeof schema.categories.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      const [updated] = await ctx.db
        .update(schema.categories)
        .set(updateData)
        .where(eq(schema.categories.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a category (only if no products are associated)
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.query.categories.findFirst({
        where: (categories, { eq: eqFn }) => eqFn(categories.id, input.id),
      });
      if (!category) Errors.categoryNotFound();

      // TODO: Check if products are associated
      const productsCount = 0;

      if (productsCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Impossible de supprimer: ${productsCount} produit(s) inscrit(s) dans cette catégorie`,
        });
      }

      await ctx.db
        .delete(schema.categories)
        .where(eq(schema.categories.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder categories by updating sortOrder
   */
  reorder: organizerProcedure
    .input(reorderCategoriesSchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });
      if (!cup) Errors.cupNotFound();

      // Validate that all categoryIds belong to this cup
      const existingCategories = await ctx.db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.cupId, input.cupId),
            inArray(schema.categories.id, input.categoryIds)
          )
        );

      if (existingCategories.length !== input.categoryIds.length) {
        Errors.badRequest("Certaines catégories n'appartiennent pas à cette cup");
      }

      const updates = input.categoryIds.map((categoryId, index) =>
        ctx.db
          .update(schema.categories)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(
            and(
              eq(schema.categories.id, categoryId),
              eq(schema.categories.cupId, input.cupId)
            )
          )
      );

      await Promise.all(updates);

      return { success: true };
    }),

  /**
   * Get categories count for a cup (used for displaying count in cup detail)
   */
  count: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });
      if (!cup) Errors.cupNotFound();

      const result = await ctx.db
        .select({ count: count() })
        .from(schema.categories)
        .where(eq(schema.categories.cupId, input.cupId));

      return result[0]?.count ?? 0;
    }),
});
