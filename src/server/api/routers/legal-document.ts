/**
 * Documents légaux éditables (aujourd'hui : le règlement — conditions de
 * participation). Lecture publique pour le portail, écriture réservée à
 * l'organisateur. Sans version enregistrée, le texte par défaut livré avec le
 * code fait foi.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import { legalDocuments, legalDocumentSlugs } from "~/server/db/schema";
import { getLegalDocument } from "~/server/services/legal-document.service";
import { tiptapDocumentInput } from "~/server/api/schemas/tiptap";

export const legalDocumentRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ slug: z.enum(legalDocumentSlugs) }))
    .query(({ ctx, input }) => getLegalDocument(ctx.db, input.slug)),

  update: organizerProcedure
    .input(
      z.object({
        slug: z.enum(legalDocumentSlugs),
        title: z.string().trim().min(1, "Titre requis").max(120),
        lede: z.string().trim().max(500).nullable(),
        // Mêmes bornes que les articles ; un règlement vide n'a pas de sens.
        content: tiptapDocumentInput.refine((d) => (d.content?.length ?? 0) > 0, {
          message: "Le règlement ne peut pas être vide",
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const values = {
        title: input.title,
        lede: input.lede || null,
        content: input.content as Record<string, unknown>,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      };
      const [row] = await ctx.db
        .insert(legalDocuments)
        .values({ slug: input.slug, ...values })
        .onConflictDoUpdate({ target: legalDocuments.slug, set: values })
        .returning();
      return row!;
    }),
});
