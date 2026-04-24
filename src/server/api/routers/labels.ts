import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, asc, count } from "drizzle-orm";

import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import { Errors } from "~/lib/errors";
import * as schema from "~/server/db/schema";
import type { CupStatus } from "~/server/db/schema";
import {
  createLabelSchema,
  updateLabelSchema,
  reorderLabelsSchema,
  validateLabelRanges,
  getDefaultLabels,
  getMaxScoreForScale,
} from "~/lib/validations/labels";

function assertLabelsEditable(cupStatus: CupStatus): void {
  if (cupStatus === "rating" || cupStatus === "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Impossible de modifier les labels pendant ou après la phase de notation",
    });
  }
}

type Ctx = { db: typeof import("~/server/db").db };

const requireCup = async (ctx: Ctx, cupId: string) => {
  const cup = await ctx.db.query.cups.findFirst({
    where: (cups, { eq: eqFn }) => eqFn(cups.id, cupId),
  });
  if (!cup) Errors.cupNotFound();
  return cup!;
};

const requireLabelWithCup = async (ctx: Ctx, labelId: string) => {
  const label = await ctx.db.query.cupLabels.findFirst({
    where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.id, labelId),
    with: { cup: true },
  });

  if (!label) Errors.notFound("Label non trouvé");
  return label!;
};

export const labelsRouter = createTRPCRouter({
  /**
   * Get all labels for a cup with edit permission status
   */
  getCupLabels: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      const labels = await ctx.db.query.cupLabels.findMany({
        where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.cupId, input.cupId),
        orderBy: (cupLabels) => [asc(cupLabels.sortOrder)],
      });

      const canEdit = cup.status !== "rating" && cup.status !== "completed";

      return {
        labels,
        cupStatus: cup.status,
        canEdit,
        ratingScale: cup.ratingScale,
        scaleMax: getMaxScoreForScale(cup.ratingScale),
      };
    }),

  /**
   * Initialize default labels (Bronze, Argent, Or) for a cup
   */
  initializeDefaultLabels: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      assertLabelsEditable(cup.status);

      const existingLabel = await ctx.db.query.cupLabels.findFirst({
        where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.cupId, input.cupId),
      });

      if (existingLabel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Des labels existent déjà pour cette cup",
        });
      }

      const defaultLabels = getDefaultLabels(cup.ratingScale);

      const labelsToInsert = defaultLabels.map((label) => ({
        id: nanoid(),
        cupId: input.cupId,
        name: label.name,
        minScore: label.minScore,
        maxScore: label.maxScore,
        color: label.color,
        sortOrder: label.sortOrder,
        icon: label.icon,
        condition: label.condition,
        isPublic: label.isPublic,
      }));

      await ctx.db.insert(schema.cupLabels).values(labelsToInsert);

      return { created: labelsToInsert.length };
    }),

  /**
   * Create a new label
   */
  create: organizerProcedure
    .input(createLabelSchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      assertLabelsEditable(cup.status);

      const existingLabels = await ctx.db.query.cupLabels.findMany({
        where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.cupId, input.cupId),
      });

      const scaleMax = getMaxScoreForScale(cup.ratingScale);

      if (input.minScore < 0 || input.minScore > scaleMax) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Le score minimum doit être entre 0 et ${scaleMax}`,
        });
      }
      if (input.maxScore !== null && input.maxScore !== undefined) {
        if (input.maxScore < 0 || input.maxScore > scaleMax) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Le score maximum doit être entre 0 et ${scaleMax}`,
          });
        }
      }

      const validation = validateLabelRanges(
        existingLabels.map((l) => ({
          id: l.id,
          name: l.name,
          minScore: l.minScore,
          maxScore: l.maxScore,
        })),
        {
          name: input.name,
          minScore: input.minScore,
          maxScore: input.maxScore ?? null,
        },
        scaleMax
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La plage de scores chevauche le label "${validation.conflictWith}"`,
        });
      }

      const maxOrder = Math.max(...existingLabels.map((l) => l.sortOrder), -1);

      const labelId = nanoid();
      const [label] = await ctx.db
        .insert(schema.cupLabels)
        .values({
          id: labelId,
          cupId: input.cupId,
          name: input.name,
          minScore: input.minScore,
          maxScore: input.maxScore ?? null,
          color: input.color ?? null,
          sortOrder: maxOrder + 1,
          icon: input.icon ?? null,
          condition: input.condition ?? null,
          isPublic: input.isPublic ?? true,
        })
        .returning();

      return label;
    }),

  /**
   * Update an existing label
   */
  update: organizerProcedure
    .input(updateLabelSchema)
    .mutation(async ({ ctx, input }) => {
      const label = await requireLabelWithCup(ctx, input.labelId);
      assertLabelsEditable(label.cup.status);

      const newMinScore = input.minScore ?? label.minScore;
      const newMaxScore =
        input.maxScore !== undefined ? input.maxScore : label.maxScore;

      const scaleMax = getMaxScoreForScale(label.cup.ratingScale);

      if (input.minScore !== undefined) {
        if (input.minScore < 0 || input.minScore > scaleMax) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Le score minimum doit être entre 0 et ${scaleMax}`,
          });
        }
      }
      if (input.maxScore !== undefined && input.maxScore !== null) {
        if (input.maxScore < 0 || input.maxScore > scaleMax) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Le score maximum doit être entre 0 et ${scaleMax}`,
          });
        }
      }

      if (input.minScore !== undefined || input.maxScore !== undefined) {
        const otherLabels = await ctx.db.query.cupLabels.findMany({
          where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.cupId, label.cupId),
        });

        const validation = validateLabelRanges(
          otherLabels.map((l) => ({
            id: l.id,
            name: l.name,
            minScore: l.minScore,
            maxScore: l.maxScore,
          })),
          {
            id: input.labelId,
            name: input.name ?? label.name,
            minScore: newMinScore,
            maxScore: newMaxScore,
          },
          scaleMax
        );

        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La plage de scores chevauche le label "${validation.conflictWith}"`,
          });
        }
      }

      const updateData: Partial<typeof schema.cupLabels.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.minScore !== undefined) updateData.minScore = input.minScore;
      if (input.maxScore !== undefined) updateData.maxScore = input.maxScore;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.condition !== undefined) updateData.condition = input.condition;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

      const [updated] = await ctx.db
        .update(schema.cupLabels)
        .set(updateData)
        .where(eq(schema.cupLabels.id, input.labelId))
        .returning();

      return updated;
    }),

  /**
   * Delete a label
   */
  delete: organizerProcedure
    .input(z.object({ labelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const label = await requireLabelWithCup(ctx, input.labelId);
      assertLabelsEditable(label.cup.status);

      await ctx.db
        .delete(schema.cupLabels)
        .where(eq(schema.cupLabels.id, input.labelId));

      return { success: true };
    }),

  /**
   * Reorder labels by updating sortOrder
   */
  reorder: organizerProcedure
    .input(reorderLabelsSchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      assertLabelsEditable(cup.status);

      const existingLabels = await ctx.db.query.cupLabels.findMany({
        where: (cupLabels, { eq: eqFn }) => eqFn(cupLabels.cupId, input.cupId),
      });

      const existingIds = new Set(existingLabels.map((l) => l.id));
      const allBelongToCup = input.labelIds.every((id) => existingIds.has(id));

      if (!allBelongToCup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains labels n'appartiennent pas à cette cup",
        });
      }

      if (input.labelIds.length !== existingLabels.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tous les labels de la cup doivent être inclus",
        });
      }

      const updates = input.labelIds.map((labelId, index) =>
        ctx.db
          .update(schema.cupLabels)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(schema.cupLabels.id, labelId))
      );

      await Promise.all(updates);

      return { success: true };
    }),

  /**
   * Get labels count for a cup
   */
  count: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireCup(ctx, input.cupId);

      const result = await ctx.db
        .select({ count: count() })
        .from(schema.cupLabels)
        .where(eq(schema.cupLabels.cupId, input.cupId));

      return result[0]?.count ?? 0;
    }),
});
