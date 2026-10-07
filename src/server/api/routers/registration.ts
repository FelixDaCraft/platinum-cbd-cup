import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { and as drizzleAnd, eq, gte, lte } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedProcedure,
  producerProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { cancelPaymentOrder, createPaymentOrder, getTransaction } from "~/lib/viva";
import { formatPhaseDate } from "~/lib/validations/phases";
import {
  confirmPaidRegistration,
  PaymentVerificationError,
  type PaymentVerificationReason,
} from "~/server/services/registration-payment.service";
import { allocateInvoiceNumber } from "~/server/services/invoice.service";
import {
  addProductSchema,
  removeProductSchema,
  getRegistrationSchema,
  getOrCreateRegistrationSchema,
  listByCupSchema,
} from "~/lib/validations/registration";
import { anonymizeRegistrationProducts } from "~/server/services/anonymization.service";
import {
  assertCartWithinQuotas,
  countByCategory,
  getCategoryOccupancy,
  lockCategoryQuotas,
  PAYMENT_ORDER_TIMEOUT_SECONDS,
  PAYMENT_RESERVATION_MS,
} from "~/server/services/category-quota.service";

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

/**
 * Refuse tant que les inscriptions ne sont pas ouvertes. Facteur commun aux
 * deux fenetres ci-dessous.
 */
function assertRegistrationHasOpened(cup: { registrationOpenAt: Date | null }) {
  if (cup.registrationOpenAt && new Date() < new Date(cup.registrationOpenAt)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Les inscriptions ne sont pas encore ouvertes (ouverture le ${formatPhaseDate(
        cup.registrationOpenAt
      )}).`,
    });
  }
}

/**
 * Fenetre de DEPOT d'une inscription : creation et composition du panier.
 *
 * Aucun planificateur ne fait avancer `cups.status` (cf. phase-automation.ts,
 * sans appelant) : les dates saisies par l'organisateur sont donc la seule
 * source de verite. C'est ce controle qui decide quels produits concourent, donc
 * celui qui protege l'integrite du concours ; il est strict.
 */
function assertRegistrationOpen(cup: {
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
}) {
  assertRegistrationHasOpened(cup);

  if (cup.registrationCloseAt && new Date() > new Date(cup.registrationCloseAt)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Les inscriptions sont closes depuis le ${formatPhaseDate(
        cup.registrationCloseAt
      )}.`,
    });
  }
}

/**
 * Fenetre de REGLEMENT d'une inscription deja deposee.
 *
 * Volontairement plus permissive que `assertRegistrationOpen` : un producteur
 * inscrit dans les delais dont le paiement a echoue doit pouvoir le relancer
 * apres la cloture (c'est ce que promet la page `register/cancel`). Son panier
 * reste gele — `addProduct` ferme bien a `registrationCloseAt` — donc aucun
 * produit nouveau n'entre au concours par ce chemin.
 *
 * La borne est le demarrage de la notation, pas la cloture des inscriptions :
 * la confirmation declenche l'anonymisation des produits, et en injecter dans
 * une cup deja en cours de jugement fausserait le concours. L'intervalle
 * cloture -> debut de notation est la fenetre de reconciliation de
 * l'organisateur.
 */
function assertPaymentWindowOpen(cup: {
  status: string;
  registrationOpenAt: Date | null;
  ratingStartAt: Date | null;
}) {
  assertRegistrationHasOpened(cup);

  const ratingStarted =
    cup.status === "rating" ||
    cup.status === "completed" ||
    (cup.ratingStartAt !== null && new Date() >= new Date(cup.ratingStartAt));

  if (ratingStarted) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "La phase de notation a commence : cette inscription ne peut plus etre reglee en ligne. Contactez-nous via la page Contact.",
    });
  }
}

/**
 * Message destine au producteur quand un paiement encaisse ne correspond pas a
 * l'inscription qu'il pretend regler. Aucun de ces cas ne se resout tout seul :
 * l'argent est chez Viva, l'inscription reste `pending_payment`, une
 * intervention humaine est necessaire. Le message le dit explicitement plutot
 * que de laisser croire a une panne passagere.
 */
function paymentVerificationMessage(reason: PaymentVerificationReason): string {
  switch (reason) {
    case "amount_mismatch":
      return "Le montant regle ne correspond pas au total de votre inscription. Votre paiement n'est pas perdu : contactez-nous via la page Contact en precisant votre reference de paiement, nous regularisons.";
    case "order_code_mismatch":
    case "missing_order_code":
      return "Ce paiement ne correspond pas a la commande enregistree pour votre inscription. Contactez-nous via la page Contact en precisant votre reference de paiement.";
    case "amount_unknown":
      return "Le montant de votre paiement n'a pas pu etre verifie. Contactez-nous via la page Contact pour finaliser votre inscription.";
  }
}

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

/** Client Drizzle au sein d'une transaction en cours. */
type RegistrationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Verrouille la ligne d'inscription pour la duree de la transaction et renvoie
 * l'etat de facturation lu sous ce verrou.
 *
 * Toujours pris AVANT d'ecrire les produits, soit le meme ordre que
 * `confirmPaidRegistration` (inscription puis produits) : verrouiller dans
 * l'ordre inverse — insertion d'un produit, qui prend un KEY SHARE sur
 * l'inscription, puis montee en FOR UPDATE — exposerait a un interblocage avec
 * une confirmation concurrente.
 */
async function lockRegistrationForBilling(
  tx: RegistrationTx,
  registrationId: string
) {
  const [locked] = await tx
    .select({
      totalAmount: schema.registrations.totalAmount,
      paymentOrderCode: schema.registrations.paymentOrderCode,
    })
    .from(schema.registrations)
    .where(eq(schema.registrations.id, registrationId))
    .for("update");

  return locked;
}

/**
 * Recalcule le total d'une inscription depuis ses produits et le persiste.
 *
 * Toute variation du total perime la commande Viva deja creee : le
 * `paymentOrderCode` est efface. Sans cela, un producteur pouvait faire creer
 * une commande pour un produit, en ajouter neuf, puis regler l'ancien checkout —
 * `confirmPaidRegistration` refuse desormais ce sous-paiement, mais le
 * producteur se retrouvait avec une commande perimee sans le savoir. En
 * l'effacant ici, le prochain `createCheckoutSession` en emet une neuve au bon
 * montant.
 *
 * `previous` est l'etat lu par `lockRegistrationForBilling` dans la meme
 * transaction : le total et l'effacement de la commande sont donc commites avec
 * l'ecriture du produit qui les a provoques.
 *
 * La reservation des places tombe avec la commande : elle couvrait l'ancien
 * panier. `staleOrderCode` est rendu a l'appelant pour qu'il annule la commande
 * chez Viva une fois la transaction commitee (aucun appel reseau sous verrou).
 */
async function applyRecalculatedTotal(
  tx: RegistrationTx,
  registrationId: string,
  previous: { totalAmount: number; paymentOrderCode: string | null } | undefined
): Promise<{
  total: number;
  paymentOrderInvalidated: boolean;
  staleOrderCode: string | null;
}> {
  const products = await tx.query.products.findMany({
    where: (prod, { eq: eqFn }) => eqFn(prod.registrationId, registrationId),
    columns: { priceAtRegistration: true },
  });

  const total = products.reduce((sum, p) => sum + p.priceAtRegistration, 0);

  const paymentOrderInvalidated =
    previous !== undefined &&
    previous.paymentOrderCode !== null &&
    previous.totalAmount !== total;

  await tx
    .update(schema.registrations)
    .set({
      totalAmount: total,
      ...(paymentOrderInvalidated
        ? { paymentOrderCode: null, paymentReservedUntil: null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.registrations.id, registrationId));

  if (paymentOrderInvalidated) {
    console.log(
      `[Registration] ${registrationId}: total ${previous.totalAmount} -> ${total}, commande Viva ${previous.paymentOrderCode} perimee`
    );
  }

  return {
    total,
    paymentOrderInvalidated,
    staleOrderCode: paymentOrderInvalidated ? previous.paymentOrderCode : null,
  };
}

export const registrationRouter = createTRPCRouter({
  /**
   * Get or create a registration for the current producer on a cup
   * Creates a pending_payment registration if none exists
   */
  getOrCreate: producerProcedure
    .input(getOrCreateRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

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

      assertRegistrationOpen(cup);

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
          // Remise a zero et purge des produits dans la meme transaction, et
          // `paymentOrderCode` efface : la commande Viva de la tentative
          // annulee ne doit pas pouvoir regler le nouveau panier.
          await ctx.db.transaction(async (tx) => {
            await lockRegistrationForBilling(tx, existingRegistration.id);

            await tx
              .update(schema.registrations)
              .set({
                status: "pending_payment",
                totalAmount: 0,
                paymentOrderCode: null,
                paymentReservedUntil: null,
                updatedAt: new Date(),
              })
              .where(eq(schema.registrations.id, existingRegistration.id));

            // Delete any old products from cancelled registration
            await tx
              .delete(schema.products)
              .where(eq(schema.products.registrationId, existingRegistration.id));
          });

          return {
            ...existingRegistration,
            status: "pending_payment" as const,
            totalAmount: 0,
            paymentOrderCode: null,
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
  getById: producerProcedure
    .input(getRegistrationSchema)
    .query(async ({ ctx, input }) => {
      const producer = ctx.producer;

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
  addProduct: producerProcedure
    .input(addProductSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

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

      const cup = await ctx.db.query.cups.findFirst({
        where: (cups, { eq: eqFn }) => eqFn(cups.id, registration.cupId),
        columns: { registrationOpenAt: true, registrationCloseAt: true },
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      assertRegistrationOpen(cup);

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

      // L'insertion et le recalcul du total sont commites ensemble : un produit
      // enregistre sans que le total suive laisserait payer moins que du.
      const { product, total, paymentOrderInvalidated, staleOrderCode } =
        await ctx.db.transaction(async (tx) => {
          const previous = await lockRegistrationForBilling(tx, input.registrationId);

          // Quotas : le panier, produit ajoute compris, doit tenir dans les
          // places que les autres inscriptions n'occupent ni ne reservent.
          // Ajouter au panier ne reserve rien ; c'est l'ouverture du paiement
          // qui prend la place (createCheckoutSession).
          await lockCategoryQuotas(tx, [input.categoryId]);
          const cartProducts = await tx.query.products.findMany({
            where: (prod, { eq: eqFn }) => eqFn(prod.registrationId, input.registrationId),
            columns: { categoryId: true },
          });
          assertCartWithinQuotas(
            [category],
            countByCategory([...cartProducts, { categoryId: input.categoryId }]),
            await getCategoryOccupancy(tx, registration.cupId, input.registrationId)
          );

          const [created] = await tx
            .insert(schema.products)
            .values({
              id: nanoid(),
              registrationId: input.registrationId,
              categoryId: input.categoryId,
              name: input.name,
              description: input.description ?? null,
              priceAtRegistration: price,
              status: "pending",
            })
            .returning();

          const recalculated = await applyRecalculatedTotal(
            tx,
            input.registrationId,
            previous
          );

          return { product: created, ...recalculated };
        });

      if (staleOrderCode) {
        await cancelPaymentOrder(staleOrderCode);
      }

      return {
        product,
        newTotal: total,
        // Vrai si une commande Viva anterieure vient d'etre perimee : le client
        // doit repasser par createCheckoutSession, l'ancien lien ne vaut plus.
        paymentOrderInvalidated,
      };
    }),

  /**
   * Remove a product from a registration
   * Only pending_payment registrations can be modified
   */
  removeProduct: producerProcedure
    .input(removeProductSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

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

      const { total, paymentOrderInvalidated, staleOrderCode } =
        await ctx.db.transaction(async (tx) => {
          const previous = await lockRegistrationForBilling(tx, product.registrationId);

          await tx
            .delete(schema.products)
            .where(eq(schema.products.id, input.productId));

          return applyRecalculatedTotal(tx, product.registrationId, previous);
        });

      if (staleOrderCode) {
        await cancelPaymentOrder(staleOrderCode);
      }

      return {
        success: true,
        newTotal: total,
        paymentOrderInvalidated,
      };
    }),

  /**
   * Get registration summary for payment
   * Returns products grouped by category with totals
   */
  getSummary: producerProcedure
    .input(getRegistrationSchema)
    .query(async ({ ctx, input }) => {
      const producer = ctx.producer;

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
   * Create a Viva.com payment order for a registration and return the URL the
   * producer must be sent to. Only works for pending_payment registrations
   * that actually have products and a non-zero total.
   */
  createCheckoutSession: producerProcedure
    .input(getRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

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
              status: true,
              registrationOpenAt: true,
              ratingStartAt: true,
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

      // Fenetre de reglement, pas de depot : le panier a ete compose avant la
      // cloture (`addProduct`), on ne fait ici que le payer.
      assertPaymentWindowOpen(registration.cup);

      if (registration.products.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez ajouter au moins un produit",
        });
      }

      if (registration.totalAmount === 0) {
        // Cas ouvert par le schéma (`cups.default_price_per_product` nullable,
        // `categories.price_override` à 0) mais non branché côté client : la
        // page d'inscription appelle toujours ce checkout. Le message doit
        // donc rester lisible par un producteur, pas nommer une procédure.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cette inscription est gratuite : aucun paiement n'est requis. Contactez l'organisateur pour la faire confirmer.",
        });
      }

      // Reservation des places AVANT la creation de la commande, sous verrou de
      // quota : de deux producteurs qui visent la derniere place, le premier a
      // passer ici la garde, le second recoit « categorie complete ». La
      // reservation est commitee avant l'appel a Viva (aucun appel reseau sous
      // verrou) et retiree si la commande ne peut pas etre creee.
      const previousOrderCode = await ctx.db.transaction(async (tx) => {
        const [locked] = await tx
          .select({
            status: schema.registrations.status,
            paymentOrderCode: schema.registrations.paymentOrderCode,
          })
          .from(schema.registrations)
          .where(eq(schema.registrations.id, registration.id))
          .for("update");

        if (locked?.status !== "pending_payment") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cette inscription a deja ete payee ou annulee",
          });
        }

        const cartProducts = await tx.query.products.findMany({
          where: (prod, { eq: eqFn }) => eqFn(prod.registrationId, registration.id),
          columns: { categoryId: true },
        });
        const cart = countByCategory(cartProducts);

        await lockCategoryQuotas(tx, [...cart.keys()]);
        const categories = await tx.query.categories.findMany({
          where: (cat, { inArray: inArrayFn }) => inArrayFn(cat.id, [...cart.keys()]),
          columns: { id: true, name: true, maxProducts: true, maxProductsPerProducer: true },
        });
        assertCartWithinQuotas(
          categories,
          cart,
          await getCategoryOccupancy(tx, registration.cupId, registration.id)
        );

        await tx
          .update(schema.registrations)
          .set({
            paymentReservedUntil: new Date(Date.now() + PAYMENT_RESERVATION_MS),
            updatedAt: new Date(),
          })
          .where(eq(schema.registrations.id, registration.id));

        return locked.paymentOrderCode;
      });

      // Une relance (page d'echec) remplace la commande precedente : on l'annule
      // pour qu'elle ne puisse plus etre reglee en parallele de la nouvelle.
      if (previousOrderCode) {
        await cancelPaymentOrder(previousOrderCode);
      }

      // The success / cancel URLs are configured on the Viva payment source
      // (VIVA_SOURCE_CODE) in the Viva back-office, not per order.
      try {
        const { orderCode, checkoutUrl } = await createPaymentOrder({
          paymentTimeout: PAYMENT_ORDER_TIMEOUT_SECONDS,
          amount: registration.totalAmount,
          customerTrns: `Inscription ${registration.cup.name} — ${registration.products.length} produit(s)`,
          // Echoed back on the webhook; this is how a payment is matched to
          // the registration it settles.
          merchantTrns: registration.id,
          customerEmail: ctx.session.user.email ?? undefined,
          customerName: ctx.session.user.name ?? undefined,
        });

        await ctx.db
          .update(schema.registrations)
          .set({ paymentOrderCode: orderCode, updatedAt: new Date() })
          .where(eq(schema.registrations.id, registration.id));

        return { checkoutUrl, orderCode };
      } catch (error) {
        console.error("[Registration] Viva payment order creation failed:", error);
        // Pas de commande, donc rien a payer : la place est rendue.
        await ctx.db
          .update(schema.registrations)
          .set({ paymentReservedUntil: null, updatedAt: new Date() })
          .where(eq(schema.registrations.id, registration.id));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Erreur lors de la creation de la session de paiement. Veuillez reessayer.",
        });
      }
    }),

  /**
   * Rend les places reservees par un paiement abandonne (page d'echec Viva).
   *
   * La commande est d'abord annulee chez Viva : tant qu'elle reste payable, la
   * place doit rester tenue, sinon un paiement tardif aboutirait sur une place
   * deja reprise. Si l'annulation echoue (commande deja reglee, identifiants
   * Basic absents, Viva injoignable), la reservation est conservee et tombera
   * d'elle-meme a son echeance.
   */
  releasePaymentReservation: producerProcedure
    .input(getRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, input.registrationId),
            eqFn(reg.producerId, ctx.producer.id)
          ),
        columns: {
          id: true,
          status: true,
          paymentOrderCode: true,
          paymentReservedUntil: true,
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      if (
        registration.status !== "pending_payment" ||
        !registration.paymentReservedUntil ||
        !registration.paymentOrderCode
      ) {
        return { released: false as const };
      }

      const orderCode = registration.paymentOrderCode;
      if (!(await cancelPaymentOrder(orderCode))) {
        return { released: false as const };
      }

      // Conditionne a la meme commande : une relance concurrente a pu en
      // ouvrir une nouvelle, dont la reservation ne doit pas sauter.
      await ctx.db
        .update(schema.registrations)
        .set({ paymentOrderCode: null, paymentReservedUntil: null, updatedAt: new Date() })
        .where(
          drizzleAnd(
            eq(schema.registrations.id, registration.id),
            eq(schema.registrations.status, "pending_payment"),
            eq(schema.registrations.paymentOrderCode, orderCode)
          )
        );

      return { released: true as const };
    }),

  /**
   * Settle a Viva payment from the success redirect.
   *
   * The webhook is the source of truth, but it can arrive after the producer
   * is back on the site — or not at all if the webhook URL has not been
   * registered in the Viva back-office yet. This re-reads the transaction
   * from Viva and confirms the registration itself; `confirmPaidRegistration`
   * is idempotent, so whichever path runs second is a no-op.
   */
  confirmVivaPayment: producerProcedure
    .input(z.object({ transactionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

      let transaction;
      try {
        transaction = await getTransaction(input.transactionId);
      } catch (error) {
        console.error("[Registration] Viva transaction lookup failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de verifier le paiement aupres de Viva.",
        });
      }

      // "F" = finished/settled. Anything else is not a completed payment.
      if (transaction.statusId !== "F") {
        return { status: "pending" as const, registrationId: null };
      }

      const registrationId = transaction.merchantTrns;
      if (!registrationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paiement non rattache a une inscription.",
        });
      }

      // The transaction must belong to a registration of the caller.
      const registration = await ctx.db.query.registrations.findFirst({
        where: (reg, { eq: eqFn, and: andFn }) =>
          andFn(
            eqFn(reg.id, registrationId),
            eqFn(reg.producerId, producer.id)
          ),
        columns: { id: true },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      let result;
      try {
        result = await confirmPaidRegistration({
          registrationId,
          transactionId: transaction.transactionId,
          orderCode: transaction.orderCode,
          // Deja lu chez Viva juste au-dessus : sans ce montant le service
          // refait la meme requete pour rien.
          amount: transaction.amount,
        });
      } catch (error) {
        if (error instanceof PaymentVerificationError) {
          // Le paiement existe mais ne correspond pas a l'inscription : c'est un
          // litige a traiter a la main, pas une panne serveur.
          console.error(
            `[Registration] Paiement ${transaction.transactionId} refuse pour l'inscription ${registrationId} (${error.reason}): ${error.message}`
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: paymentVerificationMessage(error.reason),
          });
        }
        throw error;
      }

      if (result.status === "not_found") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription non trouvee",
        });
      }

      // `already_confirmed` : le webhook est passe avant le retour navigateur.
      return { status: "confirmed" as const, registrationId };
    }),

  /**
   * Confirm a free registration (totalAmount = 0)
   * Directly sets status to confirmed without payment
   */
  confirmFreeRegistration: producerProcedure
    .input(getRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      const producer = ctx.producer;

      // Get registration
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
              status: true,
              registrationOpenAt: true,
              ratingStartAt: true,
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
          message: "Cette inscription a deja ete confirmee ou annulee",
        });
      }

      // Meme fenetre que le reglement payant : confirmer une inscription
      // gratuite est l'acte equivalent, et son panier est gele de la meme facon.
      assertPaymentWindowOpen(registration.cup);

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

      const now = new Date();

      // Meme contrat que le chemin payant (confirmPaidRegistration) : numero de
      // facture et anonymisation commites avec le passage en `confirmed`.
      // Sans l'attribution ici, une inscription gratuite n'etait numerotee qu'au
      // premier telechargement de sa facture, donc hors ordre chronologique.
      const confirmation = await ctx.db.transaction(async (tx) => {
        // Verrou de ligne : un double clic ne doit pas anonymiser deux fois ni
        // consommer deux numeros de facture.
        const [locked] = await tx
          .select({ status: schema.registrations.status })
          .from(schema.registrations)
          .where(eq(schema.registrations.id, registration.id))
          .for("update");

        if (locked?.status === "confirmed") {
          return { alreadyConfirmed: true as const };
        }

        // Pas de paiement, donc pas de reservation prealable : les quotas sont
        // verifies ici, au moment ou la place est prise.
        const cart = countByCategory(registration.products);
        await lockCategoryQuotas(tx, [...cart.keys()]);
        const categories = await tx.query.categories.findMany({
          where: (cat, { inArray: inArrayFn }) => inArrayFn(cat.id, [...cart.keys()]),
          columns: { id: true, name: true, maxProducts: true, maxProductsPerProducer: true },
        });
        assertCartWithinQuotas(
          categories,
          cart,
          await getCategoryOccupancy(tx, registration.cupId, registration.id)
        );

        const invoiceNumber = await allocateInvoiceNumber(tx, registration.id, now);

        await tx
          .update(schema.registrations)
          .set({
            status: "confirmed",
            paymentReservedUntil: null,
            updatedAt: now,
          })
          .where(eq(schema.registrations.id, registration.id));

        // Dans la transaction : une inscription confirmee dont les produits ne
        // seraient pas anonymises serait lisible en clair par le jury.
        const anonymizedProducts = await anonymizeRegistrationProducts(
          tx as unknown as typeof db,
          registration.id
        );

        return { alreadyConfirmed: false as const, invoiceNumber, anonymizedProducts };
      });

      if (confirmation.alreadyConfirmed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette inscription a deja ete confirmee ou annulee",
        });
      }

      const { invoiceNumber, anonymizedProducts } = confirmation;

      return {
        success: true,
        registrationId: registration.id,
        invoiceNumber,
        anonymizedProducts,
      };
    }),

  /**
   * List all registrations for a cup (organizer view)
   * Organisateur uniquement : la reponse expose l'email, le SIRET et le montant
   * paye de chaque producteur participant.
   */
  listByCup: organizerProcedure
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
