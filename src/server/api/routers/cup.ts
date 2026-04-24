import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import Stripe from "stripe";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import { Errors } from "~/lib/errors";
import * as schema from "~/server/db/schema";
import {
  createCupSchema,
  updateCupSchema,
  getRatingScaleValues,
} from "~/lib/validations/cup";
import {
  updatePhaseDatesSchema,
  getPhaseStatus,
  getEditableDates,
  canEditDate,
} from "~/lib/validations/phases";
import { canPublishCup } from "~/lib/validations/publish";
import { eq, and, count, inArray, asc, isNotNull } from "drizzle-orm";
import { encryptJson, decryptJson, isEncryptionConfigured } from "~/lib/encryption";
import { hasAnonymizedProducts } from "~/server/services/anonymization.service";
import { computeResults } from "~/server/api/routers/results";

// Payment configuration types
interface StripeConfig {
  secretKey: string;
  publishableKey: string;
}

interface VivaWalletConfig {
  merchantId: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
}

interface PaymentConfig {
  stripe?: StripeConfig;
  vivaWallet?: VivaWalletConfig;
}

const requireCup = async (
  ctx: { db: typeof import("~/server/db").db },
  cupId: string
) => {
  const cup = await ctx.db.query.cups.findFirst({
    where: (cups, { eq: eqFn }) => eqFn(cups.id, cupId),
  });
  if (!cup) Errors.cupNotFound();
  return cup!;
};

export const cupRouter = createTRPCRouter({
  /**
   * Create a new cup. Organizer only.
   */
  create: organizerProcedure
    .input(createCupSchema)
    .mutation(async ({ ctx, input }) => {
      const cupId = nanoid();
      const [cup] = await ctx.db
        .insert(schema.cups)
        .values({
          id: cupId,
          name: input.name,
          type: input.type,
          description: input.description ?? null,
          ratingScale: input.ratingScale ?? "0-20",
          status: "draft",
        })
        .returning();

      return cup;
    }),

  /**
   * List all cups. Any authenticated user can view.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const cups = await ctx.db.query.cups.findMany({
      orderBy: (cups, { desc }) => [desc(cups.createdAt)],
    });

    return cups;
  }),

  /**
   * Get a cup by ID.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await requireCup(ctx, input.id);
    }),

  /**
   * Update a cup (organizer only).
   */
  update: organizerProcedure
    .input(updateCupSchema)
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.id);

      if (input.ratingScale && existingCup.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L'échelle de notation ne peut être modifiée qu'en mode brouillon",
        });
      }

      const updateData: Partial<typeof schema.cups.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.ratingScale !== undefined) updateData.ratingScale = input.ratingScale;

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set(updateData)
        .where(eq(schema.cups.id, input.id))
        .returning();

      return updatedCup;
    }),

  /**
   * Get phase dates for a cup
   */
  getPhaseDates: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      return {
        registrationOpenAt: cup.registrationOpenAt,
        registrationCloseAt: cup.registrationCloseAt,
        ratingStartAt: cup.ratingStartAt,
        ratingEndAt: cup.ratingEndAt,
        status: getPhaseStatus(cup),
        cupStatus: cup.status,
        editableDates: getEditableDates(cup.status),
      };
    }),

  /**
   * Update phase dates for a cup (organizer only)
   */
  updatePhaseDates: organizerProcedure
    .input(updatePhaseDatesSchema)
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Les dates ne peuvent pas être modifiées sur une cup terminée",
        });
      }

      const updateData: Partial<typeof schema.cups.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.registrationOpenAt !== undefined && canEditDate(existingCup.status, "registrationOpenAt")) {
        updateData.registrationOpenAt = input.registrationOpenAt;
      }
      if (input.registrationCloseAt !== undefined && canEditDate(existingCup.status, "registrationCloseAt")) {
        updateData.registrationCloseAt = input.registrationCloseAt;
      }
      if (input.ratingStartAt !== undefined && canEditDate(existingCup.status, "ratingStartAt")) {
        updateData.ratingStartAt = input.ratingStartAt;
      }
      if (input.ratingEndAt !== undefined && canEditDate(existingCup.status, "ratingEndAt")) {
        updateData.ratingEndAt = input.ratingEndAt;
      }

      const mergedDates = {
        registrationOpenAt: updateData.registrationOpenAt ?? existingCup.registrationOpenAt,
        registrationCloseAt: updateData.registrationCloseAt ?? existingCup.registrationCloseAt,
        ratingStartAt: updateData.ratingStartAt ?? existingCup.ratingStartAt,
        ratingEndAt: updateData.ratingEndAt ?? existingCup.ratingEndAt,
      };

      if (mergedDates.registrationOpenAt && mergedDates.registrationCloseAt) {
        if (mergedDates.registrationOpenAt >= mergedDates.registrationCloseAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La date d'ouverture doit être avant la date de clôture des inscriptions",
          });
        }
      }
      if (mergedDates.ratingStartAt && mergedDates.ratingEndAt) {
        if (mergedDates.ratingStartAt >= mergedDates.ratingEndAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La date de début doit être avant la date de fin de notation",
          });
        }
      }
      if (mergedDates.registrationCloseAt && mergedDates.ratingStartAt) {
        if (mergedDates.registrationCloseAt > mergedDates.ratingStartAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La clôture des inscriptions doit être avant ou égale au début de la notation",
          });
        }
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set(updateData)
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour des dates",
        });
      }

      return {
        ...updatedCup,
        status: getPhaseStatus(updatedCup),
        editableDates: getEditableDates(updatedCup.status),
      };
    }),

  /**
   * Get publication status for a cup
   */
  getPublishStatus: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      if (cup.status !== "draft") {
        return {
          canPublish: false,
          errors: ["La cup n'est pas en mode brouillon"],
          warnings: [],
          status: cup.status,
        };
      }

      const validation = await canPublishCup(input.cupId, ctx.db);

      return {
        ...validation,
        status: cup.status,
      };
    }),

  /**
   * Get dashboard statistics for a cup
   */
  getDashboardStats: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      const categoriesResult = await ctx.db
        .select({ count: count() })
        .from(schema.categories)
        .where(eq(schema.categories.cupId, input.cupId));

      const categoriesCount = categoriesResult[0]?.count ?? 0;

      const categories = await ctx.db.query.categories.findMany({
        where: (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        columns: { id: true },
      });
      const categoryIds = categories.map((c) => c.id);

      let criteriaCount = 0;
      if (categoryIds.length > 0) {
        const criteriaResult = await ctx.db
          .select({ count: count() })
          .from(schema.ratingCriteria)
          .where(inArray(schema.ratingCriteria.categoryId, categoryIds));
        criteriaCount = criteriaResult[0]?.count ?? 0;
      }

      const labelsResult = await ctx.db
        .select({ count: count() })
        .from(schema.cupLabels)
        .where(eq(schema.cupLabels.cupId, input.cupId));

      const labelsCount = labelsResult[0]?.count ?? 0;

      const hasPhaseDates = !!(
        cup.registrationOpenAt ||
        cup.registrationCloseAt ||
        cup.ratingStartAt ||
        cup.ratingEndAt
      );

      const registrations = await ctx.db.query.registrations.findMany({
        where: (reg, { eq: eqFn }) => eqFn(reg.cupId, input.cupId),
        columns: { id: true, status: true },
        with: {
          products: { columns: { id: true } },
        },
      });

      const confirmedRegistrations = registrations.filter((r) => r.status === "confirmed");
      const pendingPayments = registrations.filter((r) => r.status === "pending_payment");
      const totalProducts = registrations.reduce((sum, r) => sum + r.products.length, 0);

      return {
        categoriesCount,
        criteriaCount,
        labelsCount,
        hasCategories: categoriesCount > 0,
        hasCriteria: criteriaCount > 0,
        hasLabels: labelsCount > 0,
        hasPhaseDates,
        status: cup.status,
        registrationsCount: confirmedRegistrations.length,
        pendingPaymentsCount: pendingPayments.length,
        totalProductsCount: totalProducts,
      };
    }),

  /**
   * Publish a cup (organizer only)
   */
  publish: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seule une cup en brouillon peut être publiée",
        });
      }

      const validation = await canPublishCup(input.cupId, ctx.db);
      if (!validation.canPublish) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Configuration incomplète: ${validation.errors.join(", ")}`,
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la publication",
        });
      }

      return updatedCup;
    }),

  /**
   * Unpublish a cup (organizer only)
   */
  unpublish: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status !== "published") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seule une cup publiée peut être dépubliée",
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la dépublication",
        });
      }

      return updatedCup;
    }),

  /**
   * Close registrations for a cup (organizer only)
   */
  closeRegistrations: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status !== "published") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seule une cup publiée peut avoir ses inscriptions clôturées",
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({ status: "registration_closed", updatedAt: new Date() })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la clôture des inscriptions",
        });
      }

      return updatedCup;
    }),

  /**
   * Start rating phase for a cup (organizer only)
   */
  startRating: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status !== "registration_closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La phase de notation ne peut démarrer qu'après la clôture des inscriptions",
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({ status: "rating", updatedAt: new Date() })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du démarrage de la notation",
        });
      }

      return updatedCup;
    }),

  /**
   * Close rating phase for a cup (organizer only)
   */
  closeRating: organizerProcedure
    .input(z.object({
      cupId: z.string().min(1, "Cup ID requis"),
      force: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status !== "rating") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seule une cup en phase de notation peut être clôturée",
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la clôture de la notation",
        });
      }

      return updatedCup;
    }),

  /**
   * Get public details for a published cup
   * NO AUTHENTICATION REQUIRED
   */
  getPublicDetails: publicProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      if (cup.status === "draft") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      const categories = await ctx.db.query.categories.findMany({
        where: (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        orderBy: (cat) => [asc(cat.sortOrder)],
      });

      const categoriesWithCriteria = await Promise.all(
        categories.map(async (category) => {
          const criteria = await ctx.db.query.ratingCriteria.findMany({
            where: (rc, { eq: eqFn }) => eqFn(rc.categoryId, category.id),
            orderBy: (rc) => [asc(rc.sortOrder)],
            columns: {
              id: true,
              name: true,
              description: true,
              coefficient: true,
              sortOrder: true,
            },
          });

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            pricePerProduct: category.priceOverride,
            criteria,
          };
        })
      );

      const ratingScale = getRatingScaleValues(cup.ratingScale);
      const canRegister = cup.status === "published";

      let galleryUrls: string[] = [];
      if (cup.galleryUrls) {
        try {
          galleryUrls = JSON.parse(cup.galleryUrls) as string[];
        } catch {
          galleryUrls = [];
        }
      }

      return {
        cup: {
          id: cup.id,
          name: cup.name,
          description: cup.description,
          type: cup.type,
          status: cup.status,
          ratingScale: cup.ratingScale,
          ratingScaleValues: ratingScale,
          currency: cup.currency,
          defaultPricePerProduct: cup.defaultPricePerProduct,
          registrationOpenAt: cup.registrationOpenAt,
          registrationCloseAt: cup.registrationCloseAt,
          ratingStartAt: cup.ratingStartAt,
          ratingEndAt: cup.ratingEndAt,
          bannerUrl: cup.bannerUrl,
          pdfLogoUrl: cup.pdfLogoUrl,
          publicPageDescription: cup.publicPageDescription,
          galleryUrls,
          eventDate: cup.eventDate,
          eventLocation: cup.eventLocation,
          contactEmail: cup.contactEmail,
          websiteUrl: cup.websiteUrl,
          resultsPublishedAt: cup.resultsPublishedAt,
          resultsVisibility: cup.resultsVisibility,
        },
        categories: categoriesWithCriteria,
        canRegister,
      };
    }),

  /**
   * Get payment configuration for a cup (organizer only)
   */
  getPaymentConfig: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      return {
        paymentProvider: cup.paymentProvider,
        isConfigured: !!cup.paymentProvider && !!cup.paymentConfigEncrypted,
        configuredAt: cup.paymentConfiguredAt,
        encryptionAvailable: isEncryptionConfigured(),
      };
    }),

  /**
   * Update payment configuration for a cup (organizer only)
   */
  updatePaymentConfig: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        provider: z.enum(["stripe", "viva_wallet"]),
        config: z.union([
          z.object({
            type: z.literal("stripe"),
            secretKey: z.string().min(1, "Clé secrète requise"),
            publishableKey: z.string().min(1, "Clé publique requise"),
          }),
          z.object({
            type: z.literal("viva_wallet"),
            merchantId: z.string().min(1, "Merchant ID requis"),
            apiKey: z.string().min(1, "API Key requise"),
            clientId: z.string().min(1, "Client ID requis"),
            clientSecret: z.string().min(1, "Client Secret requis"),
          }),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isEncryptionConfigured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "La configuration de chiffrement n'est pas disponible",
        });
      }

      await requireCup(ctx, input.cupId);

      let paymentConfig: PaymentConfig;
      if (input.config.type === "stripe") {
        paymentConfig = {
          stripe: {
            secretKey: input.config.secretKey,
            publishableKey: input.config.publishableKey,
          },
        };
      } else {
        paymentConfig = {
          vivaWallet: {
            merchantId: input.config.merchantId,
            apiKey: input.config.apiKey,
            clientId: input.config.clientId,
            clientSecret: input.config.clientSecret,
          },
        };
      }

      const encryptedConfig = encryptJson(paymentConfig);

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({
          paymentProvider: input.provider,
          paymentConfigEncrypted: encryptedConfig,
          paymentConfiguredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      return {
        success: true,
        paymentProvider: updatedCup?.paymentProvider,
        configuredAt: updatedCup?.paymentConfiguredAt,
      };
    }),

  /**
   * Test payment connection for a cup (organizer only)
   */
  testPaymentConnection: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      if (!cup.paymentProvider || !cup.paymentConfigEncrypted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun processeur de paiement configuré",
        });
      }

      let config: PaymentConfig;
      try {
        config = decryptJson<PaymentConfig>(cup.paymentConfigEncrypted);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du déchiffrement de la configuration",
        });
      }

      if (cup.paymentProvider === "stripe" && config.stripe) {
        try {
          const stripe = new Stripe(config.stripe.secretKey, {
            apiVersion: "2025-12-15.clover",
          });
          await stripe.balance.retrieve();
          return { success: true, message: "Connexion Stripe réussie" };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur inconnue";
          return { success: false, message: `Erreur Stripe: ${message}` };
        }
      }

      if (cup.paymentProvider === "viva_wallet" && config.vivaWallet) {
        return {
          success: false,
          message: "Test de connexion Viva Wallet non implémenté - veuillez vérifier vos identifiants manuellement",
        };
      }

      return { success: false, message: "Configuration invalide" };
    }),

  /**
   * Remove payment configuration for a cup (organizer only)
   */
  removePaymentConfig: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      await requireCup(ctx, input.cupId);

      await ctx.db
        .update(schema.cups)
        .set({
          paymentProvider: null,
          paymentConfigEncrypted: null,
          paymentConfiguredAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      return { success: true };
    }),

  /**
   * Update anonymization prefix for a cup (organizer only)
   */
  updateAnonymizationPrefix: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        prefix: z
          .string()
          .length(1, "Le prefixe doit etre une seule lettre")
          .regex(/^[A-Z]$/, "Le prefixe doit etre une lettre majuscule (A-Z)"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingCup = await requireCup(ctx, input.cupId);

      if (existingCup.status === "rating" || existingCup.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le prefixe d'anonymisation ne peut pas etre modifie pendant ou apres la phase de notation",
        });
      }

      const hasAnonymized = await hasAnonymizedProducts(ctx.db, input.cupId);
      if (hasAnonymized) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le prefixe ne peut pas etre modifie car des produits ont deja ete anonymises",
        });
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({
          anonymizationPrefix: input.prefix,
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      return {
        success: true,
        anonymizationPrefix: updatedCup?.anonymizationPrefix,
      };
    }),

  /**
   * Get results publication settings for a cup
   */
  getResultsSettings: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      return {
        cupId: cup.id,
        cupName: cup.name,
        status: cup.status,
        resultsPublishedAt: cup.resultsPublishedAt,
        resultsVisibility: cup.resultsVisibility ?? "labels",
        canPublishResults: cup.status === "completed",
      };
    }),

  /**
   * Publish results publicly
   */
  publishResults: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        visibility: z.enum(["podium", "labels", "labels_and_podium", "all"]).default("labels"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      if (cup.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La notation doit être clôturée avant de publier les résultats",
        });
      }

      await computeResults(ctx.db, input.cupId, cup);

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({
          resultsPublishedAt: new Date(),
          resultsVisibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      return {
        success: true,
        cupId: updatedCup?.id,
        resultsPublishedAt: updatedCup?.resultsPublishedAt,
      };
    }),

  /**
   * Unpublish results
   */
  unpublishResults: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({
          resultsPublishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvée" });
      }

      return { success: true, cupId: updatedCup.id };
    }),

  /**
   * Update results visibility
   */
  updateResultsVisibility: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        visibility: z.enum(["podium", "labels", "labels_and_podium", "all"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set({
          resultsVisibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      if (!updatedCup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvée" });
      }

      return { success: true, visibility: updatedCup.resultsVisibility };
    }),

  /**
   * Get public results for a cup
   * Public endpoint - no auth required
   */
  getPublicResults: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
        with: {
          labels: {
            columns: {
              id: true,
              name: true,
              minScore: true,
              maxScore: true,
            },
          },
        },
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvée" });
      }

      if (cup.status === "draft") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvée" });
      }

      if (!cup.resultsPublishedAt) {
        return {
          published: false,
          message: "Résultats à venir",
          categories: [],
          visibility: cup.resultsVisibility,
        };
      }

      const categoryFilter = input.categoryId;
      const categories = await ctx.db.query.categories.findMany({
        where: categoryFilter
          ? (cat, { eq: eqFn, and: andFn }) =>
              andFn(eqFn(cat.cupId, input.cupId), eqFn(cat.id, categoryFilter))
          : (cat, { eq: eqFn }) => eqFn(cat.cupId, input.cupId),
        orderBy: (cat) => [asc(cat.sortOrder)],
      });

      const allProducts = await ctx.db.query.products.findMany({
        where: (prod, { eq: eqFn, and: andFn, inArray: inArrayFn }) =>
          andFn(
            inArrayFn(
              prod.categoryId,
              categories.map((c) => c.id)
            ),
            eqFn(prod.status, "rated"),
            eqFn(prod.excludedFromResults, false)
          ),
        with: {
          registration: {
            with: {
              producer: {
                columns: {
                  companyName: true,
                  brandName: true,
                },
              },
            },
          },
          label: {
            columns: {
              id: true,
              name: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: (prod) => [asc(prod.categoryRank)],
      });

      const visibility = cup.resultsVisibility ?? "labels";

      const filterByVisibility = (product: typeof allProducts[number]): boolean => {
        switch (visibility) {
          case "podium":
            return product.categoryRank !== null && product.categoryRank <= 3;
          case "labels":
            return product.labelId !== null;
          case "labels_and_podium": {
            const isOnPodium = product.categoryRank !== null && product.categoryRank <= 3;
            const hasLabel = product.labelId !== null;
            return isOnPodium || hasLabel;
          }
          case "all":
            return product.finalScore !== null;
          default:
            return product.labelId !== null;
        }
      };

      const filteredProducts = allProducts.filter(filterByVisibility);

      const resultsByCategory = categories.map((category) => {
        const categoryProducts = filteredProducts
          .filter((p) => p.categoryId === category.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            producerName: p.registration.producer.brandName || p.registration.producer.companyName,
            finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
            categoryRank: p.categoryRank,
            label: p.label
              ? { id: p.label.id, name: p.label.name }
              : null,
          }));

        const showPodium = visibility === "podium" || visibility === "labels_and_podium" || visibility === "all";
        const podium = showPodium
          ? categoryProducts.filter((p) => p.categoryRank !== null && p.categoryRank <= 3)
          : [];

        const showLabeled = visibility === "labels" || visibility === "labels_and_podium" || visibility === "all";
        const podiumIds = new Set(podium.map((p) => p.id));
        const labeled = showLabeled
          ? categoryProducts.filter((p) => p.label !== null && !podiumIds.has(p.id))
          : [];

        return {
          id: category.id,
          name: category.name,
          podium,
          labeledProducts: labeled,
          totalProducts: categoryProducts.length,
        };
      });

      const sortedLabels = [...cup.labels].sort(
        (a, b) => (b.minScore ?? 0) - (a.minScore ?? 0)
      );

      return {
        published: true,
        publishedAt: cup.resultsPublishedAt,
        visibility: cup.resultsVisibility,
        categories: resultsByCategory,
        labels: sortedLabels,
      };
    }),

  /**
   * Get overview stats for all cups
   */
  getOverviewStats: protectedProcedure.query(async ({ ctx }) => {
    const cups = await ctx.db.query.cups.findMany({
      orderBy: (cups, { desc }) => [desc(cups.createdAt)],
      with: {
        registrations: {
          columns: {
            id: true,
            status: true,
            totalAmount: true,
          },
          with: {
            products: { columns: { id: true } },
          },
        },
        categories: { columns: { id: true } },
      },
    });

    const ratingCupIds = cups
      .filter((cup) => cup.status === "rating" || cup.status === "completed")
      .map((cup) => cup.id);

    const ratingStatsMap: Record<string, {
      totalRatings: number;
      expectedRatings: number;
      activeJuries: number;
      confirmedProducts: number;
    }> = {};

    if (ratingCupIds.length > 0) {
      const juriesPerCup = await ctx.db
        .select({
          cupId: schema.cupJuries.cupId,
          count: count(),
        })
        .from(schema.cupJuries)
        .where(
          and(
            inArray(schema.cupJuries.cupId, ratingCupIds),
            eq(schema.cupJuries.isActive, true)
          )
        )
        .groupBy(schema.cupJuries.cupId);

      const productsPerCup = await ctx.db
        .select({
          cupId: schema.categories.cupId,
          count: count(),
        })
        .from(schema.products)
        .innerJoin(
          schema.categories,
          eq(schema.products.categoryId, schema.categories.id)
        )
        .where(
          and(
            inArray(schema.categories.cupId, ratingCupIds),
            isNotNull(schema.products.anonymousCode)
          )
        )
        .groupBy(schema.categories.cupId);

      const ratingsPerCup = await ctx.db
        .select({
          cupId: schema.categories.cupId,
          count: count(),
        })
        .from(schema.productRatings)
        .innerJoin(
          schema.products,
          eq(schema.productRatings.productId, schema.products.id)
        )
        .innerJoin(
          schema.categories,
          eq(schema.products.categoryId, schema.categories.id)
        )
        .where(
          and(
            inArray(schema.categories.cupId, ratingCupIds),
            isNotNull(schema.productRatings.submittedAt)
          )
        )
        .groupBy(schema.categories.cupId);

      for (const cupId of ratingCupIds) {
        const juries = juriesPerCup.find((j) => j.cupId === cupId)?.count ?? 0;
        const products = productsPerCup.find((p) => p.cupId === cupId)?.count ?? 0;
        const ratings = ratingsPerCup.find((r) => r.cupId === cupId)?.count ?? 0;

        ratingStatsMap[cupId] = {
          totalRatings: ratings,
          expectedRatings: products * juries,
          activeJuries: juries,
          confirmedProducts: products,
        };
      }
    }

    const cupsWithStats = cups.map((cup) => {
      const confirmedRegistrations = cup.registrations.filter((r) => r.status === "confirmed");
      const pendingPayments = cup.registrations.filter((r) => r.status === "pending_payment");
      const totalProducts = cup.registrations.reduce((sum, r) => sum + r.products.length, 0);
      const revenue = confirmedRegistrations.reduce((sum, r) => sum + r.totalAmount, 0);

      const now = new Date();
      const deadlines = [
        { date: cup.registrationOpenAt, label: "Ouverture inscriptions" },
        { date: cup.registrationCloseAt, label: "Fermeture inscriptions" },
        { date: cup.ratingStartAt, label: "Début notation" },
        { date: cup.ratingEndAt, label: "Fin notation" },
      ].filter((d) => d.date && new Date(d.date) > now);

      const nextDeadline = deadlines.sort(
        (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
      )[0];

      const ratingStats = ratingStatsMap[cup.id];

      return {
        id: cup.id,
        name: cup.name,
        type: cup.type,
        status: cup.status,
        createdAt: cup.createdAt,
        confirmedCount: confirmedRegistrations.length,
        pendingCount: pendingPayments.length,
        totalProducts,
        categoriesCount: cup.categories.length,
        revenue,
        currency: cup.currency,
        registrationOpenAt: cup.registrationOpenAt,
        registrationCloseAt: cup.registrationCloseAt,
        ratingStartAt: cup.ratingStartAt,
        ratingEndAt: cup.ratingEndAt,
        nextDeadline: nextDeadline
          ? { date: nextDeadline.date, label: nextDeadline.label }
          : null,
        ratingStats: ratingStats
          ? {
              totalRatings: ratingStats.totalRatings,
              expectedRatings: ratingStats.expectedRatings,
              completion: ratingStats.expectedRatings > 0
                ? Math.round((ratingStats.totalRatings / ratingStats.expectedRatings) * 100)
                : 0,
              activeJuries: ratingStats.activeJuries,
              confirmedProducts: ratingStats.confirmedProducts,
            }
          : null,
      };
    });

    const totalRevenue = cupsWithStats.reduce((sum, cup) => sum + cup.revenue, 0);
    const totalRegistrations = cupsWithStats.reduce((sum, cup) => sum + cup.confirmedCount, 0);

    return {
      cups: cupsWithStats,
      totalRevenue,
      totalRegistrations,
    };
  }),
});
