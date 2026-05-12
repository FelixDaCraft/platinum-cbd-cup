/**
 * Jury Router
 * Handles jury invitation, management, and assignment endpoints
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray, sql, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { auth } from "~/lib/auth";
import * as schema from "~/server/db/schema";
import { hashPassword } from "better-auth/crypto";
import {
  sendJuryInvitation,
  resendInvitation,
  sendBulkInvitations,
  sendRatingReminder,
  sendBulkRatingReminders,
  sendRatingSheet,
  sendBulkRatingSheets,
  sendJuryWelcomeEmail,
} from "~/server/services/jury-invitation.service";
import { getMaxScoreForScale } from "~/lib/validations/labels";
import { ORGANIZATION_NAME } from "~/lib/organization";
import type { RatingScale } from "~/server/db/schema/cups";

export const juryRouter = createTRPCRouter({
  /**
   * List all jury profiles for the current user's organization
   * Used in the dashboard global juries page
   */
  listByOrganization: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });

    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez etre connecte",
      });
    }

    const juryProfiles = await ctx.db.query.juryProfiles.findMany({
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
      orderBy: (jp, { desc: descFn }) => [descFn(jp.createdAt)],
    });

    // Get cup participation for each jury via cupJuries
    const juryUserIds = juryProfiles.map((jp) => jp.userId);
    const cupJuriesData = juryUserIds.length > 0
      ? await ctx.db.query.cupJuries.findMany({
          where: (cj, { inArray: inArrayFn }) =>
            inArrayFn(cj.userId, juryUserIds),
          with: {
            cup: {
              columns: { id: true, name: true },
            },
          },
        })
      : [];

    // Group cups by userId
    const cupsByUserId = new Map<string, Array<{ id: string; name: string }>>();
    for (const cj of cupJuriesData) {
      const existing = cupsByUserId.get(cj.userId) ?? [];
      existing.push({ id: cj.cup.id, name: cj.cup.name });
      cupsByUserId.set(cj.userId, existing);
    }

    return juryProfiles.map((jp) => ({
      id: jp.id,
      userName: jp.user.name,
      userEmail: jp.user.email,
      juryType: jp.juryType,
      expertise: jp.expertise,
      cups: cupsByUserId.get(jp.userId) ?? [],
      createdAt: jp.createdAt,
    }));
  }),

  /**
   * Delete a jury profile (org admin only)
   */
  deleteByOrganization: publicProcedure
    .input(z.object({ juryProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      const juryProfile = await ctx.db.query.juryProfiles.findFirst({
        where: eq(schema.juryProfiles.id, input.juryProfileId),
      });

      if (!juryProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      await ctx.db
        .delete(schema.juryProfiles)
        .where(eq(schema.juryProfiles.id, input.juryProfileId));

      return { success: true };
    }),

  /**
   * Invite a single jury to a cup
   * Only the cup owner can invite juries
   */
  invite: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        email: z.string().email("Email invalide"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        customMessage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup and verify ownership
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check if user is the owner of the organization
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut inviter des jurys",
        });
      }

      // Send invitation
      const result = await sendJuryInvitation({
        cupId: input.cupId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        customMessage: input.customMessage,
        invitedByUserId: session.user.id,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de l'envoi de l'invitation",
        });
      }

      return {
        success: true,
        invitationId: result.invitationId,
        alreadyInvited: result.alreadyInvited,
      };
    }),

  /**
   * Invite multiple juries at once
   */
  inviteBulk: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        juries: z
          .array(
            z.object({
              email: z.string().email("Email invalide"),
              firstName: z.string().optional(),
              lastName: z.string().optional(),
            })
          )
          .min(1, "Au moins un jury requis")
          .max(100, "Maximum 100 jurys par import"),
        customMessage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut inviter des jurys",
        });
      }

      // Send bulk invitations
      const result = await sendBulkInvitations(
        input.cupId,
        input.juries,
        session.user.id,
        input.customMessage
      );

      return result;
    }),

  /**
   * Resend an invitation (reminder)
   */
  resendInvitation: publicProcedure
    .input(
      z.object({
        invitationId: z.string().min(1, "Invitation ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get invitation
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.id, input.invitationId),
        with: {
          cup: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut relancer les jurys",
        });
      }

      // Resend invitation
      const result = await resendInvitation(input.invitationId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de la relance",
        });
      }

      return { success: true };
    }),

  /**
   * List all jury invitations for a cup
   */
  listInvitations: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        status: z.enum(["pending", "accepted", "declined", "expired", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut voir les invitations",
        });
      }

      // Build query conditions
      const conditions = [eq(schema.juryInvitations.cupId, input.cupId)];
      if (input.status !== "all") {
        conditions.push(eq(schema.juryInvitations.status, input.status));
      }

      // Get invitations
      const invitations = await ctx.db.query.juryInvitations.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.juryInvitations.createdAt)],
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return invitations;
    }),

  /**
   * Get invitation statistics for a cup
   */
  getInvitationStats: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get all invitations for this cup
      const invitations = await ctx.db.query.juryInvitations.findMany({
        where: eq(schema.juryInvitations.cupId, input.cupId),
        columns: {
          status: true,
        },
      });

      // Count by status
      const stats = {
        total: invitations.length,
        pending: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
      };

      for (const inv of invitations) {
        if (inv.status === "pending") stats.pending++;
        else if (inv.status === "accepted") stats.accepted++;
        else if (inv.status === "declined") stats.declined++;
        else if (inv.status === "expired") stats.expired++;
      }

      return stats;
    }),

  /**
   * Cancel/delete a pending invitation
   */
  cancelInvitation: publicProcedure
    .input(
      z.object({
        invitationId: z.string().min(1, "Invitation ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get invitation
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.id, input.invitationId),
        with: {
          cup: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut annuler les invitations",
        });
      }

      // Can only cancel pending invitations
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seules les invitations en attente peuvent etre annulees",
        });
      }

      // Delete invitation
      await ctx.db
        .delete(schema.juryInvitations)
        .where(eq(schema.juryInvitations.id, input.invitationId));

      return { success: true };
    }),

  /**
   * Get invitation by token (for jury acceptance page)
   * This is a public endpoint - no auth required
   */
  getInvitationByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.token, input.token),
        with: {
          cup: {
            columns: {
              id: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee ou expiree",
        });
      }

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        // Update status to expired
        await ctx.db
          .update(schema.juryInvitations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(schema.juryInvitations.id, invitation.id));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a expire",
        });
      }

      // Check if already processed
      if (invitation.status !== "pending") {
        return {
          invitation,
          alreadyProcessed: true,
          status: invitation.status,
        };
      }

      return {
        invitation,
        alreadyProcessed: false,
        status: invitation.status,
      };
    }),

  /**
   * Accept a jury invitation
   */
  acceptInvitation: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      // Auth check - user must be logged in to accept
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte pour accepter l'invitation",
        });
      }

      // Get invitation with cup relation
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.token, input.token),
        with: {
          cup: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee",
        });
      }

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        await ctx.db
          .update(schema.juryInvitations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(schema.juryInvitations.id, invitation.id));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a expire",
        });
      }

      // Check if already processed
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a deja ete traitee",
        });
      }

      // Ensure jury profile exists
      const existingProfile = await ctx.db.query.juryProfiles.findFirst({
        where: eq(schema.juryProfiles.userId, session.user.id),
      });

      if (!existingProfile) {
        const juryProfileId = nanoid();
        await ctx.db.insert(schema.juryProfiles).values({
          id: juryProfileId,
          userId: session.user.id,
          juryType: "pro",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Check if user is already a jury for this cup
      const existingJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, invitation.cupId),
          eq(schema.cupJuries.userId, session.user.id)
        ),
      });

      if (existingJury) {
        // Update invitation status
        await ctx.db
          .update(schema.juryInvitations)
          .set({
            status: "accepted",
            userId: session.user.id,
            acceptedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.juryInvitations.id, invitation.id));

        return {
          success: true,
          alreadyJury: true,
          cupJuryId: existingJury.id,
        };
      }

      // Create cup jury record
      const cupJuryId = nanoid();
      await ctx.db.insert(schema.cupJuries).values({
        id: cupJuryId,
        cupId: invitation.cupId,
        userId: session.user.id,
        invitationId: invitation.id,
        joinedAt: new Date(),
      });

      // Update invitation status
      await ctx.db
        .update(schema.juryInvitations)
        .set({
          status: "accepted",
          userId: session.user.id,
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.juryInvitations.id, invitation.id));

      return {
        success: true,
        alreadyJury: false,
        cupJuryId,
      };
    }),

  /**
   * Register a new user and accept jury invitation in one step
   * This bypasses email verification since the jury clicked on an invitation link
   * sent to their email (proof of email ownership)
   */
  registerAndAcceptInvitation: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
        email: z.string().email("Email invalide"),
        password: z.string().min(8, "Mot de passe requis (8 caracteres minimum)"),
        name: z.string().min(1, "Nom requis"),
        expertise: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get invitation
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.token, input.token),
        with: {
          cup: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee ou expiree",
        });
      }

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        await ctx.db
          .update(schema.juryInvitations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(schema.juryInvitations.id, invitation.id));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a expire",
        });
      }

      // Check if already processed
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a deja ete traitee",
        });
      }

      // Verify email matches invitation
      if (input.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L'email ne correspond pas a l'invitation",
        });
      }

      // Check if user already exists
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(schema.users.email, input.email.toLowerCase()),
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Un compte existe deja avec cet email. Veuillez vous connecter.",
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(input.password);

      // Create user with emailVerified: true (invitation link = proof of email)
      const userId = nanoid();
      const accountId = nanoid();
      const now = new Date();

      await ctx.db.insert(schema.users).values({
        id: userId,
        name: input.name,
        email: input.email.toLowerCase(),
        emailVerified: true, // Verified through invitation link
        createdAt: now,
        updatedAt: now,
      });

      // Create account for password auth
      await ctx.db.insert(schema.accounts).values({
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      // Check if already a jury for this cup (shouldn't happen but just in case)
      const existingJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, invitation.cupId),
          eq(schema.cupJuries.userId, userId)
        ),
      });

      let cupJuryId: string;

      if (existingJury) {
        cupJuryId = existingJury.id;
      } else {
        // Create jury profile for this organization
        const juryProfileId = nanoid();
        await ctx.db.insert(schema.juryProfiles).values({
          id: juryProfileId,
          userId: userId,
          juryType: "pro",
          expertise: input.expertise ?? null,
          createdAt: now,
          updatedAt: now,
        });

        // Create cup jury record linked to profile
        cupJuryId = nanoid();
        await ctx.db.insert(schema.cupJuries).values({
          id: cupJuryId,
          cupId: invitation.cupId,
          userId: userId,
          invitationId: invitation.id,
          juryProfileId: juryProfileId,
          joinedAt: now,
        });
      }

      // Update invitation status
      await ctx.db
        .update(schema.juryInvitations)
        .set({
          status: "accepted",
          userId: userId,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.juryInvitations.id, invitation.id));

      // Send welcome email (async, don't wait)
      sendJuryWelcomeEmail({
        userId,
        cupId: invitation.cupId,
      }).catch((err) => {
        console.error("[Jury Register] Failed to send welcome email:", err);
      });

      return {
        success: true,
        userId,
        cupJuryId,
      };
    }),

  /**
   * Decline a jury invitation
   */
  declineInvitation: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get invitation
      const invitation = await ctx.db.query.juryInvitations.findFirst({
        where: eq(schema.juryInvitations.token, input.token),
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation non trouvee",
        });
      }

      // Check if already processed
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette invitation a deja ete traitee",
        });
      }

      // Update invitation status
      await ctx.db
        .update(schema.juryInvitations)
        .set({
          status: "declined",
          declinedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.juryInvitations.id, invitation.id));

      return { success: true };
    }),

  /**
   * List all juries for a cup (accepted invitations)
   */
  listJuries: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        includeInactive: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut voir les jurys",
        });
      }

      // Get juries with their assignments
      const whereCondition = input.includeInactive
        ? eq(schema.cupJuries.cupId, input.cupId)
        : and(
            eq(schema.cupJuries.cupId, input.cupId),
            eq(schema.cupJuries.isActive, true)
          );

      const juries = await ctx.db.query.cupJuries.findMany({
        where: whereCondition,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          categoryAssignments: {
            with: {
              category: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [desc(schema.cupJuries.joinedAt)],
      });

      return juries;
    }),

  /**
   * Remove a jury from a cup (soft delete - set isActive to false)
   */
  removeJury: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get jury
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: eq(schema.cupJuries.id, input.cupJuryId),
        with: {
          cup: true,
        },
      });

      if (!cupJury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut retirer des jurys",
        });
      }

      // Soft delete - set isActive to false
      await ctx.db
        .update(schema.cupJuries)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.cupJuries.id, input.cupJuryId));

      return { success: true };
    }),

  /**
   * Reactivate a jury member (set isActive back to true)
   */
  reactivateJury: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get jury
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: eq(schema.cupJuries.id, input.cupJuryId),
        with: {
          cup: true,
        },
      });

      if (!cupJury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut reactiver des jurys",
        });
      }

      // Check if already active
      if (cupJury.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce jury est deja actif",
        });
      }

      // Reactivate - set isActive to true
      await ctx.db
        .update(schema.cupJuries)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(schema.cupJuries.id, input.cupJuryId));

      return { success: true };
    }),

  /**
   * Assign categories to a jury
   */
  assignCategories: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
        categoryIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get jury and cup
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: eq(schema.cupJuries.id, input.cupJuryId),
        with: {
          cup: true,
        },
      });

      if (!cupJury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut assigner des categories",
        });
      }

      // Validate that all category IDs belong to this cup
      if (input.categoryIds.length > 0) {
        const categories = await ctx.db.query.categories.findMany({
          where: and(
            eq(schema.categories.cupId, cupJury.cupId),
            inArray(schema.categories.id, input.categoryIds)
          ),
        });

        if (categories.length !== input.categoryIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Certaines categories ne sont pas valides pour cette cup",
          });
        }
      }

      // Delete existing assignments
      await ctx.db
        .delete(schema.juryCategoryAssignments)
        .where(eq(schema.juryCategoryAssignments.cupJuryId, input.cupJuryId));

      // Create new assignments
      if (input.categoryIds.length > 0) {
        const assignments = input.categoryIds.map((categoryId) => ({
          id: nanoid(),
          cupJuryId: input.cupJuryId,
          categoryId,
          assignedBy: session.user.id,
          assignedAt: new Date(),
        }));

        await ctx.db.insert(schema.juryCategoryAssignments).values(assignments);
      }

      return { success: true, assignedCount: input.categoryIds.length };
    }),

  /**
   * Get categories assigned to a jury
   */
  getAssignedCategories: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      const assignments = await ctx.db.query.juryCategoryAssignments.findMany({
        where: eq(schema.juryCategoryAssignments.cupJuryId, input.cupJuryId),
        with: {
          category: true,
        },
      });

      return assignments.map((a) => a.category);
    }),

  /**
   * Bulk assign categories to multiple juries
   * FR-83: L'organisateur peut assigner plusieurs jurys à une catégorie en une action
   */
  bulkAssignCategories: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        cupJuryIds: z.array(z.string()).min(1, "Au moins un jury requis"),
        categoryIds: z.array(z.string()).min(1, "Au moins une categorie requise"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check if user is the owner
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut assigner des categories",
        });
      }

      // Validate juries belong to this cup
      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          inArray(schema.cupJuries.id, input.cupJuryIds),
          eq(schema.cupJuries.isActive, true)
        ),
      });

      if (juries.length !== input.cupJuryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains jurys ne sont pas valides pour cette cup",
        });
      }

      // Validate categories belong to this cup
      const categories = await ctx.db.query.categories.findMany({
        where: and(
          eq(schema.categories.cupId, input.cupId),
          inArray(schema.categories.id, input.categoryIds)
        ),
      });

      if (categories.length !== input.categoryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certaines categories ne sont pas valides pour cette cup",
        });
      }

      // For each jury, add the new category assignments (without removing existing ones)
      let totalAssignments = 0;

      for (const juryId of input.cupJuryIds) {
        // Get existing assignments for this jury
        const existingAssignments = await ctx.db.query.juryCategoryAssignments.findMany({
          where: eq(schema.juryCategoryAssignments.cupJuryId, juryId),
        });

        const existingCategoryIds = new Set(existingAssignments.map((a) => a.categoryId));

        // Add only new categories
        const newCategoryIds = input.categoryIds.filter((id) => !existingCategoryIds.has(id));

        if (newCategoryIds.length > 0) {
          const assignments = newCategoryIds.map((categoryId) => ({
            id: nanoid(),
            cupJuryId: juryId,
            categoryId,
            assignedBy: session.user.id,
            assignedAt: new Date(),
          }));

          await ctx.db.insert(schema.juryCategoryAssignments).values(assignments);
          totalAssignments += assignments.length;
        }
      }

      return {
        success: true,
        juriesUpdated: input.cupJuryIds.length,
        assignmentsCreated: totalAssignments,
      };
    }),

  /**
   * Get completion stats for all juries of a cup
   * FR-104: L'organisateur peut voir le taux de complétion global et par jury
   */
  getCompletionStats: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Check membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Get all juries for this cup
      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          categoryAssignments: {
            with: {
              category: true,
            },
          },
        },
      });

      // Get total products count per category (from confirmed registrations)
      // First get confirmed registrations for this cup
      const confirmedRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(schema.registrations.cupId, input.cupId),
          eq(schema.registrations.status, "confirmed")
        ),
        with: {
          products: {
            columns: {
              id: true,
              categoryId: true,
            },
          },
        },
      });

      // Flatten products from confirmed registrations
      const cupProducts = confirmedRegistrations.flatMap((r) => r.products);

      // Group products by category
      const productsByCategory = new Map<string, number>();
      for (const product of cupProducts) {
        const categoryId = product.categoryId;
        productsByCategory.set(categoryId, (productsByCategory.get(categoryId) ?? 0) + 1);
      }

      // Calculate stats per jury
      // Note: Actual ratings are not implemented yet (Epic 7)
      // For now, we return 0 ratings but show the expected product count
      const juryStats = juries.map((jury) => {
        // Calculate total products this jury should rate based on assigned categories
        let totalProductsToRate = 0;
        for (const assignment of jury.categoryAssignments) {
          totalProductsToRate += productsByCategory.get(assignment.categoryId) ?? 0;
        }

        // TODO: When Epic 7 (Ratings) is implemented, calculate actual ratings from ratings table
        const productsRated = 0; // Placeholder

        return {
          juryId: jury.id,
          userId: jury.userId,
          userName: jury.user.name,
          userEmail: jury.user.email,
          categoriesAssigned: jury.categoryAssignments.length,
          categories: jury.categoryAssignments.map((a) => ({
            id: a.category.id,
            name: a.category.name,
            productsCount: productsByCategory.get(a.categoryId) ?? 0,
            productsRated: 0, // Placeholder
          })),
          totalProductsToRate,
          productsRated,
          completionRate: totalProductsToRate > 0
            ? Math.round((productsRated / totalProductsToRate) * 100)
            : 0,
        };
      });

      // Sort by completion rate (least advanced first)
      juryStats.sort((a, b) => a.completionRate - b.completionRate);

      // Calculate global stats
      const totalProductsToRate = juryStats.reduce((sum, j) => sum + j.totalProductsToRate, 0);
      const totalProductsRated = juryStats.reduce((sum, j) => sum + j.productsRated, 0);
      const globalCompletionRate = totalProductsToRate > 0
        ? Math.round((totalProductsRated / totalProductsToRate) * 100)
        : 0;

      return {
        globalStats: {
          totalJuries: juries.length,
          totalProductsToRate,
          totalProductsRated,
          completionRate: globalCompletionRate,
        },
        juryStats,
      };
    }),

  /**
   * Send a rating reminder to a jury
   * FR-105: Relance des jurys qui n'ont pas termine
   */
  sendRatingReminder: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get the jury to verify cup ownership
      const jury = await ctx.db.query.cupJuries.findFirst({
        where: eq(schema.cupJuries.id, input.cupJuryId),
        with: {
          cup: true,
        },
      });

      if (!jury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Send the reminder
      const result = await sendRatingReminder({
        cupJuryId: input.cupJuryId,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de l'envoi du rappel",
        });
      }

      return { success: true };
    }),

  /**
   * Send rating reminders to multiple juries
   * FR-105: Relance groupee des jurys
   */
  sendBulkRatingReminders: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        juryIds: z.array(z.string().min(1)).min(1, "Au moins un jury requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Verify all juries belong to this cup
      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          inArray(schema.cupJuries.id, input.juryIds),
          eq(schema.cupJuries.cupId, input.cupId)
        ),
      });

      if (juries.length !== input.juryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains jurys ne sont pas valides pour cette cup",
        });
      }

      // Send the reminders
      const result = await sendBulkRatingReminders(input.juryIds);

      return result;
    }),

  /**
   * Send rating sheet to a jury
   * FR-106: Envoi des fiches de notation par email
   */
  sendRatingSheet: publicProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get the jury with assignments
      const jury = await ctx.db.query.cupJuries.findFirst({
        where: eq(schema.cupJuries.id, input.cupJuryId),
        with: {
          cup: true,
          categoryAssignments: {
            with: {
              category: true,
            },
          },
        },
      });

      if (!jury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jury non trouve",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Get products for the jury's assigned categories
      const assignedCategoryIds = jury.categoryAssignments.map((a) => a.categoryId);

      if (assignedCategoryIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce jury n'a pas de categories assignees",
        });
      }

      // Get products from confirmed registrations in assigned categories
      const confirmedRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(schema.registrations.cupId, jury.cupId),
          eq(schema.registrations.status, "confirmed")
        ),
        with: {
          products: {
            where: inArray(schema.products.categoryId, assignedCategoryIds),
            with: {
              category: true,
            },
          },
        },
      });

      // Flatten products with category info
      const products = confirmedRegistrations.flatMap((r) =>
        r.products.map((p) => ({
          categoryName: p.category.name,
          productCode: p.anonymousCode ?? `#${p.id.slice(0, 4).toUpperCase()}`,
        }))
      );

      if (products.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun produit a noter dans les categories assignees",
        });
      }

      // Send the rating sheet
      const result = await sendRatingSheet({
        cupJuryId: input.cupJuryId,
        products,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Erreur lors de l'envoi de la fiche",
        });
      }

      return { success: true, productsCount: products.length };
    }),

  /**
   * Send rating sheets to all juries of a cup
   * FR-106: Envoi des fiches de notation a tous les jurys
   */
  sendAllRatingSheets: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Get all active juries with their category assignments
      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          categoryAssignments: {
            with: {
              category: true,
            },
          },
        },
      });

      if (juries.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun jury actif dans cette cup",
        });
      }

      // Get products from confirmed registrations
      const confirmedRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(schema.registrations.cupId, input.cupId),
          eq(schema.registrations.status, "confirmed")
        ),
        with: {
          products: {
            with: {
              category: true,
            },
          },
        },
      });

      // Flatten all products
      const allProducts = confirmedRegistrations.flatMap((r) =>
        r.products.map((p) => ({
          categoryId: p.categoryId,
          categoryName: p.category.name,
          productCode: p.anonymousCode ?? `#${p.id.slice(0, 4).toUpperCase()}`,
        }))
      );

      // Prepare data for each jury
      const juriesData = juries
        .filter((jury) => jury.categoryAssignments.length > 0)
        .map((jury) => {
          const assignedCategoryIds = new Set(
            jury.categoryAssignments.map((a) => a.categoryId)
          );
          const juryProducts = allProducts
            .filter((p) => assignedCategoryIds.has(p.categoryId))
            .map(({ categoryName, productCode }) => ({ categoryName, productCode }));

          return {
            cupJuryId: jury.id,
            products: juryProducts,
          };
        })
        .filter((data) => data.products.length > 0);

      if (juriesData.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun jury avec des produits a noter",
        });
      }

      // Send the rating sheets
      const result = await sendBulkRatingSheets(juriesData);

      return {
        ...result,
        totalJuries: juries.length,
        juriesWithProducts: juriesData.length,
      };
    }),

  /**
   * Get jury info for a cup (for jury dashboard)
   * Returns the jury's status, assigned categories, and products to rate
   */
  getMyJuryCup: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          categoryAssignments: {
            with: {
              category: true,
            },
          },
        },
      });

      if (!juryMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      // Get products from assigned categories (from confirmed registrations)
      const assignedCategoryIds = juryMembership.categoryAssignments.map(
        (a) => a.categoryId
      );

      type ProductScore = {
        criterionId: string;
        criterionName: string;
        score: number;
        sortOrder: number;
        coefficient: number;
      };

      let productsToRate: Array<{
        id: string;
        anonymousCode: string | null;
        categoryId: string;
        categoryName: string;
        isRated: boolean;
        hasDraft: boolean; // Story 7.19: Draft visibility
        // Per-criterion scores when the jury has saved (draft or submitted) a rating.
        // Used by the category page to show "at a glance" mini-bars without
        // having to open each product.
        scores: ProductScore[];
      }> = [];

      if (assignedCategoryIds.length > 0) {
        const confirmedRegistrations = await ctx.db.query.registrations.findMany({
          where: and(
            eq(schema.registrations.cupId, input.cupId),
            eq(schema.registrations.status, "confirmed")
          ),
          with: {
            producer: {
              columns: { userId: true },
            },
            products: {
              where: inArray(schema.products.categoryId, assignedCategoryIds),
              with: {
                category: true,
                ratings: {
                  where: eq(schema.productRatings.juryId, juryMembership.id),
                  with: {
                    scores: {
                      with: {
                        criterion: {
                          columns: {
                            id: true,
                            name: true,
                            sortOrder: true,
                            coefficient: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Filter out products from jury's own registrations (conflict of interest)
        // Story 7.7: A jury cannot rate their own products
        productsToRate = confirmedRegistrations
          .filter((r) => r.producer.userId !== session.user.id)
          .flatMap((r) =>
            r.products.map((p) => {
              const submittedRating = p.ratings.find((rating) => rating.submittedAt !== null);
              const draftRating = p.ratings.find((rating) => rating.submittedAt === null);
              const sourceRating = submittedRating ?? draftRating;
              const scores: ProductScore[] = sourceRating
                ? sourceRating.scores
                    .map((s) => ({
                      criterionId: s.criterionId,
                      criterionName: s.criterion.name,
                      score: s.score,
                      sortOrder: s.criterion.sortOrder,
                      coefficient: s.criterion.coefficient,
                    }))
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                : [];
              return {
                id: p.id,
                anonymousCode: p.anonymousCode,
                categoryId: p.categoryId,
                categoryName: p.category.name,
                // Mark as rated if there's a submitted rating
                isRated: !!submittedRating,
                // Story 7.19: Mark as draft if there's an unsubmitted rating
                hasDraft: !submittedRating && !!draftRating,
                scores,
              };
            })
          );
      }

      // Count rated products
      const ratedCount = productsToRate.filter((p) => p.isRated).length;

      return {
        cup: {
          id: cup.id,
          name: cup.name,
          description: cup.description,
          organizationName: ORGANIZATION_NAME,
          ratingEndDate: cup.ratingEndAt,
          status: cup.status,
          ratingScale: cup.ratingScale,
        },
        jury: {
          id: juryMembership.id,
          samplesReceivedAt: juryMembership.samplesReceivedAt,
          joinedAt: juryMembership.joinedAt,
          categoryAssignments: juryMembership.categoryAssignments.map((a) => ({
            id: a.id,
            categoryId: a.category.id,
            categoryName: a.category.name,
          })),
        },
        productsToRate,
        totalProductsToRate: productsToRate.length,
        ratedProductsCount: ratedCount,
      };
    }),

  /**
   * Get product details for rating
   * Checks authorization and returns rating criteria
   */
  getProductForRating: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        productId: z.string().min(1, "Product ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte pour noter",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          categoryAssignments: true,
        },
      });

      if (!juryMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      // Check if samples received
      if (!juryMembership.samplesReceivedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Vous devez d'abord confirmer la reception de vos echantillons",
        });
      }

      // Check if ratings are locked (manual or automatic) - Story 7.11
      if (cup.ratingsLockedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les notations sont verrouillees. Les resultats sont definitifs.",
        });
      }

      // Check if rating deadline has passed
      if (cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La phase de notation est terminee. La date limite est passee.",
        });
      }

      // Get product
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
        with: {
          category: {
            with: {
              criteria: {
                orderBy: (criteria, { asc }) => [asc(criteria.sortOrder)],
              },
            },
          },
          registration: {
            with: {
              producer: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // Check if product belongs to this cup
      if (product.registration.cupId !== input.cupId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce produit n'appartient pas a cette cup",
        });
      }

      // Check if jury is assigned to this category
      const isAssigned = juryMembership.categoryAssignments.some(
        (a) => a.categoryId === product.categoryId
      );

      if (!isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas assigne a cette categorie",
        });
      }

      // Check for conflict of interest (jury is also producer)
      if (product.registration.producer.userId === session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous ne pouvez pas noter vos propres produits",
        });
      }

      // Story 7.16: Calculate progress within current category only
      // Get all products in the current product's category for this cup
      const allProductsResult = await ctx.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .where(
          and(
            eq(schema.registrations.cupId, input.cupId),
            eq(schema.registrations.status, "confirmed"),
            eq(schema.products.categoryId, product.categoryId)
          )
        )
        .orderBy(schema.products.anonymousCode);

      const totalProducts = allProductsResult.length;

      // Get submitted ratings count for current category only
      const ratedProductsResult = await ctx.db
        .select({ productId: schema.productRatings.productId })
        .from(schema.productRatings)
        .innerJoin(
          schema.products,
          eq(schema.productRatings.productId, schema.products.id)
        )
        .where(
          and(
            eq(schema.productRatings.juryId, juryMembership.id),
            isNotNull(schema.productRatings.submittedAt),
            eq(schema.products.categoryId, product.categoryId)
          )
        );

      const ratedCount = ratedProductsResult.length;

      // Find current product position
      const productIds = allProductsResult.map((p) => p.id);
      const currentPosition = productIds.indexOf(input.productId) + 1;

      return {
        cup: {
          id: cup.id,
          name: cup.name,
          organizationName: ORGANIZATION_NAME,
          ratingEndDate: cup.ratingEndAt,
          status: cup.status,
          ratingScale: cup.ratingScale,
        },
        product: {
          id: product.id,
          anonymousCode: product.anonymousCode,
          categoryId: product.categoryId,
          categoryName: product.category.name,
        },
        criteria: product.category.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          coefficient: c.coefficient,
          sortOrder: c.sortOrder,
        })),
        juryId: juryMembership.id,
        // Story 7.15: Progress info
        progress: {
          current: currentPosition,
          total: totalProducts,
          rated: ratedCount,
        },
      };
    }),

  /**
   * Confirm samples received by jury
   * Must be called before jury can start rating
   */
  confirmSamplesReceived: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
      });

      if (!juryMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      if (juryMembership.samplesReceivedAt) {
        return {
          success: true,
          alreadyConfirmed: true,
          confirmedAt: juryMembership.samplesReceivedAt,
        };
      }

      // Update the confirmation timestamp
      const now = new Date();
      await ctx.db
        .update(schema.cupJuries)
        .set({
          samplesReceivedAt: now,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(schema.cupJuries.id, juryMembership.id));

      return {
        success: true,
        alreadyConfirmed: false,
        confirmedAt: now,
      };
    }),

  /**
   * Submit rating for a product
   * Creates or updates the rating with all criterion scores
   */
  submitRating: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        productId: z.string().min(1, "Product ID requis"),
        scores: z.array(
          z.object({
            criterionId: z.string().min(1, "Criterion ID requis"),
            score: z.number().int().min(0).max(100),
          })
        ).min(1, "Au moins un score requis"),
        comment: z.string().max(500, "Commentaire trop long (max 500 caracteres)").optional(),
        submit: z.boolean().default(false), // false = save draft, true = submit
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte pour noter",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Validate scores against cup's rating scale
      const maxScore = getMaxScoreForScale((cup.ratingScale ?? "0-20") as RatingScale);
      const minScore = cup.ratingScale?.startsWith("0") ? 0 : 1;
      const invalidScore = input.scores.find(
        (s) => s.score < minScore || s.score > maxScore
      );
      if (invalidScore) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Score doit etre entre ${minScore} et ${maxScore}`,
        });
      }

      // Check if cup is in rating phase
      if (cup.status !== "rating" && cup.status !== "published") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La cup n'est pas en phase de notation",
        });
      }

      // Check if ratings are locked (manual or automatic) - Story 7.11
      if (cup.ratingsLockedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les notations sont verrouillees. Les resultats sont definitifs.",
        });
      }

      // Check if rating deadline has passed
      if (cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La phase de notation est terminee. La date limite est passee.",
        });
      }

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          categoryAssignments: true,
        },
      });

      if (!juryMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      // Check if samples received
      if (!juryMembership.samplesReceivedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Vous devez d'abord confirmer la reception de vos echantillons",
        });
      }

      // Get product with category and criteria
      const product = await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
        with: {
          registration: true,
          category: {
            with: {
              criteria: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // Check if product belongs to this cup
      if (product.registration.cupId !== input.cupId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce produit n'appartient pas a cette cup",
        });
      }

      // Check if jury is assigned to this category
      const isAssigned = juryMembership.categoryAssignments.some(
        (a) => a.categoryId === product.categoryId
      );

      if (!isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas assigne a cette categorie",
        });
      }

      // Validate that all criteria are provided
      const criteriaIds = product.category.criteria.map((c) => c.id);
      const providedCriteriaIds = input.scores.map((s) => s.criterionId);

      const missingCriteria = criteriaIds.filter(
        (id) => !providedCriteriaIds.includes(id)
      );

      if (input.submit && missingCriteria.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Scores manquants pour ${missingCriteria.length} critere(s)`,
        });
      }

      // Validate that only valid criteria are provided
      const invalidCriteria = providedCriteriaIds.filter(
        (id) => !criteriaIds.includes(id)
      );

      if (invalidCriteria.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains criteres ne sont pas valides pour cette categorie",
        });
      }

      // Check for existing rating
      let existingRating = await ctx.db.query.productRatings.findFirst({
        where: and(
          eq(schema.productRatings.productId, input.productId),
          eq(schema.productRatings.juryId, juryMembership.id)
        ),
        with: {
          scores: true,
        },
      });

      // If already submitted, cannot modify
      if (existingRating?.submittedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Vous avez deja soumis une notation pour ce produit",
        });
      }

      const now = new Date();

      // Create or update rating
      if (!existingRating) {
        // Create new rating
        const ratingId = nanoid();

        await ctx.db.insert(schema.productRatings).values({
          id: ratingId,
          productId: input.productId,
          juryId: juryMembership.id,
          comment: input.comment,
          submittedAt: input.submit ? now : null,
          createdAt: now,
          updatedAt: now,
        });

        // Create scores
        for (const score of input.scores) {
          await ctx.db.insert(schema.criterionScores).values({
            id: nanoid(),
            productRatingId: ratingId,
            criterionId: score.criterionId,
            score: score.score,
            createdAt: now,
            updatedAt: now,
          });
        }

        existingRating = {
          id: ratingId,
          productId: input.productId,
          juryId: juryMembership.id,
          comment: input.comment ?? null,
          submittedAt: input.submit ? now : null,
          createdAt: now,
          updatedAt: now,
          scores: input.scores.map((s) => ({
            id: nanoid(),
            productRatingId: ratingId,
            criterionId: s.criterionId,
            score: s.score,
            createdAt: now,
            updatedAt: now,
          })),
        };
      } else {
        // Update existing rating
        await ctx.db
          .update(schema.productRatings)
          .set({
            comment: input.comment,
            submittedAt: input.submit ? now : null,
            updatedAt: now,
          })
          .where(eq(schema.productRatings.id, existingRating.id));

        // Update or insert scores
        for (const score of input.scores) {
          const existingScore = existingRating.scores.find(
            (s) => s.criterionId === score.criterionId
          );

          if (existingScore) {
            await ctx.db
              .update(schema.criterionScores)
              .set({
                score: score.score,
                updatedAt: now,
              })
              .where(eq(schema.criterionScores.id, existingScore.id));
          } else {
            await ctx.db.insert(schema.criterionScores).values({
              id: nanoid(),
              productRatingId: existingRating.id,
              criterionId: score.criterionId,
              score: score.score,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // Update jury last activity
      await ctx.db
        .update(schema.cupJuries)
        .set({
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(schema.cupJuries.id, juryMembership.id));

      // Calculate weighted average score
      const criteriaMap = new Map(
        product.category.criteria.map((c) => [c.id, c.coefficient])
      );

      let weightedSum = 0;
      let totalWeight = 0;

      for (const score of input.scores) {
        const coefficient = criteriaMap.get(score.criterionId) ?? 1;
        weightedSum += score.score * coefficient;
        totalWeight += coefficient;
      }

      const averageScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Story 7.18: Find next unrated product, prioritizing same category
      let nextProductId: string | null = null;
      let categoryComplete = false;
      let allComplete = false;

      if (input.submit) {
        // Get products already rated by this jury (submitted only)
        const ratedProductIds = await ctx.db
          .select({ productId: schema.productRatings.productId })
          .from(schema.productRatings)
          .where(
            and(
              eq(schema.productRatings.juryId, juryMembership.id),
              isNotNull(schema.productRatings.submittedAt)
            )
          );

        const ratedSet = new Set(ratedProductIds.map((r) => r.productId));
        // Add current product as it was just rated
        ratedSet.add(input.productId);

        // First, check products in the SAME category
        const sameCategoryProducts = await ctx.db
          .select({
            id: schema.products.id,
            anonymousCode: schema.products.anonymousCode,
          })
          .from(schema.products)
          .innerJoin(
            schema.registrations,
            eq(schema.products.registrationId, schema.registrations.id)
          )
          .where(
            and(
              eq(schema.registrations.cupId, input.cupId),
              eq(schema.registrations.status, "confirmed"),
              eq(schema.products.categoryId, product.categoryId)
            )
          )
          .orderBy(schema.products.anonymousCode);

        const unratedInCategory = sameCategoryProducts.filter(
          (p) => !ratedSet.has(p.id)
        );

        if (unratedInCategory.length > 0) {
          // More products in same category
          nextProductId = unratedInCategory[0]!.id;
        } else {
          // Category is complete
          categoryComplete = true;

          // Check other categories
          const assignedCategoryIds = juryMembership.categoryAssignments.map(
            (a) => a.categoryId
          );

          if (assignedCategoryIds.length > 0) {
            const allProducts = await ctx.db
              .select({
                id: schema.products.id,
                categoryId: schema.products.categoryId,
              })
              .from(schema.products)
              .innerJoin(
                schema.registrations,
                eq(schema.products.registrationId, schema.registrations.id)
              )
              .where(
                and(
                  eq(schema.registrations.cupId, input.cupId),
                  eq(schema.registrations.status, "confirmed"),
                  inArray(schema.products.categoryId, assignedCategoryIds)
                )
              );

            const unratedAll = allProducts.filter((p) => !ratedSet.has(p.id));

            if (unratedAll.length === 0) {
              // All products in all categories are rated
              allComplete = true;
            }
          }
        }
      }

      return {
        success: true,
        ratingId: existingRating.id,
        submitted: input.submit,
        averageScore: Math.round(averageScore * 100) / 100,
        totalCriteria: criteriaIds.length,
        scoredCriteria: input.scores.length,
        nextProductId,
        categoryComplete,
        allComplete,
      };
    }),

  /**
   * Get existing rating for a product (if any)
   * Used to load draft ratings
   */
  getMyRating: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        productId: z.string().min(1, "Product ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
      });

      if (!juryMembership) {
        return null;
      }

      // Get existing rating
      const rating = await ctx.db.query.productRatings.findFirst({
        where: and(
          eq(schema.productRatings.productId, input.productId),
          eq(schema.productRatings.juryId, juryMembership.id)
        ),
        with: {
          scores: true,
        },
      });

      if (!rating) {
        return null;
      }

      return {
        id: rating.id,
        comment: rating.comment,
        submittedAt: rating.submittedAt,
        scores: rating.scores.map((s) => ({
          criterionId: s.criterionId,
          score: s.score,
        })),
      };
    }),

  // =====================================================
  // Public Jury Token Endpoints - Story 7.9
  // =====================================================

  /**
   * Generate public jury tokens for a cup
   * Only the cup owner can generate tokens
   */
  generatePublicJuryTokens: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().min(1, "Category ID requis"),
        quantity: z.number().int().min(1).max(500, "Max 500 tokens par generation"),
        expiresInDays: z.number().int().min(1).max(365).default(90),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify ownership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut generer des tokens",
        });
      }

      // Verify category belongs to cup
      const category = await ctx.db.query.categories.findFirst({
        where: and(
          eq(schema.categories.id, input.categoryId),
          eq(schema.categories.cupId, input.cupId)
        ),
      });

      if (!category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette categorie n'appartient pas a cette cup",
        });
      }

      // Generate tokens
      const batchId = nanoid();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const tokens: { id: string; token: string }[] = [];

      for (let i = 0; i < input.quantity; i++) {
        const tokenId = nanoid();
        const tokenValue = nanoid(16); // Shorter token for QR codes

        await ctx.db.insert(schema.publicJuryTokens).values({
          id: tokenId,
          cupId: input.cupId,
          categoryId: input.categoryId,
          token: tokenValue,
          batchId,
          expiresAt,
        });

        tokens.push({ id: tokenId, token: tokenValue });
      }

      return {
        success: true,
        batchId,
        tokensGenerated: tokens.length,
        tokens,
        expiresAt,
      };
    }),

  /**
   * Get public jury token info by token value
   * Public endpoint - for claim page
   */
  getPublicJuryTokenInfo: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.db.query.publicJuryTokens.findFirst({
        where: eq(schema.publicJuryTokens.token, input.token),
        with: {
          cup: {
            columns: {
              id: true,
              name: true,
              description: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!tokenRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token invalide ou introuvable",
        });
      }

      // Check if expired
      if (new Date() > tokenRecord.expiresAt) {
        if (tokenRecord.status === "available") {
          // Update status to expired
          await ctx.db
            .update(schema.publicJuryTokens)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(schema.publicJuryTokens.id, tokenRecord.id));
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce token a expire",
        });
      }

      // Check if already claimed
      if (tokenRecord.status === "claimed") {
        return {
          token: tokenRecord,
          alreadyClaimed: true,
          cup: tokenRecord.cup,
          category: tokenRecord.category,
        };
      }

      return {
        token: {
          id: tokenRecord.id,
          status: tokenRecord.status,
          expiresAt: tokenRecord.expiresAt,
        },
        alreadyClaimed: false,
        cup: tokenRecord.cup,
        category: tokenRecord.category,
      };
    }),

  /**
   * Claim a public jury token
   * Creates cupJury entry and assigns category
   * User must be logged in (simplified registration handled by auth)
   */
  claimPublicJuryToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte pour utiliser ce token",
        });
      }

      // Get token
      const tokenRecord = await ctx.db.query.publicJuryTokens.findFirst({
        where: eq(schema.publicJuryTokens.token, input.token),
      });

      if (!tokenRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token invalide ou introuvable",
        });
      }

      // Check if expired
      if (new Date() > tokenRecord.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce token a expire",
        });
      }

      // Check if already claimed
      if (tokenRecord.status === "claimed") {
        // Check if claimed by same user
        if (tokenRecord.claimedByUserId === session.user.id) {
          return {
            success: true,
            alreadyClaimed: true,
            message: "Vous avez deja utilise ce token",
            cupJuryId: tokenRecord.cupJuryId,
            cupId: tokenRecord.cupId,
          };
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ce token a deja ete utilise par quelqu'un d'autre",
        });
      }

      // Ensure user has a jury profile (upsert pattern)
      let juryProfileId: string;
      const existingProfile = await ctx.db.query.juryProfiles.findFirst({
        where: eq(schema.juryProfiles.userId, session.user.id),
      });

      if (existingProfile) {
        juryProfileId = existingProfile.id;
      } else {
        juryProfileId = nanoid();
        await ctx.db.insert(schema.juryProfiles).values({
          id: juryProfileId,
          userId: session.user.id,
          juryType: "public",
        });
      }

      // Check if user already has a cupJury entry for this cup
      let cupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, tokenRecord.cupId),
          eq(schema.cupJuries.userId, session.user.id)
        ),
      });

      const now = new Date();

      if (!cupJury) {
        // Create new cupJury entry
        const cupJuryId = nanoid();
        await ctx.db.insert(schema.cupJuries).values({
          id: cupJuryId,
          cupId: tokenRecord.cupId,
          userId: session.user.id,
          juryProfileId: juryProfileId,
          isActive: true,
          joinedAt: now,
          // Public juries don't need to confirm samples (they buy packs with samples included)
          samplesReceivedAt: now,
        });

        cupJury = {
          id: cupJuryId,
          cupId: tokenRecord.cupId,
          userId: session.user.id,
          juryProfileId: juryProfileId,
          invitationId: null,
          isActive: true,
          notifyOnAssignment: true,
          notifyOnReminder: true,
          lastReminderAt: null,
          reminderCount: "0",
          ratingSheetSentAt: null,
          samplesReceivedAt: now,
          joinedAt: now,
          lastActivityAt: null,
          createdAt: now,
          updatedAt: now,
        };
      } else if (!cupJury.juryProfileId) {
        // Link existing cupJury to the jury profile if not already linked
        await ctx.db
          .update(schema.cupJuries)
          .set({ juryProfileId: juryProfileId, updatedAt: now })
          .where(eq(schema.cupJuries.id, cupJury.id));
      }

      // At this point cupJury is guaranteed to be defined (either from DB or just created)
      // TypeScript needs a hint since it can't infer this from the control flow
      const cupJuryRecord = cupJury!;

      // Check if already assigned to this category
      const existingAssignment = await ctx.db.query.juryCategoryAssignments.findFirst({
        where: and(
          eq(schema.juryCategoryAssignments.cupJuryId, cupJuryRecord.id),
          eq(schema.juryCategoryAssignments.categoryId, tokenRecord.categoryId)
        ),
      });

      if (!existingAssignment) {
        // Create category assignment
        await ctx.db.insert(schema.juryCategoryAssignments).values({
          id: nanoid(),
          cupJuryId: cupJuryRecord.id,
          categoryId: tokenRecord.categoryId,
          assignedAt: now,
        });
      }

      // Update token status
      await ctx.db
        .update(schema.publicJuryTokens)
        .set({
          status: "claimed",
          claimedByUserId: session.user.id,
          cupJuryId: cupJuryRecord.id,
          claimedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.publicJuryTokens.id, tokenRecord.id));

      return {
        success: true,
        alreadyClaimed: false,
        message: "Token utilise avec succes! Vous pouvez maintenant noter les produits.",
        cupJuryId: cupJuryRecord.id,
        cupId: tokenRecord.cupId,
        categoryId: tokenRecord.categoryId,
      };
    }),

  /**
   * List public jury tokens for a cup
   * Organizer only
   */
  listPublicJuryTokens: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().optional(),
        status: z.enum(["available", "claimed", "expired", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify ownership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Build conditions
      const conditions = [eq(schema.publicJuryTokens.cupId, input.cupId)];
      if (input.categoryId) {
        conditions.push(eq(schema.publicJuryTokens.categoryId, input.categoryId));
      }
      if (input.status !== "all") {
        conditions.push(eq(schema.publicJuryTokens.status, input.status));
      }

      // Get tokens
      const tokens = await ctx.db.query.publicJuryTokens.findMany({
        where: and(...conditions),
        with: {
          category: {
            columns: { id: true, name: true },
          },
          claimedBy: {
            columns: { id: true, name: true, email: true },
          },
        },
        orderBy: [desc(schema.publicJuryTokens.createdAt)],
      });

      // Stats
      const stats = {
        total: tokens.length,
        available: tokens.filter((t) => t.status === "available").length,
        claimed: tokens.filter((t) => t.status === "claimed").length,
        expired: tokens.filter((t) => t.status === "expired").length,
      };

      return { tokens, stats };
    }),

  // =====================================================
  // Score Calculation Endpoints - Story 7.10
  // =====================================================

  /**
   * Get scores for all products in a cup
   * Organizer only - calculates real-time scores from submitted ratings
   */
  getProductScores: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().optional(), // Filter by category
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Get categories
      let categoryConditions = [eq(schema.categories.cupId, input.cupId)];
      if (input.categoryId) {
        categoryConditions.push(eq(schema.categories.id, input.categoryId));
      }

      const categories = await ctx.db.query.categories.findMany({
        where: and(...categoryConditions),
        with: {
          criteria: true,
        },
      });

      // Get confirmed registrations with products
      const registrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(schema.registrations.cupId, input.cupId),
          eq(schema.registrations.status, "confirmed")
        ),
        with: {
          products: {
            where: input.categoryId
              ? eq(schema.products.categoryId, input.categoryId)
              : undefined,
            with: {
              ratings: {
                // Only include submitted ratings
                where: isNotNull(schema.productRatings.submittedAt),
                with: {
                  scores: true,
                },
              },
            },
          },
          producer: {
            columns: { companyName: true },
          },
        },
      });

      // Calculate scores per product
      type ProductScore = {
        productId: string;
        productName: string;
        anonymousCode: string | null;
        categoryId: string;
        categoryName: string;
        producerName: string;
        totalRatings: number;
        averageScore: number;
        criterionScores: Array<{
          criterionId: string;
          criterionName: string;
          coefficient: number;
          averageScore: number;
          ratingCount: number;
        }>;
        rank: number | null;
      };

      const productScores: ProductScore[] = [];

      for (const reg of registrations) {
        for (const product of reg.products) {
          const category = categories.find((c) => c.id === product.categoryId);
          if (!category) continue;

          const submittedRatings = product.ratings.filter((r) => r.submittedAt);

          // Calculate per-criterion averages
          const criterionScores: ProductScore["criterionScores"] = [];

          for (const criterion of category.criteria) {
            const scores: number[] = [];
            for (const rating of submittedRatings) {
              const scoreRecord = rating.scores.find(
                (s) => s.criterionId === criterion.id
              );
              if (scoreRecord) {
                scores.push(scoreRecord.score);
              }
            }

            if (scores.length > 0) {
              const avgScore =
                scores.reduce((a, b) => a + b, 0) / scores.length;
              criterionScores.push({
                criterionId: criterion.id,
                criterionName: criterion.name,
                coefficient: criterion.coefficient ?? 1,
                averageScore: Math.round(avgScore * 100) / 100,
                ratingCount: scores.length,
              });
            }
          }

          // Calculate weighted average
          let weightedSum = 0;
          let totalWeight = 0;

          for (const cs of criterionScores) {
            weightedSum += cs.averageScore * cs.coefficient;
            totalWeight += cs.coefficient;
          }

          const averageScore =
            totalWeight > 0
              ? Math.round((weightedSum / totalWeight) * 100) / 100
              : 0;

          productScores.push({
            productId: product.id,
            productName: product.name,
            anonymousCode: product.anonymousCode,
            categoryId: category.id,
            categoryName: category.name,
            producerName: reg.producer.companyName ?? "Inconnu",
            totalRatings: submittedRatings.length,
            averageScore,
            criterionScores,
            rank: null, // Will be calculated below
          });
        }
      }

      // Calculate rankings per category
      const categoryGroups = new Map<string, ProductScore[]>();
      for (const ps of productScores) {
        const group = categoryGroups.get(ps.categoryId) ?? [];
        group.push(ps);
        categoryGroups.set(ps.categoryId, group);
      }

      for (const [, products] of categoryGroups) {
        // Sort by average score descending
        products.sort((a, b) => b.averageScore - a.averageScore);
        // Assign ranks (only for products with ratings)
        let rank = 1;
        for (const product of products) {
          if (product.totalRatings > 0) {
            product.rank = rank++;
          }
        }
      }

      // Summary stats
      const stats = {
        totalProducts: productScores.length,
        productsWithRatings: productScores.filter((p) => p.totalRatings > 0).length,
        categoriesCount: categories.length,
        averageRatingsPerProduct:
          productScores.length > 0
            ? Math.round(
                (productScores.reduce((a, p) => a + p.totalRatings, 0) /
                  productScores.length) *
                  100
              ) / 100
            : 0,
      };

      return {
        products: productScores,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          productCount: productScores.filter((p) => p.categoryId === c.id).length,
          ratedProductCount: productScores.filter(
            (p) => p.categoryId === c.id && p.totalRatings > 0
          ).length,
        })),
        stats,
      };
    }),

  /**
   * Get category rankings with medal positions
   * Organizer only
   */
  getCategoryRankings: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().min(1, "Category ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup with labels
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
        with: {
          labels: {
            orderBy: [desc(schema.cupLabels.minScore)],
          },
        },
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Get category
      const category = await ctx.db.query.categories.findFirst({
        where: and(
          eq(schema.categories.id, input.categoryId),
          eq(schema.categories.cupId, input.cupId)
        ),
        with: {
          criteria: true,
        },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categorie non trouvee",
        });
      }

      // Get products in this category with ratings
      const registrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(schema.registrations.cupId, input.cupId),
          eq(schema.registrations.status, "confirmed")
        ),
        with: {
          products: {
            where: eq(schema.products.categoryId, input.categoryId),
            with: {
              ratings: {
                where: isNotNull(schema.productRatings.submittedAt),
                with: {
                  scores: true,
                },
              },
            },
          },
          producer: {
            columns: { companyName: true },
          },
        },
      });

      // Calculate scores
      type RankedProduct = {
        productId: string;
        productName: string;
        anonymousCode: string | null;
        producerName: string;
        totalRatings: number;
        averageScore: number;
        rank: number;
        label: { id: string; name: string; color: string } | null;
      };

      const products: RankedProduct[] = [];

      for (const reg of registrations) {
        for (const product of reg.products) {
          const submittedRatings = product.ratings.filter((r) => r.submittedAt);

          if (submittedRatings.length === 0) continue;

          // Calculate weighted average
          let weightedSum = 0;
          let totalWeight = 0;

          for (const criterion of category.criteria) {
            const scores: number[] = [];
            for (const rating of submittedRatings) {
              const scoreRecord = rating.scores.find(
                (s) => s.criterionId === criterion.id
              );
              if (scoreRecord) {
                scores.push(scoreRecord.score);
              }
            }

            if (scores.length > 0) {
              const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
              const coef = criterion.coefficient ?? 1;
              weightedSum += avgScore * coef;
              totalWeight += coef;
            }
          }

          const averageScore =
            totalWeight > 0
              ? Math.round((weightedSum / totalWeight) * 100) / 100
              : 0;

          products.push({
            productId: product.id,
            productName: product.name,
            anonymousCode: product.anonymousCode,
            producerName: reg.producer.companyName ?? "Inconnu",
            totalRatings: submittedRatings.length,
            averageScore,
            rank: 0,
            label: null,
          });
        }
      }

      // Sort and rank
      products.sort((a, b) => b.averageScore - a.averageScore);
      products.forEach((p, i) => {
        p.rank = i + 1;
        // Assign label based on score
        for (const label of cup.labels) {
          if (p.averageScore >= label.minScore) {
            p.label = {
              id: label.id,
              name: label.name,
              color: label.color ?? "#000000",
            };
            break;
          }
        }
      });

      return {
        category: {
          id: category.id,
          name: category.name,
        },
        products,
        labels: cup.labels,
      };
    }),

  // =====================================================
  // Rating Lock Endpoints - Story 7.11
  // =====================================================

  /**
   * Lock ratings manually for a cup
   * Organizer only - prevents any further rating modifications
   */
  lockRatings: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        confirm: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify ownership (only owner can lock)
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seul l'organisateur peut verrouiller les notations",
        });
      }

      // Check if already locked
      if (cup.ratingsLockedAt) {
        return {
          success: true,
          alreadyLocked: true,
          lockedAt: cup.ratingsLockedAt,
          message: "Les notations sont deja verrouillees",
        };
      }

      // Require confirmation
      if (!input.confirm) {
        // Get stats to show what will be locked
        const registrations = await ctx.db.query.registrations.findMany({
          where: and(
            eq(schema.registrations.cupId, input.cupId),
            eq(schema.registrations.status, "confirmed")
          ),
          with: {
            products: {
              with: {
                ratings: {
                  where: isNotNull(schema.productRatings.submittedAt),
                },
              },
            },
          },
        });

        const totalProducts = registrations.flatMap((r) => r.products).length;
        const totalRatings = registrations
          .flatMap((r) => r.products)
          .flatMap((p) => p.ratings)
          .filter((r) => r.submittedAt).length;

        return {
          success: false,
          requiresConfirmation: true,
          stats: {
            totalProducts,
            totalRatings,
          },
          message: `Vous etes sur le point de verrouiller ${totalRatings} notations pour ${totalProducts} produits. Cette action est irreversible.`,
        };
      }

      // Lock the ratings
      const now = new Date();
      await ctx.db
        .update(schema.cups)
        .set({
          ratingsLockedAt: now,
          ratingsLockedBy: session.user.id,
          status: "completed",
          updatedAt: now,
        })
        .where(eq(schema.cups.id, input.cupId));

      return {
        success: true,
        alreadyLocked: false,
        lockedAt: now,
        message: "Les notations ont ete verrouillees. Les resultats sont maintenant definitifs.",
      };
    }),

  /**
   * Get rating lock status for a cup
   * Organizer only
   */
  getRatingLockStatus: publicProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Get cup
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cup non trouvee",
        });
      }

      // Verify membership
      const user = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces refuse",
        });
      }

      // Determine lock status
      const isManuallyLocked = !!cup.ratingsLockedAt;
      const isAutoLocked = cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt);
      const isLocked = isManuallyLocked || isAutoLocked;

      // Get who locked it (if manually locked)
      let lockedByUser = null;
      if (cup.ratingsLockedBy) {
        const user = await ctx.db.query.users.findFirst({
          where: eq(schema.users.id, cup.ratingsLockedBy),
          columns: { id: true, name: true, email: true },
        });
        lockedByUser = user;
      }

      return {
        isLocked,
        isManuallyLocked,
        isAutoLocked: isAutoLocked ?? false,
        ratingsLockedAt: cup.ratingsLockedAt,
        ratingEndAt: cup.ratingEndAt,
        lockedBy: lockedByUser,
        cupStatus: cup.status,
      };
    }),

  /**
   * Get all cups where current user is an active jury
   * Story 7.13: Central jury dashboard
   */
  getMyJuryCups: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });

    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez etre connecte",
      });
    }

    // Get all active jury memberships for this user
    const juryMemberships = await ctx.db.query.cupJuries.findMany({
      where: and(
        eq(schema.cupJuries.userId, session.user.id),
        eq(schema.cupJuries.isActive, true)
      ),
      with: {
        cup: {
          with: {
          },
        },
        categoryAssignments: {
          with: {
            category: true,
          },
        },
      },
    });

    if (juryMemberships.length === 0) {
      return [];
    }

    // For each membership, calculate rating progress
    const cupsWithProgress = await Promise.all(
      juryMemberships.map(async (membership) => {
        const cup = membership.cup;
        const assignedCategoryIds = membership.categoryAssignments.map(
          (a) => a.categoryId
        );

        let totalProducts = 0;
        let ratedProducts = 0;

        if (assignedCategoryIds.length > 0) {
          // Get products from confirmed registrations in assigned categories
          const confirmedRegistrations = await ctx.db.query.registrations.findMany({
            where: and(
              eq(schema.registrations.cupId, cup.id),
              eq(schema.registrations.status, "confirmed")
            ),
            with: {
              producer: {
                columns: { userId: true },
              },
              products: {
                where: inArray(schema.products.categoryId, assignedCategoryIds),
                with: {
                  ratings: {
                    where: eq(schema.productRatings.juryId, membership.id),
                  },
                },
              },
            },
          });

          // Filter out own products and count
          confirmedRegistrations
            .filter((r) => r.producer.userId !== session.user.id)
            .forEach((r) => {
              r.products.forEach((p) => {
                totalProducts++;
                if (p.ratings.some((rating) => rating.submittedAt !== null)) {
                  ratedProducts++;
                }
              });
            });
        }

        return {
          cupId: cup.id,
          cupName: cup.name,
          organizationName: ORGANIZATION_NAME,
          status: cup.status,
          ratingStartAt: cup.ratingStartAt,
          ratingEndAt: cup.ratingEndAt,
          ratingsLockedAt: cup.ratingsLockedAt,
          samplesReceivedAt: membership.samplesReceivedAt,
          assignedCategories: membership.categoryAssignments.map((a) => ({
            id: a.category.id,
            name: a.category.name,
          })),
          progress: {
            total: totalProducts,
            rated: ratedProducts,
            percentage: totalProducts > 0 ? Math.round((ratedProducts / totalProducts) * 100) : 0,
          },
        };
      })
    );

    // Sort by: rating phase first, then by progress percentage (lowest first)
    return cupsWithProgress.sort((a, b) => {
      // Rating phase cups first
      const aInRating = a.status === "rating" || a.status === "published";
      const bInRating = b.status === "rating" || b.status === "published";
      if (aInRating && !bInRating) return -1;
      if (!aInRating && bInRating) return 1;
      // Then by progress (incomplete first)
      return a.progress.percentage - b.progress.percentage;
    });
  }),

  /**
   * Get personal statistics for the current jury user
   * Returns member since date, cups participated, total ratings, average score
   */
  getMyStats: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });

    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez etre connecte",
      });
    }

    // Get the user's first jury membership (member since)
    const firstMembership = await ctx.db.query.cupJuries.findFirst({
      where: eq(schema.cupJuries.userId, session.user.id),
      orderBy: [schema.cupJuries.createdAt],
    });

    if (!firstMembership) {
      return null;
    }

    // Count distinct cups participated
    const cupsParticipated = await ctx.db
      .select({ count: sql<number>`count(distinct ${schema.cupJuries.cupId})` })
      .from(schema.cupJuries)
      .where(eq(schema.cupJuries.userId, session.user.id));

    // Get all jury memberships to count ratings
    const juryMemberships = await ctx.db
      .select({ id: schema.cupJuries.id })
      .from(schema.cupJuries)
      .where(eq(schema.cupJuries.userId, session.user.id));

    const juryIds = juryMemberships.map((m) => m.id);

    let totalRatings = 0;
    let averageScore: number | null = null;

    if (juryIds.length > 0) {
      // Count submitted ratings
      const ratingsCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.productRatings)
        .where(
          and(
            inArray(schema.productRatings.juryId, juryIds),
            isNotNull(schema.productRatings.submittedAt)
          )
        );

      totalRatings = Number(ratingsCount[0]?.count ?? 0);

      // Note: averageScore calculation requires aggregating criterion_scores
      // which is complex. Keeping null for now - UI handles this gracefully.
      // TODO: Implement proper average score calculation post-prod if needed
    }

    return {
      memberSince: firstMembership.createdAt,
      cupsParticipated: Number(cupsParticipated[0]?.count ?? 0),
      totalRatings,
      averageScore,
    };
  }),

  /**
   * Get cups with published results for comparison view
   * Returns cups where resultsPublishedAt is set, with label summary
   */
  getCompletedCupsWithResults: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });

    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez etre connecte",
      });
    }

    // Step 1: Get jury memberships with cup basic info (shallow query)
    const juryMemberships = await ctx.db.query.cupJuries.findMany({
      where: eq(schema.cupJuries.userId, session.user.id),
      with: {
        cup: {
          with: {
          },
        },
      },
    });

    // Filter to only cups with published results
    const cupsWithPublishedResults = juryMemberships.filter(
      (m) => m.cup.resultsPublishedAt !== null
    );

    // If no cups with results, return early
    if (cupsWithPublishedResults.length === 0) {
      return [];
    }

    // Step 2: For each cup with results, fetch label summary separately
    const results = await Promise.all(
      cupsWithPublishedResults.map(async (membership) => {
        const cup = membership.cup;

        // Get products with labels for this cup
        const productsWithLabels = await ctx.db
          .select({
            labelId: schema.products.labelId,
            labelName: schema.cupLabels.name,
            labelColor: schema.cupLabels.color,
            labelIcon: schema.cupLabels.icon,
          })
          .from(schema.products)
          .innerJoin(
            schema.categories,
            eq(schema.products.categoryId, schema.categories.id)
          )
          .leftJoin(
            schema.cupLabels,
            eq(schema.products.labelId, schema.cupLabels.id)
          )
          .where(eq(schema.categories.cupId, cup.id));

        // Count totals and labels
        const totalProducts = productsWithLabels.length;
        const labelCounts = new Map<string, { name: string; color: string | null; icon: string | null; count: number }>();

        productsWithLabels.forEach((product) => {
          if (product.labelId && product.labelName) {
            const existing = labelCounts.get(product.labelId);
            if (existing) {
              existing.count++;
            } else {
              labelCounts.set(product.labelId, {
                name: product.labelName,
                color: product.labelColor,
                icon: product.labelIcon,
                count: 1,
              });
            }
          }
        });

        // Convert label counts to array sorted by medal order
        const labelSummary = Array.from(labelCounts.values()).sort((a, b) => {
          const order = ["Platine", "Or", "Argent", "Bronze", "Participant"];
          const aIdx = order.indexOf(a.name);
          const bIdx = order.indexOf(b.name);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          return a.name.localeCompare(b.name);
        });

        return {
          cupId: cup.id,
          cupName: cup.name,
          organizationName: ORGANIZATION_NAME,
          resultsPublishedAt: cup.resultsPublishedAt,
          totalProducts,
          productsWithLabels: productsWithLabels.filter((p) => p.labelId).length,
          labelSummary,
        };
      })
    );

    // Sort by results published date (most recent first)
    return results.sort((a, b) => {
      if (!a.resultsPublishedAt || !b.resultsPublishedAt) return 0;
      return new Date(b.resultsPublishedAt).getTime() - new Date(a.resultsPublishedAt).getTime();
    });
  }),

  /**
   * Get cup ratings comparison for the current jury
   * Shows jury's ratings vs final scores with code/variety/producer correspondence
   * Only available when cup is completed
   */
  getCupRatingsComparison: publicProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Find jury membership for this cup
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          cup: {
            with: {
            },
          },
          categoryAssignments: {
            with: {
              category: true,
            },
          },
        },
      });

      if (!cupJury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      const cup = cupJury.cup;

      // Only allow when cup is completed
      if (cup.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont disponibles qu'une fois la cup terminee",
        });
      }

      const maxScale = getMaxScoreForScale(cup.ratingScale as RatingScale);

      // Get all products with their ratings by this jury
      const assignedCategoryIds = cupJury.categoryAssignments.map((a) => a.categoryId);

      if (assignedCategoryIds.length === 0) {
        return {
          cupName: cup.name,
          cupId: cup.id,
          ratingScale: cup.ratingScale,
          resultsPublishedAt: cup.resultsPublishedAt,
          categories: [],
          products: [],
          stats: {
            totalProducts: 0,
            ratedByJury: 0,
            alignmentScore: null,
            averageDifference: null,
          },
        };
      }

      // Get all products from confirmed registrations in assigned categories
      const allProducts = await ctx.db
        .select({
          productId: schema.products.id,
          productName: schema.products.name,
          anonymousCode: schema.products.anonymousCode,
          finalScore: schema.products.finalScore,
          categoryRank: schema.products.categoryRank,
          categoryId: schema.products.categoryId,
          categoryName: schema.categories.name,
          producerName: schema.producers.companyName,
          producerBrand: schema.producers.brandName,
          labelId: schema.cupLabels.id,
          labelName: schema.cupLabels.name,
          labelColor: schema.cupLabels.color,
          labelIcon: schema.cupLabels.icon,
        })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .innerJoin(
          schema.categories,
          eq(schema.products.categoryId, schema.categories.id)
        )
        .innerJoin(
          schema.producers,
          eq(schema.registrations.producerId, schema.producers.id)
        )
        .leftJoin(
          schema.cupLabels,
          eq(schema.products.labelId, schema.cupLabels.id)
        )
        .where(
          and(
            eq(schema.registrations.cupId, input.cupId),
            eq(schema.registrations.status, "confirmed"),
            inArray(schema.products.categoryId, assignedCategoryIds)
          )
        );

      // Get all jury ratings for these products
      const productIds = allProducts.map((p) => p.productId);
      const juryRatings = productIds.length > 0
        ? await ctx.db
            .select({
              productId: schema.productRatings.productId,
              ratingId: schema.productRatings.id,
              submittedAt: schema.productRatings.submittedAt,
            })
            .from(schema.productRatings)
            .where(
              and(
                eq(schema.productRatings.juryId, cupJury.id),
                inArray(schema.productRatings.productId, productIds),
                isNotNull(schema.productRatings.submittedAt)
              )
            )
        : [];

      // Get criteria for assigned categories
      const criteria = await ctx.db.query.ratingCriteria.findMany({
        where: inArray(schema.ratingCriteria.categoryId, assignedCategoryIds),
      });

      // Get criterion scores for jury's ratings
      const ratingIds = juryRatings.map((r) => r.ratingId);
      const juryScores = ratingIds.length > 0
        ? await ctx.db
            .select({
              productRatingId: schema.criterionScores.productRatingId,
              criterionId: schema.criterionScores.criterionId,
              score: schema.criterionScores.score,
            })
            .from(schema.criterionScores)
            .where(inArray(schema.criterionScores.productRatingId, ratingIds))
        : [];

      // Build jury score map: productId -> weighted average
      const ratingIdToProduct = new Map(
        juryRatings.map((r) => [r.ratingId, r.productId])
      );

      const criteriaByCategory = new Map<string, typeof criteria>();
      for (const c of criteria) {
        const arr = criteriaByCategory.get(c.categoryId) ?? [];
        arr.push(c);
        criteriaByCategory.set(c.categoryId, arr);
      }

      // Group scores by product
      const scoresByProduct = new Map<string, Map<string, number>>();
      for (const s of juryScores) {
        const productId = ratingIdToProduct.get(s.productRatingId);
        if (!productId) continue;
        let productMap = scoresByProduct.get(productId);
        if (!productMap) {
          productMap = new Map();
          scoresByProduct.set(productId, productMap);
        }
        productMap.set(s.criterionId, s.score);
      }

      // Compute jury weighted average per product
      const juryScoreByProduct = new Map<string, number>();
      for (const product of allProducts) {
        const productScores = scoresByProduct.get(product.productId);
        if (!productScores) continue;

        const categoryCriteria = criteriaByCategory.get(product.categoryId) ?? [];
        let weightedSum = 0;
        let coeffSum = 0;
        for (const c of categoryCriteria) {
          const score = productScores.get(c.id);
          if (score !== undefined) {
            weightedSum += score * c.coefficient;
            coeffSum += c.coefficient;
          }
        }
        if (coeffSum > 0) {
          juryScoreByProduct.set(product.productId, weightedSum / coeffSum);
        }
      }

      // Build products with comparison
      const productsWithComparison = allProducts.map((product) => {
        const juryScore = juryScoreByProduct.get(product.productId) ?? null;
        const finalScore = product.finalScore ? parseFloat(product.finalScore) : null;
        const difference =
          juryScore !== null && finalScore !== null
            ? juryScore - finalScore
            : null;

        return {
          productId: product.productId,
          productName: product.productName,
          anonymousCode: product.anonymousCode,
          categoryName: product.categoryName,
          categoryId: product.categoryId,
          categoryRank: product.categoryRank,
          producerName: product.producerName,
          producerBrand: product.producerBrand,
          juryScore: juryScore !== null ? Math.round(juryScore * 100) / 100 : null,
          finalScore,
          difference: difference !== null ? Math.round(difference * 100) / 100 : null,
          label: product.labelName
            ? {
                name: product.labelName,
                color: product.labelColor,
                icon: product.labelIcon,
              }
            : null,
        };
      });

      // Sort by category then by rank
      productsWithComparison.sort((a, b) => {
        if (a.categoryName !== b.categoryName) {
          return a.categoryName.localeCompare(b.categoryName);
        }
        if (a.categoryRank !== null && b.categoryRank !== null) {
          return a.categoryRank - b.categoryRank;
        }
        return 0;
      });

      // Compute stats
      const ratedByJury = productsWithComparison.filter((p) => p.juryScore !== null).length;
      const withBothScores = productsWithComparison.filter(
        (p) => p.juryScore !== null && p.finalScore !== null
      );

      let alignmentScore: number | null = null;
      let averageDifference: number | null = null;

      if (withBothScores.length > 0) {
        // Alignment = % of ratings within ±5 pts of final score (on the cup scale)
        const threshold = 1; // ±1 point
        const aligned = withBothScores.filter(
          (p) => Math.abs(p.difference!) <= threshold
        ).length;
        alignmentScore = Math.round((aligned / withBothScores.length) * 100);

        // Average difference
        const totalDiff = withBothScores.reduce((sum, p) => sum + p.difference!, 0);
        averageDifference = Math.round((totalDiff / withBothScores.length) * 100) / 100;
      }

      return {
        cupName: cup.name,
        cupId: cup.id,
        ratingScale: cup.ratingScale,
        resultsPublishedAt: cup.resultsPublishedAt,
        categories: cupJury.categoryAssignments.map((a) => ({
          id: a.category.id,
          name: a.category.name,
        })),
        products: productsWithComparison,
        stats: {
          totalProducts: allProducts.length,
          ratedByJury,
          alignmentScore,
          averageDifference,
        },
      };
    }),

  /**
   * Get detailed criterion scores for a specific product rated by this jury
   * Used in the expandable row on the jury results page
   */
  getJuryProductDetail: publicProcedure
    .input(z.object({ productId: z.string(), cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Verify this user is an active jury for this cup
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, session.user.id),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          cup: true,
        },
      });

      if (!cupJury) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vous n'etes pas jury pour cette cup",
        });
      }

      if (cupJury.cup.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Les resultats ne sont disponibles qu'une fois la cup terminee",
        });
      }

      // Get product with category and producer info
      const product = await ctx.db
        .select({
          productId: schema.products.id,
          productName: schema.products.name,
          anonymousCode: schema.products.anonymousCode,
          finalScore: schema.products.finalScore,
          categoryId: schema.products.categoryId,
          categoryName: schema.categories.name,
          producerName: schema.producers.companyName,
        })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .innerJoin(
          schema.categories,
          eq(schema.products.categoryId, schema.categories.id)
        )
        .innerJoin(
          schema.producers,
          eq(schema.registrations.producerId, schema.producers.id)
        )
        .where(
          and(
            eq(schema.products.id, input.productId),
            eq(schema.registrations.cupId, input.cupId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // Get jury's submitted product rating for this product
      const juryRating = await ctx.db.query.productRatings.findFirst({
        where: and(
          eq(schema.productRatings.productId, input.productId),
          eq(schema.productRatings.juryId, cupJury.id),
          isNotNull(schema.productRatings.submittedAt)
        ),
      });

      // Get criteria for this category ordered by sortOrder
      const criteria = await ctx.db.query.ratingCriteria.findMany({
        where: eq(schema.ratingCriteria.categoryId, product.categoryId),
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      });

      // Get this jury's criterion scores for the rating (if exists)
      const juryScores =
        juryRating
          ? await ctx.db
              .select({
                criterionId: schema.criterionScores.criterionId,
                score: schema.criterionScores.score,
              })
              .from(schema.criterionScores)
              .where(eq(schema.criterionScores.productRatingId, juryRating.id))
          : [];

      const juryScoreMap = new Map(juryScores.map((s) => [s.criterionId, s.score]));

      // Compute category averages for each criterion (all juries, all products in category)
      const categoryAvgRows = await ctx.db
        .select({
          criterionId: schema.criterionScores.criterionId,
          score: schema.criterionScores.score,
        })
        .from(schema.criterionScores)
        .innerJoin(
          schema.productRatings,
          eq(schema.criterionScores.productRatingId, schema.productRatings.id)
        )
        .innerJoin(schema.products, eq(schema.productRatings.productId, schema.products.id))
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .where(
          and(
            eq(schema.products.categoryId, product.categoryId),
            eq(schema.registrations.cupId, input.cupId),
            isNotNull(schema.productRatings.submittedAt)
          )
        );

      // Group category avg scores by criterion
      const categoryScoresByCriterion = new Map<string, number[]>();
      for (const row of categoryAvgRows) {
        const arr = categoryScoresByCriterion.get(row.criterionId) ?? [];
        arr.push(row.score);
        categoryScoresByCriterion.set(row.criterionId, arr);
      }

      // Build criterion detail rows
      const criteriaDetails = criteria.map((criterion) => {
        const juryScore = juryScoreMap.get(criterion.id) ?? null;
        const catScores = categoryScoresByCriterion.get(criterion.id) ?? [];
        const categoryAverage =
          catScores.length > 0
            ? catScores.reduce((sum, s) => sum + s, 0) / catScores.length
            : null;

        return {
          criterionId: criterion.id,
          criterionName: criterion.name,
          criterionDescription: criterion.description,
          coefficient: criterion.coefficient,
          juryScore: juryScore !== null ? juryScore : null,
          categoryAverage: categoryAverage !== null ? Math.round(categoryAverage * 100) / 100 : null,
        };
      });

      // Compute jury weighted average
      const scoredCriteria = criteriaDetails.filter((c) => c.juryScore !== null);
      const totalCoeff = scoredCriteria.reduce((sum, c) => sum + c.coefficient, 0);
      const juryWeightedAverage =
        totalCoeff > 0
          ? scoredCriteria.reduce((sum, c) => sum + c.juryScore! * c.coefficient, 0) / totalCoeff
          : null;

      return {
        productId: product.productId,
        productName: product.productName,
        anonymousCode: product.anonymousCode,
        categoryName: product.categoryName,
        producerName: product.producerName,
        finalScore: product.finalScore ? parseFloat(product.finalScore) : null,
        juryWeightedAverage:
          juryWeightedAverage !== null ? Math.round(juryWeightedAverage * 100) / 100 : null,
        juryComment: juryRating?.comment ?? null,
        ratingScale: cupJury.cup.ratingScale,
        criteriaDetails,
      };
    }),

  /**
   * Generate PDF synthesis for a jury's ratings on a cup
   * Only available when cup is completed
   */
  generateJuryPdf: publicProcedure
    .input(z.object({ cupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez etre connecte",
        });
      }

      // Import the jury PDF service
      const { generateJurySynthesisPdf } = await import(
        "~/server/services/jury-pdf.service"
      );

      const result = await generateJurySynthesisPdf(input.cupId, session.user.id);

      return {
        base64: result.buffer.toString("base64"),
        filename: result.filename,
      };
    }),
});
