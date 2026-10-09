/**
 * Results Router - Story 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * Handles calculation of final scores, label attribution, rankings, PDF generation and email sending
 */

import { z } from "zod";
import { eq, and, sql, asc, isNotNull } from "drizzle-orm";
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
import { cupJuries } from "~/server/db/schema/juries";
import { juryPanelEnum } from "~/lib/enums";
import { hasAnyResult, panelColumns } from "~/server/db/panel-columns";
import { generateProducerSynthesisPdf } from "~/server/services/results-pdf.service";
import {
  sendResultsEmail,
  sendBulkResultsEmails,
} from "~/server/services/results-email.service";
import { getMaxScoreForScale } from "~/lib/validations/labels";
import { calculateWeightedScore } from "~/lib/validations/criteria";
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
 * `computeResults` vit désormais dans la couche service
 * (`~/server/services/results-computation.service`) : c'est une règle métier,
 * pas du transport, et `cup.publishResults` l'importait jusqu'ici en traversant
 * un routeur tRPC pour l'atteindre.
 *
 * La réexportation est conservée parce que des appelants la nomment encore
 * depuis ce module ; elle ne doit pas être doublée d'une implémentation locale.
 * Les deux copies ont coexisté quelques heures : toute correction du calcul
 * (départage, exclus, arrondi) faite d'un seul côté aurait divergé en silence,
 * sans que le typecheck puisse rien voir.
 */
export { computeResults } from "~/server/services/results-computation.service";

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
          const hasResults = reg.products.some(hasAnyResult);
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
            productsWithResults: reg.products.filter(hasAnyResult).length,
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
      const hasResults = registration.products.some(hasAnyResult);
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
        // Classement d'un panel : les moyennes ne mêlent jamais pro et public.
        panel: z.enum(juryPanelEnum).default("public"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cupId, categoryId, panel } = input;
      const panelCols = panelColumns(panel);

      // Verify cup access
      const { cup } = await requireOrganizerAndCup(ctx, cupId);

      // Get categories
      const cupCategories = await ctx.db.query.categories.findMany({
        where: categoryId
          ? and(eq(categories.cupId, cupId), eq(categories.id, categoryId))
          : eq(categories.cupId, cupId),
        orderBy: [asc(categories.sortOrder)],
        with: {
          // Grille du panel demandé seulement : le jury pro et le jury public
          // ne notent pas les mêmes critères.
          criteria: {
            where: eq(ratingCriteria.panel, panel),
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
        .innerJoin(cupJuries, eq(productRatings.juryId, cupJuries.id))
        .innerJoin(products, eq(productRatings.productId, products.id))
        .innerJoin(registrations, eq(products.registrationId, registrations.id))
        .where(
          and(
            eq(registrations.cupId, cupId),
            isNotNull(productRatings.submittedAt),
            eq(cupJuries.panel, panel)
          )
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
            anonymousCode: panelCols.anonymousCode,
            finalScore: panelCols.finalScore,
            categoryRank: panelCols.categoryRank,
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
          .orderBy(asc(panelCols.categoryRank));

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
          if (computedFinalScore === null) {
            // Moyenne pondérée : une seule implémentation pour toute
            // l'application (`~/lib/validations/criteria`). Les copies locales
            // avaient fini par diverger sur les arrondis, et deux pages
            // affichaient deux notes finales pour le même produit.
            // Les critères non notés sont écartés avant l'appel : le helper
            // renvoie 0 sur une liste vide, alors qu'ici « aucune note » doit
            // rester `null` — sinon un produit non noté s'afficherait à 0/20.
            const notedCriteria = criteriaScoresData.flatMap((c) =>
              c.productScore === null
                ? []
                : [{ score: c.productScore, criterionCoefficient: c.coefficient }]
            );
            if (notedCriteria.length > 0) {
              computedFinalScore = calculateWeightedScore(notedCriteria);
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
            // Labels décernés par le jury public seul.
            label:
              panel === "public" && product.labelName
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
        panel,
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
        panel: z.enum(juryPanelEnum).default("public"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { productId, panel } = input;

      // Get product with cup info
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          category: {
            with: {
              // Grille du panel demandé seulement.
              criteria: {
                where: eq(ratingCriteria.panel, panel),
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

      // Notes déposées par les jurés du panel demandé.
      const allRatings = await ctx.db.query.productRatings.findMany({
        where: and(
          eq(productRatings.productId, productId),
          isNotNull(productRatings.submittedAt)
        ),
        with: {
          scores: true,
          jury: { columns: { panel: true } },
        },
        orderBy: [asc(productRatings.submittedAt)],
      });
      const ratings = allRatings.filter((rating) => rating.jury.panel === panel);

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

        // Note globale de ce juré, via l'implémentation partagée. Les critères
        // laissés vides sont retirés d'abord : sans note, le total doit rester
        // `null` (« non noté ») et non 0.
        const notedCriteria = criteriaData.flatMap((c) =>
          c.score === null
            ? []
            : [{ score: c.score, criterionCoefficient: c.coefficient }]
        );
        const juryTotalScore =
          notedCriteria.length > 0 ? calculateWeightedScore(notedCriteria) : null;

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
        panel,
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
