/**
 * Organization About router — single-tenant.
 * Reads/writes the `organization_about` table (singleton row) used by the
 * public /about (Manifesto) page and the dashboard about editor.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import { organizationAbout } from "~/server/db/schema";

const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nom requis"),
  role: z.string().min(1, "Rôle requis"),
  photo: z.string().url().nullable().or(z.literal("")).optional().transform((v) => (v ? v : null)),
  bio: z.string().nullable().optional().transform((v) => (v ? v : null)),
});

export const organizationAboutRouter = createTRPCRouter({
  /**
   * Get the singleton about content. Public — used by the /about portal page.
   */
  get: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.organizationAbout.findFirst();
    return row ?? null;
  }),

  /**
   * Upsert the singleton about content. Organizer-only.
   */
  update: organizerProcedure
    .input(
      z.object({
        history: z.string().nullable().optional(),
        mission: z.string().nullable().optional(),
        values: z.string().nullable().optional(),
        galleryImages: z.array(z.string().url()).optional(),
        teamMembers: z.array(teamMemberSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.organizationAbout.findFirst();

      const payload = {
        history: input.history ?? null,
        mission: input.mission ?? null,
        values: input.values ?? null,
        galleryImages: input.galleryImages ?? [],
        teamMembers: input.teamMembers ?? [],
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await ctx.db
          .update(organizationAbout)
          .set(payload)
          .where(eq(organizationAbout.id, existing.id))
          .returning();
        return updated;
      }

      const [inserted] = await ctx.db
        .insert(organizationAbout)
        .values(payload)
        .returning();
      return inserted;
    }),
});
