/**
 * Jury Router
 * Handles jury invitation, management, and assignment endpoints
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray, sql, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createTRPCRouter,
  publicProcedure,
  strictRateLimitedPublicProcedure,
  protectedProcedure,
  organizerProcedure,
  juryProcedure,
} from "~/server/api/trpc";
import { getCupOrThrow } from "~/server/api/helpers/cup";
import { assertProducerMayJudge } from "~/server/api/helpers/jury";
import * as schema from "~/server/db/schema";
import { generateId } from "~/server/db/schema/id";
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
import { calculateWeightedScore } from "~/lib/validations/criteria";
import { weightedAverageOrNull } from "~/server/services/weighted-score";
import { formatPhaseDate } from "~/lib/validations/phases";
import { ORGANIZATION_NAME } from "~/lib/organization";
import type { RatingScale } from "~/server/db/schema/cups";

/**
 * Fenetre de notation.
 *
 * Aucun planificateur ne fait avancer `cups.status` (cf. phase-automation.ts,
 * sans appelant) : les dates de phase saisies par l'organisateur sont donc la
 * seule source de verite cote serveur. Elles sont verifiees a chaque lecture
 * d'un produit a noter et a chaque soumission de note.
 *
 * `ratingStartAt` n'est opposable que tant que l'organisateur n'a pas ouvert la
 * phase a la main : une fois `status === "rating"`, la date de debut n'est plus
 * modifiable (getEditableDates) et la bloquer enfermerait les jures.
 * `ratingEndAt` reste toujours opposable — elle, l'organisateur peut la
 * repousser s'il veut prolonger.
 */
function assertRatingWindowOpen(cup: {
  status: string;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
  ratingsLockedAt: Date | null;
}) {
  // Verrouillage manuel (Story 7.11)
  if (cup.ratingsLockedAt) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Les notations sont verrouillees. Les resultats sont definitifs.",
    });
  }

  const now = new Date();

  if (
    cup.status !== "rating" &&
    cup.ratingStartAt &&
    now < new Date(cup.ratingStartAt)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `La phase de notation n'est pas encore ouverte (debut le ${formatPhaseDate(
        cup.ratingStartAt
      )}).`,
    });
  }

  if (cup.ratingEndAt && now > new Date(cup.ratingEndAt)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La phase de notation est terminee. La date limite est passee.",
    });
  }
}

/** Client de base compatible avec `ctx.db` comme avec une transaction. */
type DbClient =
  | typeof import("~/server/db").db
  | Parameters<Parameters<typeof import("~/server/db").db.transaction>[0]>[0];

/**
 * Aligne `users.role` sur "jury" au moment ou le compte devient jure.
 *
 * Sans cette ecriture la colonne reste sur son defaut "producer" et
 * `user.getRedirectPath` renvoie le jure vers /producer/dashboard, d'ou une
 * double redirection a chaque connexion. On ne degrade jamais un organisateur
 * ni un producteur deja identifie : leur role principal reste le leur, les
 * casquettes secondaires se lisent via les profils.
 */
async function alignUserRoleToJury(db: DbClient, userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { role: true, isAdmin: true },
  });

  if (!user || user.isAdmin || user.role === "organizer" || user.role === "jury") {
    return;
  }

  const producerProfile = await db.query.producers.findFirst({
    where: eq(schema.producers.userId, userId),
    columns: { id: true },
  });

  if (producerProfile) return;

  await db
    .update(schema.users)
    .set({ role: "jury", updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

/**
 * Conflit d'interets : un producteur inscrit a la cup ne peut pas en devenir
 * jure, ses propres produits y sont notes. Meme regle sur les trois portes
 * d'entree (invitation, code, jeton public).
 */

export const juryRouter = createTRPCRouter({
  /**
   * List all jury profiles for the current user's organization
   * Used in the dashboard global juries page
   */
  listByOrganization: organizerProcedure.query(async ({ ctx }) => {
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
  deleteByOrganization: organizerProcedure
    .input(z.object({ juryProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
  invite: organizerProcedure
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
      const cup = await getCupOrThrow(ctx.db, input.cupId);

      // Send invitation
      const result = await sendJuryInvitation({
        cupId: input.cupId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        customMessage: input.customMessage,
        invitedByUserId: ctx.userId,
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
  inviteBulk: organizerProcedure
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
      const cup = await getCupOrThrow(ctx.db, input.cupId);

      // Send bulk invitations
      const result = await sendBulkInvitations(
        input.cupId,
        input.juries,
        ctx.userId,
        input.customMessage
      );

      return result;
    }),

  /**
   * Resend an invitation (reminder)
   */
  resendInvitation: organizerProcedure
    .input(
      z.object({
        invitationId: z.string().min(1, "Invitation ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  listInvitations: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        status: z.enum(["pending", "accepted", "declined", "expired", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  getInvitationStats: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
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
  cancelInvitation: organizerProcedure
    .input(
      z.object({
        invitationId: z.string().min(1, "Invitation ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  acceptInvitation: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Le lien d'invitation circule par email : il peut etre transfere. Seul le
      // titulaire de l'adresse invitee peut l'accepter (meme regle que
      // registerAndAcceptInvitation).
      if (
        ctx.session.user.email?.toLowerCase() !== invitation.email.toLowerCase()
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Cette invitation a ete envoyee a une autre adresse email. Connectez-vous avec le compte invite.",
        });
      }

      await assertProducerMayJudge(ctx.db, ctx.userId, invitation.cupId);

      // Check if user is already a jury for this cup
      const existingJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, invitation.cupId),
          eq(schema.cupJuries.userId, ctx.userId)
        ),
      });

      const now = new Date();
      const cupJuryId = existingJury?.id ?? nanoid();

      // Profil jure, rattachement a la cup et cloture de l'invitation forment
      // un tout : une coupure au milieu laissait une invitation "accepted"
      // sans cupJury, donc un jure qui ne peut ni noter ni reutiliser son lien.
      await ctx.db.transaction(async (tx) => {
        const existingProfile = await tx.query.juryProfiles.findFirst({
          where: eq(schema.juryProfiles.userId, ctx.userId),
        });

        if (!existingProfile) {
          await tx.insert(schema.juryProfiles).values({
            id: nanoid(),
            userId: ctx.userId,
            juryType: "pro",
            createdAt: now,
            updatedAt: now,
          });
        }

        if (!existingJury) {
          await tx.insert(schema.cupJuries).values({
            id: cupJuryId,
            cupId: invitation.cupId,
            userId: ctx.userId,
            invitationId: invitation.id,
            joinedAt: now,
          });
        }

        // L'invitation ne se ferme que si elle est encore "pending" : deux
        // acceptations concurrentes du meme lien n'en valident qu'une.
        const closed = await tx
          .update(schema.juryInvitations)
          .set({
            status: "accepted",
            userId: ctx.userId,
            acceptedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.juryInvitations.id, invitation.id),
              eq(schema.juryInvitations.status, "pending")
            )
          )
          .returning({ id: schema.juryInvitations.id });

        if (closed.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cette invitation a deja ete traitee",
          });
        }

        await alignUserRoleToJury(tx, ctx.userId);
      });

      return {
        success: true,
        alreadyJury: Boolean(existingJury),
        cupJuryId,
      };
    }),

  /**
   * Register a new user and accept jury invitation in one step
   * This bypasses email verification since the jury clicked on an invitation link
   * sent to their email (proof of email ownership)
   */
  registerAndAcceptInvitation: strictRateLimitedPublicProcedure
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
      //
      // `generateId` plutôt que `nanoid` : les lignes `users` et `accounts`
      // sont normalement écrites par Better Auth, jamais par un routeur. Ce
      // chemin les crée à la main (il hache le mot de passe lui-même) et doit
      // donc produire des identifiants du format que le reste du schéma
      // garantit, et non celui d'un paquet tiers qui peut changer d'alphabet
      // ou de longueur à la prochaine montée de version.
      const userId = generateId();
      const accountId = generateId();
      const now = new Date();

      const cupJuryId = nanoid();

      // Compte, moyen de connexion, profil jure, rattachement a la cup et
      // cloture de l'invitation : tout ou rien. Une coupure apres l'insertion
      // du user laissait une adresse email brulee par la contrainte d'unicite,
      // sans ligne `accounts`, donc un compte impossible a utiliser et
      // impossible a recreer.
      await ctx.db.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          id: userId,
          name: input.name,
          email: input.email.toLowerCase(),
          emailVerified: true, // Verified through invitation link
          // Sans role explicite la colonne retombe sur "producer" (defaut DB) et
          // les redirections apres connexion envoient le jure vers /producer.
          role: "jury",
          createdAt: now,
          updatedAt: now,
        });

        // Create account for password auth
        await tx.insert(schema.accounts).values({
          id: accountId,
          accountId: userId,
          providerId: "credential",
          userId: userId,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        });

        // Create jury profile
        const juryProfileId = nanoid();
        await tx.insert(schema.juryProfiles).values({
          id: juryProfileId,
          userId: userId,
          juryType: "pro",
          expertise: input.expertise ?? null,
          createdAt: now,
          updatedAt: now,
        });

        // Create cup jury record linked to profile
        await tx.insert(schema.cupJuries).values({
          id: cupJuryId,
          cupId: invitation.cupId,
          userId: userId,
          invitationId: invitation.id,
          juryProfileId: juryProfileId,
          joinedAt: now,
        });

        // Le filtre sur "pending" rend la prise du lien atomique : deux
        // inscriptions simultanees sur le meme token, une seule aboutit.
        const closed = await tx
          .update(schema.juryInvitations)
          .set({
            status: "accepted",
            userId: userId,
            acceptedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.juryInvitations.id, invitation.id),
              eq(schema.juryInvitations.status, "pending")
            )
          )
          .returning({ id: schema.juryInvitations.id });

        if (closed.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cette invitation a deja ete traitee",
          });
        }
      });

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
   * List all juries for a cup (accepted invitations)
   */
  listJuries: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        includeInactive: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  removeJury: organizerProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  reactivateJury: organizerProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  assignCategories: organizerProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
        categoryIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Purge puis reecriture dans la meme transaction : une coupure entre les
      // deux laissait le jure sans aucune categorie assignee, donc sans rien a
      // noter, sans trace de ce qu'il avait avant.
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(schema.juryCategoryAssignments)
          .where(eq(schema.juryCategoryAssignments.cupJuryId, input.cupJuryId));

        if (input.categoryIds.length > 0) {
          await tx.insert(schema.juryCategoryAssignments).values(
            input.categoryIds.map((categoryId) => ({
              id: nanoid(),
              cupJuryId: input.cupJuryId,
              categoryId,
              assignedBy: ctx.userId,
              assignedAt: new Date(),
            }))
          );
        }
      });

      return { success: true, assignedCount: input.categoryIds.length };
    }),

  /**
   * Bulk assign categories to multiple juries
   * FR-83: L'organisateur peut assigner plusieurs jurys à une catégorie en une action
   */
  bulkAssignCategories: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        cupJuryIds: z.array(z.string()).min(1, "Au moins un jury requis"),
        categoryIds: z.array(z.string()).min(1, "Au moins une categorie requise"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

      // Dédoublonnage avant toute chose. La procédure est appelable
      // directement : deux fois le même identifiant dans la liste faisait
      // échouer le contrôle de validité ci-dessous (`juries.length !==
      // cupJuryIds.length`), puis produisait deux lignes identiques dans une
      // insertion unique, en violation de `jury_category_assignment_unique`.
      const cupJuryIds = [...new Set(input.cupJuryIds)];
      const categoryIds = [...new Set(input.categoryIds)];

      // Validate juries belong to this cup
      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          inArray(schema.cupJuries.id, cupJuryIds),
          eq(schema.cupJuries.isActive, true)
        ),
      });

      if (juries.length !== cupJuryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains jurys ne sont pas valides pour cette cup",
        });
      }

      // Validate categories belong to this cup
      const categories = await ctx.db.query.categories.findMany({
        where: and(
          eq(schema.categories.cupId, input.cupId),
          inArray(schema.categories.id, categoryIds)
        ),
      });

      if (categories.length !== categoryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certaines categories ne sont pas valides pour cette cup",
        });
      }

      // Une lecture pour tout le lot au lieu de deux requetes par jure, et une
      // seule insertion : l'assignation en masse portait 2N aller-retours SQL,
      // et un echec au milieu laissait la moitie du lot assignee.
      const existingAssignments = await ctx.db.query.juryCategoryAssignments.findMany({
        where: inArray(schema.juryCategoryAssignments.cupJuryId, cupJuryIds),
        columns: { cupJuryId: true, categoryId: true },
      });

      const alreadyAssigned = new Set(
        existingAssignments.map((a) => `${a.cupJuryId}:${a.categoryId}`)
      );

      const assignments = cupJuryIds.flatMap((juryId) =>
        categoryIds
          .filter((categoryId) => !alreadyAssigned.has(`${juryId}:${categoryId}`))
          .map((categoryId) => ({
            id: nanoid(),
            cupJuryId: juryId,
            categoryId,
            assignedBy: ctx.userId,
            assignedAt: new Date(),
          }))
      );

      if (assignments.length > 0) {
        await ctx.db.insert(schema.juryCategoryAssignments).values(assignments);
      }

      const totalAssignments = assignments.length;

      return {
        success: true,
        juriesUpdated: cupJuryIds.length,
        assignmentsCreated: totalAssignments,
      };
    }),

  /**
   * Get completion stats for all juries of a cup
   * FR-104: L'organisateur peut voir le taux de complétion global et par jury
   */
  getCompletionStats: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
          producer: {
            columns: { userId: true },
          },
          products: {
            columns: {
              id: true,
              categoryId: true,
            },
          },
        },
      });

      // Flatten products from confirmed registrations, en gardant le proprietaire :
      // un jure ne note jamais ses propres produits (cf. getMyJuryCup), ils ne
      // doivent donc pas compter dans son denominateur.
      const cupProducts = confirmedRegistrations.flatMap((r) =>
        r.products.map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          ownerUserId: r.producer.userId,
        }))
      );

      const cupProductIds = new Set(cupProducts.map((p) => p.id));

      // Notations reellement soumises, par jury et par categorie
      const juryIds = juries.map((j) => j.id);
      const submittedRatings = juryIds.length > 0
        ? await ctx.db
            .select({
              juryId: schema.productRatings.juryId,
              categoryId: schema.products.categoryId,
              productId: schema.productRatings.productId,
            })
            .from(schema.productRatings)
            .innerJoin(
              schema.products,
              eq(schema.productRatings.productId, schema.products.id)
            )
            .where(
              and(
                inArray(schema.productRatings.juryId, juryIds),
                isNotNull(schema.productRatings.submittedAt)
              )
            )
        : [];

      // juryId -> categoryId -> nombre de produits notes
      const ratedByJuryAndCategory = new Map<string, Map<string, number>>();
      for (const rating of submittedRatings) {
        // Ignore les notes portant sur des produits hors inscriptions confirmees
        if (!cupProductIds.has(rating.productId)) continue;
        let byCategory = ratedByJuryAndCategory.get(rating.juryId);
        if (!byCategory) {
          byCategory = new Map<string, number>();
          ratedByJuryAndCategory.set(rating.juryId, byCategory);
        }
        byCategory.set(
          rating.categoryId,
          (byCategory.get(rating.categoryId) ?? 0) + 1
        );
      }

      // Calculate stats per jury
      const juryStats = juries.map((jury) => {
        const assignedCategoryIds = new Set(
          jury.categoryAssignments.map((a) => a.categoryId)
        );
        const ratedByCategory =
          ratedByJuryAndCategory.get(jury.id) ?? new Map<string, number>();

        // Produits a noter par categorie, hors produits du jure lui-meme
        const toRateByCategory = new Map<string, number>();
        for (const product of cupProducts) {
          if (!assignedCategoryIds.has(product.categoryId)) continue;
          if (product.ownerUserId === jury.userId) continue;
          toRateByCategory.set(
            product.categoryId,
            (toRateByCategory.get(product.categoryId) ?? 0) + 1
          );
        }

        let totalProductsToRate = 0;
        let productsRated = 0;
        for (const assignment of jury.categoryAssignments) {
          totalProductsToRate += toRateByCategory.get(assignment.categoryId) ?? 0;
          productsRated += ratedByCategory.get(assignment.categoryId) ?? 0;
        }

        return {
          juryId: jury.id,
          userId: jury.userId,
          userName: jury.user.name,
          userEmail: jury.user.email,
          categoriesAssigned: jury.categoryAssignments.length,
          categories: jury.categoryAssignments.map((a) => ({
            id: a.category.id,
            name: a.category.name,
            productsCount: toRateByCategory.get(a.categoryId) ?? 0,
            productsRated: ratedByCategory.get(a.categoryId) ?? 0,
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
  sendRatingReminder: organizerProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the jury
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
  sendBulkRatingReminders: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        juryIds: z.array(z.string().min(1)).min(1, "Au moins un jury requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  sendRatingSheet: organizerProcedure
    .input(
      z.object({
        cupJuryId: z.string().min(1, "Jury ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  sendAllRatingSheets: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  getMyJuryCup: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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
          .filter((r) => r.producer.userId !== ctx.userId)
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
  getProductForRating: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        productId: z.string().min(1, "Product ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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

      // Verrouillage et fenetre de notation (ratingStartAt / ratingEndAt)
      assertRatingWindowOpen(cup);

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
      if (product.registration.producer.userId === ctx.userId) {
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
  confirmSamplesReceived: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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
  submitRating: protectedProcedure
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
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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

      // Verrouillage et fenetre de notation (ratingStartAt / ratingEndAt)
      assertRatingWindowOpen(cup);

      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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
          registration: {
            with: {
              producer: {
                columns: { userId: true },
              },
            },
          },
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

      // Conflit d'interets (Story 7.7) : getProductForRating l'ecartait deja,
      // mais la soumission est appelable directement.
      if (product.registration.producer.userId === ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous ne pouvez pas noter vos propres produits",
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

      // Un critere envoye deux fois ferait echouer l'upsert groupe par une
      // erreur Postgres brute (« cannot affect row a second time ») : on la
      // traduit en refus lisible avant d'ecrire quoi que ce soit.
      if (new Set(providedCriteriaIds).size !== providedCriteriaIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Un critere ne peut etre note qu'une fois",
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
      const existingRating = await ctx.db.query.productRatings.findFirst({
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
      const existingScores = existingRating?.scores ?? [];

      // Une coupure entre l'insertion de la note et celle de ses scores laissait
      // une notation partielle marquee submittedAt, donc des moyennes faussees
      // dans computeResults : tout est ecrit d'un bloc.
      const ratingId = await ctx.db.transaction(async (tx) => {
        // Upsert, et NON un « si existant alors UPDATE sinon INSERT » décidé sur
        // une lecture faite hors transaction.
        //
        // L'écran de notation émet deux requêtes pour la même note :
        // l'enregistrement automatique (submit:false, 300 ms après le dernier
        // clic) et la validation (submit:true). Parties ensemble, elles
        // lisaient toutes deux « aucune notation » et tentaient chacune un
        // INSERT : la perdante remontait au juré l'erreur Postgres brute
        // « duplicate key value violates unique constraint ».
        //
        // Plus grave, dans l'autre ordre : l'enregistrement automatique
        // arrivait APRÈS la validation et remettait `submittedAt` à NULL. La
        // page affichait « notation soumise » pendant que la base gardait un
        // brouillon — une voix perdue, sans que personne ne puisse le savoir.
        // D'où le `submit ? now : <valeur actuelle>` : une notation soumise ne
        // redevient jamais un brouillon.
        const [ligne] = await tx
          .insert(schema.productRatings)
          .values({
            id: nanoid(),
            productId: input.productId,
            juryId: juryMembership.id,
            comment: input.comment,
            submittedAt: input.submit ? now : null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.productRatings.productId, schema.productRatings.juryId],
            set: {
              comment: sql`excluded.comment`,
              submittedAt: input.submit
                ? now
                : sql`${schema.productRatings.submittedAt}`,
              updatedAt: now,
            },
          })
          .returning({ id: schema.productRatings.id });

        // L'identifiant qui ressort est celui de la ligne RÉELLE — pas le
        // nanoid généré plus haut, qui est jeté en cas de conflit. Les scores
        // doivent s'y rattacher, sinon ils partent sur une notation fantôme.
        const idReel = ligne!.id;

        // Un seul upsert pour tous les criteres, adosse a l'unicite
        // (product_rating_id, criterion_id). La reprise d'un brouillon faisait
        // sinon un UPDATE par critere : sur le chemin critique du jour de
        // notation, 7 a 10 aller-retours SQL par soumission au lieu de deux.
        await tx
          .insert(schema.criterionScores)
          .values(
            input.scores.map((score) => ({
              id:
                existingScores.find((s) => s.criterionId === score.criterionId)?.id ??
                nanoid(),
              productRatingId: idReel,
              criterionId: score.criterionId,
              score: score.score,
              createdAt: now,
              updatedAt: now,
            }))
          )
          .onConflictDoUpdate({
            target: [
              schema.criterionScores.productRatingId,
              schema.criterionScores.criterionId,
            ],
            set: {
              score: sql`excluded.score`,
              updatedAt: now,
            },
          });

        // Update jury last activity
        await tx
          .update(schema.cupJuries)
          .set({
            lastActivityAt: now,
            updatedAt: now,
          })
          .where(eq(schema.cupJuries.id, juryMembership.id));

        return idReel;
      });

      // Calculate weighted average score
      const criteriaMap = new Map(
        product.category.criteria.map((c) => [c.id, c.coefficient])
      );

      // Implémentation partagée (`~/lib/validations/criteria`) : la note d'une
      // fiche recalculée par le routeur et celle affichée par le dashboard
      // venaient de deux copies de la même formule.
      const averageScore = calculateWeightedScore(
        input.scores.map((score) => ({
          score: score.score,
          criterionCoefficient: criteriaMap.get(score.criterionId) ?? 1,
        }))
      );

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
        ratingId,
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
  getMyRating: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        productId: z.string().min(1, "Product ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get jury membership
      const juryMembership = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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
  generatePublicJuryTokens: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().min(1, "Category ID requis"),
        quantity: z.number().int().min(1).max(500, "Max 500 tokens par generation"),
        expiresInDays: z.number().int().min(1).max(365).default(90),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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

      // Un seul insert pour tout le lot : jusqu'a 500 aller-retours SQL
      // auparavant, et une coupure au milieu laissait un lot partiel dont les
      // planches de QR codes deja imprimees ne correspondaient plus.
      const tokens = Array.from({ length: input.quantity }, () => ({
        id: nanoid(),
        token: nanoid(16), // Shorter token for QR codes
      }));

      await ctx.db.insert(schema.publicJuryTokens).values(
        tokens.map((t) => ({
          id: t.id,
          cupId: input.cupId,
          categoryId: input.categoryId,
          token: t.token,
          batchId,
          expiresAt,
        }))
      );

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
  claimPublicJuryToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
        if (tokenRecord.claimedByUserId === ctx.userId) {
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

      // Le meme controle existe sur `juryCodes.activate` et `acceptInvitation` ;
      // ce chemin-ci est la troisieme porte d'entree et doit l'appliquer aussi,
      // sinon la garde se contourne en demandant un jeton public.
      await assertProducerMayJudge(ctx.db, ctx.userId, tokenRecord.cupId);

      const now = new Date();

      // Profil, rattachement, assignation de categorie et consommation du jeton
      // forment un tout : sans transaction, une coupure marquait le jeton
      // "claimed" sans que le jure soit rattache a la cup — jeton perdu.
      const cupJuryId = await ctx.db.transaction(async (tx) => {
        // Le filtre sur "available" rend la prise atomique : deux
        // reclamations concurrentes du meme jeton, une seule gagne.
        const claimed = await tx
          .update(schema.publicJuryTokens)
          .set({
            status: "claimed",
            claimedByUserId: ctx.userId,
            claimedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.publicJuryTokens.id, tokenRecord.id),
              eq(schema.publicJuryTokens.status, "available")
            )
          )
          .returning({ id: schema.publicJuryTokens.id });

        if (claimed.length === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ce token a deja ete utilise par quelqu'un d'autre",
          });
        }

        // Ensure user has a jury profile (upsert pattern)
        const existingProfile = await tx.query.juryProfiles.findFirst({
          where: eq(schema.juryProfiles.userId, ctx.userId),
        });

        let juryProfileId: string;
        if (existingProfile) {
          juryProfileId = existingProfile.id;
        } else {
          juryProfileId = nanoid();
          await tx.insert(schema.juryProfiles).values({
            id: juryProfileId,
            userId: ctx.userId,
            juryType: "public",
          });
        }

        // Check if user already has a cupJury entry for this cup
        const existingCupJury = await tx.query.cupJuries.findFirst({
          where: and(
            eq(schema.cupJuries.cupId, tokenRecord.cupId),
            eq(schema.cupJuries.userId, ctx.userId)
          ),
        });

        let resolvedCupJuryId: string;

        if (!existingCupJury) {
          resolvedCupJuryId = nanoid();
          await tx.insert(schema.cupJuries).values({
            id: resolvedCupJuryId,
            cupId: tokenRecord.cupId,
            userId: ctx.userId,
            juryProfileId: juryProfileId,
            isActive: true,
            joinedAt: now,
            // Public juries don't need to confirm samples (they buy packs with samples included)
            samplesReceivedAt: now,
          });
        } else {
          resolvedCupJuryId = existingCupJury.id;

          if (!existingCupJury.juryProfileId) {
            // Link existing cupJury to the jury profile if not already linked
            await tx
              .update(schema.cupJuries)
              .set({ juryProfileId: juryProfileId, updatedAt: now })
              .where(eq(schema.cupJuries.id, existingCupJury.id));
          }
        }

        // Check if already assigned to this category
        const existingAssignment = await tx.query.juryCategoryAssignments.findFirst({
          where: and(
            eq(schema.juryCategoryAssignments.cupJuryId, resolvedCupJuryId),
            eq(schema.juryCategoryAssignments.categoryId, tokenRecord.categoryId)
          ),
        });

        if (!existingAssignment) {
          // Create category assignment
          await tx.insert(schema.juryCategoryAssignments).values({
            id: nanoid(),
            cupJuryId: resolvedCupJuryId,
            categoryId: tokenRecord.categoryId,
            assignedAt: now,
          });
        }

        // Le jeton porte le cupJury pour que l'organisateur sache qui l'a pris.
        await tx
          .update(schema.publicJuryTokens)
          .set({ cupJuryId: resolvedCupJuryId, updatedAt: now })
          .where(eq(schema.publicJuryTokens.id, tokenRecord.id));

        await alignUserRoleToJury(tx, ctx.userId);

        return resolvedCupJuryId;
      });

      return {
        success: true,
        alreadyClaimed: false,
        message: "Token utilise avec succes! Vous pouvez maintenant noter les produits.",
        cupJuryId,
        cupId: tokenRecord.cupId,
        categoryId: tokenRecord.categoryId,
      };
    }),

  /**
   * List public jury tokens for a cup
   * Organizer only
   */
  listPublicJuryTokens: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        categoryId: z.string().optional(),
        status: z.enum(["available", "claimed", "expired", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  // Rating Lock Endpoints - Story 7.11
  // =====================================================

  /**
   * Lock ratings manually for a cup
   * Organizer only - prevents any further rating modifications
   */
  lockRatings: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        confirm: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
          ratingsLockedBy: ctx.userId,
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
  getRatingLockStatus: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);

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
  getMyJuryCups: protectedProcedure.query(async ({ ctx }) => {
    // Get all active jury memberships for this user
    const juryMemberships = await ctx.db.query.cupJuries.findMany({
      where: and(
        eq(schema.cupJuries.userId, ctx.userId),
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
            .filter((r) => r.producer.userId !== ctx.userId)
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
  getMyStats: protectedProcedure.query(async ({ ctx }) => {
    // Get the user's first jury membership (member since)
    const firstMembership = await ctx.db.query.cupJuries.findFirst({
      where: eq(schema.cupJuries.userId, ctx.userId),
      orderBy: [schema.cupJuries.createdAt],
    });

    if (!firstMembership) {
      return null;
    }

    // Count distinct cups participated
    const cupsParticipated = await ctx.db
      .select({ count: sql<number>`count(distinct ${schema.cupJuries.cupId})` })
      .from(schema.cupJuries)
      .where(eq(schema.cupJuries.userId, ctx.userId));

    // Get all jury memberships to count ratings
    const juryMemberships = await ctx.db
      .select({ id: schema.cupJuries.id })
      .from(schema.cupJuries)
      .where(eq(schema.cupJuries.userId, ctx.userId));

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
  getCompletedCupsWithResults: protectedProcedure.query(async ({ ctx }) => {
    // Step 1: Get jury memberships with cup basic info (shallow query)
    const juryMemberships = await ctx.db.query.cupJuries.findMany({
      where: eq(schema.cupJuries.userId, ctx.userId),
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
  getCupRatingsComparison: protectedProcedure
    .input(z.object({ cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Find jury membership for this cup
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
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
        // Implémentation partagée. Les critères que ce juré n'a pas notés sont
        // écartés avant l'appel : sans aucune note, le produit ne doit pas
        // entrer dans la comparaison avec un score de 0, il doit en être absent.
        const notedCriteria = categoryCriteria.flatMap((c) => {
          const score = productScores.get(c.id);
          return score === undefined
            ? []
            : [{ score, criterionCoefficient: c.coefficient }];
        });
        if (notedCriteria.length > 0) {
          juryScoreByProduct.set(
            product.productId,
            calculateWeightedScore(notedCriteria)
          );
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
  getJuryProductDetail: protectedProcedure
    .input(z.object({ productId: z.string(), cupId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify this user is an active jury for this cup
      const cupJury = await ctx.db.query.cupJuries.findFirst({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          eq(schema.cupJuries.userId, ctx.userId),
          eq(schema.cupJuries.isActive, true)
        ),
        with: {
          cup: true,
          categoryAssignments: true,
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

      // La fiche leve l'anonymat (nom du produit, producteur) : elle reste
      // limitee aux categories reellement assignees, comme
      // getCupRatingsComparison.
      const isAssigned = cupJury.categoryAssignments.some(
        (a) => a.categoryId === product.categoryId
      );

      if (!isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'etes pas assigne a cette categorie",
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

      // Moyenne pondérée du juré, par le helper commun. Cette fiche affiche
      // `juryWeightedAverage` à côté de `finalScore` : c'est l'écran où une
      // divergence entre le calcul du juré et le calcul officiel se verrait
      // immédiatement, donc le dernier endroit où garder une copie de la
      // formule. `weightedAverageOrNull` porte exactement la sémantique
      // attendue ici : pas de note, pas de moyenne — surtout pas un zéro.
      const juryWeightedAverage = weightedAverageOrNull(
        criteriaDetails.map((c) => ({ score: c.juryScore, coefficient: c.coefficient }))
      );

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
   * Get the current jury user's own profile for the edit page
   * Returns user fields (name, email, image) + juryProfile fields
   */
  getMyProfileForEdit: juryProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.userId),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur non trouvé" });
    }

    return {
      user,
      juryProfile: ctx.juryProfile,
    };
  }),

  /**
   * Update the current jury user's own profile
   * Handles user fields (name, image) and juryProfile fields separately
   * Email changes are handled client-side via authClient.changeEmail()
   */
  updateMyProfile: juryProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z
          .string()
          .refine(
            (v) =>
              v === "" ||
              v.startsWith("/uploads/") ||
              v.startsWith("http"),
            "URL d'image invalide"
          )
          .optional()
          .nullable(),
        displayName: z.string().max(100).optional().nullable(),
        expertise: z.string().max(150).optional().nullable(),
        bio: z.string().max(300).optional().nullable(),
        showOnPublicResults: z.boolean().optional(),
        notifyOnInvitation: z.boolean().optional(),
        notifyOnAssignment: z.boolean().optional(),
        notifyOnReminder: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Update users table if user fields provided
      const hasUserUpdates = input.name !== undefined || input.image !== undefined;
      if (hasUserUpdates) {
        await ctx.db
          .update(schema.users)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.image !== undefined
              ? { image: input.image === "" ? null : input.image }
              : {}),
            updatedAt: now,
          })
          .where(eq(schema.users.id, ctx.userId));
      }

      // Public jurys stay anonymous on the palmares — strip any attempt
      // to set the publicly-visible fields so a forged payload cannot
      // expose them. Notification prefs remain editable.
      const isPublicJury = ctx.juryProfile.juryType === "public";

      // Update juryProfiles table
      await ctx.db
        .update(schema.juryProfiles)
        .set({
          ...(!isPublicJury && input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          ...(!isPublicJury && input.expertise !== undefined
            ? { expertise: input.expertise }
            : {}),
          ...(!isPublicJury && input.bio !== undefined
            ? { bio: input.bio }
            : {}),
          ...(!isPublicJury && input.showOnPublicResults !== undefined
            ? { showOnPublicResults: input.showOnPublicResults }
            : {}),
          ...(input.notifyOnInvitation !== undefined
            ? { notifyOnInvitation: input.notifyOnInvitation }
            : {}),
          ...(input.notifyOnAssignment !== undefined
            ? { notifyOnAssignment: input.notifyOnAssignment }
            : {}),
          ...(input.notifyOnReminder !== undefined
            ? { notifyOnReminder: input.notifyOnReminder }
            : {}),
          updatedAt: now,
        })
        .where(eq(schema.juryProfiles.id, ctx.juryProfile.id));

      // Fetch and return updated data
      const updatedUser = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, ctx.userId),
        columns: { id: true, name: true, email: true, image: true },
      });

      const updatedProfile = await ctx.db.query.juryProfiles.findFirst({
        where: eq(schema.juryProfiles.id, ctx.juryProfile.id),
      });

      return {
        user: updatedUser,
        juryProfile: updatedProfile,
      };
    }),
});
