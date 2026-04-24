import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import * as schema from "~/server/db/schema";

export const profileRouter = createTRPCRouter({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    };
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Le nom doit faire au moins 2 caractères"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.users)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(schema.users.id, ctx.userId));

      return { success: true };
    }),

  /**
   * GDPR: Export all user data (single-tenant)
   */
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;

    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const producer = await ctx.db.query.producers.findFirst({
      where: eq(schema.producers.userId, userId),
    });

    let registrations: typeof schema.registrations.$inferSelect[] = [];
    let products: typeof schema.products.$inferSelect[] = [];
    if (producer) {
      registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.producerId, producer.id),
      });

      const regIds = registrations.map((r) => r.id);
      if (regIds.length > 0) {
        products = await ctx.db.query.products.findMany({
          where: eq(schema.products.registrationId, regIds[0]!),
        });
      }
    }

    const juryAssignments = await ctx.db.query.cupJuries.findMany({
      where: eq(schema.cupJuries.userId, userId),
    });

    let ratingsGiven: typeof schema.productRatings.$inferSelect[] = [];
    if (juryAssignments.length > 0) {
      const juryIds = juryAssignments.map((j) => j.id);
      ratingsGiven = await ctx.db.query.productRatings.findMany({
        where: eq(schema.productRatings.juryId, juryIds[0]!),
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
          }
        : null,
      producer: producer
        ? {
            id: producer.id,
            companyName: producer.companyName,
            brandName: producer.brandName,
            siret: producer.siret,
            website: producer.website,
            createdAt: producer.createdAt,
          }
        : null,
      registrations: registrations.map((reg) => ({
        id: reg.id,
        cupId: reg.cupId,
        status: reg.status,
        createdAt: reg.createdAt,
      })),
      products: products.map((prod) => ({
        id: prod.id,
        name: prod.name,
        description: prod.description,
        createdAt: prod.createdAt,
      })),
      juryAssignments: juryAssignments.map((j) => ({
        cupId: j.cupId,
        isActive: j.isActive,
        joinedAt: j.joinedAt,
      })),
      ratingsGiven: ratingsGiven.length,
    };
  }),

  /**
   * GDPR: Get account deletion status
   */
  getAccountStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.userId),
      columns: {
        deletionRequestedAt: true,
        deletionScheduledFor: true,
      },
    });

    return {
      deletionRequested: !!user?.deletionRequestedAt,
      deletionRequestedAt: user?.deletionRequestedAt ?? null,
      deletionScheduledFor: user?.deletionScheduledFor ?? null,
    };
  }),

  /**
   * GDPR: Request account deletion (30-day grace period)
   */
  requestAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.userId),
      columns: { deletionRequestedAt: true },
    });

    if (user?.deletionRequestedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Une demande de suppression est déjà en cours",
      });
    }

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await ctx.db
      .update(schema.users)
      .set({
        deletionRequestedAt: now,
        deletionScheduledFor: scheduledFor,
        updatedAt: now,
      })
      .where(eq(schema.users.id, ctx.userId));

    return {
      success: true,
      scheduledFor,
    };
  }),

  /**
   * GDPR: Cancel account deletion request
   */
  cancelAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(schema.users)
      .set({
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, ctx.userId));

    return { success: true };
  }),
});
