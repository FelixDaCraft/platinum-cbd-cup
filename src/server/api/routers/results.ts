/**
 * Results Router - Story 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * Handles calculation of final scores, label attribution, rankings, PDF generation and email sending
 */

import { z } from "zod";
import { eq, and, sql, desc, asc, isNotNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  organizerProcedure,
  type AuthedContext,
} from "~/server/api/trpc";
import { products } from "~/server/db/schema/products";
import { categories } from "~/server/db/schema/categories";
import { cups } from "~/server/db/schema/cups";
import { cupLabels } from "~/server/db/schema/cup-labels";
import { productRatings, criterionScores } from "~/server/db/schema/ratings";
import { ratingCriteria } from "~/server/db/schema/rating-criteria";
import { registrations } from "~/server/db/schema/registrations";
import { producers } from "~/server/db/schema/producers";
import { generateProducerSynthesisPdf } from "~/server/services/results-pdf.service";
import {
  sendResultsEmail,
  sendBulkResultsEmails,
} from "~/server/services/results-email.service";
import { getMaxScoreForScale } from "~/lib/validations/labels";
import { getCupOrThrow } from "~/server/api/helpers/cup";

/**
 * Charge la cup d'une procédure organisateur.
 * Le contrôle de rôle est porté par `organizerProcedure` : ce helper ne fait
 * plus que résoudre la cup, via l'unique implémentation de helpers/cup.ts.
 * (Les anciens tableaux de rôles « owner/admin/member » étaient des vestiges
 * multi-tenant, ignorés depuis le passage single-tenant.)
 */
async function requireOrganizerAndCup(ctx: AuthedContext, cupId: string) {
  return { cup: await getCupOrThrow(ctx.db, cupId) };
}

/**
 * Core calculation logic - computes final scores, ranks, and labels for all products in a cup.
 * Extracted as a helper so it can be called from both calculateResults and publishResults.
 * Exported so cup.publishResults can also use it.
 *
 * Toutes les lectures sont agrégées en amont (une poignée de requêtes pour
 * toute la cup, au lieu d'une par note) et toutes les écritures sont commitées
 * en une transaction : pendant le calcul, le palmarès public et le widget ne
 * doivent jamais voir un classement à moitié réécrit.
 */
export async function computeResults(
  db: typeof import("~/server/db").db,
  cupId: string,
  // Conservé pour les appelants (cup.publishResults) : les scores restent
  // exprimés dans l'échelle d'origine, le calcul n'a pas besoin de la lire.
  _cup: { ratingScale: string }
) {
  const cupCategories = await db.query.categories.findMany({
    where: eq(categories.cupId, cupId),
  });

  if (cupCategories.length === 0) {
    return { productsProcessed: 0, labelsAttributed: 0 };
  }

  const categoryIds = cupCategories.map((c) => c.id);

  const labels = await db.query.cupLabels.findMany({
    where: eq(cupLabels.cupId, cupId),
    orderBy: [desc(cupLabels.minScore)],
  });

  // Produits éligibles au classement de la cup, avec la date d'inscription
  // qui sert de dernier départage.
  const eligibleProducts = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      registrationId: products.registrationId,
      registeredAt: registrations.createdAt,
      disqualified: products.disqualified,
    })
    .from(products)
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        inArray(products.categoryId, categoryIds),
        eq(registrations.cupId, cupId),
        eq(registrations.status, "confirmed"),
        // Les produits exclus disparaissent de tout affichage ; les
        // disqualifiés restent notés (le palmarès les montre avec un badge
        // « DISQUALIFIÉ ») mais sont sortis du classement plus bas.
        eq(products.excludedFromResults, false)
      )
    );

  // Somme pondérée et somme des coefficients par note déposée : la moyenne
  // d'un produit est la moyenne des moyennes de ses jurés.
  const ratingAggregates = await db
    .select({
      productId: productRatings.productId,
      ratingId: productRatings.id,
      weightedSum: sql<string>`sum(${criterionScores.score} * ${ratingCriteria.coefficient})`,
      coefficientSum: sql<string>`sum(${ratingCriteria.coefficient})`,
    })
    .from(criterionScores)
    .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
    .innerJoin(ratingCriteria, eq(criterionScores.criterionId, ratingCriteria.id))
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId, productRatings.id);

  // Nombre de notes déposées par produit — y compris celles sans score, qui
  // n'entrent pas dans la moyenne mais comptent dans le départage.
  const ratingCounts = await db
    .select({
      productId: productRatings.productId,
      juryCount: sql<string>`count(*)`,
    })
    .from(productRatings)
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId);

  const juryCountByProduct = new Map(
    ratingCounts.map((r) => [r.productId, Number(r.juryCount)])
  );

  const averagesByProduct = new Map<string, number[]>();
  for (const row of ratingAggregates) {
    const coefficientSum = Number(row.coefficientSum);
    if (coefficientSum <= 0) continue;

    const averages = averagesByProduct.get(row.productId) ?? [];
    averages.push(Number(row.weightedSum) / coefficientSum);
    averagesByProduct.set(row.productId, averages);
  }

  type ProductUpdate = {
    id: string;
    finalScore: string | null;
    labelId: string | null;
    categoryRank: number | null;
  };

  const updates: ProductUpdate[] = [];
  let productsProcessed = 0;
  let labelsAttributed = 0;

  for (const category of cupCategories) {
    const categoryProducts = eligibleProducts.filter(
      (p) => p.categoryId === category.id
    );

    const productScores: {
      id: string;
      finalScore: number;
      juryCount: number;
      registeredAt: Date;
    }[] = [];

    for (const product of categoryProducts) {
      const averages = averagesByProduct.get(product.id);

      // Aucune note exploitable : on efface un éventuel résultat antérieur
      // plutôt que de laisser un rang ou un label périmé.
      if (!averages || averages.length === 0) {
        updates.push({
          id: product.id,
          finalScore: null,
          labelId: null,
          categoryRank: null,
        });
        continue;
      }

      const finalScore = averages.reduce((a, b) => a + b, 0) / averages.length;
      productsProcessed++;

      // Un disqualifié garde sa note — le palmarès public l'affiche au bas de
      // sa catégorie avec un badge « DISQUALIFIÉ », et la requête de la page
      // écarte les produits sans finalScore. Mais il ne prend ni rang ni
      // label : sans cela il consommait une place de podium et le vrai premier
      // s'affichait « 2e ».
      if (product.disqualified) {
        updates.push({
          id: product.id,
          finalScore: finalScore.toFixed(2),
          labelId: null,
          categoryRank: null,
        });
        continue;
      }

      productScores.push({
        id: product.id,
        finalScore,
        juryCount: juryCountByProduct.get(product.id) ?? averages.length,
        registeredAt: product.registeredAt,
      });
    }

    productScores.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      if (b.juryCount !== a.juryCount) {
        return b.juryCount - a.juryCount;
      }
      return a.registeredAt.getTime() - b.registeredAt.getTime();
    });

    for (let i = 0; i < productScores.length; i++) {
      const { id, finalScore } = productScores[i]!;

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

      updates.push({
        id,
        finalScore: finalScore.toFixed(2),
        labelId: matchedLabelId,
        categoryRank: i + 1,
      });
    }
  }

  // Produits exclus des résultats : ils ne doivent conserver ni note, ni rang,
  // ni label d'un calcul antérieur. Résolus par identifiant et via la jointure
  // sur l'inscription, pour que le recalcul d'une cup ne puisse jamais toucher
  // un produit d'une autre cup.
  const excludedProducts = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        eq(products.excludedFromResults, true)
      )
    );

  await db.transaction(async (tx) => {
    if (excludedProducts.length > 0) {
      await tx
        .update(products)
        .set({
          finalScore: null,
          labelId: null,
          categoryRank: null,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            products.id,
            excludedProducts.map((p) => p.id)
          )
        );
    }

    for (const update of updates) {
      await tx
        .update(products)
        .set({
          finalScore: update.finalScore,
          labelId: update.labelId,
          categoryRank: update.categoryRank,
          updatedAt: new Date(),
        })
        .where(eq(products.id, update.id));
    }
  });

  return { productsProcessed, labelsAttributed };
}

export const resultsRouter = createTRPCRouter({
  /**
   * Update PDF customization settings
   * Story 8.3: Personnalisation Template PDF
   */
  updatePdfSettings: organizerProcedure
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
      await requireOrganizerAndCup(ctx, cupId);

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
  getPdfSettings: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Verify cup access
      const { cup } = await requireOrganizerAndCup(ctx, cupId);

      return {
        cupId: cup.id,
        cupName: cup.name,
        pdfLogoUrl: cup.pdfLogoUrl,
        pdfIntroText: cup.pdfIntroText,
        resultsPublishedAt: cup.resultsPublishedAt,
      };
    }),

  // publishResults / unpublishResults vivent dans cup.ts : seul ce chemin
  // exige que la notation soit clôturée (status = completed) et positionne
  // resultsVisibility. Les doublons qui vivaient ici étaient plus permissifs.

  /**
   * Generate synthesis PDF for all products of a producer registration
   * Story 8.4: FR38 - Génération PDFs synthèse
   */
  generateProducerPdf: organizerProcedure
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
      await requireOrganizerAndCup(ctx, registration.cupId);

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
   * Send results email to a single producer
   * Story 8.6: FR40 - Envoi PDFs par email
   */
  sendResultsToProducer: organizerProcedure
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
      await requireOrganizerAndCup(ctx, registration.cupId);

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
  sendResultsToAllProducers: organizerProcedure
    .input(
      z.object({
        cupId: z.string(),
        customMessage: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cupId, customMessage } = input;

      // Verify cup access (owner/admin only)
      const { cup } = await requireOrganizerAndCup(ctx, cupId);

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
  getEmailSendStatus: organizerProcedure
    .input(
      z.object({
        cupId: z.string(),
        status: z.enum(["all", "sent", "not_sent", "error"]).optional().default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cupId, status } = input;

      // Verify cup access
      const { cup } = await requireOrganizerAndCup(ctx, cupId);

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
  retryEmailSend: organizerProcedure
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
      await requireOrganizerAndCup(ctx, registration.cupId);

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
  getDetailedResults: organizerProcedure
    .input(
      z.object({
        cupId: z.string(),
        categoryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cupId, categoryId } = input;

      // Verify cup access
      const { cup } = await requireOrganizerAndCup(ctx, cupId);

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

      // Une seule agrégation pour toute la cup : la version précédente faisait
      // une requête par (catégorie x critère) puis par (produit x critère),
      // soit un millier d'allers-retours sur une cup de taille réelle.
      const scoreAggregates = await ctx.db
        .select({
          productId: productRatings.productId,
          criterionId: criterionScores.criterionId,
          categoryId: products.categoryId,
          total: sql<string>`sum(${criterionScores.score})`,
          count: sql<string>`count(*)`,
        })
        .from(criterionScores)
        .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
        .innerJoin(products, eq(productRatings.productId, products.id))
        .innerJoin(registrations, eq(products.registrationId, registrations.id))
        .where(
          and(eq(registrations.cupId, cupId), isNotNull(productRatings.submittedAt))
        )
        .groupBy(
          productRatings.productId,
          criterionScores.criterionId,
          products.categoryId
        );

      // sum()/count() reviennent en bigint, donc en chaîne côté driver.
      const addTo = (
        map: Map<string, { total: number; count: number }>,
        key: string,
        total: number,
        count: number
      ) => {
        const acc = map.get(key) ?? { total: 0, count: 0 };
        acc.total += total;
        acc.count += count;
        map.set(key, acc);
      };

      const byProductCriterion = new Map<string, { total: number; count: number }>();
      const byCategoryCriterion = new Map<string, { total: number; count: number }>();

      for (const row of scoreAggregates) {
        const total = Number(row.total);
        const count = Number(row.count);
        addTo(byProductCriterion, `${row.productId}:${row.criterionId}`, total, count);
        addTo(byCategoryCriterion, `${row.categoryId}:${row.criterionId}`, total, count);
      }

      const averageOf = (
        map: Map<string, { total: number; count: number }>,
        key: string
      ) => {
        const acc = map.get(key);
        return acc && acc.count > 0 ? acc.total / acc.count : null;
      };

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
          const avg = averageOf(byCategoryCriterion, `${category.id}:${criterion.id}`);
          if (avg !== null) {
            criteriaAverages[criterion.id] = avg; // Keep in original scale
          }
        }

        // Get detailed scores for each product
        const productsWithDetails = [];
        for (const product of categoryProducts) {
          const criteriaScoresData = [];

          for (const criterion of category.criteria) {
            // Moyenne du produit sur ce critère, issue de l'agrégat ci-dessus.
            const productScore = averageOf(
              byProductCriterion,
              `${product.id}:${criterion.id}`
            );

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
  getAnonymizedJuryScores: organizerProcedure
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
      await requireOrganizerAndCup(ctx, product.registration.cupId);

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
