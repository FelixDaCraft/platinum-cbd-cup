/**
 * Articles Router - single-tenant
 * CRUD operations for blog articles.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";

// Slug generation helper
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim hyphens
    .substring(0, 100);
}

export const articlesRouter = createTRPCRouter({
  /**
   * List articles (public reads published only; organizer reads all).
   */
  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "published", "all"]).optional().default("all"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = input?.status && input.status !== "all"
        ? [eq(schema.articles.status, input.status)]
        : [];

      const articles = await ctx.db.query.articles.findMany({
        where: whereConditions.length ? and(...whereConditions) : undefined,
        with: {
          author: {
            columns: { id: true, name: true, image: true },
          },
          sponsor: {
            columns: { id: true, name: true, logo: true },
          },
        },
        orderBy: [desc(schema.articles.updatedAt)],
      });

      return articles;
    }),

  /**
   * Get a single article by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.id, input.id),
        with: {
          author: {
            columns: { id: true, name: true, image: true },
          },
          sponsor: {
            columns: { id: true, name: true, logo: true },
          },
        },
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article non trouvé",
        });
      }

      return article;
    }),

  /**
   * Create a new article (organizer only)
   */
  create: organizerProcedure
    .input(
      z.object({
        title: z.string().min(1, "Le titre est requis"),
        slug: z.string().optional(),
        excerpt: z.string().optional(),
        content: z.record(z.unknown()), // TipTap JSON
        coverImage: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sponsorId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate slug if not provided
      let slug = input.slug?.trim() || generateSlug(input.title);

      // Check if slug is unique
      const existingSlug = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.slug, slug),
      });

      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }

      if (input.sponsorId) {
        const sponsor = await ctx.db.query.sponsors.findFirst({
          where: eq(schema.sponsors.id, input.sponsorId),
        });

        if (!sponsor) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sponsor not found",
          });
        }
      }

      const [article] = await ctx.db
        .insert(schema.articles)
        .values({
          id: crypto.randomUUID(),
          authorId: ctx.userId,
          title: input.title,
          slug,
          excerpt: input.excerpt || null,
          content: input.content,
          coverImage: input.coverImage || null,
          category: input.category || null,
          tags: input.tags ?? [],
          sponsorId: input.sponsorId || null,
          status: "draft",
        })
        .returning();

      return article;
    }),

  /**
   * Update an existing article
   */
  update: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        slug: z.string().optional(),
        excerpt: z.string().optional().nullable(),
        content: z.record(z.unknown()).optional(),
        coverImage: z.string().nullable().optional(),
        category: z.string().optional().nullable(),
        tags: z.array(z.string()).optional(),
        sponsorId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article non trouvé",
        });
      }

      // Check slug uniqueness if changed
      if (input.slug && input.slug !== existing.slug) {
        const existingSlug = await ctx.db.query.articles.findFirst({
          where: eq(schema.articles.slug, input.slug),
        });

        if (existingSlug) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ce slug est déjà utilisé",
          });
        }
      }

      if (input.sponsorId) {
        const sponsor = await ctx.db.query.sponsors.findFirst({
          where: eq(schema.sponsors.id, input.sponsorId),
        });

        if (!sponsor) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sponsor not found",
          });
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.excerpt !== undefined) updateData.excerpt = input.excerpt || null;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.coverImage !== undefined) updateData.coverImage = input.coverImage || null;
      if (input.category !== undefined) updateData.category = input.category || null;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.sponsorId !== undefined) updateData.sponsorId = input.sponsorId || null;

      const [updated] = await ctx.db
        .update(schema.articles)
        .set(updateData)
        .where(eq(schema.articles.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Publish an article
   */
  publish: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article non trouvé",
        });
      }

      const [updated] = await ctx.db
        .update(schema.articles)
        .set({
          status: "published",
          publishedAt: existing.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.articles.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Unpublish an article (back to draft)
   */
  unpublish: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(schema.articles)
        .set({
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(schema.articles.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article non trouvé",
        });
      }

      return updated;
    }),

  /**
   * Delete an article
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article non trouvé",
        });
      }

      await ctx.db
        .delete(schema.articles)
        .where(eq(schema.articles.id, input.id));

      return { success: true };
    }),

  /**
   * Check if a slug is available
   */
  checkSlug: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        excludeId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.query.articles.findFirst({
        where: eq(schema.articles.slug, input.slug),
      });

      if (!existing) {
        return { available: true };
      }

      if (input.excludeId && existing.id === input.excludeId) {
        return { available: true };
      }

      return { available: false };
    }),
});
