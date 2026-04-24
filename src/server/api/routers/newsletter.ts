/**
 * Newsletter Router - single-tenant
 * Newsletter subscriber management.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";

/**
 * Generate a random token for confirmation/unsubscribe
 */
function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export const newsletterRouter = createTRPCRouter({
  /**
   * Get newsletter stats for dashboard
   */
  getStats: organizerProcedure.query(async ({ ctx }) => {
    const [totalResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.newsletterSubscribers);

    const [activeResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.status, "active"));

    const [pendingResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.status, "pending"));

    const [unsubscribedResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.status, "unsubscribed"));

    return {
      total: totalResult?.count ?? 0,
      active: activeResult?.count ?? 0,
      pending: pendingResult?.count ?? 0,
      unsubscribed: unsubscribedResult?.count ?? 0,
    };
  }),

  /**
   * List subscribers with pagination and filtering
   */
  list: organizerProcedure
    .input(
      z.object({
        status: z.enum(["all", "active", "pending", "unsubscribed"]).optional().default("all"),
        search: z.string().optional(),
        page: z.number().min(1).optional().default(1),
        limit: z.number().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const conditions = [];

      if (input.status !== "all") {
        conditions.push(eq(schema.newsletterSubscribers.status, input.status));
      }

      if (input.search) {
        conditions.push(
          sql`(${schema.newsletterSubscribers.email} ILIKE ${`%${input.search}%`} OR ${schema.newsletterSubscribers.name} ILIKE ${`%${input.search}%`})`
        );
      }

      const where = conditions.length ? and(...conditions) : undefined;

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.newsletterSubscribers)
        .where(where);

      const totalCount = countResult?.count ?? 0;
      const totalPages = Math.ceil(totalCount / input.limit);

      const subscribers = await ctx.db.query.newsletterSubscribers.findMany({
        where,
        orderBy: [desc(schema.newsletterSubscribers.createdAt)],
        limit: input.limit,
        offset,
      });

      return {
        subscribers,
        pagination: {
          currentPage: input.page,
          totalPages,
          totalCount,
          hasNextPage: input.page < totalPages,
          hasPrevPage: input.page > 1,
        },
      };
    }),

  /**
   * Add a subscriber manually (from dashboard)
   */
  add: organizerProcedure
    .input(
      z.object({
        email: z.string().email("Email invalide"),
        name: z.string().optional(),
        skipConfirmation: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.newsletterSubscribers.findFirst({
        where: eq(schema.newsletterSubscribers.email, input.email.toLowerCase()),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cet email est déjà inscrit",
        });
      }

      const [subscriber] = await ctx.db
        .insert(schema.newsletterSubscribers)
        .values({
          id: crypto.randomUUID(),
          email: input.email.toLowerCase(),
          name: input.name || null,
          status: input.skipConfirmation ? "active" : "pending",
          confirmedAt: input.skipConfirmation ? new Date() : null,
          confirmationToken: input.skipConfirmation ? null : generateToken(),
          unsubscribeToken: generateToken(),
          source: "manual",
        })
        .returning();

      return subscriber;
    }),

  /**
   * Subscribe from portal (public endpoint)
   */
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email invalide"),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.newsletterSubscribers.findFirst({
        where: eq(schema.newsletterSubscribers.email, input.email.toLowerCase()),
      });

      if (existing) {
        if (existing.status === "active") {
          return { success: true, message: "Vous êtes déjà inscrit à notre newsletter." };
        }
        if (existing.status === "unsubscribed") {
          await ctx.db
            .update(schema.newsletterSubscribers)
            .set({
              status: "pending",
              confirmationToken: generateToken(),
              unsubscribedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.newsletterSubscribers.id, existing.id));

          return { success: true, message: "Un email de confirmation vous a été envoyé." };
        }
        return { success: true, message: "Un email de confirmation est en attente." };
      }

      await ctx.db.insert(schema.newsletterSubscribers).values({
        id: crypto.randomUUID(),
        email: input.email.toLowerCase(),
        name: input.name || null,
        status: "pending",
        confirmationToken: generateToken(),
        unsubscribeToken: generateToken(),
        source: "portal",
      });

      return { success: true, message: "Un email de confirmation vous a été envoyé." };
    }),

  /**
   * Confirm subscription (double opt-in)
   */
  confirm: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const subscriber = await ctx.db.query.newsletterSubscribers.findFirst({
        where: eq(schema.newsletterSubscribers.confirmationToken, input.token),
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien de confirmation invalide ou expiré",
        });
      }

      if (subscriber.status === "active") {
        return { success: true, message: "Votre inscription est déjà confirmée." };
      }

      await ctx.db
        .update(schema.newsletterSubscribers)
        .set({
          status: "active",
          confirmationToken: null,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.newsletterSubscribers.id, subscriber.id));

      return { success: true, message: "Votre inscription est confirmée !" };
    }),

  /**
   * Unsubscribe
   */
  unsubscribe: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const subscriber = await ctx.db.query.newsletterSubscribers.findFirst({
        where: eq(schema.newsletterSubscribers.unsubscribeToken, input.token),
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien de désinscription invalide",
        });
      }

      if (subscriber.status === "unsubscribed") {
        return { success: true, message: "Vous êtes déjà désinscrit." };
      }

      await ctx.db
        .update(schema.newsletterSubscribers)
        .set({
          status: "unsubscribed",
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.newsletterSubscribers.id, subscriber.id));

      return { success: true, message: "Vous avez été désinscrit de notre newsletter." };
    }),

  /**
   * Delete a subscriber (hard delete)
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const subscriber = await ctx.db.query.newsletterSubscribers.findFirst({
        where: eq(schema.newsletterSubscribers.id, input.id),
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Abonné non trouvé",
        });
      }

      await ctx.db
        .delete(schema.newsletterSubscribers)
        .where(eq(schema.newsletterSubscribers.id, input.id));

      return { success: true };
    }),

  /**
   * Export subscribers as CSV
   */
  export: organizerProcedure
    .input(
      z.object({
        status: z.enum(["all", "active", "pending", "unsubscribed"]).optional().default("active"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = input.status !== "all"
        ? eq(schema.newsletterSubscribers.status, input.status)
        : undefined;

      const subscribers = await ctx.db.query.newsletterSubscribers.findMany({
        where,
        orderBy: [desc(schema.newsletterSubscribers.createdAt)],
      });

      const headers = ["email", "name", "status", "source", "subscribed_at", "confirmed_at"];
      const rows = subscribers.map((s) => [
        s.email,
        s.name ?? "",
        s.status,
        s.source ?? "portal",
        s.createdAt.toISOString(),
        s.confirmedAt?.toISOString() ?? "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      return { csv, count: subscribers.length };
    }),
});
