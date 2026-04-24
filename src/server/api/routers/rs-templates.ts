import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  organizerProcedure,
} from "~/server/api/trpc";
import {
  rsTemplates,
  rsGeneratedPosts,
  cupSponsors,
  cups,
  rsTemplateStyleEnum,
} from "~/server/db/schema";
import {
  getDefaultColorsForStyle,
  getDefaultTextTemplate,
  getDefaultCaptionTemplate,
  getTierLabel,
  buildTemplateVariables,
  replaceTemplateVariables,
} from "~/lib/portal/image-generator";
import { ORGANIZATION_NAME, ORGANIZATION_LOGO } from "~/lib/organization";

const colorsSchema = z.object({
  background: z.string(),
  text: z.string(),
  accent: z.string(),
  overlay: z.string().optional(),
});

export const rsTemplatesRouter = createTRPCRouter({
  /**
   * List all RS templates
   */
  list: organizerProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.query.rsTemplates.findMany({
      orderBy: (t, { desc }) => [desc(t.isDefault), desc(t.createdAt)],
    });

    return templates;
  }),

  /**
   * Get a single RS template by ID
   */
  get: organizerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.query.rsTemplates.findFirst({
        where: eq(rsTemplates.id, input.id),
      });

      return template;
    }),

  /**
   * Create a new RS template
   */
  create: organizerProcedure
    .input(
      z.object({
        name: z.string().min(1, "Le nom est requis"),
        style: z.enum(rsTemplateStyleEnum).default("classic"),
        textTemplate: z.string().optional(),
        captionTemplate: z.string().optional(),
        colors: colorsSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If setting as default, unset other defaults first
      if (input.isDefault) {
        await ctx.db
          .update(rsTemplates)
          .set({ isDefault: false });
      }

      const [template] = await ctx.db
        .insert(rsTemplates)
        .values({
          name: input.name,
          style: input.style,
          textTemplate: input.textTemplate ?? getDefaultTextTemplate(),
          captionTemplate: input.captionTemplate ?? getDefaultCaptionTemplate(),
          colors: input.colors ?? getDefaultColorsForStyle(input.style),
          isDefault: input.isDefault ?? false,
        })
        .returning();

      return template;
    }),

  /**
   * Update an RS template
   */
  update: organizerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        style: z.enum(rsTemplateStyleEnum).optional(),
        textTemplate: z.string().optional(),
        captionTemplate: z.string().optional(),
        colors: colorsSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.rsTemplates.findFirst({
        where: eq(rsTemplates.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template non trouvé",
        });
      }

      if (input.isDefault) {
        await ctx.db
          .update(rsTemplates)
          .set({ isDefault: false });
      }

      const [template] = await ctx.db
        .update(rsTemplates)
        .set({
          name: input.name ?? existing.name,
          style: input.style ?? existing.style,
          textTemplate: input.textTemplate ?? existing.textTemplate,
          captionTemplate: input.captionTemplate ?? existing.captionTemplate,
          colors: input.colors ?? existing.colors,
          isDefault: input.isDefault ?? existing.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(rsTemplates.id, input.id))
        .returning();

      return template;
    }),

  /**
   * Delete an RS template
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(rsTemplates)
        .where(eq(rsTemplates.id, input.id));

      return { success: true };
    }),

  /**
   * Get default template or first available
   */
  getDefault: organizerProcedure.query(async ({ ctx }) => {
    let template = await ctx.db.query.rsTemplates.findFirst({
      where: eq(rsTemplates.isDefault, true),
    });

    if (!template) {
      template = await ctx.db.query.rsTemplates.findFirst({
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }

    return template;
  }),

  /**
   * Generate post data for a cup sponsor
   */
  generatePostData: organizerProcedure
    .input(
      z.object({
        cupSponsorId: z.string(),
        templateId: z.string().optional(),
        format: z.enum(["instagram", "twitter"]).default("instagram"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cupSponsor = await ctx.db.query.cupSponsors.findFirst({
        where: eq(cupSponsors.id, input.cupSponsorId),
        with: { sponsor: true },
      });

      if (!cupSponsor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sponsor de cup non trouvé",
        });
      }

      const cup = await ctx.db.query.cups.findFirst({
        where: eq(cups.id, cupSponsor.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvée",
        });
      }

      let template;
      if (input.templateId) {
        template = await ctx.db.query.rsTemplates.findFirst({
          where: eq(rsTemplates.id, input.templateId),
        });
      }

      if (!template) {
        template = await ctx.db.query.rsTemplates.findFirst({
          where: eq(rsTemplates.isDefault, true),
        });
      }

      if (!template) {
        template = await ctx.db.query.rsTemplates.findFirst();
      }

      const postData = {
        sponsor: {
          name: cupSponsor.sponsor.name,
          logo: cupSponsor.sponsor.logo,
          level: getTierLabel(cupSponsor.tier),
        },
        cup: {
          name: cup.name,
          hashtag: cup.name.replace(/\s+/g, ""),
        },
        organization: {
          name: ORGANIZATION_NAME,
          logo: ORGANIZATION_LOGO,
        },
      };

      const variables = buildTemplateVariables(postData);

      return {
        format: input.format,
        template: template
          ? {
              id: template.id,
              name: template.name,
              style: template.style,
              colors: template.colors,
              textContent: replaceTemplateVariables(
                template.textTemplate,
                variables
              ),
              captionContent: replaceTemplateVariables(
                template.captionTemplate ?? "",
                variables
              ),
            }
          : {
              id: null,
              name: "Default",
              style: "classic" as const,
              colors: getDefaultColorsForStyle("classic"),
              textContent: replaceTemplateVariables(
                getDefaultTextTemplate(),
                variables
              ),
              captionContent: replaceTemplateVariables(
                getDefaultCaptionTemplate(),
                variables
              ),
            },
        sponsor: postData.sponsor,
        cup: postData.cup,
        organization: postData.organization,
      };
    }),

  /**
   * Save generated post record
   */
  saveGeneratedPost: organizerProcedure
    .input(
      z.object({
        cupSponsorId: z.string(),
        templateId: z.string().optional(),
        format: z.enum(["instagram", "twitter"]),
        caption: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .insert(rsGeneratedPosts)
        .values({
          cupSponsorId: input.cupSponsorId,
          templateId: input.templateId ?? null,
          format: input.format,
          caption: input.caption,
        })
        .returning();

      return post;
    }),

  /**
   * List generated posts
   */
  listGeneratedPosts: organizerProcedure
    .input(z.object({ cupId: z.string().optional() }).optional())
    .query(async ({ ctx }) => {
      const posts = await ctx.db.query.rsGeneratedPosts.findMany({
        orderBy: (p, { desc }) => [desc(p.createdAt)],
        limit: 50,
      });

      return posts;
    }),
});
