import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";

import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import { Errors } from "~/lib/errors";
import { getCupOrThrow } from "~/server/api/helpers/cup";
import * as schema from "~/server/db/schema";
import type { CupStatus } from "~/server/db/schema";
import {
  updateCupPricingSchema,
  updateCategoryPriceSchema,
} from "~/lib/validations/pricing";

/**
 * Pricing Router - single-tenant
 *
 * Tarif d'engagement payé par le producteur : `cups.defaultPricePerProduct`,
 * surchargé par catégorie via `categories.priceOverride`. C'est la valeur que
 * `registration.addProduct` fige dans `products.priceAtRegistration` puis que
 * la commande Viva.com encaisse — un changement ici ne vaut donc que pour les
 * produits inscrits ensuite.
 */

type Ctx = { db: typeof import("~/server/db").db };

/** Une seule definition de « charger la cup ou echouer » : helpers/cup.ts. */
const requireCup = (ctx: Ctx, cupId: string) => getCupOrThrow(ctx.db, cupId);

/**
 * Une cup terminée est un historique : ses tarifs ne bougent plus.
 */
function assertPricingEditable(cupStatus: CupStatus): void {
  if (cupStatus === "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Impossible de modifier la tarification d'une cup terminée",
    });
  }
}

export const pricingRouter = createTRPCRouter({
  /**
   * Tarification complète d'une cup : prix par défaut, devise, et surcharges
   * par catégorie.
   */
  getCupPricing: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      const categories = await ctx.db.query.categories.findMany({
        where: (categories, { eq: eqFn }) => eqFn(categories.cupId, input.cupId),
        orderBy: (categories) => [asc(categories.sortOrder)],
        columns: { id: true, name: true, priceOverride: true },
      });

      return {
        defaultPricePerProduct: cup.defaultPricePerProduct,
        currency: cup.currency ?? "EUR",
        cupStatus: cup.status,
        canEdit: cup.status !== "completed",
        categoryPrices: categories.map((category) => ({
          categoryId: category.id,
          name: category.name,
          priceOverride: category.priceOverride,
        })),
      };
    }),

  /**
   * Prix par défaut et devise de la cup.
   */
  updateCupPricing: organizerProcedure
    .input(updateCupPricingSchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      assertPricingEditable(cup.status);

      const updateData: Partial<typeof schema.cups.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.defaultPricePerProduct !== undefined) {
        updateData.defaultPricePerProduct = input.defaultPricePerProduct;
      }

      // `cups.currency` est nullable : sans ce repli, une cup publiée dont la
      // colonne vaut NULL rejetterait toute sauvegarde, le formulaire renvoyant
      // toujours "EUR".
      const currentCurrency = cup.currency ?? "EUR";

      if (input.currency !== undefined) {
        const isCurrencyChange = input.currency !== currentCurrency;

        // Les montants déjà figés (priceAtRegistration, totaux, factures) ne
        // portent pas leur devise : en changer après le brouillon les rendrait
        // incohérents. Le formulaire le verrouille aussi côté client.
        if (isCurrencyChange && cup.status !== "draft") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "La devise ne peut plus être modifiée après la publication de la cup",
          });
        }

        // On écrit aussi lorsque la colonne vaut NULL, pour la normaliser sur
        // la devise effectivement affichée partout.
        if (isCurrencyChange || cup.currency === null) {
          updateData.currency = input.currency;
        }
      }

      const [updatedCup] = await ctx.db
        .update(schema.cups)
        .set(updateData)
        .where(eq(schema.cups.id, input.cupId))
        .returning();

      return updatedCup;
    }),

  /**
   * Surcharge de prix d'une catégorie. `priceOverride: null` remet la
   * catégorie sur le prix par défaut de la cup.
   */
  updateCategoryPrice: organizerProcedure
    .input(updateCategoryPriceSchema)
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.query.categories.findFirst({
        where: (categories, { eq: eqFn }) => eqFn(categories.id, input.categoryId),
      });
      if (!category) Errors.categoryNotFound();

      const cup = await requireCup(ctx, category!.cupId);
      assertPricingEditable(cup.status);

      const [updated] = await ctx.db
        .update(schema.categories)
        .set({
          priceOverride: input.priceOverride,
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, input.categoryId))
        .returning();

      return updated;
    }),
});
