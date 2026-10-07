/**
 * Widget Router - Story 11.20
 * Public API for embeddable producer widgets
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, isNotNull, lte, desc, inArray, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  producerProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { producers } from "~/server/db/schema/producers";
import { registrations } from "~/server/db/schema/registrations";
import { products } from "~/server/db/schema/products";
import { cups } from "~/server/db/schema/cups";
import { cupLabels } from "~/server/db/schema/cup-labels";
import { categories } from "~/server/db/schema/categories";
import type { JuryPanel } from "~/server/db/schema/juries";
import { getPortalBaseUrl } from "~/server/services/app-url";

export const widgetRouter = createTRPCRouter({
  /**
   * Get producer medals for public widget display
   * No authentication required - public endpoint
   */
  getProducerMedals: rateLimitedPublicProcedure
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
          /** Une distinction par produit et par panel : clé stable pour l'affichage. */
          key: string;
          id: string;
          name: string;
          category: string;
          /** Panel qui a décerné la distinction. */
          panel: JuryPanel;
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

      // Une seule requête pour toutes les inscriptions : ce widget est chargé
      // depuis des sites tiers, sans trafic maîtrisé.
      const registrationIds = producerRegistrations.map((r) => r.registrationId);

      const allDistinctions = registrationIds.length
        ? await ctx.db
            .select({
              registrationId: products.registrationId,
              id: products.id,
              name: products.name,
              finalScorePro: products.finalScorePro,
              finalScorePublic: products.finalScorePublic,
              categoryRankPro: products.categoryRankPro,
              categoryRankPublic: products.categoryRankPublic,
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
                inArray(products.registrationId, registrationIds),
                eq(products.excludedFromResults, false),
                // Disqualified products never appear in the producer widget.
                eq(products.disqualified, false),
                // Un label, ou un podium (rang 1 à 3) dans l'un des deux panels.
                or(
                  isNotNull(products.labelId),
                  lte(products.categoryRankPro, 3),
                  lte(products.categoryRankPublic, 3)
                )
              )
            )
            .orderBy(
              desc(sql`coalesce(${products.finalScorePublic}, ${products.finalScorePro})`)
            )
        : [];

      const distinctionsByRegistration = new Map<string, typeof allDistinctions>();
      for (const row of allDistinctions) {
        const bucket = distinctionsByRegistration.get(row.registrationId) ?? [];
        bucket.push(row);
        distinctionsByRegistration.set(row.registrationId, bucket);
      }

      for (const reg of producerRegistrations) {
        const productsWithDistinctions =
          distinctionsByRegistration.get(reg.registrationId) ?? [];

        if (productsWithDistinctions.length > 0) {
          medals.push({
            cup: {
              id: reg.cupId,
              name: reg.cupName,
              year: reg.cupEventDate ? new Date(reg.cupEventDate).getFullYear() : null,
            },
            products: productsWithDistinctions.flatMap((p) => {
              const label = p.labelId
                ? {
                    id: p.labelId,
                    name: p.labelName ?? "",
                    color: p.labelColor,
                    icon: p.labelIcon,
                  }
                : null;
              const podium = (rank: number | null) =>
                rank !== null && rank <= 3 ? rank : null;
              const entries = [];
              // Jury public : label et/ou podium. Une édition antérieure à
              // jury pro unique porte son label sans résultat public : il est
              // alors rendu au jury pro, qui l'avait décerné.
              const publicRank = podium(p.categoryRankPublic);
              const labelPanel: JuryPanel =
                p.finalScorePublic !== null || p.finalScorePro === null ? "public" : "pro";
              if (publicRank !== null || (label && labelPanel === "public")) {
                entries.push({
                  key: `${p.id}-public`,
                  id: p.id,
                  name: p.name,
                  category: p.categoryName,
                  panel: "public" as const,
                  finalScore: p.finalScorePublic ? parseFloat(p.finalScorePublic) : null,
                  rank: publicRank,
                  label: labelPanel === "public" ? label : null,
                });
              }
              const proRank = podium(p.categoryRankPro);
              if (proRank !== null || (label && labelPanel === "pro")) {
                entries.push({
                  key: `${p.id}-pro`,
                  id: p.id,
                  name: p.name,
                  category: p.categoryName,
                  panel: "pro" as const,
                  finalScore: p.finalScorePro ? parseFloat(p.finalScorePro) : null,
                  rank: proRank,
                  label: labelPanel === "pro" ? label : null,
                });
              }
              return entries;
            }),
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
  getEmbedCode: producerProcedure.query(async ({ ctx }) => {
    // `producerProcedure` porte la garde « ce compte a bien un profil
    // producteur » : une redefinition locale de plus en divergeait par son
    // code d'erreur.
    const { producer } = ctx;

    // Source unique de l'URL publique. Le repli en dur sur le domaine de
    // production faisait générer, depuis une préproduction, un code d'intégration
    // qui pointait vers la prod : le producteur le collait sur son site et
    // affichait les médailles du mauvais déploiement.
    const baseUrl = getPortalBaseUrl();
    const widgetUrl = `${baseUrl}/widget/producer/${producer.id}`;

    // Generate iframe code
    const iframeCode = `<iframe src="${widgetUrl}" width="350" height="400" frameborder="0" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></iframe>`;

    // Generate script code (for more dynamic integration).
    // The attribute must match the selector in public/widget/embed.js.
    const scriptCode = `<div data-platinum-widget data-producer-id="${producer.id}"></div>
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
