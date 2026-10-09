/**
 * Mise en place des jurys (back-office) : vivier de jurés, ajout direct d'un
 * juré existant, changement de panel, réception des échantillons et
 * couverture des catégories.
 *
 * Procédures fusionnées dans `juryRouter` (jury.listDirectory, etc.).
 */

import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { organizerProcedure } from "~/server/api/trpc";
import { getCupOrThrow } from "~/server/api/helpers/cup";
import {
  alignUserRoleToJury,
  assertOrganizerMayPlaceInPanel,
  isCompetingProducer,
} from "~/server/api/helpers/jury";
import * as schema from "~/server/db/schema";
import type { JuryPanel } from "~/server/db/schema/juries";
import {
  addExistingJurorsSchema,
  juryCoverageSchema,
  listJuryDirectorySchema,
  setJuryPanelSchema,
  setSamplesReceivedSchema,
} from "~/lib/validations/jury-setup";
import { getJuryCoverage, listJuryDirectory } from "~/server/services/jury-setup.service";
import { sendJuryAddedToCupEmail } from "~/server/services/jury-invitation.service";
import { EMAIL_SEND_CONCURRENCY, mapWithConcurrency } from "~/server/services/email";

const panelLabel = (panel: JuryPanel) => (panel === "pro" ? "professionnel" : "public");

export interface AddExistingJurorResult {
  userId: string;
  name: string | null;
  email: string | null;
  /** added : nouveau dans la cup ; updated : déjà membre (réactivé et/ou catégories ajoutées) ; unchanged : rien à faire ; error : refusé. */
  status: "added" | "updated" | "unchanged" | "error";
  cupJuryId: string | null;
  error: string | null;
  notified: boolean;
}

export const jurySetupProcedures = {
  /**
   * Vivier de jurés : tout compte ayant un profil juré ou ayant siégé dans
   * une cup, avec ses cups et son avancement. `cupId` renseigne `inCup`.
   */
  listDirectory: organizerProcedure
    .input(listJuryDirectorySchema)
    .query(async ({ ctx, input }) => {
      if (input.cupId) await getCupOrThrow(ctx.db, input.cupId);
      return listJuryDirectory(ctx.db, input);
    }),

  /**
   * Ajoute directement des jurés existants à une cup, sans invitation : panel
   * choisi par l'organisation, catégories optionnelles, email facultatif.
   * Un juré déjà membre du même panel est réactivé et reçoit les catégories
   * manquantes ; chaque juré refusé est rapporté sans bloquer les autres.
   */
  addExistingJurors: organizerProcedure
    .input(addExistingJurorsSchema)
    .mutation(async ({ ctx, input }) => {
      const cup = await getCupOrThrow(ctx.db, input.cupId);
      const userIds = [...new Set(input.userIds)];
      const categoryIds = [...new Set(input.categoryIds)];

      const categories =
        categoryIds.length > 0
          ? await ctx.db.query.categories.findMany({
              where: and(
                eq(schema.categories.cupId, cup.id),
                inArray(schema.categories.id, categoryIds)
              ),
              columns: { id: true, name: true, sortOrder: true },
            })
          : [];

      if (categories.length !== categoryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certaines catégories ne sont pas valides pour cette cup",
        });
      }

      const [users, profiles, pastMemberships, memberships] = await Promise.all([
        ctx.db.query.users.findMany({
          where: inArray(schema.users.id, userIds),
          columns: { id: true, name: true, email: true },
        }),
        ctx.db.query.juryProfiles.findMany({
          where: inArray(schema.juryProfiles.userId, userIds),
        }),
        ctx.db.query.cupJuries.findMany({
          where: inArray(schema.cupJuries.userId, userIds),
          columns: { userId: true },
        }),
        ctx.db.query.cupJuries.findMany({
          where: and(
            eq(schema.cupJuries.cupId, cup.id),
            inArray(schema.cupJuries.userId, userIds)
          ),
          with: { categoryAssignments: { columns: { categoryId: true } } },
        }),
      ]);

      const userById = new Map(users.map((u) => [u.id, u]));
      const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
      const hasJuried = new Set(pastMemberships.map((m) => m.userId));
      const membershipByUser = new Map(memberships.map((m) => [m.userId, m]));

      const results: AddExistingJurorResult[] = [];
      const accepted: string[] = [];

      for (const userId of userIds) {
        const user = userById.get(userId);
        const base = {
          userId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          cupJuryId: null,
          notified: false,
        };
        const refuse = (error: string) => results.push({ ...base, status: "error", error });

        if (!user) {
          refuse("Utilisateur introuvable");
          continue;
        }
        if (!profileByUser.has(userId) && !hasJuried.has(userId)) {
          refuse("Ce compte n'a jamais été juré : envoyez-lui une invitation");
          continue;
        }
        const membership = membershipByUser.get(userId);
        if (membership && membership.panel !== input.panel) {
          refuse(
            `Déjà juré ${panelLabel(membership.panel)} de cette cup : changez son jury plutôt que de l'ajouter`
          );
          continue;
        }
        if (input.panel === "public" && (await isCompetingProducer(ctx.db, userId, cup.id))) {
          refuse("Concourt à cette édition en tant que producteur : exclu du jury public");
          continue;
        }
        accepted.push(userId);
      }

      const now = new Date();
      const written = new Map<string, { cupJuryId: string; status: "added" | "updated" | "unchanged" }>();

      if (accepted.length > 0) {
        await ctx.db.transaction(async (tx) => {
          for (const userId of accepted) {
            // Profil juré : créé s'il manque, passé en « pro » pour le panel
            // pro (comme à l'acceptation d'une invitation), jamais rétrogradé.
            let profile = profileByUser.get(userId);
            if (!profile) {
              const [created] = await tx
                .insert(schema.juryProfiles)
                .values({ id: nanoid(), userId, juryType: input.panel, createdAt: now, updatedAt: now })
                .returning();
              profile = created;
            } else if (input.panel === "pro" && profile.juryType !== "pro") {
              await tx
                .update(schema.juryProfiles)
                .set({ juryType: "pro", updatedAt: now })
                .where(eq(schema.juryProfiles.id, profile.id));
            }

            const membership = membershipByUser.get(userId);
            let cupJuryId: string;
            let changed = false;

            if (membership) {
              cupJuryId = membership.id;
              if (!membership.isActive || !membership.juryProfileId) {
                await tx
                  .update(schema.cupJuries)
                  .set({
                    isActive: true,
                    juryProfileId: membership.juryProfileId ?? profile?.id ?? null,
                    updatedAt: now,
                  })
                  .where(eq(schema.cupJuries.id, membership.id));
                changed = changed || !membership.isActive;
              }
            } else {
              cupJuryId = nanoid();
              await tx.insert(schema.cupJuries).values({
                id: cupJuryId,
                cupId: cup.id,
                userId,
                juryProfileId: profile?.id ?? null,
                panel: input.panel,
                isActive: true,
                joinedAt: now,
              });
            }

            const already = new Set(membership?.categoryAssignments.map((a) => a.categoryId) ?? []);
            const missing = categoryIds.filter((id) => !already.has(id));
            if (missing.length > 0) {
              await tx.insert(schema.juryCategoryAssignments).values(
                missing.map((categoryId) => ({
                  id: nanoid(),
                  cupJuryId,
                  categoryId,
                  assignedBy: ctx.userId,
                  assignedAt: now,
                }))
              );
              changed = true;
            }

            await alignUserRoleToJury(tx, userId);

            written.set(userId, {
              cupJuryId,
              status: membership ? (changed ? "updated" : "unchanged") : "added",
            });
          }
        });
      }

      // Emails après validation de la transaction, pour les seuls jurés dont
      // la situation a changé, en respectant leur préférence de notification.
      const categoryNames = categories
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.name);
      const toNotify = input.notify
        ? [...written.entries()]
            .filter(([userId, w]) => {
              if (w.status === "unchanged") return false;
              return profileByUser.get(userId)?.notifyOnAssignment ?? true;
            })
            .map(([userId]) => userId)
        : [];

      const sent = await mapWithConcurrency(toNotify, EMAIL_SEND_CONCURRENCY, async (userId) => {
        const result = await sendJuryAddedToCupEmail({
          userId,
          cupId: cup.id,
          panel: input.panel,
          categoryNames,
        });
        return [userId, result.success] as const;
      });
      const notified = new Set(sent.filter(([, ok]) => ok).map(([userId]) => userId));

      for (const userId of accepted) {
        const user = userById.get(userId)!;
        const w = written.get(userId)!;
        results.push({
          userId,
          name: user.name,
          email: user.email,
          status: w.status,
          cupJuryId: w.cupJuryId,
          error: null,
          notified: notified.has(userId),
        });
      }

      // Ordre de la demande.
      const order = new Map(userIds.map((id, i) => [id, i]));
      results.sort((a, b) => (order.get(a.userId) ?? 0) - (order.get(b.userId) ?? 0));

      return {
        added: results.filter((r) => r.status === "added").length,
        updated: results.filter((r) => r.status === "updated").length,
        unchanged: results.filter((r) => r.status === "unchanged").length,
        failed: results.filter((r) => r.status === "error").length,
        emailsSent: notified.size,
        results,
      };
    }),

  /**
   * Change le jury (panel) d'un juré dans une cup, tant qu'il n'a soumis
   * aucune note dans cette cup. Ses brouillons sont supprimés : ils portent
   * sur la grille de critères de l'ancien panel.
   */
  setPanel: organizerProcedure.input(setJuryPanelSchema).mutation(async ({ ctx, input }) => {
    const cupJury = await ctx.db.query.cupJuries.findFirst({
      where: eq(schema.cupJuries.id, input.cupJuryId),
    });

    if (!cupJury) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Jury non trouve" });
    }

    if (cupJury.panel === input.panel) {
      return { success: true, changed: false, panel: cupJury.panel, draftsDeleted: 0 };
    }

    const [submitted] = await ctx.db
      .select({ count: count() })
      .from(schema.productRatings)
      .where(
        and(
          eq(schema.productRatings.juryId, cupJury.id),
          isNotNull(schema.productRatings.submittedAt)
        )
      );
    const submittedCount = submitted?.count ?? 0;

    if (submittedCount > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Ce juré a déjà soumis ${submittedCount} note(s) dans cette cup : son jury ne peut plus être changé.`,
      });
    }

    await assertOrganizerMayPlaceInPanel(ctx.db, cupJury.userId, cupJury.cupId, input.panel);

    const now = new Date();
    const draftsDeleted = await ctx.db.transaction(async (tx) => {
      const drafts = await tx
        .delete(schema.productRatings)
        .where(
          and(eq(schema.productRatings.juryId, cupJury.id), isNull(schema.productRatings.submittedAt))
        )
        .returning({ id: schema.productRatings.id });

      await tx
        .update(schema.cupJuries)
        .set({ panel: input.panel, updatedAt: now })
        .where(eq(schema.cupJuries.id, cupJury.id));

      // Même règle qu'à l'acceptation d'une invitation : un juré pro a un profil pro.
      if (input.panel === "pro") {
        await tx
          .update(schema.juryProfiles)
          .set({ juryType: "pro", updatedAt: now })
          .where(eq(schema.juryProfiles.userId, cupJury.userId));
      }

      return drafts.length;
    });

    return { success: true, changed: true, panel: input.panel, draftsDeleted };
  }),

  /**
   * Pose (ou retire) la réception des échantillons pour des jurés d'une cup.
   * Une date déjà posée n'est pas écrasée.
   */
  setSamplesReceived: organizerProcedure
    .input(setSamplesReceivedSchema)
    .mutation(async ({ ctx, input }) => {
      const cupJuryIds = [...new Set(input.cupJuryIds)];

      const juries = await ctx.db.query.cupJuries.findMany({
        where: and(
          eq(schema.cupJuries.cupId, input.cupId),
          inArray(schema.cupJuries.id, cupJuryIds)
        ),
        columns: { id: true },
      });

      if (juries.length !== cupJuryIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains jurés ne sont pas valides pour cette cup",
        });
      }

      const now = new Date();
      const updated = await ctx.db
        .update(schema.cupJuries)
        .set({ samplesReceivedAt: input.received ? now : null, updatedAt: now })
        .where(
          and(
            inArray(schema.cupJuries.id, cupJuryIds),
            input.received
              ? isNull(schema.cupJuries.samplesReceivedAt)
              : isNotNull(schema.cupJuries.samplesReceivedAt)
          )
        )
        .returning({ id: schema.cupJuries.id });

      return { success: true, received: input.received, updated: updated.length };
    }),

  /**
   * Couverture des catégories d'une cup par les deux jurys : objectifs,
   * jurés pro nominatifs, effectifs publics, codes, échantillons, avancement
   * et statut (critical / incomplete / ready).
   */
  getCoverage: organizerProcedure.input(juryCoverageSchema).query(async ({ ctx, input }) => {
    const cup = await getCupOrThrow(ctx.db, input.cupId);
    return getJuryCoverage(ctx.db, cup);
  }),
};
