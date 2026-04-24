/**
 * Press Router - single-tenant
 * CRUD operations for press releases, gallery images, and press settings
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";

export const pressRouter = createTRPCRouter({
  // ========================================
  // PRESS SETTINGS
  // ========================================

  /**
   * Get press settings (public read for portal)
   */
  getSettings: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.query.pressSettings.findFirst();
    return settings;
  }),

  /**
   * Update press settings (create if not exists) — organizer only
   */
  updateSettings: organizerProcedure
    .input(
      z.object({
        mediaKitUrl: z.string().nullable().optional(),
        mediaKitFileName: z.string().nullable().optional(),
        pressEmail: z.string().email().nullable().optional().or(z.literal("")),
        pressPhone: z.string().nullable().optional(),
        showPressReleases: z.boolean().optional(),
        showGallery: z.boolean().optional(),
        showMediaKit: z.boolean().optional(),
        showContact: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.pressSettings.findFirst();

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.mediaKitUrl !== undefined) updateData.mediaKitUrl = input.mediaKitUrl;
      if (input.mediaKitFileName !== undefined) updateData.mediaKitFileName = input.mediaKitFileName;
      if (input.pressEmail !== undefined) updateData.pressEmail = input.pressEmail;
      if (input.pressPhone !== undefined) updateData.pressPhone = input.pressPhone;
      if (input.showPressReleases !== undefined) updateData.showPressReleases = String(input.showPressReleases);
      if (input.showGallery !== undefined) updateData.showGallery = String(input.showGallery);
      if (input.showMediaKit !== undefined) updateData.showMediaKit = String(input.showMediaKit);
      if (input.showContact !== undefined) updateData.showContact = String(input.showContact);

      if (existing) {
        const [updated] = await ctx.db
          .update(schema.pressSettings)
          .set(updateData)
          .where(eq(schema.pressSettings.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await ctx.db
          .insert(schema.pressSettings)
          .values(updateData)
          .returning();
        return created;
      }
    }),

  // ========================================
  // PRESS RELEASES
  // ========================================

  /**
   * List all press releases (organizer)
   */
  listReleases: organizerProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "published", "all"]).optional().default("all"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = input?.status && input.status !== "all"
        ? eq(schema.pressReleases.status, input.status)
        : undefined;

      const releases = await ctx.db.query.pressReleases.findMany({
        where,
        with: {
          author: {
            columns: { id: true, name: true, image: true },
          },
        },
        orderBy: [asc(schema.pressReleases.displayOrder), desc(schema.pressReleases.publishedAt)],
      });

      return releases;
    }),

  /**
   * List published press releases (for public portal)
   */
  listPublishedReleases: publicProcedure.query(async ({ ctx }) => {
    const releases = await ctx.db.query.pressReleases.findMany({
      where: eq(schema.pressReleases.status, "published"),
      orderBy: [asc(schema.pressReleases.displayOrder), desc(schema.pressReleases.publishedAt)],
    });

    return releases;
  }),

  /**
   * Get a single press release
   */
  getRelease: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const release = await ctx.db.query.pressReleases.findFirst({
        where: eq(schema.pressReleases.id, input.id),
        with: {
          author: {
            columns: { id: true, name: true, image: true },
          },
        },
      });

      if (!release) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communiqué non trouvé",
        });
      }

      return release;
    }),

  /**
   * Create a press release
   */
  createRelease: organizerProcedure
    .input(
      z.object({
        title: z.string().min(1, "Le titre est requis"),
        excerpt: z.string().optional(),
        coverImageUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.query.pressReleases.findFirst({
        orderBy: [desc(schema.pressReleases.displayOrder)],
      });

      const [release] = await ctx.db
        .insert(schema.pressReleases)
        .values({
          authorId: ctx.userId,
          title: input.title,
          excerpt: input.excerpt || null,
          coverImageUrl: input.coverImageUrl || null,
          pdfUrl: input.pdfUrl || null,
          displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
          status: "draft",
        })
        .returning();

      return release;
    }),

  /**
   * Update a press release
   */
  updateRelease: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        excerpt: z.string().nullable().optional(),
        coverImageUrl: z.string().nullable().optional(),
        pdfUrl: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.pressReleases.findFirst({
        where: eq(schema.pressReleases.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communiqué non trouvé",
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
      if (input.coverImageUrl !== undefined) updateData.coverImageUrl = input.coverImageUrl;
      if (input.pdfUrl !== undefined) updateData.pdfUrl = input.pdfUrl;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      const [updated] = await ctx.db
        .update(schema.pressReleases)
        .set(updateData)
        .where(eq(schema.pressReleases.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Publish a press release
   */
  publishRelease: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.pressReleases.findFirst({
        where: eq(schema.pressReleases.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communiqué non trouvé",
        });
      }

      const [updated] = await ctx.db
        .update(schema.pressReleases)
        .set({
          status: "published",
          publishedAt: existing.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.pressReleases.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Unpublish a press release
   */
  unpublishRelease: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(schema.pressReleases)
        .set({
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(schema.pressReleases.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communiqué non trouvé",
        });
      }

      return updated;
    }),

  /**
   * Delete a press release
   */
  deleteRelease: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.pressReleases.findFirst({
        where: eq(schema.pressReleases.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communiqué non trouvé",
        });
      }

      await ctx.db
        .delete(schema.pressReleases)
        .where(eq(schema.pressReleases.id, input.id));

      return { success: true };
    }),

  // ========================================
  // GALLERY IMAGES
  // ========================================

  /**
   * List all gallery images (organizer)
   */
  listImages: organizerProcedure.query(async ({ ctx }) => {
    const images = await ctx.db.query.galleryImages.findMany({
      with: {
        uploader: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [asc(schema.galleryImages.displayOrder), desc(schema.galleryImages.createdAt)],
    });

    return images;
  }),

  /**
   * List gallery images for public portal
   */
  listPublicImages: publicProcedure.query(async ({ ctx }) => {
    const images = await ctx.db.query.galleryImages.findMany({
      orderBy: [asc(schema.galleryImages.displayOrder), desc(schema.galleryImages.createdAt)],
    });

    return images;
  }),

  /**
   * Add a gallery image
   */
  addImage: organizerProcedure
    .input(
      z.object({
        title: z.string().min(1, "Le titre est requis"),
        alt: z.string().optional(),
        imageUrl: z.string().url("URL d'image invalide"),
        thumbnailUrl: z.string().url().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.query.galleryImages.findFirst({
        orderBy: [desc(schema.galleryImages.displayOrder)],
      });

      const [image] = await ctx.db
        .insert(schema.galleryImages)
        .values({
          uploadedBy: ctx.userId,
          title: input.title,
          alt: input.alt || null,
          imageUrl: input.imageUrl,
          thumbnailUrl: input.thumbnailUrl || null,
          width: input.width || null,
          height: input.height || null,
          fileSize: input.fileSize || null,
          displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
        })
        .returning();

      return image;
    }),

  /**
   * Update a gallery image
   */
  updateImage: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        alt: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.galleryImages.findFirst({
        where: eq(schema.galleryImages.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image non trouvée",
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.alt !== undefined) updateData.alt = input.alt;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      const [updated] = await ctx.db
        .update(schema.galleryImages)
        .set(updateData)
        .where(eq(schema.galleryImages.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a gallery image
   */
  deleteImage: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.galleryImages.findFirst({
        where: eq(schema.galleryImages.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image non trouvée",
        });
      }

      await ctx.db
        .delete(schema.galleryImages)
        .where(eq(schema.galleryImages.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder gallery images
   */
  reorderImages: organizerProcedure
    .input(
      z.object({
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.orderedIds.map((id, index) =>
          ctx.db
            .update(schema.galleryImages)
            .set({ displayOrder: index, updatedAt: new Date() })
            .where(eq(schema.galleryImages.id, id))
        )
      );

      return { success: true };
    }),

  // ========================================
  // PUBLIC PORTAL - COMBINED DATA
  // ========================================

  /**
   * Get all press page data for public portal
   */
  getPublicPressData: publicProcedure.query(async ({ ctx }) => {
    const [settings, releases, images] = await Promise.all([
      ctx.db.query.pressSettings.findFirst(),
      ctx.db.query.pressReleases.findMany({
        where: eq(schema.pressReleases.status, "published"),
        orderBy: [asc(schema.pressReleases.displayOrder), desc(schema.pressReleases.publishedAt)],
      }),
      ctx.db.query.galleryImages.findMany({
        orderBy: [asc(schema.galleryImages.displayOrder), desc(schema.galleryImages.createdAt)],
      }),
    ]);

    return {
      settings,
      pressReleases: releases,
      galleryImages: images,
    };
  }),
});
