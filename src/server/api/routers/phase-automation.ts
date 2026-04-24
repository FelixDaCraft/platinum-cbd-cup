import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Phase automation router for automatic status transitions
 * Called by cron jobs (Trigger.dev or similar) to automatically
 * transition cups based on configured dates
 *
 * SECURITY: Protected by CRON_SECRET environment variable
 */
export const phaseAutomationRouter = createTRPCRouter({
  /**
   * Check and execute phase transitions for all cups with configured dates
   * This procedure should be called periodically by a cron job
   *
   * Transitions:
   * - published -> registration_closed (when registrationCloseAt is reached)
   * - registration_closed -> rating (when ratingStartAt is reached)
   * - rating -> completed (when ratingEndAt is reached)
   *
   * Note: Notifications to organizers are TODO for post-MVP
   *
   * @security Requires CRON_SECRET in request to prevent unauthorized access
   */
  checkPhaseTransitions: publicProcedure
    .input(z.object({ cronSecret: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Validate cron secret to prevent unauthorized access
      const expectedSecret = process.env.CRON_SECRET;
      if (!expectedSecret || input.cronSecret !== expectedSecret) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid cron secret",
        });
      }
      const now = new Date();
      const transitions: { cupId: string; from: string; to: string }[] = [];

      // Transition 1: published -> registration_closed
      // When registrationCloseAt is reached
      const cupsToCloseRegistration = await ctx.db.query.cups.findMany({
        where: (cups, { and: andFn, eq: eqFn, lte: lteFn, isNotNull: isNotNullFn }) =>
          andFn(
            eqFn(cups.status, "published"),
            isNotNullFn(cups.registrationCloseAt),
            lteFn(cups.registrationCloseAt, now)
          ),
      });

      for (const cup of cupsToCloseRegistration) {
        await ctx.db
          .update(schema.cups)
          .set({ status: "registration_closed", updatedAt: now })
          .where(eq(schema.cups.id, cup.id));

        transitions.push({
          cupId: cup.id,
          from: "published",
          to: "registration_closed",
        });

        console.log(`[Phase Automation] Cup ${cup.id} (${cup.name}): registration closed automatically`);
        // TODO (post-MVP): Send notification to organizer via Resend
      }

      // Transition 2: registration_closed -> rating
      // When ratingStartAt is reached
      const cupsToStartRating = await ctx.db.query.cups.findMany({
        where: (cups, { and: andFn, eq: eqFn, lte: lteFn, isNotNull: isNotNullFn }) =>
          andFn(
            eqFn(cups.status, "registration_closed"),
            isNotNullFn(cups.ratingStartAt),
            lteFn(cups.ratingStartAt, now)
          ),
      });

      for (const cup of cupsToStartRating) {
        await ctx.db
          .update(schema.cups)
          .set({ status: "rating", updatedAt: now })
          .where(eq(schema.cups.id, cup.id));

        transitions.push({
          cupId: cup.id,
          from: "registration_closed",
          to: "rating",
        });

        console.log(`[Phase Automation] Cup ${cup.id} (${cup.name}): rating phase started automatically`);
        // TODO (post-MVP): Send notification to organizer via Resend
      }

      // Transition 3: rating -> completed
      // When ratingEndAt is reached
      const cupsToComplete = await ctx.db.query.cups.findMany({
        where: (cups, { and: andFn, eq: eqFn, lte: lteFn, isNotNull: isNotNullFn }) =>
          andFn(
            eqFn(cups.status, "rating"),
            isNotNullFn(cups.ratingEndAt),
            lteFn(cups.ratingEndAt, now)
          ),
      });

      for (const cup of cupsToComplete) {
        await ctx.db
          .update(schema.cups)
          .set({ status: "completed", updatedAt: now })
          .where(eq(schema.cups.id, cup.id));

        transitions.push({
          cupId: cup.id,
          from: "rating",
          to: "completed",
        });

        console.log(`[Phase Automation] Cup ${cup.id} (${cup.name}): cup completed automatically`);
        // TODO (post-MVP): Send notification to organizer via Resend
      }

      return {
        transitionsCount: transitions.length,
        transitions,
        executedAt: now,
      };
    }),
});
