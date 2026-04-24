/**
 * Results Router - Story 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * Handles calculation of final scores, label attribution, rankings, PDF generation and email sending
 */

import { z } from "zod";
import { eq, and, sql, desc, asc, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { products } from "~/server/db/schema/products";
import { categories } from "~/server/db/schema/categories";
import { cups } from "~/server/db/schema/cups";
import { cupLabels } from "~/server/db/schema/cup-labels";
import { productRatings, criterionScores } from "~/server/db/schema/ratings";
import { ratingCriteria } from "~/server/db/schema/rating-criteria";
import { registrations } from "~/server/db/schema/registrations";
import { producers } from "~/server/db/schema/producers";
import {
  generateProductSynthesisPdf,
  generateProducerSynthesisPdf,
  getProductResultsForPdf,
} from "~/server/services/results-pdf.service";
import {
  sendResultsEmail,
  sendBulkResultsEmails,
} from "~/server/services/results-email.service";
import { getMaxScoreForScale } from "~/lib/validations/labels";

type ProtectedContext = {
  db: typeof db;
  userId: string;
};

/**
 * Helper to verify cup access (single-tenant).
 * Ensures the current user is an organizer/admin and the cup exists.
 * `allowedRoles` is ignored in single-tenant mode — any organizer counts.
 */
async function verifyCupAccess(
  ctx: ProtectedContext,
  cupId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _allowedRoles: string[] = ["owner", "admin"]
) {
  const user = await ctx.db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, ctx.userId),
    columns: { isAdmin: true, role: true },
  });

  const isOrganizer = user?.isAdmin === true || user?.role === "organizer";
  if (!isOrganizer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès non autorisé",
    });
  }

  const cup = await ctx.db.query.cups.findFirst({
    where: (c, { eq: eqFn }) => eqFn(c.id, cupId),
  });

  if (!cup) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cup non trouvée",
    });
  }

  return { cup };
}

/**
 * Core calculation logic - computes final scores, ranks, and labels for all products in a cup.
 * Extracted as a helper so it can be called from both calculateResults and publishResults.
 * Exported so cup.publishResults can also use it.
 */
export async function computeResults(
  db: typeof import("~/server/db").db,
  cupId: string,
  cup: { ratingScale: string }
) {
  const cupCategories = await db.query.categories.findMany({
    where: eq(categories.cupId, cupId),
  });

  const labels = await db.query.cupLabels.findMany({
    where: eq(cupLabels.cupId, cupId),
    orderBy: [desc(cupLabels.minScore)],
  });

  const maxScale = getMaxScoreForScale(cup.ratingScale);

  let productsProcessed = 0;
  let labelsAttributed = 0;

  for (const category of cupCategories) {
    const categoryProducts = await db
      .select({
        id: products.id,
        registrationId: products.registrationId,
      })
      .from(products)
      .innerJoin(registrations, eq(products.registrationId, registrations.id))
      .where(
        and(
          eq(products.categoryId, category.id),
          eq(registrations.cupId, cupId),
          eq(registrations.status, "confirmed"),
          eq(products.excludedFromResults, false)
        )
      );

    const criteria = await db.query.ratingCriteria.findMany({
      where: eq(ratingCriteria.categoryId, category.id),
    });

    const totalCoefficient = criteria.reduce((sum: number, c) => sum + c.coefficient, 0);

    const productScores: {
      id: string;
      finalScore: number;
      juryCount: number;
      registrationId: string;
    }[] = [];

    for (const product of categoryProducts) {
      const ratings = await db
        .select({
          ratingId: productRatings.id,
        })
        .from(productRatings)
        .where(
          and(
            eq(productRatings.productId, product.id),
            isNotNull(productRatings.submittedAt)
          )
        );

      if (ratings.length === 0) {
        await db
          .update(products)
          .set({
            finalScore: null,
            labelId: null,
            categoryRank: null,
            updatedAt: new Date(),
          })
          .where(eq(products.id, product.id));
        continue;
      }

      const ratingAverages: number[] = [];

      for (const rating of ratings) {
        const scores = await db
          .select({
            score: criterionScores.score,
            coefficient: ratingCriteria.coefficient,
          })
          .from(criterionScores)
          .innerJoin(ratingCriteria, eq(criterionScores.criterionId, ratingCriteria.id))
          .where(eq(criterionScores.productRatingId, rating.ratingId));

        if (scores.length === 0) continue;

        let weightedSum = 0;
        let coeffSum = 0;
        for (const s of scores) {
          weightedSum += s.score * s.coefficient;
          coeffSum += s.coefficient;
        }

        if (coeffSum > 0) {
          const avg = weightedSum / coeffSum;
          ratingAverages.push(avg);
        }
      }

      if (ratingAverages.length === 0) continue;

      const finalScore = ratingAverages.reduce((a, b) => a + b, 0) / ratingAverages.length;
      productScores.push({
        id: product.id,
        finalScore,
        juryCount: ratings.length,
        registrationId: product.registrationId,
      });
      productsProcessed++;
    }

    const regDates = new Map<string, Date>();
    for (const ps of productScores) {
      const reg = await db.query.registrations.findFirst({
        where: eq(registrations.id, ps.registrationId),
        columns: { createdAt: true },
      });
      if (reg) regDates.set(ps.registrationId, reg.createdAt);
    }

    productScores.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      if (b.juryCount !== a.juryCount) {
        return b.juryCount - a.juryCount;
      }
      const dateA = regDates.get(a.registrationId) ?? new Date();
      const dateB = regDates.get(b.registrationId) ?? new Date();
      return dateA.getTime() - dateB.getTime();
    });

    for (let i = 0; i < productScores.length; i++) {
      const { id, finalScore } = productScores[i]!;
      const rank = i + 1;

      let matchedLabelId: string | null = null;
      for (const label of labels) {
        const minOk = finalScore >= label.minScore;
        const maxOk = label.maxScore === null || finalScore <= label.maxScore;
        if (minOk && maxOk) {
          matchedLabelId = label.id;
          labelsAttributed++;
          break;
        }
      }

      await db
        .update(products)
        .set({
          finalScore: finalScore.toFixed(2),
          labelId: matchedLabelId,
          categoryRank: rank,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
    }
  }

  return { productsProcessed, labelsAttributed };
}

export const resultsRouter = createTRPCRouter({
  /**
   * Calculate final scores for all products in a cup
   * Only available when cup status is "completed" or "rating"
   * Story 8.1: FR42 - Attribution labels auto selon notes
   */
  calculateResults: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access and status
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      if (!["rating", "completed"].includes(cup.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La cup doit être en phase de notation ou terminée pour calculer les résultats",
        });
      }

      const { productsProcessed, labelsAttributed } = await computeResults(ctx.db, cupId, cup);

      return {
        success: true,
        productsProcessed,
        labelsAttributed,
        message: `Résultats calculés: ${productsProcessed} produits traités, ${labelsAttributed} labels attribués`,
      };
    }),

  /**
   * Get results for a cup organized by category
   * Story 8.1, 8.2
   */
  getCupResults: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get all categories with their products and results
      const cupCategories = await ctx.db.query.categories.findMany({
        where: eq(categories.cupId, cupId),
        orderBy: [asc(categories.sortOrder)],
      });

      const results = [];

      for (const category of cupCategories) {
        // Get products with results for this category
        const categoryProducts = await ctx.db
          .select({
            id: products.id,
            name: products.name,
            anonymousCode: products.anonymousCode,
            finalScore: products.finalScore,
            categoryRank: products.categoryRank,
            labelId: products.labelId,
            labelName: cupLabels.name,
            labelColor: cupLabels.color,
            producerName: producers.companyName,
            producerBrand: producers.brandName,
          })
          .from(products)
          .innerJoin(registrations, eq(products.registrationId, registrations.id))
          .innerJoin(producers, eq(registrations.producerId, producers.id))
          .leftJoin(cupLabels, eq(products.labelId, cupLabels.id))
          .where(
            and(
              eq(products.categoryId, category.id),
              eq(registrations.cupId, cupId),
              eq(registrations.status, "confirmed")
            )
          )
          .orderBy(asc(products.categoryRank));

        // Count labels
        const labelCounts: Record<string, number> = {};
        for (const p of categoryProducts) {
          if (p.labelName) {
            labelCounts[p.labelName] = (labelCounts[p.labelName] || 0) + 1;
          }
        }

        results.push({
          category: {
            id: category.id,
            name: category.name,
          },
          products: categoryProducts.map((p) => ({
            id: p.id,
            name: p.name,
            anonymousCode: p.anonymousCode,
            finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
            rank: p.categoryRank,
            label: p.labelName
              ? {
                  name: p.labelName,
                  color: p.labelColor,
                }
              : null,
            producer: {
              name: p.producerName,
              brand: p.producerBrand,
            },
          })),
          podium: categoryProducts.slice(0, 3).map((p, i) => ({
            position: i + 1,
            id: p.id,
            name: p.name,
            anonymousCode: p.anonymousCode,
            finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
            producer: {
              name: p.producerName,
              brand: p.producerBrand,
            },
            label: p.labelName
              ? {
                  name: p.labelName,
                  color: p.labelColor,
                }
              : null,
          })),
          labelCounts,
          totalProducts: categoryProducts.length,
          ratedProducts: categoryProducts.filter((p) => p.finalScore !== null).length,
        });
      }

      // Get overall label counts
      const overallLabelCounts: Record<string, number> = {};
      for (const r of results) {
        for (const [label, count] of Object.entries(r.labelCounts)) {
          overallLabelCounts[label] = (overallLabelCounts[label] || 0) + count;
        }
      }

      return {
        categories: results,
        summary: {
          totalCategories: results.length,
          totalProducts: results.reduce((sum, r) => sum + r.totalProducts, 0),
          ratedProducts: results.reduce((sum, r) => sum + r.ratedProducts, 0),
          labelCounts: overallLabelCounts,
        },
      };
    }),

  /**
   * Get detailed results for a single product
   */
  getProductResults: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { productId } = input;

      // Get product with related data
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          category: true,
          label: true,
          registration: {
            with: {
              cup: true,
              producer: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouvé",
        });
      }

      // Verify cup access
      await verifyCupAccess(ctx, product.registration.cupId, ["owner", "admin", "member"]);

      // Get criteria scores aggregated across all juries
      const criteria = await ctx.db.query.ratingCriteria.findMany({
        where: eq(ratingCriteria.categoryId, product.categoryId),
        orderBy: [asc(ratingCriteria.sortOrder)],
      });

      const criteriaScores = [];
      const maxScale = getMaxScoreForScale(product.registration.cup.ratingScale);

      for (const criterion of criteria) {
        // Get all submitted scores for this criterion on this product
        const scores = await ctx.db
          .select({
            score: criterionScores.score,
          })
          .from(criterionScores)
          .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
          .where(
            and(
              eq(criterionScores.criterionId, criterion.id),
              eq(productRatings.productId, productId),
              isNotNull(productRatings.submittedAt)
            )
          );

        if (scores.length === 0) {
          criteriaScores.push({
            criterion: {
              id: criterion.id,
              name: criterion.name,
              coefficient: criterion.coefficient,
            },
            averageScore: null,
            normalizedScore: null,
            juryCount: 0,
          });
          continue;
        }

        const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        const normalized = (avg / maxScale) * 100;

        criteriaScores.push({
          criterion: {
            id: criterion.id,
            name: criterion.name,
            coefficient: criterion.coefficient,
          },
          averageScore: Math.round(avg * 100) / 100,
          normalizedScore: Math.round(normalized * 100) / 100,
          juryCount: scores.length,
        });
      }

      // Get category average for comparison
      const categoryAvg = await ctx.db
        .select({
          avgScore: sql<string>`AVG(${products.finalScore}::numeric)`,
        })
        .from(products)
        .innerJoin(registrations, eq(products.registrationId, registrations.id))
        .where(
          and(
            eq(products.categoryId, product.categoryId),
            eq(registrations.cupId, product.registration.cupId),
            isNotNull(products.finalScore)
          )
        );

      const categoryAverageScore = categoryAvg[0]?.avgScore
        ? parseFloat(categoryAvg[0].avgScore)
        : null;

      // Count products in category
      const categoryCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .innerJoin(registrations, eq(products.registrationId, registrations.id))
        .where(
          and(
            eq(products.categoryId, product.categoryId),
            eq(registrations.cupId, product.registration.cupId),
            eq(registrations.status, "confirmed")
          )
        );

      const totalInCategory = categoryCount[0]?.count ?? 0;

      // Calculate percentile
      let percentile: number | null = null;
      if (product.categoryRank && totalInCategory > 0) {
        percentile = Math.round(((totalInCategory - product.categoryRank) / totalInCategory) * 100);
      }

      return {
        product: {
          id: product.id,
          name: product.name,
          anonymousCode: product.anonymousCode,
          finalScore: product.finalScore ? parseFloat(product.finalScore) : null,
          rank: product.categoryRank,
          percentile,
          label: product.label
            ? {
                id: product.label.id,
                name: product.label.name,
                color: product.label.color,
              }
            : null,
        },
        category: {
          id: product.category.id,
          name: product.category.name,
          averageScore: categoryAverageScore,
          totalProducts: totalInCategory,
        },
        producer: {
          id: product.registration.producer.id,
          name: product.registration.producer.companyName,
          brand: product.registration.producer.brandName,
        },
        criteriaScores,
        cup: {
          id: product.registration.cup.id,
          name: product.registration.cup.name,
          ratingScale: product.registration.cup.ratingScale,
        },
      };
    }),

  /**
   * Get label statistics for a cup
   */
  getLabelStats: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get all labels for this cup
      const labels = await ctx.db.query.cupLabels.findMany({
        where: eq(cupLabels.cupId, cupId),
        orderBy: [desc(cupLabels.minScore)],
      });

      // Count products per label
      const stats = [];
      for (const label of labels) {
        const count = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .innerJoin(registrations, eq(products.registrationId, registrations.id))
          .where(
            and(
              eq(registrations.cupId, cupId),
              eq(products.labelId, label.id)
            )
          );

        stats.push({
          label: {
            id: label.id,
            name: label.name,
            color: label.color,
            minScore: label.minScore,
            maxScore: label.maxScore,
          },
          count: count[0]?.count ?? 0,
        });
      }

      // Count products without label
      const noLabelCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .innerJoin(registrations, eq(products.registrationId, registrations.id))
        .where(
          and(
            eq(registrations.cupId, cupId),
            eq(registrations.status, "confirmed"),
            sql`${products.labelId} IS NULL`,
            isNotNull(products.finalScore)
          )
        );

      return {
        labels: stats,
        noLabel: noLabelCount[0]?.count ?? 0,
        total: stats.reduce((sum, s) => sum + s.count, 0) + (noLabelCount[0]?.count ?? 0),
      };
    }),

  /**
   * Export podium as CSV
   * Story 8.2: FR43 - Classement podium auto
   */
  exportPodiumCsv: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      // Get cup info
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(cups.id, cupId),
      });

      // Get all categories
      const cupCategories = await ctx.db.query.categories.findMany({
        where: eq(categories.cupId, cupId),
        orderBy: [asc(categories.sortOrder)],
      });

      // Build CSV rows
      const rows: string[][] = [];
      rows.push([
        "Catégorie",
        "Position",
        "Produit",
        "Code Anonyme",
        "Score Final",
        "Producteur",
        "Marque",
        "Label",
      ]);

      for (const category of cupCategories) {
        // Get top 3 products for this category
        const podiumProducts = await ctx.db
          .select({
            id: products.id,
            name: products.name,
            anonymousCode: products.anonymousCode,
            finalScore: products.finalScore,
            categoryRank: products.categoryRank,
            labelName: cupLabels.name,
            producerName: producers.companyName,
            producerBrand: producers.brandName,
          })
          .from(products)
          .innerJoin(registrations, eq(products.registrationId, registrations.id))
          .innerJoin(producers, eq(registrations.producerId, producers.id))
          .leftJoin(cupLabels, eq(products.labelId, cupLabels.id))
          .where(
            and(
              eq(products.categoryId, category.id),
              eq(registrations.cupId, cupId),
              eq(registrations.status, "confirmed"),
              isNotNull(products.categoryRank)
            )
          )
          .orderBy(asc(products.categoryRank))
          .limit(3);

        for (const p of podiumProducts) {
          rows.push([
            category.name,
            String(p.categoryRank ?? ""),
            p.name,
            p.anonymousCode ?? "",
            p.finalScore ?? "",
            p.producerName ?? "",
            p.producerBrand ?? "",
            p.labelName ?? "",
          ]);
        }
      }

      // Convert to CSV string
      const csvContent = rows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      return {
        filename: `podium-${cup?.name ?? cupId}-${new Date().toISOString().split("T")[0]}.csv`,
        content: csvContent,
        mimeType: "text/csv",
      };
    }),

  /**
   * Get podium summary for a cup
   * Story 8.2
   */
  getPodium: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get all categories
      const cupCategories = await ctx.db.query.categories.findMany({
        where: eq(categories.cupId, cupId),
        orderBy: [asc(categories.sortOrder)],
      });

      const podiumByCategory = [];

      for (const category of cupCategories) {
        // Get top 3 products for this category
        const podiumProducts = await ctx.db
          .select({
            id: products.id,
            name: products.name,
            anonymousCode: products.anonymousCode,
            finalScore: products.finalScore,
            categoryRank: products.categoryRank,
            labelId: products.labelId,
            labelName: cupLabels.name,
            labelColor: cupLabels.color,
            producerName: producers.companyName,
            producerBrand: producers.brandName,
            producerId: producers.id,
          })
          .from(products)
          .innerJoin(registrations, eq(products.registrationId, registrations.id))
          .innerJoin(producers, eq(registrations.producerId, producers.id))
          .leftJoin(cupLabels, eq(products.labelId, cupLabels.id))
          .where(
            and(
              eq(products.categoryId, category.id),
              eq(registrations.cupId, cupId),
              eq(registrations.status, "confirmed"),
              isNotNull(products.categoryRank)
            )
          )
          .orderBy(asc(products.categoryRank))
          .limit(3);

        podiumByCategory.push({
          category: {
            id: category.id,
            name: category.name,
          },
          podium: podiumProducts.map((p, i) => ({
            position: i + 1,
            medal: i === 0 ? "gold" : i === 1 ? "silver" : "bronze",
            product: {
              id: p.id,
              name: p.name,
              anonymousCode: p.anonymousCode,
              finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
            },
            producer: {
              id: p.producerId,
              name: p.producerName,
              brand: p.producerBrand,
            },
            label: p.labelName
              ? {
                  name: p.labelName,
                  color: p.labelColor,
                }
              : null,
          })),
        });
      }

      return {
        cupId,
        categories: podiumByCategory,
        totalCategories: podiumByCategory.length,
      };
    }),

  /**
   * Update PDF customization settings
   * Story 8.3: Personnalisation Template PDF
   */
  updatePdfSettings: protectedProcedure
    .input(
      z.object({
        cupId: z.string(),
        pdfLogoUrl: z.string().url().nullable().optional(),
        pdfIntroText: z.string().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cupId, pdfLogoUrl, pdfIntroText } = input;

      // Verify cup access (owner/admin only)
      await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (pdfLogoUrl !== undefined) {
        updateData.pdfLogoUrl = pdfLogoUrl;
      }
      if (pdfIntroText !== undefined) {
        updateData.pdfIntroText = pdfIntroText;
      }

      await ctx.db
        .update(cups)
        .set(updateData)
        .where(eq(cups.id, cupId));

      return {
        success: true,
        message: "Paramètres PDF mis à jour",
      };
    }),

  /**
   * Get PDF customization settings
   * Story 8.3
   */
  getPdfSettings: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      return {
        cupId: cup.id,
        cupName: cup.name,
        pdfLogoUrl: cup.pdfLogoUrl,
        pdfIntroText: cup.pdfIntroText,
        resultsPublishedAt: cup.resultsPublishedAt,
      };
    }),

  /**
   * Publish results - makes them visible to producers
   * Story 9.4: Publication des résultats
   */
  publishResults: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      if (cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les résultats sont déjà publiés",
        });
      }

      // Auto-calculate results before publishing to ensure scores are up to date
      await computeResults(ctx.db, cupId, cup);

      await ctx.db
        .update(cups)
        .set({
          resultsPublishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cups.id, cupId));

      return {
        success: true,
        publishedAt: new Date(),
        message: "Résultats publiés avec succès",
      };
    }),

  /**
   * Unpublish results - revokes visibility from producers
   * Story 9.4
   */
  unpublishResults: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      if (!cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les résultats ne sont pas publiés",
        });
      }

      await ctx.db
        .update(cups)
        .set({
          resultsPublishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(cups.id, cupId));

      return {
        success: true,
        message: "Publication des résultats annulée",
      };
    }),

  /**
   * Generate synthesis PDF for a single product
   * Story 8.4: FR39 - PDFs avec graphiques radar
   */
  generateProductPdf: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { productId } = input;

      // Get product to verify access
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          registration: {
            with: {
              cup: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouvé",
        });
      }

      // Verify cup access
      await verifyCupAccess(ctx, product.registration.cupId, ["owner", "admin"]);

      try {
        const result = await generateProductSynthesisPdf(productId);

        return {
          success: true,
          filename: result.filename,
          // Return base64 encoded PDF for download
          pdfBase64: result.buffer.toString("base64"),
          mimeType: "application/pdf",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors de la génération du PDF",
        });
      }
    }),

  /**
   * Generate synthesis PDF for all products of a producer registration
   * Story 8.4: FR38 - Génération PDFs synthèse
   */
  generateProducerPdf: protectedProcedure
    .input(z.object({ registrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { registrationId } = input;

      // Get registration to verify access
      const registration = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, registrationId),
        with: {
          cup: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvée",
        });
      }

      // Verify cup access
      await verifyCupAccess(ctx, registration.cupId, ["owner", "admin"]);

      try {
        const result = await generateProducerSynthesisPdf(registrationId);

        return {
          success: true,
          filename: result.filename,
          pdfBase64: result.buffer.toString("base64"),
          mimeType: "application/pdf",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors de la génération du PDF",
        });
      }
    }),

  /**
   * Get product result data for preview (without generating PDF)
   * Story 8.4
   */
  getProductPdfPreview: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { productId } = input;

      // Get product to verify access
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          registration: {
            with: {
              cup: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouvé",
        });
      }

      // Verify cup access
      await verifyCupAccess(ctx, product.registration.cupId, ["owner", "admin", "member"]);

      const resultData = await getProductResultsForPdf(productId);

      if (!resultData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Données de résultat non trouvées",
        });
      }

      return resultData;
    }),

  /**
   * Generate synthesis PDFs for all producers in a cup (mass generation)
   * Story 8.5: FR38 - Génération PDFs synthèse en masse
   */
  generateAllPdfs: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      // Verify cup status - must be in rating or completed
      if (!["rating", "completed"].includes(cup.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La cup doit être en phase de notation ou terminée pour générer les PDFs",
        });
      }

      // Get all confirmed registrations for this cup
      const cupRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.cupId, cupId),
          eq(registrations.status, "confirmed")
        ),
        with: {
          producer: true,
          products: true,
        },
      });

      if (cupRegistrations.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune inscription confirmée trouvée pour cette cup",
        });
      }

      const results: Array<{
        registrationId: string;
        producerName: string;
        productCount: number;
        success: boolean;
        filename?: string;
        pdfBase64?: string;
        error?: string;
      }> = [];

      let successCount = 0;
      let errorCount = 0;

      // Generate PDF for each registration
      for (const registration of cupRegistrations) {
        try {
          // Skip registrations with no products
          if (registration.products.length === 0) {
            results.push({
              registrationId: registration.id,
              producerName: registration.producer.companyName ?? "N/A",
              productCount: 0,
              success: false,
              error: "Aucun produit inscrit",
            });
            errorCount++;
            continue;
          }

          const pdfResult = await generateProducerSynthesisPdf(registration.id);

          results.push({
            registrationId: registration.id,
            producerName: registration.producer.companyName ?? "N/A",
            productCount: registration.products.length,
            success: true,
            filename: pdfResult.filename,
            pdfBase64: pdfResult.buffer.toString("base64"),
          });
          successCount++;
        } catch (error) {
          results.push({
            registrationId: registration.id,
            producerName: registration.producer.companyName ?? "N/A",
            productCount: registration.products.length,
            success: false,
            error: error instanceof Error ? error.message : "Erreur inconnue",
          });
          errorCount++;
        }
      }

      return {
        cupId,
        cupName: cup.name,
        totalRegistrations: cupRegistrations.length,
        successCount,
        errorCount,
        results,
      };
    }),

  /**
   * Get mass PDF generation status for a cup
   * Lists all registrations with their PDF generation status
   * Story 8.5
   */
  getMassGenerationStatus: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get all confirmed registrations
      const cupRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.cupId, cupId),
          eq(registrations.status, "confirmed")
        ),
        with: {
          producer: true,
          products: {
            with: {
              category: true,
            },
          },
        },
      });

      // Count products with results
      const registrationStats = await Promise.all(
        cupRegistrations.map(async (reg) => {
          const productsWithResults = reg.products.filter(
            (p) => p.finalScore !== null
          ).length;

          return {
            registrationId: reg.id,
            producerName: reg.producer.companyName ?? "N/A",
            producerBrand: reg.producer.brandName,
            productCount: reg.products.length,
            productsWithResults,
            readyForPdf: productsWithResults > 0,
            products: reg.products.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category?.name ?? "Sans catégorie",
              hasResults: p.finalScore !== null,
              finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
            })),
          };
        })
      );

      const readyCount = registrationStats.filter((r) => r.readyForPdf).length;

      return {
        cupId,
        cupName: cup.name,
        totalRegistrations: cupRegistrations.length,
        readyForPdf: readyCount,
        notReady: cupRegistrations.length - readyCount,
        registrations: registrationStats,
      };
    }),

  /**
   * Send results email to a single producer
   * Story 8.6: FR40 - Envoi PDFs par email
   */
  sendResultsToProducer: protectedProcedure
    .input(
      z.object({
        registrationId: z.string(),
        customMessage: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { registrationId, customMessage } = input;

      // Get registration to verify access
      const registration = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, registrationId),
        with: {
          cup: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      // Verify cup access (owner/admin only)
      await verifyCupAccess(ctx, registration.cupId, ["owner", "admin"]);

      // Send email
      const result = await sendResultsEmail({
        registrationId,
        customMessage,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de l'envoi de l'email",
        });
      }

      return {
        success: true,
        emailId: result.emailId,
        message: "Email envoye avec succes",
      };
    }),

  /**
   * Send results emails to all producers in a cup
   * Story 8.6: FR40 - Envoi PDFs par email en masse
   */
  sendResultsToAllProducers: protectedProcedure
    .input(
      z.object({
        cupId: z.string(),
        customMessage: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cupId, customMessage } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      // Verify cup status - must be in rating or completed
      if (!["rating", "completed"].includes(cup.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La cup doit etre en phase de notation ou terminee pour envoyer les resultats",
        });
      }

      // Send emails to all producers
      const result = await sendBulkResultsEmails(cupId, customMessage);

      return {
        cupId,
        cupName: cup.name,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        total: result.success + result.failed + result.skipped,
        results: result.results,
        message: `Emails envoyes: ${result.success} succes, ${result.failed} echecs, ${result.skipped} ignores`,
      };
    }),

  /**
   * Get email send status for all producers in a cup
   * Story 8.7: FR40 - Suivi des envois de syntheses
   */
  getEmailSendStatus: protectedProcedure
    .input(
      z.object({
        cupId: z.string(),
        status: z.enum(["all", "sent", "not_sent", "error"]).optional().default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cupId, status } = input;

      // Verify cup access
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get all confirmed registrations with email status
      const cupRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.cupId, cupId),
          eq(registrations.status, "confirmed")
        ),
        with: {
          producer: {
            with: {
              user: true,
            },
          },
          products: true,
        },
      });

      // Map and filter by status
      const emailStatusList = cupRegistrations
        .map((reg) => {
          const hasResults = reg.products.some((p) => p.finalScore !== null);
          let emailStatus: "sent" | "not_sent" | "error" | "no_results" = "not_sent";

          if (!hasResults) {
            emailStatus = "no_results";
          } else if (reg.synthesisEmailSentAt) {
            emailStatus = "sent";
          } else if (reg.synthesisEmailError) {
            emailStatus = "error";
          }

          return {
            registrationId: reg.id,
            producerName: reg.producer.companyName ?? "N/A",
            producerEmail: reg.producer.user.email,
            emailStatus,
            sentAt: reg.synthesisEmailSentAt,
            error: reg.synthesisEmailError,
            attempts: reg.synthesisEmailAttempts ?? 0,
            hasResults,
            productCount: reg.products.length,
            productsWithResults: reg.products.filter((p) => p.finalScore !== null).length,
          };
        })
        .filter((item) => {
          if (status === "all") return true;
          if (status === "sent") return item.emailStatus === "sent";
          if (status === "not_sent") return item.emailStatus === "not_sent" || item.emailStatus === "no_results";
          if (status === "error") return item.emailStatus === "error";
          return true;
        });

      // Count by status
      const counts = {
        total: cupRegistrations.length,
        sent: emailStatusList.filter((r) => r.emailStatus === "sent").length,
        notSent: emailStatusList.filter((r) => r.emailStatus === "not_sent").length,
        error: emailStatusList.filter((r) => r.emailStatus === "error").length,
        noResults: emailStatusList.filter((r) => r.emailStatus === "no_results").length,
      };

      return {
        cupId,
        cupName: cup.name,
        counts,
        registrations: emailStatusList,
      };
    }),

  /**
   * Retry failed email send for a single producer
   * Story 8.7
   */
  retryEmailSend: protectedProcedure
    .input(z.object({ registrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { registrationId } = input;

      // Get registration to verify access
      const registration = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, registrationId),
        with: {
          cup: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      // Verify cup access (owner/admin only)
      await verifyCupAccess(ctx, registration.cupId, ["owner", "admin"]);

      // Clear previous error before retry
      await ctx.db
        .update(registrations)
        .set({
          synthesisEmailError: null,
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, registrationId));

      // Send email
      const result = await sendResultsEmail({ registrationId });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de l'envoi de l'email",
        });
      }

      return {
        success: true,
        emailId: result.emailId,
        message: "Email renvoye avec succes",
      };
    }),

  /**
   * Retry failed email sends for all failed producers in a cup
   * Story 8.7
   */
  retryAllFailedEmails: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin"]);

      // Get all registrations with failed emails
      const failedRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.cupId, cupId),
          eq(registrations.status, "confirmed"),
          isNotNull(registrations.synthesisEmailError)
        ),
        with: {
          producer: true,
          products: true,
        },
      });

      if (failedRegistrations.length === 0) {
        return {
          cupId,
          cupName: cup.name,
          totalRetried: 0,
          success: 0,
          failed: 0,
          results: [],
          message: "Aucun email en erreur a renvoyer",
        };
      }

      const results: Array<{
        registrationId: string;
        producerName: string;
        success: boolean;
        error?: string;
      }> = [];
      let success = 0;
      let failed = 0;

      for (const reg of failedRegistrations) {
        // Skip if no products with results
        const hasResults = reg.products.some((p) => p.finalScore !== null);
        if (!hasResults) {
          results.push({
            registrationId: reg.id,
            producerName: reg.producer.companyName ?? "N/A",
            success: false,
            error: "Aucun produit avec resultats",
          });
          failed++;
          continue;
        }

        // Clear previous error
        await ctx.db
          .update(registrations)
          .set({
            synthesisEmailError: null,
            updatedAt: new Date(),
          })
          .where(eq(registrations.id, reg.id));

        const result = await sendResultsEmail({ registrationId: reg.id });

        results.push({
          registrationId: reg.id,
          producerName: reg.producer.companyName ?? "N/A",
          success: result.success,
          error: result.error,
        });

        if (result.success) {
          success++;
        } else {
          failed++;
        }
      }

      return {
        cupId,
        cupName: cup.name,
        totalRetried: failedRegistrations.length,
        success,
        failed,
        results,
        message: `Renvois: ${success} succes, ${failed} echecs`,
      };
    }),

  /**
   * Get my PDF synthesis (for producers)
   * Story 8.8: FR41 - Acces producteur a sa synthese PDF
   */
  getMyPdf: protectedProcedure
    .input(z.object({ registrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { registrationId } = input;

      // Get producer profile
      const producer = await ctx.db.query.producers.findFirst({
        where: (producers, { eq: eqFn }) =>
          eqFn(producers.userId, ctx.userId),
      });

      if (!producer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous devez avoir un profil producteur",
        });
      }

      // Get registration and verify ownership
      const registration = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.id, registrationId),
          eq(registrations.producerId, producer.id)
        ),
        with: {
          cup: true,
          products: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      // Verify results are published
      if (!registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont pas encore publies",
        });
      }

      // Verify there are products with results
      const hasResults = registration.products.some((p) => p.finalScore !== null);
      if (!hasResults) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Aucun produit note dans cette inscription",
        });
      }

      // Generate PDF
      try {
        const pdfResult = await generateProducerSynthesisPdf(registrationId);

        return {
          success: true,
          base64: pdfResult.buffer.toString("base64"),
          filename: pdfResult.filename,
          contentType: "application/pdf",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur generation PDF: ${error instanceof Error ? error.message : "Unknown"}`,
        });
      }
    }),

  /**
   * Get detailed results for all products in a cup
   * Used for interactive results visualization with radar charts
   */
  getDetailedResults: protectedProcedure
    .input(
      z.object({
        cupId: z.string(),
        categoryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cupId, categoryId } = input;

      // Verify cup access
      const { cup } = await verifyCupAccess(ctx, cupId, ["owner", "admin", "member"]);

      // Get categories
      const cupCategories = await ctx.db.query.categories.findMany({
        where: categoryId
          ? and(eq(categories.cupId, cupId), eq(categories.id, categoryId))
          : eq(categories.cupId, cupId),
        orderBy: [asc(categories.sortOrder)],
        with: {
          criteria: {
            orderBy: [asc(ratingCriteria.sortOrder)],
          },
        },
      });

      const maxScale = getMaxScoreForScale(cup.ratingScale);

      const resultsByCategory = [];

      for (const category of cupCategories) {
        // Get all products in this category
        const categoryProducts = await ctx.db
          .select({
            id: products.id,
            name: products.name,
            anonymousCode: products.anonymousCode,
            finalScore: products.finalScore,
            categoryRank: products.categoryRank,
            labelId: products.labelId,
            labelName: cupLabels.name,
            labelColor: cupLabels.color,
            producerName: producers.companyName,
            producerBrand: producers.brandName,
          })
          .from(products)
          .innerJoin(registrations, eq(products.registrationId, registrations.id))
          .innerJoin(producers, eq(registrations.producerId, producers.id))
          .leftJoin(cupLabels, eq(products.labelId, cupLabels.id))
          .where(
            and(
              eq(products.categoryId, category.id),
              eq(registrations.cupId, cupId),
              eq(registrations.status, "confirmed")
            )
          )
          .orderBy(asc(products.categoryRank));

        // Calculate category averages per criterion
        const criteriaAverages: Record<string, number> = {};
        for (const criterion of category.criteria) {
          const scores = await ctx.db
            .select({ score: criterionScores.score })
            .from(criterionScores)
            .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
            .innerJoin(products, eq(productRatings.productId, products.id))
            .innerJoin(registrations, eq(products.registrationId, registrations.id))
            .where(
              and(
                eq(criterionScores.criterionId, criterion.id),
                eq(products.categoryId, category.id),
                eq(registrations.cupId, cupId),
                isNotNull(productRatings.submittedAt)
              )
            );

          if (scores.length > 0) {
            const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
            criteriaAverages[criterion.id] = avg; // Keep in original scale
          }
        }

        // Get detailed scores for each product
        const productsWithDetails = [];
        for (const product of categoryProducts) {
          const criteriaScoresData = [];

          for (const criterion of category.criteria) {
            // Get average score for this product on this criterion
            const scores = await ctx.db
              .select({ score: criterionScores.score })
              .from(criterionScores)
              .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
              .where(
                and(
                  eq(criterionScores.criterionId, criterion.id),
                  eq(productRatings.productId, product.id),
                  isNotNull(productRatings.submittedAt)
                )
              );

            const productScore =
              scores.length > 0
                ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length // Keep in original scale
                : null;

            criteriaScoresData.push({
              criterionId: criterion.id,
              criterionName: criterion.name,
              coefficient: criterion.coefficient,
              productScore,
              categoryAverage: criteriaAverages[criterion.id] ?? null,
            });
          }

          // Fallback: compute finalScore on the fly if not persisted yet
          let computedFinalScore: number | null = product.finalScore ? parseFloat(product.finalScore) : null;
          if (computedFinalScore === null && criteriaScoresData.some(c => c.productScore !== null)) {
            let weightedSum = 0;
            let coeffSum = 0;
            for (const c of criteriaScoresData) {
              if (c.productScore !== null) {
                weightedSum += c.productScore * c.coefficient;
                coeffSum += c.coefficient;
              }
            }
            if (coeffSum > 0) {
              computedFinalScore = weightedSum / coeffSum;
            }
          }

          // Calculate percentile
          const totalInCategory = categoryProducts.length;
          const percentile =
            product.categoryRank && totalInCategory > 0
              ? Math.round(((totalInCategory - product.categoryRank) / totalInCategory) * 100)
              : null;

          productsWithDetails.push({
            id: product.id,
            name: product.name,
            anonymousCode: product.anonymousCode,
            finalScore: computedFinalScore,
            categoryRank: product.categoryRank,
            totalInCategory,
            percentile,
            producer: {
              name: product.producerName,
              brand: product.producerBrand,
            },
            label: product.labelName
              ? { name: product.labelName, color: product.labelColor }
              : null,
            criteriaScores: criteriaScoresData,
          });
        }

        resultsByCategory.push({
          category: {
            id: category.id,
            name: category.name,
            criteriaCount: category.criteria.length,
          },
          products: productsWithDetails,
          totalProducts: productsWithDetails.length,
        });
      }

      return {
        cupId,
        cupName: cup.name,
        ratingScale: cup.ratingScale,
        resultsPublishedAt: cup.resultsPublishedAt,
        categories: resultsByCategory,
      };
    }),

  /**
   * Get anonymized jury scores for a specific product
   * Shows individual jury ratings without revealing jury identity
   */
  getAnonymizedJuryScores: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { productId } = input;

      // Get product with cup info
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          category: {
            with: {
              criteria: {
                orderBy: [asc(ratingCriteria.sortOrder)],
              },
            },
          },
          registration: {
            with: {
              cup: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // Verify cup access
      await verifyCupAccess(ctx, product.registration.cupId, ["owner", "admin", "member"]);

      const cup = product.registration.cup;
      const maxScale = getMaxScoreForScale(cup.ratingScale);

      // Get all submitted ratings for this product
      const ratings = await ctx.db.query.productRatings.findMany({
        where: and(
          eq(productRatings.productId, productId),
          isNotNull(productRatings.submittedAt)
        ),
        with: {
          scores: true,
        },
        orderBy: [asc(productRatings.submittedAt)],
      });

      // Create anonymized jury identifiers (Jury #1, Jury #2, etc.)
      const juryScores = ratings.map((rating, index) => {
        const criteriaData = product.category.criteria.map((criterion) => {
          const score = rating.scores.find(
            (cs) => cs.criterionId === criterion.id
          );
          return {
            criterionId: criterion.id,
            criterionName: criterion.name,
            coefficient: criterion.coefficient,
            score: score?.score ?? null, // Keep in original scale
            rawScore: score?.score ?? null,
          };
        });

        // Calculate total score for this jury
        let totalWeightedScore = 0;
        let totalCoefficients = 0;
        criteriaData.forEach((c) => {
          if (c.score !== null) {
            totalWeightedScore += c.score * c.coefficient;
            totalCoefficients += c.coefficient;
          }
        });
        const juryTotalScore =
          totalCoefficients > 0 ? totalWeightedScore / totalCoefficients : null;

        return {
          juryId: `jury-${index + 1}`,
          juryLabel: `Jury #${index + 1}`,
          submittedAt: rating.submittedAt,
          totalScore: juryTotalScore,
          criteria: criteriaData,
          comment: rating.comment,
        };
      });

      // Calculate statistics
      const validTotalScores = juryScores
        .map((j) => j.totalScore)
        .filter((s): s is number => s !== null);

      const stats = {
        juryCount: juryScores.length,
        averageScore:
          validTotalScores.length > 0
            ? validTotalScores.reduce((a, b) => a + b, 0) / validTotalScores.length
            : null,
        minScore: validTotalScores.length > 0 ? Math.min(...validTotalScores) : null,
        maxScore: validTotalScores.length > 0 ? Math.max(...validTotalScores) : null,
        standardDeviation:
          validTotalScores.length > 1
            ? Math.sqrt(
                validTotalScores.reduce(
                  (sum, score) =>
                    sum +
                    Math.pow(
                      score -
                        validTotalScores.reduce((a, b) => a + b, 0) / validTotalScores.length,
                      2
                    ),
                  0
                ) / validTotalScores.length
              )
            : null,
      };

      return {
        productId,
        productName: product.name,
        categoryName: product.category.name,
        ratingScale: cup.ratingScale,
        criteria: product.category.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          coefficient: c.coefficient,
        })),
        juryScores,
        stats,
      };
    }),
});
