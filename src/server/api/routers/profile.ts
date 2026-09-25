import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import type { db as Database } from "~/server/db";

/** Délai de grâce entre la demande de suppression et son exécution. */
const DELETION_GRACE_DAYS = 30;

/**
 * Anonymise un compte au titre du droit à l'effacement (RGPD art. 17).
 *
 * Suppression pure impossible : `users` est en cascade sur `producers` →
 * `registrations` → `products` → `product_ratings` → `criterion_scores`, et
 * sur `cup_juries` → `product_ratings`. Effacer la ligne user détruirait les
 * résultats des concours déjà publiés, les factures et les notes des autres
 * jurés. On efface donc les données identifiantes et on rend le compte
 * inutilisable, en conservant les données de concours nécessaires à
 * l'intégrité du palmarès.
 *
 * TODO (juridique) : faire valider la liste des champs conservés
 * (raison sociale et marque du producteur, noms de produits, historique de
 * notation) au regard de l'intérêt légitime invoqué, et la documenter dans
 * la politique de confidentialité.
 */
export async function anonymizeUserAccount(
  db: typeof Database,
  userId: string
): Promise<void> {
  // Tout ou rien : les étapes 6 et 7 dépendent de l'adresse lue avant que
  // l'étape 1 ne l'écrase. Sans transaction, un échec intermédiaire laisse le
  // compte à moitié anonymisé ET irrécupérable — `deletionScheduledFor` est
  // déjà remis à null, donc le lot suivant ne le resélectionne pas, et
  // l'adresse réelle resterait à jamais dans contact_messages et newsletter.
  await db.transaction(async (tx) => {
    const now = new Date();
    // Adresse de remplacement : unique (contrainte sur users.email) et sur un
    // TLD réservé qui ne peut correspondre à aucune boîte réelle (RFC 2606).
    const placeholderEmail = `deleted-${userId}@deleted.invalid`;

    // Lu avant l'écrasement de `users.email` : les messages de contact et les
    // abonnements newsletter ne portent pas l'userId, ils sont rattachés à
    // l'adresse — c'est d'ailleurs ainsi que `exportData` les retrouve.
    const account = await tx.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { email: true },
    });
    const formerEmail = account?.email ?? null;

    // 1. Identité : l'utilisateur n'est plus identifiable depuis l'application.
    await tx
      .update(schema.users)
      .set({
        name: "Compte supprimé",
        email: placeholderEmail,
        emailVerified: false,
        image: null,
        // `deletionRequestedAt` reste en place comme trace de la demande ;
        // remettre `deletionScheduledFor` à null rend le traitement idempotent.
        deletionScheduledFor: null,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));

    // 2. Moyens d'authentification : mot de passe et jetons OAuth.
    await tx.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    // 3. Profil producteur : coordonnées et identifiants d'entreprise.
    await tx
      .update(schema.producers)
      .set({
        logo: null,
        siret: null,
        website: null,
        phone: null,
        address: null,
        updatedAt: now,
      })
      .where(eq(schema.producers.userId, userId));

    // 4. Profil juré : biographie, expertise et nom affiché publiquement.
    await tx
      .update(schema.juryProfiles)
      .set({
        expertise: null,
        bio: null,
        displayName: null,
        showOnPublicResults: false,
        updatedAt: now,
      })
      .where(eq(schema.juryProfiles.userId, userId));

    // 5. Journal d'audit : on garde la trace de l'action, pas de l'auteur.
    await tx
      .update(schema.activityLogs)
      .set({ userId: null, ipAddress: null, userAgent: null })
      .where(eq(schema.activityLogs.userId, userId));

    if (!formerEmail) return;

    // 6. Messages de contact : le corps du message est conservé comme trace de
    // l'échange avec l'organisateur, l'expéditeur ne l'est plus.
    await tx
      .update(schema.contactMessages)
      .set({
        senderName: "Compte supprimé",
        senderEmail: placeholderEmail,
        updatedAt: now,
      })
      .where(eq(schema.contactMessages.senderEmail, formerEmail));

    // 7. Newsletter : l'abonnement repose sur le consentement, rien ne justifie
    // de conserver l'adresse une fois l'effacement demandé — on supprime la
    // ligne plutôt que de la passer en « unsubscribed ».
    await tx
      .delete(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.email, formerEmail));
  });
}

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
   *
   * Droit d'accès (art. 15) : toutes les tables portant l'userId, plus celles
   * rattachées à l'adresse email (contact, newsletter).
   */
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;

    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const producer = await ctx.db.query.producers.findFirst({
      where: eq(schema.producers.userId, userId),
    });

    let registrations: (typeof schema.registrations.$inferSelect)[] = [];
    let products: (typeof schema.products.$inferSelect)[] = [];
    if (producer) {
      registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.producerId, producer.id),
      });

      const regIds = registrations.map((r) => r.id);
      if (regIds.length > 0) {
        // `inArray` et non `regIds[0]` : un producteur inscrit à plusieurs
        // éditions recevait un export tronqué présenté comme complet.
        products = await ctx.db.query.products.findMany({
          where: inArray(schema.products.registrationId, regIds),
        });
      }
    }

    const juryProfile = await ctx.db.query.juryProfiles.findFirst({
      where: eq(schema.juryProfiles.userId, userId),
    });

    const juryAssignments = await ctx.db.query.cupJuries.findMany({
      where: eq(schema.cupJuries.userId, userId),
    });

    let ratingsGiven: (typeof schema.productRatings.$inferSelect)[] = [];
    let criterionScores: (typeof schema.criterionScores.$inferSelect)[] = [];
    if (juryAssignments.length > 0) {
      const juryIds = juryAssignments.map((j) => j.id);
      ratingsGiven = await ctx.db.query.productRatings.findMany({
        where: inArray(schema.productRatings.juryId, juryIds),
      });

      const ratingIds = ratingsGiven.map((r) => r.id);
      if (ratingIds.length > 0) {
        criterionScores = await ctx.db.query.criterionScores.findMany({
          where: inArray(schema.criterionScores.productRatingId, ratingIds),
        });
      }
    }

    const sessions = await ctx.db.query.sessions.findMany({
      where: eq(schema.sessions.userId, userId),
    });

    const activityLogs = await ctx.db.query.activityLogs.findMany({
      where: eq(schema.activityLogs.userId, userId),
    });

    // Rattachés à l'adresse email et non à l'userId.
    const contactMessages = user
      ? await ctx.db.query.contactMessages.findMany({
          where: eq(schema.contactMessages.senderEmail, user.email),
        })
      : [];

    const newsletterSubscriptions = user
      ? await ctx.db.query.newsletterSubscribers.findMany({
          where: eq(schema.newsletterSubscribers.email, user.email),
        })
      : [];

    return {
      exportedAt: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            role: user.role,
            deletionRequestedAt: user.deletionRequestedAt,
            deletionScheduledFor: user.deletionScheduledFor,
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
            phone: producer.phone,
            address: producer.address,
            createdAt: producer.createdAt,
          }
        : null,
      registrations: registrations.map((reg) => ({
        id: reg.id,
        cupId: reg.cupId,
        status: reg.status,
        totalAmount: reg.totalAmount,
        invoiceNumber: reg.invoiceNumber,
        invoiceGeneratedAt: reg.invoiceGeneratedAt,
        createdAt: reg.createdAt,
      })),
      products: products.map((prod) => ({
        id: prod.id,
        registrationId: prod.registrationId,
        name: prod.name,
        description: prod.description,
        status: prod.status,
        createdAt: prod.createdAt,
      })),
      juryProfile: juryProfile
        ? {
            id: juryProfile.id,
            juryType: juryProfile.juryType,
            expertise: juryProfile.expertise,
            bio: juryProfile.bio,
            displayName: juryProfile.displayName,
            showOnPublicResults: juryProfile.showOnPublicResults,
            createdAt: juryProfile.createdAt,
          }
        : null,
      juryAssignments: juryAssignments.map((j) => ({
        id: j.id,
        cupId: j.cupId,
        isActive: j.isActive,
        joinedAt: j.joinedAt,
      })),
      ratingsGiven: ratingsGiven.map((rating) => ({
        id: rating.id,
        productId: rating.productId,
        juryId: rating.juryId,
        comment: rating.comment,
        submittedAt: rating.submittedAt,
        createdAt: rating.createdAt,
        scores: criterionScores
          .filter((score) => score.productRatingId === rating.id)
          .map((score) => ({
            criterionId: score.criterionId,
            score: score.score,
          })),
      })),
      sessions: sessions.map((s) => ({
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
      activityLogs: activityLogs.map((log) => ({
        action: log.action,
        description: log.description,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      contactMessages: contactMessages.map((m) => ({
        subject: m.subject,
        message: m.message,
        createdAt: m.createdAt,
      })),
      newsletterSubscriptions: newsletterSubscriptions.map((n) => ({
        email: n.email,
        name: n.name,
        status: n.status,
        confirmedAt: n.confirmedAt,
        unsubscribedAt: n.unsubscribedAt,
        createdAt: n.createdAt,
      })),
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
   *
   * L'exécution est portée par `processDueAccountDeletions`, appelé par
   * `scripts/process-account-deletions.ts` (cron hôte).
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
    const scheduledFor = new Date(
      now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
    );

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

/**
 * Exécute les demandes de suppression arrivées à échéance.
 *
 * Sans appelant, `deletion_scheduled_for` n'était qu'une date affichée :
 * l'application promettait une suppression qui n'arrivait jamais.
 */
export async function processDueAccountDeletions(
  db: typeof Database,
  options: { dryRun?: boolean; now?: Date } = {}
): Promise<{ id: string; email: string; scheduledFor: Date | null }[]> {
  const now = options.now ?? new Date();

  const due = await db.query.users.findMany({
    where: and(
      isNotNull(schema.users.deletionScheduledFor),
      lte(schema.users.deletionScheduledFor, now)
    ),
    columns: { id: true, email: true, deletionScheduledFor: true },
  });

  if (!options.dryRun) {
    // Chaque anonymisation est atomique ; on isole les échecs pour qu'un
    // compte en erreur n'empêche pas le traitement des suivants. Le compte
    // resté en échec garde son `deletionScheduledFor` et sera repris au
    // prochain passage.
    for (const user of due) {
      try {
        await anonymizeUserAccount(db, user.id);
      } catch (error) {
        console.error(
          `[rgpd] anonymisation du compte ${user.id} échouée, reprise au prochain passage`,
          error
        );
      }
    }
  }

  return due.map((u) => ({
    id: u.id,
    email: u.email,
    scheduledFor: u.deletionScheduledFor,
  }));
}
