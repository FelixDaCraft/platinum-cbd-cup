import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import { eq, and, count, sql, isNotNull, inArray, desc } from "drizzle-orm";
import { convertScoreToScale } from "~/lib/validations/labels";
import { ratingCriteria } from "~/server/db/schema/rating-criteria";

/**
 * Scoring Router - Procedures for tracking rating progress and live scores
 * Used by organizers to monitor cup progression during rating phase
 */
export const scoringRouter = createTRPCRouter({
  /**
   * Get global rating progress for a cup
   * Returns overall completion stats: total products to rate, rated count, percentage
   */
  getGlobalProgress: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      // Verify cup exists (single-tenant)
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      // Get all categories for this cup
      const categories = await ctx.db.query.categories.findMany({
        where: (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        columns: { id: true },
      });
      const categoryIds = categories.map((c) => c.id);

      if (categoryIds.length === 0) {
        return {
          totalProducts: 0,
          totalRatings: 0,
          expectedRatings: 0,
          completionPercentage: 0,
          activeJuries: 0,
          status: cup.status,
        };
      }

      // Count total products across all categories (only confirmed products with anonymous code)
      const productsResult = await ctx.db
        .select({ count: count() })
        .from(schema.products)
        .where(
          and(
            inArray(schema.products.categoryId, categoryIds),
            isNotNull(schema.products.anonymousCode)
          )
        );
      const totalProducts = productsResult[0]?.count ?? 0;

      // Count active juries for this cup
      const juriesResult = await ctx.db
        .select({ count: count() })
        .from(schema.cupJuries)
        .where(
          and(
            eq(schema.cupJuries.cupId, input.cupId),
            eq(schema.cupJuries.isActive, true)
          )
        );
      const activeJuries = juriesResult[0]?.count ?? 0;

      // Count submitted ratings (productRatings with submittedAt != null)
      const ratingsResult = await ctx.db
        .select({ count: count() })
        .from(schema.productRatings)
        .innerJoin(
          schema.products,
          eq(schema.productRatings.productId, schema.products.id)
        )
        .where(
          and(
            inArray(schema.products.categoryId, categoryIds),
            isNotNull(schema.productRatings.submittedAt)
          )
        );
      const totalRatings = ratingsResult[0]?.count ?? 0;

      // Expected ratings = products × juries (each jury should rate each product in their assigned categories)
      // For simplicity, we use total products × active juries as max
      // In reality, this depends on category assignments
      const expectedRatings = totalProducts * activeJuries;

      const completionPercentage =
        expectedRatings > 0 ? Math.round((totalRatings / expectedRatings) * 100) : 0;

      return {
        totalProducts,
        totalRatings,
        expectedRatings,
        completionPercentage,
        activeJuries,
        status: cup.status,
      };
    }),

  /**
   * Get rating progress per category
   * Returns completion stats for each category
   */
  getCategoryProgress: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      // Verify cup exists (single-tenant)
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      // Get all categories with product counts and rating counts
      const categories = await ctx.db.query.categories.findMany({
        where: (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
      });

      // For each category, get product count and rating count
      const categoryProgress = await Promise.all(
        categories.map(async (category) => {
          // Count products in this category (with anonymous code = confirmed)
          const productsResult = await ctx.db
            .select({ count: count() })
            .from(schema.products)
            .where(
              and(
                eq(schema.products.categoryId, category.id),
                isNotNull(schema.products.anonymousCode)
              )
            );
          const totalProducts = productsResult[0]?.count ?? 0;

          // Count juries assigned to this category
          const juriesResult = await ctx.db
            .select({ count: count() })
            .from(schema.juryCategoryAssignments)
            .innerJoin(
              schema.cupJuries,
              eq(schema.juryCategoryAssignments.cupJuryId, schema.cupJuries.id)
            )
            .where(
              and(
                eq(schema.juryCategoryAssignments.categoryId, category.id),
                eq(schema.cupJuries.isActive, true)
              )
            );
          const assignedJuries = juriesResult[0]?.count ?? 0;

          // Count submitted ratings for products in this category
          const ratingsResult = await ctx.db
            .select({ count: count() })
            .from(schema.productRatings)
            .innerJoin(
              schema.products,
              eq(schema.productRatings.productId, schema.products.id)
            )
            .where(
              and(
                eq(schema.products.categoryId, category.id),
                isNotNull(schema.productRatings.submittedAt)
              )
            );
          const completedRatings = ratingsResult[0]?.count ?? 0;

          // Expected = products × assigned juries
          const expectedRatings = totalProducts * assignedJuries;
          const completionPercentage =
            expectedRatings > 0
              ? Math.round((completedRatings / expectedRatings) * 100)
              : 0;

          return {
            id: category.id,
            name: category.name,
            totalProducts,
            assignedJuries,
            completedRatings,
            expectedRatings,
            completionPercentage,
            isComplete: completionPercentage === 100,
          };
        })
      );

      return {
        categories: categoryProgress,
        cupStatus: cup.status,
      };
    }),

  /**
   * Get detailed progress per jury
   * Returns completion stats for each jury member
   */
  getJuryProgress: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      // Verify cup exists (single-tenant)
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      // Get all active juries with their user info and category assignments
      const juries = await ctx.db.query.cupJuries.findMany({
        where: (cj, { eq: eqFn, and: andFn }) =>
          andFn(eq(cj.cupId, input.cupId), eq(cj.isActive, true)),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          categoryAssignments: {
            with: {
              category: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: (cj, { desc }) => [desc(cj.joinedAt)],
      });

      // For each jury, calculate their progress
      const juryProgress = await Promise.all(
        juries.map(async (jury) => {
          const assignedCategoryIds = jury.categoryAssignments.map(
            (a) => a.categoryId
          );

          if (assignedCategoryIds.length === 0) {
            return {
              id: jury.id,
              name: jury.user.name ?? jury.user.email,
              email: jury.user.email,
              image: jury.user.image,
              assignedCategories: [],
              totalToRate: 0,
              completedRatings: 0,
              completionPercentage: 0,
              lastActivityAt: jury.lastActivityAt,
              joinedAt: jury.joinedAt,
            };
          }

          // Count products in assigned categories
          const productsResult = await ctx.db
            .select({ count: count() })
            .from(schema.products)
            .where(
              and(
                inArray(schema.products.categoryId, assignedCategoryIds),
                isNotNull(schema.products.anonymousCode)
              )
            );
          const totalToRate = productsResult[0]?.count ?? 0;

          // Count submitted ratings by this jury
          const ratingsResult = await ctx.db
            .select({ count: count() })
            .from(schema.productRatings)
            .innerJoin(
              schema.products,
              eq(schema.productRatings.productId, schema.products.id)
            )
            .where(
              and(
                eq(schema.productRatings.juryId, jury.id),
                inArray(schema.products.categoryId, assignedCategoryIds),
                isNotNull(schema.productRatings.submittedAt)
              )
            );
          const completedRatings = ratingsResult[0]?.count ?? 0;

          const completionPercentage =
            totalToRate > 0
              ? Math.round((completedRatings / totalToRate) * 100)
              : 0;

          return {
            id: jury.id,
            name: jury.user.name ?? jury.user.email,
            email: jury.user.email,
            image: jury.user.image,
            assignedCategories: jury.categoryAssignments.map((a) => ({
              id: a.category.id,
              name: a.category.name,
            })),
            totalToRate,
            completedRatings,
            completionPercentage,
            lastActivityAt: jury.lastActivityAt,
            joinedAt: jury.joinedAt,
          };
        })
      );

      // Sort by completion percentage (ascending - show least complete first)
      juryProgress.sort((a, b) => a.completionPercentage - b.completionPercentage);

      return {
        juries: juryProgress,
        totalJuries: juries.length,
        cupStatus: cup.status,
      };
    }),

  /**
   * Get live scores/leaderboard for a cup
   * Shows current ranking based on submitted ratings
   * Only available during or after rating phase
   */
  getLiveScores: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify cup exists (single-tenant)
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      // Only allow live scores during or after rating
      if (cup.status !== "rating" && cup.status !== "completed") {
        return {
          available: false,
          message: "Les scores ne sont disponibles que pendant ou après la notation",
          products: [],
          cupStatus: cup.status,
        };
      }

      // Get categories
      const categoryFilter = input.categoryId;
      const categories = await ctx.db.query.categories.findMany({
        where: categoryFilter
          ? (cat, { eq: eqFn, and: andFn }) =>
              andFn(eqFn(cat.cupId, input.cupId), eqFn(cat.id, categoryFilter))
          : (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
      });

      if (categories.length === 0) {
        return {
          available: true,
          products: [],
          cupStatus: cup.status,
        };
      }

      const categoryIds = categories.map((c) => c.id);

      // Build coefficient map per criterion for weighted average calculation
      const criteriaCoefficients = new Map<string, number>();
      for (const category of categories) {
        const criteria = await ctx.db.query.ratingCriteria.findMany({
          where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, category.id),
        });
        for (const criterion of criteria) {
          criteriaCoefficients.set(criterion.id, criterion.coefficient);
        }
      }

      // Get products with their ratings
      // For completed cups, use finalScore; for rating phase, calculate average
      const products = await ctx.db.query.products.findMany({
        where: (prod, { and: andFn, inArray: inArrayFn, isNotNull: isNotNullFn }) =>
          andFn(
            inArrayFn(prod.categoryId, categoryIds),
            isNotNullFn(prod.anonymousCode)
          ),
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
          ratings: {
            where: (rating, { isNotNull: isNotNullFn }) =>
              isNotNullFn(rating.submittedAt),
            with: {
              scores: true,
            },
          },
          label: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Calculate scores for each product
      const productsWithScores = products.map((product) => {
        // If cup is completed and has finalScore, use it
        // Convert from 0-100 percentage to rating scale
        if (cup.status === "completed" && product.finalScore !== null) {
          const scoreInScale = convertScoreToScale(parseFloat(product.finalScore), cup.ratingScale);
          return {
            id: product.id,
            anonymousCode: product.anonymousCode,
            name: product.name,
            categoryId: product.category.id,
            categoryName: product.category.name,
            averageScore: scoreInScale,
            ratingsCount: product.ratings.length,
            categoryRank: product.categoryRank,
            label: product.label,
          };
        }

        // Calculate live average from submitted ratings
        if (product.ratings.length === 0) {
          return {
            id: product.id,
            anonymousCode: product.anonymousCode,
            name: product.name,
            categoryId: product.category.id,
            categoryName: product.category.name,
            averageScore: null,
            ratingsCount: 0,
            categoryRank: null,
            label: null,
          };
        }

        // Calculate weighted average matching computeResults logic:
        // 1. Per jury: weighted avg of criterion scores by coefficient
        // 2. Final: average of jury averages
        const ratingAverages: number[] = [];

        for (const rating of product.ratings) {
          let weightedSum = 0;
          let coeffSum = 0;
          for (const score of rating.scores) {
            const coeff = criteriaCoefficients.get(score.criterionId) ?? 1;
            weightedSum += score.score * coeff;
            coeffSum += coeff;
          }
          if (coeffSum > 0) {
            ratingAverages.push(weightedSum / coeffSum);
          }
        }

        const averageScore =
          ratingAverages.length > 0
            ? ratingAverages.reduce((a, b) => a + b, 0) / ratingAverages.length
            : null;

        return {
          id: product.id,
          anonymousCode: product.anonymousCode,
          name: product.name,
          categoryId: product.category.id,
          categoryName: product.category.name,
          averageScore,
          ratingsCount: product.ratings.length,
          categoryRank: product.categoryRank,
          label: product.label,
        };
      });

      // Sort by average score descending (highest first)
      productsWithScores.sort((a, b) => {
        if (a.averageScore === null && b.averageScore === null) return 0;
        if (a.averageScore === null) return 1;
        if (b.averageScore === null) return -1;
        return b.averageScore - a.averageScore;
      });

      // Group by category if no specific category requested
      let result;
      if (categoryFilter) {
        result = productsWithScores.slice(0, input.limit);
      } else {
        // Return top N per category
        const byCategory = new Map<string, typeof productsWithScores>();
        for (const product of productsWithScores) {
          const catId = product.categoryId;
          if (!byCategory.has(catId)) {
            byCategory.set(catId, []);
          }
          const catProducts = byCategory.get(catId)!;
          if (catProducts.length < input.limit) {
            catProducts.push(product);
          }
        }

        result = categories.map((cat) => ({
          categoryId: cat.id,
          categoryName: cat.name,
          products: byCategory.get(cat.id) ?? [],
        }));
      }

      return {
        available: true,
        products: categoryFilter ? result : undefined,
        categories: categoryFilter ? undefined : result,
        cupStatus: cup.status,
        ratingScale: cup.ratingScale,
      };
    }),
});
