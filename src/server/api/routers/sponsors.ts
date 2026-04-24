import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, notInArray } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import {
  sponsors,
  cupSponsors,
  cups,
  type SponsorSocialLinks,
  type SponsorTestimonial,
  type SponsorTier,
} from "~/server/db/schema";

const optionalUrlSchema = z.union([z.string().url(), z.literal("")]).optional();
const nullableUrlSchema = z.union([z.string().url(), z.literal("")]).nullable().optional();

const socialLinksSchema = z.object({
  facebook: optionalUrlSchema,
  twitter: optionalUrlSchema,
  instagram: optionalUrlSchema,
  linkedin: optionalUrlSchema,
  youtube: optionalUrlSchema,
}).optional();

const testimonialSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  authorName: z.string().min(1),
  authorRole: z.string().optional(),
});

export const sponsorsRouter = createTRPCRouter({
  /**
   * List all sponsors
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const sponsorsList = await ctx.db.query.sponsors.findMany({
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    return sponsorsList;
  }),

  /**
   * Get a single sponsor by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sponsor = await ctx.db.query.sponsors.findFirst({
        where: eq(sponsors.id, input.id),
      });

      return sponsor;
    }),

  /**
   * Create a new sponsor
   */
  create: organizerProcedure
    .input(
      z.object({
        name: z.string().min(1, "Le nom est requis"),
        logo: optionalUrlSchema,
        description: z.string().optional(),
        website: optionalUrlSchema,
        socialLinks: socialLinksSchema,
        gallery: z.array(z.string().url()).optional(),
        testimonials: z.array(testimonialSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newSponsor] = await ctx.db
        .insert(sponsors)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          logo: input.logo || null,
          description: input.description || null,
          website: input.website || null,
          socialLinks: (input.socialLinks ?? {}) as SponsorSocialLinks,
          gallery: input.gallery ?? [],
          testimonials: (input.testimonials ?? []) as SponsorTestimonial[],
        })
        .returning();

      return newSponsor;
    }),

  /**
   * Update an existing sponsor
   */
  update: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Le nom est requis").optional(),
        logo: nullableUrlSchema,
        description: z.string().optional().nullable(),
        website: nullableUrlSchema,
        socialLinks: socialLinksSchema,
        gallery: z.array(z.string().url()).optional(),
        testimonials: z.array(testimonialSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.sponsors.findFirst({
        where: eq(sponsors.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sponsor not found",
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.logo !== undefined) updateData.logo = input.logo || null;
      if (input.description !== undefined) updateData.description = input.description || null;
      if (input.website !== undefined) updateData.website = input.website || null;
      if (input.socialLinks !== undefined) updateData.socialLinks = input.socialLinks;
      if (input.gallery !== undefined) updateData.gallery = input.gallery;
      if (input.testimonials !== undefined) updateData.testimonials = input.testimonials;

      const [updated] = await ctx.db
        .update(sponsors)
        .set(updateData)
        .where(eq(sponsors.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a sponsor
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.sponsors.findFirst({
        where: eq(sponsors.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sponsor not found",
        });
      }

      await ctx.db
        .delete(sponsors)
        .where(eq(sponsors.id, input.id));

      return { success: true };
    }),

  /**
   * Get sponsors associated with a cup
   */
  getByCup: publicProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cupSponsorsList = await ctx.db.query.cupSponsors.findMany({
        where: eq(cupSponsors.cupId, input.cupId),
        with: {
          sponsor: true,
        },
        orderBy: (cs, { asc }) => [asc(cs.displayOrder)],
      });

      return cupSponsorsList;
    }),

  /**
   * Get available sponsors (not yet associated with the cup)
   */
  getAvailableForCup: organizerProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const associated = await ctx.db.query.cupSponsors.findMany({
        where: eq(cupSponsors.cupId, input.cupId),
        columns: { sponsorId: true },
      });

      const associatedIds = associated.map((a) => a.sponsorId);

      if (associatedIds.length === 0) {
        return ctx.db.query.sponsors.findMany({
          orderBy: (s, { asc }) => [asc(s.name)],
        });
      }

      return ctx.db.query.sponsors.findMany({
        where: notInArray(sponsors.id, associatedIds),
        orderBy: (s, { asc }) => [asc(s.name)],
      });
    }),

  /**
   * Associate a sponsor with a cup
   */
  associateToCup: organizerProcedure
    .input(
      z.object({
        cupId: z.string(),
        sponsorId: z.string(),
        tier: z.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup not found",
        });
      }

      const sponsor = await ctx.db.query.sponsors.findFirst({
        where: eq(sponsors.id, input.sponsorId),
      });

      if (!sponsor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sponsor not found",
        });
      }

      const existing = await ctx.db.query.cupSponsors.findFirst({
        where: and(
          eq(cupSponsors.cupId, input.cupId),
          eq(cupSponsors.sponsorId, input.sponsorId)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Sponsor already associated with this cup",
        });
      }

      const existingSponsors = await ctx.db.query.cupSponsors.findMany({
        where: eq(cupSponsors.cupId, input.cupId),
      });

      const maxOrder = existingSponsors.length > 0
        ? Math.max(...existingSponsors.map((s) => parseInt(s.displayOrder, 10) || 0))
        : -1;

      const [newAssociation] = await ctx.db
        .insert(cupSponsors)
        .values({
          id: crypto.randomUUID(),
          cupId: input.cupId,
          sponsorId: input.sponsorId,
          tier: input.tier as SponsorTier,
          displayOrder: String(maxOrder + 1),
        })
        .returning();

      return newAssociation;
    }),

  /**
   * Update a cup sponsor association (tier or order)
   */
  updateCupSponsor: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
        displayOrder: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const association = await ctx.db.query.cupSponsors.findFirst({
        where: eq(cupSponsors.id, input.id),
      });

      if (!association) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup sponsor association not found",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.tier !== undefined) updateData.tier = input.tier;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      const [updated] = await ctx.db
        .update(cupSponsors)
        .set(updateData)
        .where(eq(cupSponsors.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Remove a sponsor from a cup
   */
  removeFromCup: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const association = await ctx.db.query.cupSponsors.findFirst({
        where: eq(cupSponsors.id, input.id),
      });

      if (!association) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup sponsor association not found",
        });
      }

      await ctx.db.delete(cupSponsors).where(eq(cupSponsors.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder cup sponsors
   */
  reorderCupSponsors: organizerProcedure
    .input(
      z.object({
        cupId: z.string(),
        sponsorIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup not found",
        });
      }

      for (let i = 0; i < input.sponsorIds.length; i++) {
        await ctx.db
          .update(cupSponsors)
          .set({ displayOrder: String(i) })
          .where(
            and(
              eq(cupSponsors.id, input.sponsorIds[i]!),
              eq(cupSponsors.cupId, input.cupId)
            )
          );
      }

      return { success: true };
    }),
});
