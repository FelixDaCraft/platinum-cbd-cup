import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import type { db as Database } from "~/server/db";
import { and, eq, isNotNull, lte } from "drizzle-orm";

/**
 * Comparaison a temps constant du secret de cron.
 *
 * Les deux valeurs sont hachees avant comparaison pour que `timingSafeEqual`
 * recoive toujours deux buffers de meme longueur (il leve une exception sinon,
 * ce qui divulguerait la longueur du secret attendu).
 */
function cronSecretMatches(provided: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest()
  );
}

/**
 * Routeur d'automatisation des phases.
 *
 * Point d'entrée HTTP du traitement planifié, protégé par CRON_SECRET. Le
 * travail lui-même vit dans `processDuePhaseTransitions` (plus bas), qu'un
 * script d'hôte peut appeler directement. La mention « Trigger.dev » d'origine
 * était un vestige du SaaS CupMetrics : ce déploiement n'a pas d'ordonnanceur
 * applicatif.
 */
export const phaseAutomationRouter = createTRPCRouter({
  /**
   * Check and execute phase transitions for all cups with configured dates
   * This procedure should be called periodically by a cron job
   *
   * Transitions:
   * - published -> registration_closed (when registrationCloseAt is reached)
   * - registration_closed -> rating (when ratingStartAt is reached)
   * - rating -> completed (when ratingEndAt is reached)
   *
   * Note: Notifications to organizers are TODO for post-MVP
   *
   * @security Requires CRON_SECRET in request to prevent unauthorized access
   */
  checkPhaseTransitions: publicProcedure
    .input(z.object({ cronSecret: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Validate cron secret to prevent unauthorized access
      // CRON_SECRET n'est pas declare dans src/env.js : il echappe donc a la
      // validation de demarrage et son absence ne se voit qu'ici.
      const expectedSecret = process.env.CRON_SECRET;
      if (!expectedSecret) {
        console.error(
          "[Phase Automation] CRON_SECRET absent : aucune transition automatique ne peut s'executer."
        );
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid cron secret",
        });
      }

      if (!cronSecretMatches(input.cronSecret, expectedSecret)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid cron secret",
        });
      }
      return processDuePhaseTransitions(ctx.db);
    }),
});

/** Une transition de phase, telle que la rapporte le traitement planifié. */
export type PhaseTransition = { cupId: string; from: string; to: string };

/**
 * Fait avancer les cups dont la date de phase est échue.
 *
 * Exporté hors de la procédure tRPC pour qu'un planificateur puisse l'appeler
 * directement — comme `processDueAccountDeletions` — sans avoir à présenter
 * CRON_SECRET ni à monter un contexte tRPC. Sans appelant, les dates saisies
 * dans config/phases n'ont aucun effet et l'organisateur doit changer chaque
 * statut à la main.
 */
export async function processDuePhaseTransitions(
  db: typeof Database,
  options: { now?: Date } = {}
): Promise<{ transitionsCount: number; transitions: PhaseTransition[]; executedAt: Date }> {
  const now = options.now ?? new Date();
  const transitions: PhaseTransition[] = [];

  // Chaque transition est conditionnée au statut de départ dans le WHERE de
  // l'UPDATE : deux exécutions concurrentes du planificateur (ou un
  // recouvrement avec une action manuelle de l'organisateur) ne peuvent pas
  // faire sauter une phase.
  const steps = [
    {
      from: "published" as const,
      to: "registration_closed" as const,
      dateColumn: schema.cups.registrationCloseAt,
      label: "registration closed automatically",
    },
    {
      from: "registration_closed" as const,
      to: "rating" as const,
      dateColumn: schema.cups.ratingStartAt,
      label: "rating phase started automatically",
    },
    {
      from: "rating" as const,
      to: "completed" as const,
      dateColumn: schema.cups.ratingEndAt,
      label: "cup completed automatically",
    },
  ];

  for (const step of steps) {
    const moved = await db
      .update(schema.cups)
      .set({ status: step.to, updatedAt: now })
      .where(
        and(
          eq(schema.cups.status, step.from),
          isNotNull(step.dateColumn),
          lte(step.dateColumn, now)
        )
      )
      .returning({ id: schema.cups.id, name: schema.cups.name });

    for (const cup of moved) {
      transitions.push({ cupId: cup.id, from: step.from, to: step.to });
      console.log(`[Phase Automation] Cup ${cup.id} (${cup.name}): ${step.label}`);
      // TODO (post-MVP): Send notification to organizer via Resend
    }
  }

  return {
    transitionsCount: transitions.length,
    transitions,
    executedAt: now,
  };
}
