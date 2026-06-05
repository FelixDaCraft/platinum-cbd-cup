import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, count, isNotNull, ne, desc } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { auth } from "~/lib/auth";
import * as schema from "~/server/db/schema";
import {
  producerProfileUpdateSchema,
  producerLogoUpdateSchema,
} from "~/lib/validations/producer";
import {
  generateProductSynthesisPdf,
  generateProducerSynthesisPdf,
  getProductResultsForPdf,
} from "~/server/services/results-pdf.service";
import { getMaxScoreForScale } from "~/lib/validations/labels";

type ProtectedContext = {
  db: typeof db;
  userId: string;
};

const getProducerIdByUser = async (ctx: ProtectedContext) => {
  const producer = await ctx.db.query.producers.findFirst({
    where: (producers, { eq: eqFn }) => eqFn(producers.userId, ctx.userId),
    columns: { id: true },
  });

  return producer?.id ?? null;
};

const requireProducerIdByUser = async (
  ctx: ProtectedContext,
  message: string
) => {
  const producerId = await getProducerIdByUser(ctx);

  if (!producerId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message,
    });
  }

  return producerId;
};

export const producerRouter = createTRPCRouter({
  /**
   * List all producers (single-tenant).
   * Used in the dashboard global producers page. Returns names, emails,
   * phone and brand — organizer-only.
   */
  listByOrganization: organizerProcedure.query(async ({ ctx }) => {
    const producers = await ctx.db.query.producers.findMany({
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
        registrations: {
          with: {
            cup: {
              columns: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [desc(schema.producers.createdAt)],
    });

    return producers.map((p) => ({
      id: p.id,
      companyName: p.companyName,
      brandName: p.brandName,
      phone: p.phone,
      website: p.website,
      userName: p.user.name,
      userEmail: p.user.email,
      cups: p.registrations.map((r) => ({
        id: r.cup.id,
        name: r.cup.name,
      })),
      createdAt: p.createdAt,
    }));
  }),

  /**
   * Delete a producer profile (organizer only).
   * Cascades to registrations via DB FK
   */
  deleteByOrganization: organizerProcedure
    .input(z.object({ producerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const producer = await ctx.db.query.producers.findFirst({
        where: eq(schema.producers.id, input.producerId),
      });

      if (!producer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producteur non trouve",
        });
      }

      await ctx.db
        .delete(schema.producers)
        .where(eq(schema.producers.id, input.producerId));

      return { success: true };
    }),

  /**
   * Create a producer profile for the current user (single-tenant).
   * A user can have at most ONE producer profile.
   */
  createProfile: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1).max(100),
        brandName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingProducer = await ctx.db.query.producers.findFirst({
        where: (producers, { eq: eqFn }) => eqFn(producers.userId, ctx.userId),
      });

      if (existingProducer) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Un profil producteur existe deja",
        });
      }

      const producerId = nanoid();
      const [producer] = await ctx.db
        .insert(schema.producers)
        .values({
          id: producerId,
          userId: ctx.userId,
          companyName: input.companyName,
          brandName: input.brandName,
        })
        .returning();

      return producer;
    }),

  /**
   * Get the current user's producer profile.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const producer = await ctx.db.query.producers.findFirst({
      where: (producers, { eq: eqFn }) => eqFn(producers.userId, ctx.userId),
    });

    if (!producer) {
      return null;
    }

    return {
      ...producer,
      email: ctx.session.user.email,
      name: ctx.session.user.name,
    };
  }),

  /**
   * Check if current user has a producer profile
   */
  hasProfile: protectedProcedure.query(async ({ ctx }) => {
    const producer = await ctx.db.query.producers.findFirst({
      where: (producers, { eq: eqFn }) => eqFn(producers.userId, ctx.userId),
      columns: { id: true },
    });

    return !!producer;
  }),

  /**
   * Get dashboard statistics for the current producer
   * Returns counts of active competitions, registered products, and obtained labels
   */
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    // Get producer profile
    const producerId = await getProducerIdByUser(ctx);

    if (!producerId) {
      return {
        activeCompetitions: 0,
        registeredProducts: 0,
        obtainedLabels: 0,
      };
    }

    // Count active competitions (confirmed registrations in non-completed cups)
    const activeCompetitionsResult = await ctx.db
      .select({ count: count() })
      .from(schema.registrations)
      .innerJoin(schema.cups, eq(schema.registrations.cupId, schema.cups.id))
      .where(
        and(
          eq(schema.registrations.producerId, producerId),
          eq(schema.registrations.status, "confirmed"),
          ne(schema.cups.status, "completed")
        )
      );

    // Count all registered products
    const registeredProductsResult = await ctx.db
      .select({ count: count() })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(eq(schema.registrations.producerId, producerId));

    // Count products with labels
    const obtainedLabelsResult = await ctx.db
      .select({ count: count() })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(
        and(
          eq(schema.registrations.producerId, producerId),
          isNotNull(schema.products.labelId)
        )
      );

    return {
      activeCompetitions: activeCompetitionsResult[0]?.count ?? 0,
      registeredProducts: registeredProductsResult[0]?.count ?? 0,
      obtainedLabels: obtainedLabelsResult[0]?.count ?? 0,
    };
  }),

  /**
   * Get recent registrations for the current producer
   * Used in the producer dashboard timeline
   */
  getMyRegistrations: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const producerId = await getProducerIdByUser(ctx);

      if (!producerId) {
        return [];
      }

      const limit = input?.limit ?? 10;

      // Get registrations with cup info and product count
      const registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.producerId, producerId),
        with: {
          cup: {
            columns: {
              id: true,
              name: true,
              status: true,
              resultsPublishedAt: true,
            },
          },
          products: {
            columns: { id: true, finalScore: true, labelId: true },
          },
        },
        orderBy: [desc(schema.registrations.createdAt)],
        limit,
      });

      return registrations.map((reg) => ({
        id: reg.id,
        cupId: reg.cup.id,
        cupName: reg.cup.name,
        cupStatus: reg.cup.status,
        status: reg.status,
        productsCount: reg.products.length,
        hasResults: reg.products.some((p) => p.finalScore !== null),
        hasLabels: reg.products.some((p) => p.labelId !== null),
        createdAt: reg.createdAt,
        resultsPublishedAt: reg.cup.resultsPublishedAt,
      }));
    }),

  /**
   * Story 4.Y: Get all labels obtained by the current producer
   * Returns products with labels, their scores, and competition info
   */
  getMyLabels: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
    const producerId = await getProducerIdByUser(ctx);

    if (!producerId) {
      return [];
    }

    // Get all products with labels for this producer
    const limit = input?.limit;

    let query = ctx.db
      .select({
        productId: schema.products.id,
        productName: schema.products.name,
        categoryName: schema.categories.name,
        finalScore: schema.products.finalScore,
        categoryRank: schema.products.categoryRank,
        disqualified: schema.products.disqualified,
        labelId: schema.cupLabels.id,
        labelName: schema.cupLabels.name,
        labelColor: schema.cupLabels.color,
        cupId: schema.cups.id,
        cupName: schema.cups.name,
        cupRatingScale: schema.cups.ratingScale,
        resultsPublishedAt: schema.cups.resultsPublishedAt,
        registrationId: schema.registrations.id,
      })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .innerJoin(
        schema.cups,
        eq(schema.registrations.cupId, schema.cups.id)
      )
      .innerJoin(
        schema.cupLabels,
        eq(schema.products.labelId, schema.cupLabels.id)
      )
      .leftJoin(
        schema.categories,
        eq(schema.products.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.registrations.producerId, producerId),
          isNotNull(schema.products.labelId),
          // A disqualified product is never counted as a label obtained.
          eq(schema.products.disqualified, false),
          isNotNull(schema.cups.resultsPublishedAt)
        )
      )
      .orderBy(desc(schema.cups.resultsPublishedAt));

    const productsWithLabels = limit
      ? await query.limit(limit)
      : await query;

    return productsWithLabels.map((p) => ({
      id: p.productId,
      productName: p.productName,
      categoryName: p.categoryName ?? "Sans catégorie",
      finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
      categoryRank: p.categoryRank,
      label: {
        id: p.labelId,
        name: p.labelName,
        color: p.labelColor,
      },
      cup: {
        id: p.cupId,
        name: p.cupName,
        ratingScale: p.cupRatingScale,
      },
      registrationId: p.registrationId,
      obtainedAt: p.resultsPublishedAt,
    }));
  }),

  /**
   * Story 4.X: Get all results grouped by cup for the current producer
   * Returns cups with published results and all products (with or without labels)
   */
  getMyResultsByCup: protectedProcedure.query(async ({ ctx }) => {
    const producerId = await getProducerIdByUser(ctx);

    if (!producerId) {
      return [];
    }

    // Get all products from cups with published results
    const productsWithResults = await ctx.db
      .select({
        productId: schema.products.id,
        productName: schema.products.name,
        categoryName: schema.categories.name,
        finalScore: schema.products.finalScore,
        categoryRank: schema.products.categoryRank,
        disqualified: schema.products.disqualified,
        labelId: schema.cupLabels.id,
        labelName: schema.cupLabels.name,
        labelColor: schema.cupLabels.color,
        cupId: schema.cups.id,
        cupName: schema.cups.name,
        cupRatingScale: schema.cups.ratingScale,
        resultsPublishedAt: schema.cups.resultsPublishedAt,
        registrationId: schema.registrations.id,
      })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .innerJoin(
        schema.cups,
        eq(schema.registrations.cupId, schema.cups.id)
      )
      .leftJoin(
        schema.cupLabels,
        eq(schema.products.labelId, schema.cupLabels.id)
      )
      .leftJoin(
        schema.categories,
        eq(schema.products.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.registrations.producerId, producerId),
          isNotNull(schema.cups.resultsPublishedAt),
          isNotNull(schema.products.finalScore)
        )
      )
      .orderBy(desc(schema.cups.resultsPublishedAt), schema.products.name);

    // Group products by cup
    const cupMap = new Map<string, {
      id: string;
      name: string;
      ratingScale: string;
      resultsPublishedAt: Date;
      products: Array<{
        id: string;
        name: string;
        categoryName: string;
        finalScore: number | null;
        categoryRank: number | null;
        disqualified: boolean;
        label: { id: string; name: string; color: string } | null;
        registrationId: string;
      }>;
    }>();

    for (const p of productsWithResults) {
      if (!cupMap.has(p.cupId)) {
        cupMap.set(p.cupId, {
          id: p.cupId,
          name: p.cupName,
          ratingScale: p.cupRatingScale,
          resultsPublishedAt: p.resultsPublishedAt!,
          products: [],
        });
      }

      cupMap.get(p.cupId)!.products.push({
        id: p.productId,
        name: p.productName,
        categoryName: p.categoryName ?? "Sans catégorie",
        finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
        categoryRank: p.categoryRank,
        disqualified: p.disqualified,
        // Disqualified products never carry a label.
        label:
          p.disqualified || !p.labelId
            ? null
            : { id: p.labelId, name: p.labelName!, color: p.labelColor! },
        registrationId: p.registrationId,
      });
    }

    return Array.from(cupMap.values());
  }),

  /**
   * Update the current user's producer profile
   */
  updateProfile: protectedProcedure
    .input(producerProfileUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      const [updatedProducer] = await ctx.db
        .update(schema.producers)
        .set({
          companyName: input.companyName,
          brandName: input.brandName,
          siret: input.siret || null,
          website: input.website || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.producers.id, producerId))
        .returning();

      return updatedProducer;
    }),

  /**
   * Update the current user's producer logo
   */
  updateLogo: protectedProcedure
    .input(producerLogoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      const [updatedProducer] = await ctx.db
        .update(schema.producers)
        .set({
          logo: input.logo || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.producers.id, producerId))
        .returning();

      return updatedProducer;
    }),

  /**
   * Update notification preferences for the current producer
   */
  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        notifyOnProductStatusChange: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      const [updatedProducer] = await ctx.db
        .update(schema.producers)
        .set({
          notifyOnProductStatusChange: input.notifyOnProductStatusChange,
          updatedAt: new Date(),
        })
        .where(eq(schema.producers.id, producerId))
        .returning();

      return updatedProducer;
    }),

  /**
   * Get results for a specific cup registration
   * Story 8.8: Acces Producteur a sa Synthese PDF
   */
  getCupResults: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { cupId } = input;

      // Get producer profile
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      // Get cup with results status
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Get registration for this producer and cup
      const registration = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(schema.registrations.cupId, cupId),
          eq(schema.registrations.producerId, producerId)
        ),
        with: {
          products: {
            with: {
              category: true,
              label: true,
            },
          },
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune inscription trouvee pour cette cup",
        });
      }

      // Check if results are published
      const resultsPublished = !!cup.resultsPublishedAt;

      if (!resultsPublished) {
        return {
          cupId,
          cupName: cup.name,
          resultsPublished: false,
          message: "Les resultats sont en cours de traitement",
          registration: {
            id: registration.id,
            status: registration.status,
            productCount: registration.products.length,
          },
          products: [], // Don't show products if results not published
        };
      }

      // Results are published - return full data
      const products = registration.products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? "Sans categorie",
        finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
        categoryRank: p.categoryRank,
        label: p.label
          ? {
              name: p.label.name,
              color: p.label.color,
            }
          : null,
        canDownloadPdf: p.finalScore !== null,
      }));

      return {
        cupId,
        cupName: cup.name,
        resultsPublished: true,
        publishedAt: cup.resultsPublishedAt,
        registration: {
          id: registration.id,
          status: registration.status,
          productCount: registration.products.length,
        },
        products,
        canDownloadSynthesis: products.some((p) => p.finalScore !== null),
      };
    }),

  /**
   * Download PDF for a single product (producer access)
   * Story 8.8
   */
  downloadProductPdf: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { productId } = input;

      // Get producer profile
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      // Get product with registration verification
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, productId),
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
          message: "Produit non trouve",
        });
      }

      // Verify this product belongs to the producer
      if (product.registration.producerId !== producerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ce produit ne vous appartient pas",
        });
      }

      // Check if results are published
      if (!product.registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont pas encore publies",
        });
      }

      // Check if product has results
      if (!product.finalScore) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ce produit n'a pas encore de resultats",
        });
      }

      // Generate PDF
      try {
        const result = await generateProductSynthesisPdf(productId);

        return {
          success: true,
          filename: result.filename,
          pdfBase64: result.buffer.toString("base64"),
          mimeType: "application/pdf",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors de la generation du PDF",
        });
      }
    }),

  /**
   * Download synthesis PDF for all products in a registration (producer access)
   * Story 8.8
   */
  downloadRegistrationPdf: protectedProcedure
    .input(z.object({ registrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { registrationId } = input;

      // Get producer profile
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      // Get registration with cup
      const registration = await ctx.db.query.registrations.findFirst({
        where: eq(schema.registrations.id, registrationId),
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

      // Verify this registration belongs to the producer
      if (registration.producerId !== producerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cette inscription ne vous appartient pas",
        });
      }

      // Check if results are published
      if (!registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont pas encore publies",
        });
      }

      // Check if there are products with results
      const hasResults = registration.products.some((p) => p.finalScore !== null);
      if (!hasResults) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Aucun produit avec resultats",
        });
      }

      // Generate PDF
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
          message: error instanceof Error ? error.message : "Erreur lors de la generation du PDF",
        });
      }
    }),

  /**
   * Get detailed results for a single product (producer access)
   * Story 8.9: Consultation detaillee des notes par producteur
   */
  getProductDetailedResults: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { productId } = input;

      // Get producer profile
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      // Get product with registration verification
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, productId),
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
          message: "Produit non trouve",
        });
      }

      // Verify this product belongs to the producer
      if (product.registration.producerId !== producerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ce produit ne vous appartient pas",
        });
      }

      // Check if results are published
      if (!product.registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont pas encore publies",
        });
      }

      // Check if product has results
      if (!product.finalScore) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ce produit n'a pas encore de resultats",
        });
      }

      // Get detailed results using the PDF service function
      const resultData = await getProductResultsForPdf(productId);

      if (!resultData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Donnees de resultat non trouvees",
        });
      }

      return {
        productId: productId,
        productName: resultData.productName,
        anonymousCode: resultData.anonymousCode,
        categoryName: resultData.categoryName,
        finalScore: resultData.finalScore,
        categoryRank: resultData.categoryRank,
        totalInCategory: resultData.totalInCategory,
        label: resultData.label,
        criteriaScores: resultData.criteriaScores,
        cupName: product.registration.cup.name,
      };
    }),

  /**
   * Get comparison of multiple products (producer access)
   * Story 8.9: Comparatif des performances
   */
  getProductsComparison: protectedProcedure
    .input(z.object({
      productIds: z.array(z.string()).min(2).max(10),
    }))
    .query(async ({ ctx, input }) => {
      const { productIds } = input;

      // Get producer profile
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouve"
      );

      const productsData = [];

      for (const productId of productIds) {
        // Get product with registration verification
        const product = await ctx.db.query.products.findFirst({
          where: eq(schema.products.id, productId),
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
            message: `Produit ${productId} non trouve`,
          });
        }

        // Verify this product belongs to the producer
        if (product.registration.producerId !== producerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Le produit ${productId} ne vous appartient pas`,
          });
        }

        // Check if results are published
        if (!product.registration.cup.resultsPublishedAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Les resultats ne sont pas encore publies",
          });
        }

        // Skip products without results
        if (!product.finalScore) {
          continue;
        }

        // Get detailed results
        const resultData = await getProductResultsForPdf(productId);

        if (resultData) {
          productsData.push({
            productId: productId,
            productName: resultData.productName,
            categoryName: resultData.categoryName,
            finalScore: resultData.finalScore,
            label: resultData.label,
            criteriaScores: resultData.criteriaScores,
          });
        }
      }

      if (productsData.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Au moins 2 produits avec resultats sont necessaires pour une comparaison",
        });
      }

      // Build comparison data: for each criterion, show scores across products
      const criteriaMap = new Map<string, {
        criterionName: string;
        coefficient: number;
        scores: Array<{ productId: string; productName: string; productScore: number | null; categoryAverage: number | null }>;
      }>();

      for (const product of productsData) {
        for (const criterion of product.criteriaScores) {
          if (!criteriaMap.has(criterion.criterionName)) {
            criteriaMap.set(criterion.criterionName, {
              criterionName: criterion.criterionName,
              coefficient: criterion.coefficient,
              scores: [],
            });
          }
          criteriaMap.get(criterion.criterionName)!.scores.push({
            productId: product.productId,
            productName: product.productName,
            productScore: criterion.productScore,
            categoryAverage: criterion.categoryAverage,
          });
        }
      }

      return {
        products: productsData.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          categoryName: p.categoryName,
          finalScore: p.finalScore,
          label: p.label,
        })),
        criteriaComparison: Array.from(criteriaMap.values()),
      };
    }),

  /**
   * Get detailed criteria scores for a producer's product (for radar chart)
   * Only available after results are published
   */
  getMyProductCriteriaScores: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouvé"
      );

      // Get product with all relations
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
        with: {
          category: {
            with: {
              criteria: {
                orderBy: (criteria, { asc }) => [asc(criteria.sortOrder)],
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
          message: "Produit non trouvé",
        });
      }

      // Verify product belongs to this producer
      if (product.registration.producerId !== producerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ce produit ne vous appartient pas",
        });
      }

      // Verify results are published
      if (!product.registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Les résultats ne sont pas encore publiés",
        });
      }

      const cup = product.registration.cup;
      const maxScale = getMaxScoreForScale(cup.ratingScale);

      // Get all submitted ratings for this product to calculate averages
      const ratings = await ctx.db.query.productRatings.findMany({
        where: and(
          eq(schema.productRatings.productId, input.productId),
          isNotNull(schema.productRatings.submittedAt)
        ),
        with: {
          scores: true,
        },
      });

      // Calculate scores per criterion for this product
      const criteriaScoresMap = new Map<string, { total: number; count: number }>();
      for (const rating of ratings) {
        for (const score of rating.scores) {
          const existing = criteriaScoresMap.get(score.criterionId) ?? { total: 0, count: 0 };
          existing.total += score.score; // Keep in original scale
          existing.count += 1;
          criteriaScoresMap.set(score.criterionId, existing);
        }
      }

      // Get category averages for comparison
      // Get all products in same category with final scores
      const categoryProducts = await ctx.db.query.products.findMany({
        where: and(
          eq(schema.products.categoryId, product.categoryId),
          isNotNull(schema.products.finalScore)
        ),
        columns: { id: true },
      });

      const categoryProductIds = categoryProducts.map((p) => p.id);

      // Get all criterion scores for category
      const categoryScores = categoryProductIds.length > 0
        ? await ctx.db.query.criterionScores.findMany({
            where: (cs, { inArray }) => inArray(cs.productRatingId,
              // Get rating IDs for these products
              ctx.db
                .select({ id: schema.productRatings.id })
                .from(schema.productRatings)
                .where(and(
                  isNotNull(schema.productRatings.submittedAt),
                  // This is complex, we'll calculate differently
                ))
            ),
          })
        : [];

      // Simpler approach: Calculate category averages from all ratings in category
      const categoryRatings = categoryProductIds.length > 0
        ? await ctx.db.query.productRatings.findMany({
            where: (pr, { and: andFn, inArray }) => andFn(
              inArray(pr.productId, categoryProductIds),
              isNotNull(pr.submittedAt)
            ),
            with: {
              scores: true,
            },
          })
        : [];

      const categoryAveragesMap = new Map<string, { total: number; count: number }>();
      for (const rating of categoryRatings) {
        for (const score of rating.scores) {
          const existing = categoryAveragesMap.get(score.criterionId) ?? { total: 0, count: 0 };
          existing.total += score.score; // Keep in original scale
          existing.count += 1;
          categoryAveragesMap.set(score.criterionId, existing);
        }
      }

      // Build criteria scores array
      const criteriaScores = product.category.criteria.map((criterion) => {
        const productData = criteriaScoresMap.get(criterion.id);
        const categoryData = categoryAveragesMap.get(criterion.id);

        return {
          criterionId: criterion.id,
          criterionName: criterion.name,
          coefficient: criterion.coefficient,
          productScore: productData && productData.count > 0
            ? productData.total / productData.count
            : null,
          categoryAverage: categoryData && categoryData.count > 0
            ? categoryData.total / categoryData.count
            : null,
        };
      });

      return {
        productId: product.id,
        productName: product.name,
        categoryName: product.category.name,
        finalScore: product.finalScore ? parseFloat(product.finalScore) : null,
        categoryRank: product.categoryRank,
        ratingScale: cup.ratingScale,
        criteriaScores,
      };
    }),

  /**
   * Get anonymized jury scores for a producer's product
   * Only available after results are published
   */
  getMyProductJuryScores: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const producerId = await requireProducerIdByUser(
        ctx,
        "Profil producteur non trouvé"
      );

      // Get product with all relations
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
        with: {
          category: {
            with: {
              criteria: {
                orderBy: (criteria, { asc }) => [asc(criteria.sortOrder)],
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
          message: "Produit non trouvé",
        });
      }

      // Verify product belongs to this producer
      if (product.registration.producerId !== producerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ce produit ne vous appartient pas",
        });
      }

      // Verify results are published
      if (!product.registration.cup.resultsPublishedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Les résultats ne sont pas encore publiés",
        });
      }

      const cup = product.registration.cup;
      const maxScale = getMaxScoreForScale(cup.ratingScale);

      // Get all submitted ratings for this product
      const ratings = await ctx.db.query.productRatings.findMany({
        where: and(
          eq(schema.productRatings.productId, input.productId),
          isNotNull(schema.productRatings.submittedAt)
        ),
        with: {
          scores: true,
        },
        orderBy: (pr, { asc }) => [asc(pr.submittedAt)],
      });

      // Create anonymized jury identifiers (Jury #1, Jury #2, etc.)
      const juryScores = ratings.map((rating, index) => {
        const criteriaData = product.category.criteria.map((criterion) => {
          const score = rating.scores.find((cs) => cs.criterionId === criterion.id);
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

      // For PUBLIC cups, only return aggregated stats (no individual jury details)
      // This protects jury anonymity and prevents pattern analysis
      const isPublicCup = cup.type === "public";

      // Calculate per-criterion averages for aggregated view
      const criteriaAverages = product.category.criteria.map((criterion) => {
        const scores = juryScores
          .map((j) => j.criteria.find((c) => c.criterionId === criterion.id)?.score)
          .filter((s): s is number => s !== null);

        return {
          criterionId: criterion.id,
          criterionName: criterion.name,
          coefficient: criterion.coefficient,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          minScore: scores.length > 0 ? Math.min(...scores) : null,
          maxScore: scores.length > 0 ? Math.max(...scores) : null,
        };
      });

      return {
        productId: product.id,
        productName: product.name,
        categoryName: product.category.name,
        ratingScale: cup.ratingScale,
        cupType: cup.type,
        criteria: product.category.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          coefficient: c.coefficient,
        })),
        // For PUBLIC cups: return only aggregated data (no individual jury scores)
        // For PRO cups: return full jury details
        juryScores: isPublicCup ? [] : juryScores,
        criteriaAverages,
        stats,
        // Flag indicating if detailed jury scores are available
        detailedScoresAvailable: !isPublicCup,
      };
    }),
});
