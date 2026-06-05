/**
 * Widget Router - Story 11.20
 * Public API for embeddable producer widgets
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, isNotNull, lte, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { producers } from "~/server/db/schema/producers";
import { registrations } from "~/server/db/schema/registrations";
import { products } from "~/server/db/schema/products";
import { cups } from "~/server/db/schema/cups";
import { cupLabels } from "~/server/db/schema/cup-labels";
import { categories } from "~/server/db/schema/categories";

export const widgetRouter = createTRPCRouter({
  /**
   * Get producer medals for public widget display
   * No authentication required - public endpoint
   */
  getProducerMedals: publicProcedure
    .input(
      z.object({
        producerId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { producerId } = input;

      // Get producer info
      const producer = await ctx.db.query.producers.findFirst({
        where: eq(producers.id, producerId),
      });

      if (!producer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producteur non trouvé",
        });
      }

      // Get all registrations with published results
      const producerRegistrations = await ctx.db
        .select({
          registrationId: registrations.id,
          cupId: cups.id,
          cupName: cups.name,
          cupEventDate: cups.eventDate,
          resultsPublishedAt: cups.resultsPublishedAt,
        })
        .from(registrations)
        .innerJoin(cups, eq(registrations.cupId, cups.id))
        .where(
          and(
            eq(registrations.producerId, producerId),
            eq(registrations.status, "confirmed"),
            isNotNull(cups.resultsPublishedAt)
          )
        )
        .orderBy(desc(cups.eventDate), desc(cups.resultsPublishedAt));

      // Get products with labels OR podium positions (rank <= 3) for each registration
      const medals: Array<{
        cup: {
          id: string;
          name: string;
          year: number | null; // Extracted from eventDate
        };
        products: Array<{
          id: string;
          name: string;
          category: string;
          finalScore: number | null;
          rank: number | null;
          label: {
            id: string;
            name: string;
            color: string | null;
            icon: string | null;
          } | null;
        }>;
      }> = [];

      for (const reg of producerRegistrations) {
        const productsWithDistinctions = await ctx.db
          .select({
            id: products.id,
            name: products.name,
            finalScore: products.finalScore,
            categoryRank: products.categoryRank,
            categoryName: categories.name,
            labelId: cupLabels.id,
            labelName: cupLabels.name,
            labelColor: cupLabels.color,
            labelIcon: cupLabels.icon,
          })
          .from(products)
          .innerJoin(categories, eq(products.categoryId, categories.id))
          .leftJoin(cupLabels, eq(products.labelId, cupLabels.id))
          .where(
            and(
              eq(products.registrationId, reg.registrationId),
              eq(products.excludedFromResults, false),
              // Disqualified products never appear in the producer widget.
              eq(products.disqualified, false),
              // Product has a label OR is on podium (rank 1, 2, or 3)
              or(
                isNotNull(products.labelId),
                and(isNotNull(products.categoryRank), lte(products.categoryRank, 3))
              )
            )
          )
          .orderBy(desc(products.finalScore));

        if (productsWithDistinctions.length > 0) {
          medals.push({
            cup: {
              id: reg.cupId,
              name: reg.cupName,
              year: reg.cupEventDate ? new Date(reg.cupEventDate).getFullYear() : null,
            },
            products: productsWithDistinctions.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.categoryName,
              finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
              rank: p.categoryRank,
              label: p.labelId
                ? {
                    id: p.labelId,
                    name: p.labelName ?? "",
                    color: p.labelColor,
                    icon: p.labelIcon,
                  }
                : null,
            })),
          });
        }
      }

      // Count medals by label name and podium positions
      const medalCounts: Record<string, number> = {};
      let podiumCount = 0;
      const podiumByRank: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

      for (const cup of medals) {
        for (const product of cup.products) {
          // Count labels
          if (product.label) {
            medalCounts[product.label.name] =
              (medalCounts[product.label.name] ?? 0) + 1;
          }
          // Count podium positions (only if no label, to avoid double counting)
          if (product.rank && product.rank <= 3) {
            podiumCount++;
            podiumByRank[product.rank] = (podiumByRank[product.rank] ?? 0) + 1;
          }
        }
      }

      const totalLabels = Object.values(medalCounts).reduce((a, b) => a + b, 0);

      return {
        producer: {
          id: producer.id,
          companyName: producer.companyName,
          brandName: producer.brandName,
          logo: producer.logo,
          website: producer.website,
        },
        medals,
        summary: {
          totalLabels,
          totalPodiums: podiumCount,
          totalDistinctions: totalLabels + podiumCount,
          byLabel: medalCounts,
          byPodium: podiumByRank,
          cupsParticipated: medals.length,
        },
      };
    }),

  /**
   * Get widget embed code for the current producer
   * Requires authentication
   */
  getEmbedCode: protectedProcedure.query(async ({ ctx }) => {
    // Get producer profile
    const producer = await ctx.db.query.producers.findFirst({
      where: eq(producers.userId, ctx.userId),
    });

    if (!producer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profil producteur non trouvé",
      });
    }

    // Generate base URL for widget
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cupmetrics.com";
    const widgetUrl = `${baseUrl}/widget/producer/${producer.id}`;

    // Generate iframe code
    const iframeCode = `<iframe src="${widgetUrl}" width="350" height="400" frameborder="0" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></iframe>`;

    // Generate script code (for more dynamic integration)
    const scriptCode = `<div id="cupmetrics-widget" data-producer-id="${producer.id}"></div>
<script src="${baseUrl}/widget/embed.js" async></script>`;

    return {
      producerId: producer.id,
      widgetUrl,
      iframeCode,
      scriptCode,
      previewUrl: widgetUrl,
    };
  }),
});
