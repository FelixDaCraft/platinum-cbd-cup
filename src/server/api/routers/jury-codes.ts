/**
 * Jury Invitation Codes Router
 * Handles generation, activation, and management of invitation codes
 * for public cups where jury members are not known in advance
 */

import { z } from "zod";
import { randomInt } from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createTRPCRouter,
  organizerProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  rateLimitMiddleware,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import { alignUserRoleToJury, assertMayJoinPanel } from "~/server/api/helpers/jury";

/**
 * Generate a short readable code like "FLR-7X9-KM2"
 */
function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 3; i++) {
      // randomInt (CSPRNG) et non Math.random : un code d'invitation ne doit
      // pas être prédictible à partir de codes déjà distribués.
      segment += chars[randomInt(chars.length)];
    }
    segments.push(segment);
  }
  return segments.join("-");
}


const normalizeCode = (code: string) =>
  code
    .replace(/[-\s]/g, "")
    .toUpperCase()
    .replace(/(.{3})(?=.)/g, "$1-");

export const juryCodesRouter = createTRPCRouter({
  /**
   * Generate multiple invitation codes for a cup.
   * Only works for public cups.
   */
  generate: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryIds: z.array(z.string()).min(1, "Au moins une catégorie requise"),
        count: z.number().min(1).max(200, "Maximum 200 codes par génération"),
        destination: z.string().optional(),
        // QR glissé dans la boîte d'échantillons : réception acquise à l'activation.
        samplesIncluded: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      const categories = await ctx.db.query.categories.findMany({
        where: and(
          eq(schema.categories.cupId, input.cupId),
          inArray(schema.categories.id, input.categoryIds)
        ),
      });

      if (categories.length !== input.categoryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certaines catégories sont invalides",
        });
      }

      const codes: { id: string; code: string }[] = [];
      const existingCodes = new Set<string>();

      const existingInDb = await ctx.db.query.juryInvitationCodes.findMany({
        columns: { code: true },
      });
      existingInDb.forEach((c) => existingCodes.add(c.code));

      for (let i = 0; i < input.count; i++) {
        let code: string;
        let attempts = 0;
        do {
          code = generateShortCode();
          attempts++;
          if (attempts > 100) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Impossible de générer des codes uniques",
            });
          }
        } while (existingCodes.has(code));

        existingCodes.add(code);
        codes.push({ id: nanoid(), code });
      }

      await ctx.db.insert(schema.juryInvitationCodes).values(
        codes.map((c) => ({
          id: c.id,
          cupId: input.cupId,
          code: c.code,
          status: "pending" as const,
          destination: input.destination?.trim() || null,
          samplesIncluded: input.samplesIncluded,
          expiresAt: cup.ratingEndAt,
        }))
      );

      const categoryAssignments = codes.flatMap((c) =>
        input.categoryIds.map((catId) => ({
          id: nanoid(),
          codeId: c.id,
          categoryId: catId,
        }))
      );

      await ctx.db.insert(schema.juryInvitationCodeCategories).values(categoryAssignments);

      return {
        success: true,
        count: codes.length,
        codes: codes.map((c) => c.code),
        samplesIncluded: input.samplesIncluded,
      };
    }),

  /**
   * List all invitation codes for a cup
   */
  list: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        status: z.enum(["pending", "activated", "revoked", "expired", "all"]).default("all"),
        categoryId: z.string().optional(),
        destination: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      const conditions = [eq(schema.juryInvitationCodes.cupId, input.cupId)];
      if (input.status !== "all") {
        conditions.push(eq(schema.juryInvitationCodes.status, input.status));
      }
      if (input.destination) {
        conditions.push(eq(schema.juryInvitationCodes.destination, input.destination));
      }

      let codes = await ctx.db.query.juryInvitationCodes.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.juryInvitationCodes.createdAt)],
        with: {
          categories: {
            with: {
              category: { columns: { id: true, name: true } },
            },
          },
          activatedBy: {
            columns: { id: true, name: true, email: true },
          },
        },
      });

      if (input.categoryId) {
        codes = codes.filter((code) =>
          code.categories.some((cc) => cc.category.id === input.categoryId)
        );
      }

      return codes.map((code) => ({
        id: code.id,
        code: code.code,
        status: code.status,
        destination: code.destination,
        samplesIncluded: code.samplesIncluded,
        categories: code.categories.map((cc) => ({
          id: cc.category.id,
          name: cc.category.name,
        })),
        activatedBy: code.activatedBy
          ? {
              id: code.activatedBy.id,
              name: code.activatedBy.name,
              email: code.activatedBy.email,
            }
          : null,
        activatedAt: code.activatedAt,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
      }));
    }),

  /**
   * Get code details by code string (public endpoint for activation)
   * Limité en débit : sans cela, l'espace des codes (9 caractères sur un
   * alphabet de 32) serait énumérable depuis /api/trpc.
   */
  getByCode: rateLimitedPublicProcedure
    .input(z.object({ code: z.string().min(1, "Code requis") }))
    .query(async ({ ctx, input }) => {
      const code = await ctx.db.query.juryInvitationCodes.findFirst({
        where: eq(schema.juryInvitationCodes.code, normalizeCode(input.code)),
        with: {
          cup: {
            columns: { id: true, name: true, ratingEndAt: true },
          },
          categories: {
            with: {
              category: { columns: { id: true, name: true } },
            },
          },
        },
      });

      if (!code) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code d'invitation invalide",
        });
      }

      if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
        return {
          valid: false,
          reason: "expired",
          message: "Ce code d'invitation a expiré",
        };
      }

      if (code.status === "activated") {
        return {
          valid: false,
          reason: "already_activated",
          message: "Ce code d'invitation a déjà été utilisé",
        };
      }

      if (code.status === "revoked") {
        return {
          valid: false,
          reason: "revoked",
          message: "Ce code d'invitation a été révoqué",
        };
      }

      return {
        valid: true,
        code: code.code,
        cup: {
          id: code.cup.id,
          name: code.cup.name,
        },
        categories: code.categories.map((cc) => ({
          id: cc.category.id,
          name: cc.category.name,
        })),
        expiresAt: code.expiresAt,
        samplesIncluded: code.samplesIncluded,
      };
    }),

  /**
   * Activate a code - link it to the current user and create jury assignment
   */
  activate: protectedProcedure
    .use(rateLimitMiddleware)
    .input(z.object({ code: z.string().min(1, "Code requis") }))
    .mutation(async ({ ctx, input }) => {
      const invitationCode = await ctx.db.query.juryInvitationCodes.findFirst({
        where: eq(schema.juryInvitationCodes.code, normalizeCode(input.code)),
        with: {
          cup: true,
          categories: true,
        },
      });

      if (!invitationCode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code d'invitation invalide",
        });
      }

      if (invitationCode.status === "activated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce code a déjà été utilisé",
        });
      }

      if (invitationCode.status === "revoked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce code a été révoqué",
        });
      }

      if (invitationCode.expiresAt && new Date(invitationCode.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce code a expiré",
        });
      }

      // Conflit d'intérêts, par le garde-fou partagé : la règle dépend du type
      // d'édition, et cette copie en ligne ne la connaissait pas — elle
      // bloquait les jurys pro autant que les publics.
      // Un code d'invitation fait entrer dans le panel public.
      await assertMayJoinPanel(ctx.db, ctx.userId, invitationCode.cupId, "public");

      const existingCupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, invitationCode.cupId),
          eq(schema.cupJuries.userId, ctx.userId)
        ),
      });

      // Une transaction : sans elle, un échec après l'étape 1 brûlait le code
      // sans créer le profil, et le juré restait bloqué sur « code déjà utilisé ».
      await ctx.db.transaction(async (tx) => {
        // 1. Consommer le code. Le filtre sur `status` rend la prise atomique :
        //    deux activations concurrentes du même code, une seule gagne.
        const claimed = await tx
          .update(schema.juryInvitationCodes)
          .set({
            status: "activated",
            activatedByUserId: ctx.userId,
            activatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.juryInvitationCodes.id, invitationCode.id),
              eq(schema.juryInvitationCodes.status, "pending")
            )
          )
          .returning({ id: schema.juryInvitationCodes.id });

        if (claimed.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce code a déjà été utilisé",
          });
        }

        // 2. Ensure user has a jury profile
        let juryProfileId: string;
        const existingProfile = await tx.query.juryProfiles.findFirst({
          where: eq(schema.juryProfiles.userId, ctx.userId),
        });

        if (existingProfile) {
          juryProfileId = existingProfile.id;
        } else {
          juryProfileId = nanoid();
          await tx.insert(schema.juryProfiles).values({
            id: juryProfileId,
            userId: ctx.userId,
            juryType: "public",
          });
        }

        // 3. Handle cup jury and category assignments
        const now = new Date();
        if (existingCupJury) {
          // Échantillons inclus : la réception est acquise, sans écraser une
          // date déjà posée.
          if (invitationCode.samplesIncluded && !existingCupJury.samplesReceivedAt) {
            await tx
              .update(schema.cupJuries)
              .set({ samplesReceivedAt: now, updatedAt: now })
              .where(eq(schema.cupJuries.id, existingCupJury.id));
          }

          const categoryIds = invitationCode.categories.map((c) => c.categoryId);

          const existingAssignments = await tx.query.juryCategoryAssignments.findMany({
            where: and(
              eq(schema.juryCategoryAssignments.cupJuryId, existingCupJury.id),
              inArray(schema.juryCategoryAssignments.categoryId, categoryIds)
            ),
          });
          const existingCategoryIds = new Set(existingAssignments.map((a) => a.categoryId));

          const newAssignments = categoryIds
            .filter((catId) => !existingCategoryIds.has(catId))
            .map((catId) => ({
              id: nanoid(),
              cupJuryId: existingCupJury.id,
              categoryId: catId,
            }));

          if (newAssignments.length > 0) {
            await tx.insert(schema.juryCategoryAssignments).values(newAssignments);
          }
        } else {
          const cupJuryId = nanoid();
          await tx.insert(schema.cupJuries).values({
            id: cupJuryId,
            cupId: invitationCode.cupId,
            userId: ctx.userId,
            juryProfileId: juryProfileId,
            panel: "public",
            isActive: true,
            // Échantillons dans la boîte du QR : rien à confirmer ensuite.
            samplesReceivedAt: invitationCode.samplesIncluded ? now : null,
          });

          const assignments = invitationCode.categories.map((c) => ({
            id: nanoid(),
            cupJuryId: cupJuryId,
            categoryId: c.categoryId,
          }));

          if (assignments.length > 0) {
            await tx.insert(schema.juryCategoryAssignments).values(assignments);
          }
        }

        await alignUserRoleToJury(tx, ctx.userId);
      });

      return {
        success: true,
        cupId: invitationCode.cupId,
        categoriesCount: invitationCode.categories.length,
        samplesIncluded: invitationCode.samplesIncluded,
      };
    }),

  /**
   * Revoke a code (only pending codes can be revoked)
   */
  revoke: organizerProcedure
    .input(z.object({ codeId: z.string().min(1, "Code ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const code = await ctx.db.query.juryInvitationCodes.findFirst({
        where: eq(schema.juryInvitationCodes.id, input.codeId),
      });

      if (!code) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code non trouvé",
        });
      }

      if (code.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seuls les codes en attente peuvent être révoqués",
        });
      }

      await ctx.db
        .update(schema.juryInvitationCodes)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(schema.juryInvitationCodes.id, input.codeId));

      return { success: true };
    }),

  /**
   * Delete a code (only pending or revoked codes can be deleted)
   */
  delete: organizerProcedure
    .input(z.object({ codeId: z.string().min(1, "Code ID requis") }))
    .mutation(async ({ ctx, input }) => {
      const code = await ctx.db.query.juryInvitationCodes.findFirst({
        where: eq(schema.juryInvitationCodes.id, input.codeId),
      });

      if (!code) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code non trouvé",
        });
      }

      if (code.status === "activated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Les codes activés ne peuvent pas être supprimés",
        });
      }

      await ctx.db
        .delete(schema.juryInvitationCodes)
        .where(eq(schema.juryInvitationCodes.id, input.codeId));

      return { success: true };
    }),

  /**
   * Bulk delete codes (only pending or revoked)
   */
  deleteBulk: organizerProcedure
    .input(
      z.object({
        codeIds: z.array(z.string()).min(1, "Au moins un code requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const codes = await ctx.db.query.juryInvitationCodes.findMany({
        where: inArray(schema.juryInvitationCodes.id, input.codeIds),
      });

      if (codes.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucun code trouvé",
        });
      }

      const deletableCodes = codes.filter((c) => c.status !== "activated");
      const deletableIds = deletableCodes.map((c) => c.id);

      if (deletableIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tous les codes sélectionnés sont déjà activés",
        });
      }

      await ctx.db
        .delete(schema.juryInvitationCodes)
        .where(inArray(schema.juryInvitationCodes.id, deletableIds));

      return {
        success: true,
        deletedCount: deletableIds.length,
        skippedCount: codes.length - deletableIds.length,
      };
    }),

  /**
   * Get statistics for a cup's invitation codes
   */
  getStats: organizerProcedure
    .input(z.object({ cupId: z.string().min(1, "Cup ID requis") }))
    .query(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      const codes = await ctx.db.query.juryInvitationCodes.findMany({
        where: eq(schema.juryInvitationCodes.cupId, input.cupId),
        columns: { status: true },
      });

      return {
        total: codes.length,
        pending: codes.filter((c) => c.status === "pending").length,
        activated: codes.filter((c) => c.status === "activated").length,
        revoked: codes.filter((c) => c.status === "revoked").length,
        expired: codes.filter((c) => c.status === "expired").length,
      };
    }),
});
