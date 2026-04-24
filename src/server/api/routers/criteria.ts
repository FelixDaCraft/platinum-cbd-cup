import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, asc, count, inArray } from "drizzle-orm";

import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import { Errors } from "~/lib/errors";
import * as schema from "~/server/db/schema";
import type { CupStatus } from "~/server/db/schema";
import {
  createCriterionSchema,
  updateCriterionSchema,
  reorderCriteriaSchema,
  duplicateCriteriaSchema,
  initializeDefaultCriteriaSchema,
  importCriteriaFromCupSchema,
  DEFAULT_CRITERIA,
} from "~/lib/validations/criteria";
import { getRatingScaleValues } from "~/lib/validations/cup";

/**
 * Helper to block criteria modifications during rating or completed phases
 */
function assertCriteriaEditable(cupStatus: CupStatus): void {
  if (cupStatus === "rating" || cupStatus === "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Impossible de modifier les critères pendant ou après la phase de notation",
    });
  }
}

type Ctx = { db: { query: typeof import("~/server/db").db.query } };

const requireCategoryWithCup = async (
  ctx: Ctx,
  categoryId: string,
  notFoundMsg = "Catégorie non trouvée"
) => {
  const category = await ctx.db.query.categories.findFirst({
    where: (categories, { eq: eqFn }) => eqFn(categories.id, categoryId),
    with: { cup: true },
  });

  if (!category) Errors.notFound(notFoundMsg);
  return category!;
};

const requireCriterionWithCategoryAndCup = async (
  ctx: Ctx,
  criterionId: string
) => {
  const criterion = await ctx.db.query.ratingCriteria.findFirst({
    where: (rc, { eq: eqFn }) => eqFn(rc.id, criterionId),
    with: {
      category: {
        with: { cup: true },
      },
    },
  });

  if (!criterion) Errors.notFound("Critère non trouvé");
  return criterion!;
};

const requireCup = async (ctx: Ctx, cupId: string) => {
  const cup = await ctx.db.query.cups.findFirst({
    where: (cups, { eq: eqFn }) => eqFn(cups.id, cupId),
  });
  if (!cup) Errors.cupNotFound();
  return cup!;
};

export const criteriaRouter = createTRPCRouter({
  /**
   * Get all criteria for a category with edit permission status
   */
  getCategoryCriteria: organizerProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await requireCategoryWithCup(ctx, input.categoryId);

      const criteria = await ctx.db.query.ratingCriteria.findMany({
        where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, input.categoryId),
        orderBy: (rc) => [asc(rc.sortOrder)],
      });

      const canEdit =
        category.cup.status !== "rating" &&
        category.cup.status !== "completed";

      const ratingScale = getRatingScaleValues(category.cup.ratingScale);

      return {
        criteria,
        cupStatus: category.cup.status,
        canEdit,
        ratingScale,
        cupRatingScale: category.cup.ratingScale,
        category: {
          id: category.id,
          name: category.name,
          cupId: category.cupId,
        },
      };
    }),

  /**
   * Create a new criterion
   */
  create: organizerProcedure
    .input(createCriterionSchema)
    .mutation(async ({ ctx, input }) => {
      const category = await requireCategoryWithCup(ctx, input.categoryId);
      assertCriteriaEditable(category.cup.status);

      const existingCriteria = await ctx.db.query.ratingCriteria.findMany({
        where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, input.categoryId),
      });

      const maxOrder = Math.max(
        ...existingCriteria.map((c) => c.sortOrder),
        -1
      );

      const criterionId = nanoid();
      const [criterion] = await ctx.db
        .insert(schema.ratingCriteria)
        .values({
          id: criterionId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description ?? null,
          coefficient: input.coefficient,
          sortOrder: maxOrder + 1,
        })
        .returning();

      return criterion;
    }),

  /**
   * Update an existing criterion
   */
  update: organizerProcedure
    .input(updateCriterionSchema)
    .mutation(async ({ ctx, input }) => {
      const criterion = await requireCriterionWithCategoryAndCup(
        ctx,
        input.criterionId
      );
      assertCriteriaEditable(criterion.category.cup.status);

      const updateData: Partial<typeof schema.ratingCriteria.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.coefficient !== undefined) updateData.coefficient = input.coefficient;

      const [updated] = await ctx.db
        .update(schema.ratingCriteria)
        .set(updateData)
        .where(eq(schema.ratingCriteria.id, input.criterionId))
        .returning();

      return updated;
    }),

  /**
   * Delete a criterion
   */
  delete: organizerProcedure
    .input(z.object({ criterionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const criterion = await requireCriterionWithCategoryAndCup(
        ctx,
        input.criterionId
      );
      assertCriteriaEditable(criterion.category.cup.status);

      await ctx.db
        .delete(schema.ratingCriteria)
        .where(eq(schema.ratingCriteria.id, input.criterionId));

      return { success: true };
    }),

  /**
   * Reorder criteria by updating sortOrder
   */
  reorder: organizerProcedure
    .input(reorderCriteriaSchema)
    .mutation(async ({ ctx, input }) => {
      const category = await requireCategoryWithCup(ctx, input.categoryId);
      assertCriteriaEditable(category.cup.status);

      const existingCriteria = await ctx.db.query.ratingCriteria.findMany({
        where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, input.categoryId),
      });

      const existingIds = new Set(existingCriteria.map((c) => c.id));
      const allBelongToCategory = input.criterionIds.every((id) =>
        existingIds.has(id)
      );

      if (!allBelongToCategory) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains critères n'appartiennent pas à cette catégorie",
        });
      }

      if (input.criterionIds.length !== existingCriteria.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tous les critères de la catégorie doivent être inclus",
        });
      }

      const updates = input.criterionIds.map((criterionId, index) =>
        ctx.db
          .update(schema.ratingCriteria)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(schema.ratingCriteria.id, criterionId))
      );

      await Promise.all(updates);

      return { success: true };
    }),

  /**
   * Duplicate criteria from one category to another (same cup only)
   */
  duplicateFromCategory: organizerProcedure
    .input(duplicateCriteriaSchema)
    .mutation(async ({ ctx, input }) => {
      const sourceCategory = await requireCategoryWithCup(
        ctx,
        input.sourceCategoryId,
        "Catégorie source non trouvée"
      );
      const targetCategory = await requireCategoryWithCup(
        ctx,
        input.targetCategoryId,
        "Catégorie cible non trouvée"
      );

      if (sourceCategory.cupId !== targetCategory.cupId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La duplication n'est possible qu'entre catégories d'une même cup",
        });
      }

      assertCriteriaEditable(targetCategory.cup.status);

      const sourceCriteria = await ctx.db.query.ratingCriteria.findMany({
        where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, input.sourceCategoryId),
        orderBy: (rc) => [asc(rc.sortOrder)],
      });

      if (sourceCriteria.length === 0) {
        return { duplicated: 0 };
      }

      const existingCount = await ctx.db
        .select({ count: count() })
        .from(schema.ratingCriteria)
        .where(eq(schema.ratingCriteria.categoryId, input.targetCategoryId));

      const baseOrder = existingCount[0]?.count ?? 0;

      const criteriaToCopy = sourceCriteria.map((criterion, index) => ({
        id: nanoid(),
        categoryId: input.targetCategoryId,
        name: criterion.name,
        description: criterion.description,
        coefficient: criterion.coefficient,
        sortOrder: baseOrder + index,
      }));

      await ctx.db.insert(schema.ratingCriteria).values(criteriaToCopy);

      return { duplicated: criteriaToCopy.length };
    }),

  /**
   * Initialize default criteria for a category
   */
  initializeDefaultCriteria: organizerProcedure
    .input(initializeDefaultCriteriaSchema)
    .mutation(async ({ ctx, input }) => {
      const category = await requireCategoryWithCup(ctx, input.categoryId);
      assertCriteriaEditable(category.cup.status);

      const existingCriteria = await ctx.db.query.ratingCriteria.findMany({
        where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, input.categoryId),
      });

      if (existingCriteria.length > 0) {
        return { created: 0, message: "Critères déjà configurés" };
      }

      const criteriaToInsert = DEFAULT_CRITERIA.map((criterion, index) => ({
        id: nanoid(),
        categoryId: input.categoryId,
        name: criterion.name,
        description: criterion.description,
        coefficient: criterion.coefficient,
        sortOrder: index,
      }));

      await ctx.db.insert(schema.ratingCriteria).values(criteriaToInsert);

      return { created: criteriaToInsert.length };
    }),

  /**
   * Get criteria count for a category
   */
  count: organizerProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireCategoryWithCup(ctx, input.categoryId);

      const result = await ctx.db
        .select({ count: count() })
        .from(schema.ratingCriteria)
        .where(eq(schema.ratingCriteria.categoryId, input.categoryId));

      return result[0]?.count ?? 0;
    }),

  /**
   * Get other categories in the same cup (for duplication source selection)
   */
  getOtherCategoriesInCup: organizerProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentCategory = await requireCategoryWithCup(ctx, input.categoryId);

      const otherCategories = await ctx.db.query.categories.findMany({
        where: (categories, { eq: eqFn, and: andFn, ne: neFn }) =>
          andFn(
            eqFn(categories.cupId, currentCategory.cupId),
            neFn(categories.id, input.categoryId)
          ),
        orderBy: (categories) => [asc(categories.sortOrder)],
      });

      const categoriesWithCounts = await Promise.all(
        otherCategories.map(async (cat) => {
          const result = await ctx.db
            .select({ count: count() })
            .from(schema.ratingCriteria)
            .where(eq(schema.ratingCriteria.categoryId, cat.id));

          return {
            id: cat.id,
            name: cat.name,
            criteriaCount: result[0]?.count ?? 0,
          };
        })
      );

      return categoriesWithCounts;
    }),

  /**
   * Get all cups (except current cup) with their categories and criteria
   * Used for importing criteria from other cups
   */
  getImportableCupsWithCategories: organizerProcedure
    .input(z.object({ currentCupId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireCup(ctx, input.currentCupId);

      const otherCups = await ctx.db.query.cups.findMany({
        where: (cups, { ne: neFn }) => neFn(cups.id, input.currentCupId),
        orderBy: (cups, { desc }) => [desc(cups.createdAt)],
      });

      const cupsWithCategoriesAndCriteria = await Promise.all(
        otherCups.map(async (cup) => {
          const categories = await ctx.db.query.categories.findMany({
            where: (categories, { eq: eqFn }) => eqFn(categories.cupId, cup.id),
            orderBy: (categories) => [asc(categories.sortOrder)],
          });

          const categoriesWithCriteria = await Promise.all(
            categories.map(async (category) => {
              const criteria = await ctx.db.query.ratingCriteria.findMany({
                where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, category.id),
                orderBy: (rc) => [asc(rc.sortOrder)],
              });

              return {
                id: category.id,
                name: category.name,
                criteria: criteria.map((c) => ({
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  coefficient: c.coefficient,
                })),
              };
            })
          );

          const hasAnyCriteria = categoriesWithCriteria.some(
            (cat) => cat.criteria.length > 0
          );

          if (!hasAnyCriteria) return null;

          return {
            id: cup.id,
            name: cup.name,
            categories: categoriesWithCriteria.filter(
              (cat) => cat.criteria.length > 0
            ),
          };
        })
      );

      return cupsWithCategoriesAndCriteria.filter(
        (cup): cup is NonNullable<typeof cup> => cup !== null
      );
    }),

  /**
   * Import selected criteria from another cup
   */
  importCriteriaFromOtherCup: organizerProcedure
    .input(importCriteriaFromCupSchema)
    .mutation(async ({ ctx, input }) => {
      const targetCategory = await requireCategoryWithCup(
        ctx,
        input.targetCategoryId,
        "Catégorie cible non trouvée"
      );
      assertCriteriaEditable(targetCategory.cup.status);

      const criteriaToImport = await ctx.db.query.ratingCriteria.findMany({
        where: (rc) => inArray(rc.id, input.criteriaIds),
      });

      if (criteriaToImport.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucun critère trouvé à importer",
        });
      }

      const existingCount = await ctx.db
        .select({ count: count() })
        .from(schema.ratingCriteria)
        .where(eq(schema.ratingCriteria.categoryId, input.targetCategoryId));

      const baseOrder = existingCount[0]?.count ?? 0;

      const criteriaToCopy = criteriaToImport.map((criterion, index) => ({
        id: nanoid(),
        categoryId: input.targetCategoryId,
        name: criterion.name,
        description: criterion.description,
        coefficient: criterion.coefficient,
        sortOrder: baseOrder + index,
      }));

      await ctx.db.insert(schema.ratingCriteria).values(criteriaToCopy);

      return { imported: criteriaToCopy.length };
    }),
});
