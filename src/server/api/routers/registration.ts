import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { and as drizzleAnd, eq, gte, lte } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { stripe } from "~/lib/stripe";
import { env } from "~/env";
import {
  addProductSchema,
  removeProductSchema,
  getRegistrationSchema,
  getOrCreateRegistrationSchema,
  listByCupSchema,
} from "~/lib/validations/registration";
import { anonymizeRegistrationProducts } from "~/server/services/anonymization.service";

/**
 * Build the base URL for the single-tenant app.
 */
function getPortalBaseUrl(): string {
  return env.BETTER_AUTH_URL;
}

type ProtectedContext = {
  db: typeof db;
  userId: string;
  session: {
    user: {
      email?: string | null;
    };
  };
};

const getProducerByUser = async (ctx: ProtectedContext) =>
  ctx.db.query.producers.findFirst({
    where: (producers, { eq: eqFn }) => eqFn(producers.userId, ctx.userId),
  });

const requireProducerByUser = async (ctx: ProtectedContext) => {
  const producer = await getProducerByUser(ctx);

  if (!producer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous devez avoir un profil producteur",
    });
  }

  return producer;
};

/**
 * Helper to get the price for a product in a category
 * Uses category override or cup default price
 */
async function getProductPrice(
  db: typeof import("~/server/db").db,
  cupId: string,
  categoryId: string
): Promise<number> {
  // Get category with price override
  const category = await db.query.categories.findFirst({
    where: (cat, { eq: eqFn }) => eqFn(cat.id, categoryId),
  });

  if (!category) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Categorie non trouvee",
    });
  }

  // If category has price override, use it
  if (category.priceOverride !== null) {
    return category.priceOverride;
  }

  // Otherwise get cup default price
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq: eqFn }) => eqFn(cups.id, cupId),
  });

  if (!cup) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cup non trouvee",
    });
  }

  return cup.defaultPricePerProduct ?? 0;
}

/**
 * Helper to recalculate registration total from products
 */
async function recalculateRegistrationTotal(
  db: typeof import("~/server/db").db,
  registrationId: string
): Promise<number> {
  const products = await db.query.products.findMany({
    where: (prod, { eq: eqFn }) => eqFn(prod.registrationId, registrationId),
  });

  const total = products.reduce((sum, p) => sum + p.priceAtRegistration, 0);

  // Update registration total
  await db
    .update(schema.registrations)
    .set({ totalAmount: total, updatedAt: new Date() })
    .where(eq(schema.registrations.id, registrationId));

  return total;
}

export const registrationRouter = createTRPCRouter({
  /**
   * Get or create a registration for the current producer on a cup
   * Creates a pending_payment registration if none exists
   */
  getOrCreate: protectedProcedure
    .input(getOrCreateRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Check cup exists and is open for registration
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      if (cup.status !== "published") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Les inscriptions ne sont pas ouvertes pour cette cup",
        });
      }

      // Check if registration already exists
      const existingRegistration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.cupId, input.cupId),
            eqFn(reg.producerId, producer.id)
          ),
        with: {
          products: {
            with: {
              category: true,
            },
          },
        },
      });

      if (existingRegistration) {
        // If cancelled, reactivate it
        if (existingRegistration.status === "cancelled") {
          await ctx.db
            .update(schema.registrations)
            .set({
              status: "pending_payment",
              totalAmount: 0,
              updatedAt: new Date(),
            })
            .where(eq(schema.registrations.id, existingRegistration.id));

          // Delete any old products from cancelled registration
          await ctx.db
            .delete(schema.products)
            .where(eq(schema.products.registrationId, existingRegistration.id));

          return {
            ...existingRegistration,
            status: "pending_payment" as const,
            totalAmount: 0,
            products: [],
          };
        }

        return existingRegistration;
      }

      // Create new registration
      const registrationId = nanoid();
      const [registration] = await ctx.db
        .insert(schema.registrations)
        .values({
          id: registrationId,
          cupId: input.cupId,
          producerId: producer.id,
          status: "pending_payment",
          totalAmount: 0,
          currency: cup.currency ?? "EUR",
        })
        .returning();

      return {
        ...registration!,
        products: [],
      };
    }),

  /**
   * Get a registration by ID with products
   * Only the owning producer can access
   */
  getById: protectedProcedure
    .input(getRegistrationSchema)
    .query(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get registration with products
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, producer.id)
          ),
        with: {
          products: {
            with: {
              category: true,
            },
          },
          cup: {
            columns: {
              id: true,
              name: true,
              currency: true,
              defaultPricePerProduct: true,
            },
          },
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      return registration;
    }),

  /**
   * Add a product to a registration
   * Only pending_payment registrations can be modified
   */
  addProduct: protectedProcedure
    .input(addProductSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get registration and verify ownership
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, producer.id)
          ),
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      if (registration.status !== "pending_payment") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription ne peut plus etre modifiee",
        });
      }

      // Verify category belongs to the cup
      const category = await ctx.db.query.categories.findFirst({
        where: (cat, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(cat.id, input.categoryId),
            eqFn(cat.cupId, registration.cupId)
          ),
      });

      if (!category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette categorie n'appartient pas a cette cup",
        });
      }

      // Get price for this product
      const price = await getProductPrice(ctx.db, registration.cupId, input.categoryId);

      // Create product
      const productId = nanoid();
      const [product] = await ctx.db
        .insert(schema.products)
        .values({
          id: productId,
          registrationId: input.registrationId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description ?? null,
          priceAtRegistration: price,
          status: "pending",
        })
        .returning();

      // Recalculate total
      const newTotal = await recalculateRegistrationTotal(ctx.db, input.registrationId);

      return {
        product,
        newTotal,
      };
    }),

  /**
   * Remove a product from a registration
   * Only pending_payment registrations can be modified
   */
  removeProduct: protectedProcedure
    .input(removeProductSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get product with registration
      const product = await ctx.db.query.products.findFirst({
        where: (prod, { eq: eqFn }) => eqFn(prod.id, input.productId),
        with: {
          registration: true,
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // Verify ownership
      if (product.registration.producerId !== producer.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas autorise a modifier ce produit",
        });
      }

      if (product.registration.status !== "pending_payment") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription ne peut plus etre modifiee",
        });
      }

      // Delete product
      await ctx.db
        .delete(schema.products)
        .where(eq(schema.products.id, input.productId));

      // Recalculate total
      const newTotal = await recalculateRegistrationTotal(
        ctx.db,
        product.registrationId
      );

      return {
        success: true,
        newTotal,
      };
    }),

  /**
   * Get registration summary for payment
   * Returns products grouped by category with totals
   */
  getSummary: protectedProcedure
    .input(getRegistrationSchema)
    .query(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get registration with products and cup
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, producer.id)
          ),
        with: {
          products: {
            with: {
              category: true,
            },
          },
          cup: {
            columns: {
              id: true,
              name: true,
              currency: true,
              defaultPricePerProduct: true,
            },
          },
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      // Group products by category
      const productsByCategory = registration.products.reduce(
        (acc, product) => {
          const categoryId = product.categoryId;
          if (!acc[categoryId]) {
            acc[categoryId] = {
              category: product.category,
              products: [],
              subtotal: 0,
            };
          }
          acc[categoryId].products.push(product);
          acc[categoryId].subtotal += product.priceAtRegistration;
          return acc;
        },
        {} as Record<
          string,
          {
            category: typeof registration.products[0]["category"];
            products: typeof registration.products;
            subtotal: number;
          }
        >
      );

      return {
        registration: {
          id: registration.id,
          status: registration.status,
          totalAmount: registration.totalAmount,
          currency: registration.currency,
        },
        cup: registration.cup,
        categories: Object.values(productsByCategory),
        productCount: registration.products.length,
        canProceedToPayment:
          registration.status === "pending_payment" &&
          registration.products.length > 0,
      };
    }),

  /**
   * List all registrations for the current producer
   */
  listMyRegistrations: protectedProcedure.query(async ({ ctx }) => {
    // Get producer profile
    const producer = await getProducerByUser(ctx);

    if (!producer) {
      return [];
    }

    const registrations = await ctx.db.query.registrations.findMany({
      where: (reg, { eq: eqFn }) => eqFn(reg.producerId, producer.id),
      columns: {
        id: true,
        status: true,
        totalAmount: true,
        currency: true,
        invoiceNumber: true,
        invoiceGeneratedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        cup: {
          columns: {
            id: true,
            name: true,
            status: true,
            resultsPublishedAt: true,
            ratingScale: true,
          },
        },
        products: {
          columns: {
            id: true,
            name: true,
            status: true,
            anonymousCode: true,
            receivedAt: true,
            finalScore: true,
            categoryRank: true,
          },
          with: {
            category: {
              columns: {
                name: true,
              },
            },
            label: {
              columns: {
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: (reg, { desc }) => [desc(reg.createdAt)],
    });

    return registrations.map((reg) => ({
      ...reg,
      productCount: reg.products.length,
    }));
  }),

  /**
   * Create Stripe checkout session for registration payment
   * Only works for pending_payment registrations with products
   */
  createCheckoutSession: protectedProcedure
    .input(getRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get registration with products and cup
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, producer.id)
          ),
        with: {
          products: true,
          cup: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      if (registration.status !== "pending_payment") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription a deja ete payee ou annulee",
        });
      }

      if (registration.products.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez ajouter au moins un produit",
        });
      }

      if (registration.totalAmount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Utilisez confirmFreeRegistration pour les inscriptions gratuites",
        });
      }

      // Get portal URL for redirect after payment
      const baseUrl = getPortalBaseUrl();
      const cupId = registration.cupId;

      // Create Stripe Checkout Session for one-time payment
      try {
        const checkoutSession = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: (registration.currency ?? "EUR").toLowerCase(),
                product_data: {
                  name: `Inscription - ${registration.cup.name}`,
                  description: `${registration.products.length} produit(s)`,
                },
                unit_amount: registration.totalAmount,
              },
              quantity: 1,
            },
          ],
          success_url: `${baseUrl}/cups/${cupId}/register/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/cups/${cupId}/register?cancelled=true`,
          customer_email: ctx.session.user.email ?? undefined,
          metadata: {
            type: "producer_registration",
            registrationId: registration.id,
            cupId,
            producerId: producer.id,
          },
        });

        return {
          checkoutUrl: checkoutSession.url,
          sessionId: checkoutSession.id,
        };
      } catch (error) {
        console.error("[Registration] Stripe checkout session creation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la creation de la session de paiement. Veuillez reessayer.",
        });
      }
    }),

  /**
   * Confirm a free registration (totalAmount = 0)
   * Directly sets status to confirmed without payment
   */
  confirmFreeRegistration: protectedProcedure
    .input(getRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = await requireProducerByUser(ctx);

      // Get registration
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, producer.id)
          ),
        with: {
          products: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      if (registration.status !== "pending_payment") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription a deja ete confirmee ou annulee",
        });
      }

      if (registration.products.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez ajouter au moins un produit",
        });
      }

      if (registration.totalAmount !== 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription necessite un paiement",
        });
      }

      // Confirm registration
      await ctx.db
        .update(schema.registrations)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(schema.registrations.id, registration.id));

      // Anonymize products for free registrations too
      const anonymizedProducts = await anonymizeRegistrationProducts(
        ctx.db,
        registration.id
      );

      return {
        success: true,
        registrationId: registration.id,
        anonymizedProducts,
      };
    }),

  /**
   * List all registrations for a cup (organizer view)
   * Only organization members can access this endpoint
   * Includes producer details and products
   */
  listByCup: protectedProcedure
    .input(listByCupSchema)
    .query(async ({ ctx, input }) => {
      // Verify cup exists (single-tenant)
      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Build where conditions for filters
      const whereConditions = [eq(schema.registrations.cupId, input.cupId)];

      if (input.status) {
        whereConditions.push(eq(schema.registrations.status, input.status));
      }

      if (input.dateFrom) {
        whereConditions.push(gte(schema.registrations.createdAt, input.dateFrom));
      }

      if (input.dateTo) {
        whereConditions.push(lte(schema.registrations.createdAt, input.dateTo));
      }

      // Query registrations with producer and products
      const registrations = await ctx.db.query.registrations.findMany({
        where: drizzleAnd(...whereConditions),
        with: {
          producer: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          products: {
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
        orderBy: (reg, { desc }) => [desc(reg.createdAt)],
      });

      // If categoryId filter is provided, filter registrations that have products in that category
      let filteredRegistrations = registrations;
      if (input.categoryId) {
        filteredRegistrations = registrations.filter((reg) =>
          reg.products.some((p) => p.categoryId === input.categoryId)
        );
      }

      // Return registrations with computed fields
      return filteredRegistrations.map((reg) => ({
        id: reg.id,
        status: reg.status,
        totalAmount: reg.totalAmount,
        currency: reg.currency,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        producer: {
          id: reg.producer.id,
          companyName: reg.producer.companyName,
          brandName: reg.producer.brandName,
          siret: reg.producer.siret,
          website: reg.producer.website,
          user: reg.producer.user,
        },
        products: reg.products.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          anonymousCode: p.anonymousCode,
          category: p.category,
        })),
        productCount: reg.products.length,
      }));
    }),
});
