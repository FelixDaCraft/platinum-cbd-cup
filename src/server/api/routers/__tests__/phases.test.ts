import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  updatePhaseDatesSchema,
  getPhaseStatus,
  getEditableDates,
  canEditDate,
  formatPhaseDate,
} from "~/lib/validations/phases";
import type { CupStatus } from "~/server/db/schema/cups";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  /**
   * Lignes que chaque UPDATE ... RETURNING rend, dans l'ordre d'appel.
   * `processDuePhaseTransitions` ne lit plus les cups avant de les écrire :
   * c'est l'UPDATE conditionnel lui-même qui dit lesquelles ont bougé.
   */
  updateReturns: [] as { id: string; name: string }[][],
}));

const { updates, updateReturns } = dbState;

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        return {
          where: () => ({
            returning: () => {
              const rows = dbState.updateReturns.shift() ?? [];
              // Une entrée par cup réellement déplacée : l'UPDATE groupé n'est
              // compté que s'il a touché au moins une ligne.
              for (let i = 0; i < rows.length; i++) dbState.updates.push(values);
              return Promise.resolve(rows);
            },
            then: (resolve: (v: unknown) => unknown) => {
              dbState.updates.push(values);
              return Promise.resolve(undefined).then(resolve);
            },
          }),
        };
      },
    }),
  },
}));

beforeEach(() => {
  updates.length = 0;
  updateReturns.length = 0;
});

describe("Phases — validations, helpers et automatisation", () => {
  describe("Input Validation - updatePhaseDatesSchema", () => {
    it("rejects missing cupId", () => {
      const result = updatePhaseDatesSchema.safeParse({
        registrationOpenAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty cupId", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "",
        registrationOpenAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("requis");
      }
    });

    it("accepts all dates as null (manual transitions)", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: null,
        registrationCloseAt: null,
        ratingStartAt: null,
        ratingEndAt: null,
      });

      expect(result.success).toBe(true);
    });

    it("accepts partial dates (only registration)", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-01-15"),
        registrationCloseAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(true);
    });

    it("rejects registrationOpenAt > registrationCloseAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-02-15"),
        registrationCloseAt: new Date("2026-01-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("ouverture");
        expect(result.error.issues[0]?.path).toContain("registrationCloseAt");
      }
    });

    it("rejects ratingStartAt > ratingEndAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        ratingStartAt: new Date("2026-03-15"),
        ratingEndAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("début");
        expect(result.error.issues[0]?.path).toContain("ratingEndAt");
      }
    });

    it("rejects registrationCloseAt > ratingStartAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationCloseAt: new Date("2026-03-15"),
        ratingStartAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("clôture");
        expect(result.error.issues[0]?.path).toContain("ratingStartAt");
      }
    });

    it("accepts registrationCloseAt === ratingStartAt (same moment)", () => {
      const sameDate = new Date("2026-02-15T12:00:00Z");
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationCloseAt: sameDate,
        ratingStartAt: sameDate,
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid timeline: open < close <= ratingStart < ratingEnd", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-01-15"),
        registrationCloseAt: new Date("2026-02-15"),
        ratingStartAt: new Date("2026-02-20"),
        ratingEndAt: new Date("2026-02-28"),
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Phase Status Determination - getPhaseStatus", () => {
    const createCup = (overrides: Partial<{
      status: CupStatus;
      registrationOpenAt: Date | null;
      registrationCloseAt: Date | null;
      ratingStartAt: Date | null;
      ratingEndAt: Date | null;
    }> = {}) => ({
      status: "draft" as CupStatus,
      registrationOpenAt: null,
      registrationCloseAt: null,
      ratingStartAt: null,
      ratingEndAt: null,
      ...overrides,
    });

    it("returns draft for draft status", () => {
      const cup = createCup({ status: "draft" });
      expect(getPhaseStatus(cup)).toBe("draft");
    });

    it("returns completed for completed status", () => {
      const cup = createCup({ status: "completed" });
      expect(getPhaseStatus(cup)).toBe("completed");
    });

    it("returns rating for rating status", () => {
      const cup = createCup({ status: "rating" });
      expect(getPhaseStatus(cup)).toBe("rating");
    });

    it("returns closed for registration_closed status", () => {
      const cup = createCup({ status: "registration_closed" });
      expect(getPhaseStatus(cup)).toBe("closed");
    });

    it("returns pending when published with future registrationOpenAt", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const cup = createCup({
        status: "published",
        registrationOpenAt: futureDate,
      });
      expect(getPhaseStatus(cup)).toBe("pending");
    });

    it("returns registration when published with past/no registrationOpenAt", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const cup = createCup({
        status: "published",
        registrationOpenAt: pastDate,
      });
      expect(getPhaseStatus(cup)).toBe("registration");
    });

    it("returns registration when published with null registrationOpenAt", () => {
      const cup = createCup({ status: "published" });
      expect(getPhaseStatus(cup)).toBe("registration");
    });
  });

  describe("Editable Dates by Status - getEditableDates", () => {
    it("all dates editable in draft", () => {
      const editable = getEditableDates("draft");
      expect(editable).toContain("registrationOpenAt");
      expect(editable).toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(4);
    });

    it("registrationOpenAt locked in published", () => {
      const editable = getEditableDates("published");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(3);
    });

    it("registration dates locked in registration_closed", () => {
      const editable = getEditableDates("registration_closed");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).not.toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(2);
    });

    it("only ratingEndAt editable in rating", () => {
      const editable = getEditableDates("rating");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).not.toContain("registrationCloseAt");
      expect(editable).not.toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(1);
    });

    it("no dates editable when completed", () => {
      const editable = getEditableDates("completed");
      expect(editable).toHaveLength(0);
    });
  });

  describe("Can Edit Date - canEditDate", () => {
    it("returns true for all dates in draft", () => {
      expect(canEditDate("draft", "registrationOpenAt")).toBe(true);
      expect(canEditDate("draft", "registrationCloseAt")).toBe(true);
      expect(canEditDate("draft", "ratingStartAt")).toBe(true);
      expect(canEditDate("draft", "ratingEndAt")).toBe(true);
    });

    it("returns false for locked dates", () => {
      expect(canEditDate("published", "registrationOpenAt")).toBe(false);
      expect(canEditDate("registration_closed", "registrationOpenAt")).toBe(false);
      expect(canEditDate("registration_closed", "registrationCloseAt")).toBe(false);
      expect(canEditDate("rating", "ratingStartAt")).toBe(false);
      expect(canEditDate("completed", "ratingEndAt")).toBe(false);
    });
  });

  describe("Format Phase Date - formatPhaseDate", () => {
    it("returns 'Non définie' for null date", () => {
      expect(formatPhaseDate(null)).toBe("Non définie");
    });

    it("formats date in French locale", () => {
      const date = new Date("2026-02-15T14:30:00Z");
      const formatted = formatPhaseDate(date);
      // Should contain date and time in French format
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).not.toBe("Non definie");
    });
  });

  // ---------------------------------------------------------------------
  // Automatisation des phases (phase-automation.ts)
  //
  // Remplace les blocs « Phase Automation Security » et « Phase Automation
  // Transitions » d'origine, qui recalculaient la condition dans le test
  // (`expect(shouldTransition).toBe(true)`) sans jamais appeler la
  // procédure. checkPhaseTransitions est une procédure PUBLIQUE : son seul
  // garde est CRON_SECRET, d'où la couverture ci-dessous.
  // ---------------------------------------------------------------------
  describe("Automatisation des phases", () => {
    const CRON_SECRET = "secret-de-cron-pour-les-tests";
    let previousSecret: string | undefined;

    beforeEach(() => {
      vi.clearAllMocks();
      previousSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = CRON_SECRET;
    });

    afterEach(() => {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previousSecret;
      }
    });

    async function createCaller() {
      const { phaseAutomationRouter } = await import("../phase-automation");
      const { db } = await import("~/server/db");

      return phaseAutomationRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);
    }

    async function codeOf(fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        return (error as TRPCError).code;
      }
      throw new Error("La procédure aurait dû lever une erreur");
    }

    /** Les trois UPDATE de transition, dans l'ordre du routeur. */
    async function queueCupBatches(
      toClose: { id: string; name: string }[],
      toRate: { id: string; name: string }[],
      toComplete: { id: string; name: string }[]
    ) {
      updateReturns.length = 0;
      updateReturns.push(toClose, toRate, toComplete);
    }

    it("refuse un secret invalide", async () => {
      await queueCupBatches([], [], []);
      const caller = await createCaller();

      expect(
        await codeOf(() => caller.checkPhaseTransitions({ cronSecret: "mauvais" }))
      ).toBe("UNAUTHORIZED");
      expect(updates).toHaveLength(0);
    });

    // Un secret vide ne doit pas ouvrir la porte : c'est exactement ce qu'une
    // variable d'environnement oubliée produit côté appelant.
    it("refuse un secret vide", async () => {
      await queueCupBatches([], [], []);
      const caller = await createCaller();

      expect(await codeOf(() => caller.checkPhaseTransitions({ cronSecret: "" }))).toBe(
        "UNAUTHORIZED"
      );
    });

    it("refuse un préfixe du secret attendu", async () => {
      await queueCupBatches([], [], []);
      const caller = await createCaller();

      expect(
        await codeOf(() =>
          caller.checkPhaseTransitions({ cronSecret: CRON_SECRET.slice(0, -1) })
        )
      ).toBe("UNAUTHORIZED");
    });

    // Sans CRON_SECRET côté serveur, la procédure doit se fermer, pas
    // s'ouvrir à tout le monde.
    it("refuse tout appel quand CRON_SECRET n'est pas configuré", async () => {
      delete process.env.CRON_SECRET;
      await queueCupBatches([], [], []);
      const caller = await createCaller();

      expect(
        await codeOf(() => caller.checkPhaseTransitions({ cronSecret: CRON_SECRET }))
      ).toBe("UNAUTHORIZED");
      expect(updates).toHaveLength(0);
    });

    it("n'effectue aucune transition quand aucune date n'est atteinte", async () => {
      await queueCupBatches([], [], []);
      const caller = await createCaller();

      const result = await caller.checkPhaseTransitions({ cronSecret: CRON_SECRET });

      expect(result.transitionsCount).toBe(0);
      expect(result.transitions).toEqual([]);
      expect(updates).toHaveLength(0);
    });

    it("enchaîne les trois transitions et les rapporte", async () => {
      await queueCupBatches(
        [{ id: "cup-a", name: "Cup A" }],
        [{ id: "cup-b", name: "Cup B" }],
        [{ id: "cup-c", name: "Cup C" }]
      );
      const caller = await createCaller();

      const result = await caller.checkPhaseTransitions({ cronSecret: CRON_SECRET });

      expect(result.transitionsCount).toBe(3);
      expect(result.transitions).toEqual([
        { cupId: "cup-a", from: "published", to: "registration_closed" },
        { cupId: "cup-b", from: "registration_closed", to: "rating" },
        { cupId: "cup-c", from: "rating", to: "completed" },
      ]);
      expect(updates.map((u) => u.status)).toEqual([
        "registration_closed",
        "rating",
        "completed",
      ]);
    });

    it("traite toutes les cups d'un même lot", async () => {
      await queueCupBatches(
        [
          { id: "cup-a", name: "Cup A" },
          { id: "cup-b", name: "Cup B" },
        ],
        [],
        []
      );
      const caller = await createCaller();

      const result = await caller.checkPhaseTransitions({ cronSecret: CRON_SECRET });

      expect(result.transitionsCount).toBe(2);
      expect(updates).toHaveLength(2);
    });
  });
});
