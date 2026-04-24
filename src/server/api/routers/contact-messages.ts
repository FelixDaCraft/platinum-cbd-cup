import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, desc, or } from "drizzle-orm";

import {
  createTRPCRouter,
  organizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { auth } from "~/lib/auth";
import * as schema from "~/server/db/schema";
import { contactSubjectEnum } from "~/server/db/schema/contact-messages";

/**
 * Contact Messages Router - single-tenant
 * CRUD operations for contact form submissions
 */
export const contactMessagesRouter = createTRPCRouter({
  /**
   * List messages
   */
  list: organizerProcedure
    .input(
      z.object({
        filter: z.enum(["all", "unread", "starred", "archived"]).default("all"),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.filter === "unread") {
        conditions.push(eq(schema.contactMessages.status, "unread"));
      } else if (input.filter === "starred") {
        conditions.push(eq(schema.contactMessages.isStarred, true));
      } else if (input.filter === "archived") {
        conditions.push(eq(schema.contactMessages.status, "archived"));
      } else {
        // "all" - exclude archived
        conditions.push(
          or(
            eq(schema.contactMessages.status, "unread"),
            eq(schema.contactMessages.status, "read"),
            eq(schema.contactMessages.status, "replied")
          )!
        );
      }

      let messages = await ctx.db.query.contactMessages.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(schema.contactMessages.createdAt)],
        limit: input.limit,
      });

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        messages = messages.filter(
          (m) =>
            m.senderName.toLowerCase().includes(searchLower) ||
            m.senderEmail.toLowerCase().includes(searchLower) ||
            m.message.toLowerCase().includes(searchLower)
        );
      }

      return messages;
    }),

  /**
   * Get a single message by ID
   */
  getById: organizerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.query.contactMessages.findFirst({
        where: eq(schema.contactMessages.id, input.id),
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message non trouvé",
        });
      }

      return message;
    }),

  /**
   * Mark a message as read
   */
  markAsRead: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.contactMessages)
        .set({
          status: "read",
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Toggle star status
   */
  toggleStar: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.query.contactMessages.findFirst({
        where: eq(schema.contactMessages.id, input.id),
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message non trouvé",
        });
      }

      await ctx.db
        .update(schema.contactMessages)
        .set({
          isStarred: !message.isStarred,
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true, isStarred: !message.isStarred };
    }),

  /**
   * Archive a message
   */
  archive: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.contactMessages)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a message (organizer only)
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.contactMessages)
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Submit a new contact message (public - from portal)
   */
  submit: publicProcedure
    .input(
      z.object({
        senderName: z.string().min(2).max(100),
        senderEmail: z.string().email(),
        subject: z.enum(contactSubjectEnum),
        message: z.string().min(10).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(schema.contactMessages).values({
        id: nanoid(),
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        subject: input.subject,
        message: input.message,
        status: "unread",
        isStarred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, message: "Message envoyé avec succès" };
    }),

  /**
   * Get unread count (for authenticated users)
   */
  getUnreadCount: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({
      headers: ctx.headers,
    });

    if (!session?.user) {
      return { count: 0 };
    }

    const messages = await ctx.db.query.contactMessages.findMany({
      where: eq(schema.contactMessages.status, "unread"),
    });

    return { count: messages.length };
  }),
});
