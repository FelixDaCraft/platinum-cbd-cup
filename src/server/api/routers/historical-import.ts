/**
 * Historical Import Router
 * Handles import of past cup editions.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createTRPCRouter,
  organizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import { historicalMedalEnum } from "~/server/db/schema/historical-imports";

const createHistoricalCupSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  edition: z.string().optional(),
  eventDate: z.date().optional(),
  description: z.string().optional(),
});

const historicalResultSchema = z.object({
  productName: z.string().min(1, "Nom du produit requis"),
  producerName: z.string().min(1, "Nom du producteur requis"),
  producerEmail: z.string().email().optional(),
  category: z.string().optional(),
  medal: z.enum(historicalMedalEnum).default("none"),
  rank: z.number().int().positive().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

const importHistoricalResultsSchema = z.object({
  historicalCupId: z.string().min(1),
  results: z.array(historicalResultSchema),
});

function parseCSVContent(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 1) {
    throw new Error("Le fichier CSV est vide");
  }

  const firstLine = lines[0] ?? "";
  const separator = firstLine.includes(";") ? ";" : ",";
  const headers = firstLine.split(separator).map((h) => h.trim().toLowerCase());

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    rows.push(values);
  }

  return { headers, rows };
}

export const historicalImportRouter = createTRPCRouter({
  /**
   * List all historical cups
   */
  list: organizerProcedure.query(async ({ ctx }) => {
    const historicalCups = await ctx.db.query.historicalCups.findMany({
      orderBy: (cups, { desc }) => [desc(cups.year)],
    });

    return historicalCups;
  }),

  /**
   * Get a single historical cup with its results
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const historicalCup = await ctx.db.query.historicalCups.findFirst({
        where: eq(schema.historicalCups.id, input.id),
        with: {
          results: {
            with: {
              historicalProducer: true,
            },
          },
        },
      });

      if (!historicalCup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Édition non trouvée",
        });
      }

      return historicalCup;
    }),

  /**
   * Create a new historical cup (edition)
   */
  create: organizerProcedure
    .input(createHistoricalCupSchema)
    .mutation(async ({ ctx, input }) => {
      const cupId = nanoid();
      const [historicalCup] = await ctx.db
        .insert(schema.historicalCups)
        .values({
          id: cupId,
          name: input.name,
          year: input.year,
          edition: input.edition,
          eventDate: input.eventDate,
          description: input.description,
          importedBy: ctx.userId,
        })
        .returning();

      return historicalCup;
    }),

  /**
   * Parse CSV and preview results before import
   */
  parseResultsCSV: organizerProcedure
    .input(
      z.object({
        historicalCupId: z.string().min(1),
        csvContent: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const historicalCup = await ctx.db.query.historicalCups.findFirst({
        where: eq(schema.historicalCups.id, input.historicalCupId),
      });

      if (!historicalCup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Édition non trouvée",
        });
      }

      const { headers, rows } = parseCSVContent(input.csvContent);

      const producerCol = headers.findIndex((h) =>
        ["producteur", "nom_producteur", "producer", "producer_name"].includes(h)
      );
      const productCol = headers.findIndex((h) =>
        ["produit", "nom_produit", "product", "product_name", "nom"].includes(h)
      );
      const emailCol = headers.findIndex((h) => ["email", "producteur_email"].includes(h));
      const categoryCol = headers.findIndex((h) => ["categorie", "category"].includes(h));
      const medalCol = headers.findIndex((h) => ["medaille", "medal", "prix", "distinction"].includes(h));
      const rankCol = headers.findIndex((h) => ["rang", "rank", "classement", "position"].includes(h));
      const scoreCol = headers.findIndex((h) => ["score", "note", "points"].includes(h));

      if (producerCol === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Colonne 'producteur' ou 'nom_producteur' requise",
        });
      }

      if (productCol === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Colonne 'produit' ou 'nom_produit' requise",
        });
      }

      const medalMapping: Record<string, typeof historicalMedalEnum[number]> = {
        or: "gold",
        gold: "gold",
        médaille_or: "gold",
        "médaille d'or": "gold",
        argent: "silver",
        silver: "silver",
        médaille_argent: "silver",
        "médaille d'argent": "silver",
        bronze: "bronze",
        médaille_bronze: "bronze",
        "médaille de bronze": "bronze",
        mention: "mention",
        "mention spéciale": "mention",
        "": "none",
        aucune: "none",
        none: "none",
      };

      const previewRows = rows.map((row, index) => {
        const producerName = row[producerCol]?.trim() ?? "";
        const productName = row[productCol]?.trim() ?? "";
        const email = emailCol >= 0 ? row[emailCol]?.trim() : undefined;
        const category = categoryCol >= 0 ? row[categoryCol]?.trim() : undefined;
        const medalRaw = medalCol >= 0 ? row[medalCol]?.trim().toLowerCase() : "";
        const medal = medalMapping[medalRaw ?? ""] ?? "none";
        const rank = rankCol >= 0 ? parseInt(row[rankCol] ?? "", 10) || undefined : undefined;
        const score = scoreCol >= 0 ? parseInt(row[scoreCol] ?? "", 10) || undefined : undefined;

        let status: "valid" | "invalid" | "warning" = "valid";
        let error: string | undefined;

        if (!producerName) {
          status = "invalid";
          error = "Nom du producteur requis";
        } else if (!productName) {
          status = "invalid";
          error = "Nom du produit requis";
        }

        return {
          index,
          data: {
            producerName,
            productName,
            email,
            category,
            medal,
            rank,
            score,
          },
          status,
          error,
        };
      });

      return {
        rows: previewRows,
        detectedColumns: {
          producer: producerCol >= 0,
          product: productCol >= 0,
          email: emailCol >= 0,
          category: categoryCol >= 0,
          medal: medalCol >= 0,
          rank: rankCol >= 0,
          score: scoreCol >= 0,
        },
      };
    }),

  /**
   * Import results into a historical cup
   */
  importResults: organizerProcedure
    .input(importHistoricalResultsSchema)
    .mutation(async ({ ctx, input }) => {
      const historicalCup = await ctx.db.query.historicalCups.findFirst({
        where: eq(schema.historicalCups.id, input.historicalCupId),
      });

      if (!historicalCup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Édition non trouvée",
        });
      }

      let producersCreated = 0;
      let resultsCreated = 0;
      const errors: string[] = [];

      const producerCache = new Map<string, string>();

      const existingProducers = await ctx.db.query.historicalProducers.findMany();
      for (const p of existingProducers) {
        producerCache.set(p.name.toLowerCase(), p.id);
      }

      for (const result of input.results) {
        try {
          let producerId = producerCache.get(result.producerName.toLowerCase());

          if (!producerId) {
            producerId = nanoid();
            await ctx.db.insert(schema.historicalProducers).values({
              id: producerId,
              name: result.producerName,
              email: result.producerEmail,
            });
            producerCache.set(result.producerName.toLowerCase(), producerId);
            producersCreated++;
          }

          const resultId = nanoid();
          await ctx.db.insert(schema.historicalResults).values({
            id: resultId,
            historicalCupId: input.historicalCupId,
            historicalProducerId: producerId,
            productName: result.productName,
            category: result.category,
            medal: result.medal,
            rank: result.rank,
            score: result.score,
          });
          resultsCreated++;
        } catch (e) {
          console.error("Error importing result:", result, e);
          errors.push(`Erreur pour ${result.productName}: ${e instanceof Error ? e.message : "Erreur inconnue"}`);
        }
      }

      await ctx.db
        .update(schema.historicalCups)
        .set({
          productsCount: resultsCreated,
          producersCount: producersCreated,
          updatedAt: new Date(),
        })
        .where(eq(schema.historicalCups.id, input.historicalCupId));

      return {
        producersCreated,
        resultsCreated,
        errors,
      };
    }),

  /**
   * Delete a historical cup and all its data
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const historicalCup = await ctx.db.query.historicalCups.findFirst({
        where: eq(schema.historicalCups.id, input.id),
      });

      if (!historicalCup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Édition non trouvée",
        });
      }

      await ctx.db
        .delete(schema.historicalCups)
        .where(eq(schema.historicalCups.id, input.id));

      return { success: true };
    }),
});
