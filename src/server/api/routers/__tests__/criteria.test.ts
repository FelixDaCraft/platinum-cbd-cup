import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  createCriterionSchema,
  updateCriterionSchema,
  reorderCriteriaSchema,
  duplicateCriteriaSchema,
  initializeDefaultCriteriaSchema,
  DEFAULT_CRITERIA,
  formatCoefficient,
  calculateWeightedScore,
} from "~/lib/validations/criteria";

vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "test_criterion_id") }));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

/**
 * État de la base simulée (voir category.test.ts pour le détail du montage).
 *
 * ~/server/db/schema n'est délibérément PAS simulé : le routeur passe les
 * tables réelles à `eq()` de drizzle-orm, qui a besoin de vraies colonnes.
 * L'ancien `vi.mock("~/server/db/schema")` est ce qui rendait impossible
 * l'appel du routeur, d'où des tests qui se contentaient de recopier la
 * règle métier.
 */
const dbState = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  updates: [] as Record<string, unknown>[],
  deleted: [] as true[],
  inserted: [] as unknown[],
}));

const { selectResults, updates, deleted, inserted } = dbState;

vi.mock("~/server/db", () => {
  const selectChain = () => {
    const chain = {
      from: () => chain,
      where: () => {
        const rows = Promise.resolve(dbState.selectResults.shift() ?? []);
        return Object.assign(rows, { groupBy: () => rows });
      },
    };
    return chain;
  };

  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
        cups: { findFirst: vi.fn() },
        categories: { findFirst: vi.fn(), findMany: vi.fn() },
        ratingCriteria: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      select: selectChain,
      insert: () => ({
        values: (values: unknown) => {
          dbState.inserted.push(values);
          return { returning: () => Promise.resolve([values]) };
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          dbState.updates.push(values);
          return {
            where: () => ({
              returning: () => Promise.resolve([values]),
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve(undefined).then(resolve),
            }),
          };
        },
      }),
      delete: () => ({
        where: () => {
          dbState.deleted.push(true);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

beforeEach(() => {
  selectResults.length = 0;
  updates.length = 0;
  deleted.length = 0;
  inserted.length = 0;
});

describe("Criteria Router", () => {
  describe("Input Validation - createCriterionSchema", () => {
    it("rejects missing categoryId", () => {
      const result = createCriterionSchema.safeParse({
        name: "Aspect visuel",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("categoryId");
      }
    });

    it("rejects missing panel", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Arôme",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an unknown panel", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "invités",
        name: "Arôme",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("requis");
      }
    });

    it("rejects name too long (over 100 chars)", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "a".repeat(101),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("trop long");
      }
    });

    it("rejects coefficient < 1", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Test",
        coefficient: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("minimum");
      }
    });

    it("rejects coefficient > 10", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Test",
        coefficient: 11,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("maximum");
      }
    });

    it("rejects non-integer coefficient", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Test",
        coefficient: 1.5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("entier");
      }
    });

    it("accepts description as optional", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Aspect visuel",
      });

      expect(result.success).toBe(true);
    });

    it("rejects description too long (over 500 chars)", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Test",
        description: "a".repeat(501),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("trop longue");
      }
    });

    it("accepts valid criterion with all fields", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Aspect visuel",
        description: "Apparence générale du produit",
        coefficient: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Aspect visuel");
        expect(result.data.coefficient).toBe(2);
      }
    });

    it("uses default coefficient of 1 when not provided", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        name: "Test",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coefficient).toBe(1);
      }
    });
  });

  describe("Input Validation - updateCriterionSchema", () => {
    it("rejects missing criterionId", () => {
      const result = updateCriterionSchema.safeParse({
        name: "Updated name",
      });

      expect(result.success).toBe(false);
    });

    it("accepts partial update with only name", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        name: "Updated name",
      });

      expect(result.success).toBe(true);
    });

    it("accepts partial update with only coefficient", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        coefficient: 5,
      });

      expect(result.success).toBe(true);
    });

    it("accepts null description (to clear)", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        description: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - reorderCriteriaSchema", () => {
    it("rejects missing categoryId", () => {
      const result = reorderCriteriaSchema.safeParse({
        criterionIds: ["crit-1", "crit-2"],
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty criterionIds array", () => {
      const result = reorderCriteriaSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        criterionIds: [],
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid reorder input", () => {
      const result = reorderCriteriaSchema.safeParse({
        categoryId: "cat-1",
        panel: "pro",
        criterionIds: ["crit-1", "crit-2", "crit-3"],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - duplicateCriteriaSchema", () => {
    it("rejects missing sourceCategoryId", () => {
      const result = duplicateCriteriaSchema.safeParse({
        targetCategoryId: "cat-2",
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing targetCategoryId", () => {
      const result = duplicateCriteriaSchema.safeParse({
        sourceCategoryId: "cat-1",
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid duplicate input", () => {
      const result = duplicateCriteriaSchema.safeParse({
        sourceCategoryId: "cat-1",
        targetCategoryId: "cat-2",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - initializeDefaultCriteriaSchema", () => {
    it("rejects missing categoryId", () => {
      const result = initializeDefaultCriteriaSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("accepts valid categoryId", () => {
      const result = initializeDefaultCriteriaSchema.safeParse({
        categoryId: "cat-1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Constants - DEFAULT_CRITERIA", () => {
    it("has 4 default criteria", () => {
      expect(DEFAULT_CRITERIA).toHaveLength(4);
    });

    it("has correct default values", () => {
      expect(DEFAULT_CRITERIA[0]).toMatchObject({
        name: "Aspect visuel",
        coefficient: 1,
      });
      expect(DEFAULT_CRITERIA[1]).toMatchObject({
        name: "Arôme",
        coefficient: 2,
      });
      expect(DEFAULT_CRITERIA[2]).toMatchObject({
        name: "Goût",
        coefficient: 2,
      });
      expect(DEFAULT_CRITERIA[3]).toMatchObject({
        name: "Effet",
        coefficient: 2,
      });
    });

    it("all criteria have valid coefficients (1-10)", () => {
      for (const criterion of DEFAULT_CRITERIA) {
        expect(criterion.coefficient).toBeGreaterThanOrEqual(1);
        expect(criterion.coefficient).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("Helpers - formatCoefficient", () => {
    it("formats coefficient with multiplication sign", () => {
      expect(formatCoefficient(1)).toBe("×1");
      expect(formatCoefficient(5)).toBe("×5");
      expect(formatCoefficient(10)).toBe("×10");
    });
  });

  describe("Helpers - calculateWeightedScore", () => {
    it("calculates correct weighted average", () => {
      // Example from story:
      // Aspect visuel: 7 × 1 = 7
      // Arôme: 8 × 2 = 16
      // Goût: 9 × 2 = 18
      // Effet: 7 × 2 = 14
      // Total: 55 / 7 = 7.857...
      const ratings = [
        { criterionCoefficient: 1, score: 7 },
        { criterionCoefficient: 2, score: 8 },
        { criterionCoefficient: 2, score: 9 },
        { criterionCoefficient: 2, score: 7 },
      ];

      const result = calculateWeightedScore(ratings);

      expect(result).toBeCloseTo(7.857, 2);
    });

    it("returns 0 for empty ratings", () => {
      expect(calculateWeightedScore([])).toBe(0);
    });

    it("handles single rating", () => {
      const ratings = [{ criterionCoefficient: 1, score: 8 }];

      expect(calculateWeightedScore(ratings)).toBe(8);
    });

    it("handles uniform coefficients (simple average)", () => {
      const ratings = [
        { criterionCoefficient: 1, score: 6 },
        { criterionCoefficient: 1, score: 8 },
        { criterionCoefficient: 1, score: 10 },
      ];

      expect(calculateWeightedScore(ratings)).toBe(8);
    });

    it("handles high coefficient weights correctly", () => {
      // criterion1: 5 × 1 = 5
      // criterion2: 10 × 10 = 100
      // Total: 105 / 11 = 9.545...
      const ratings = [
        { criterionCoefficient: 1, score: 5 },
        { criterionCoefficient: 10, score: 10 },
      ];

      expect(calculateWeightedScore(ratings)).toBeCloseTo(9.545, 2);
    });
  });


  // ---------------------------------------------------------------------
  // Procédures du routeur
  //
  // Remplace les blocs « Business Logic - … », « Multi-tenancy Validation »
  // et « Integration - … » d'origine : aucun n'importait criteria.ts, tous
  // recopiaient la règle dans le test avant de la comparer à elle-même. Les
  // critères et leurs coefficients déterminent le classement final : une
  // modification en pleine notation fausserait le palmarès.
  // ---------------------------------------------------------------------
  describe("Procédures", () => {
    async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      if (row === null) {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        return;
      }

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { id: "session-1" },
      } as never);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
    }

    const asOrganizer = () => signIn({ isAdmin: false, role: "organizer" });
    const asProducer = () => signIn({ isAdmin: false, role: "producer" });
    const asAnonymous = () => signIn(null);

    /** Catégorie rattachée à une cup du statut demandé. */
    function categoryWithCup(status: string, overrides: Record<string, unknown> = {}) {
      return {
        id: "cat-1",
        name: "Indoor",
        cupId: "cup-1",
        cup: { id: "cup-1", status, ratingScale: "0-20" },
        ...overrides,
      };
    }

    async function createCaller() {
      const { criteriaRouter } = await import("../criteria");
      const { db } = await import("~/server/db");

      return criteriaRouter.createCaller({ headers: new Headers(), db } as never);
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

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("refuse un appelant anonyme sur chaque procédure", async () => {
      await asAnonymous();
      const caller = await createCaller();

      expect(
        await codeOf(() => caller.getCategoryCriteria({ categoryId: "cat-1" }))
      ).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() => caller.create({ categoryId: "cat-1", panel: "pro", name: "Arôme" }))
      ).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.delete({ criterionId: "cri-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(
        await codeOf(() =>
          caller.reorder({ categoryId: "cat-1", panel: "pro", criterionIds: ["cri-1"] })
        )
      ).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() => caller.initializeDefaultCriteria({ categoryId: "cat-1" }))
      ).toBe("UNAUTHORIZED");
    });

    it("refuse un producteur authentifié sur chaque procédure", async () => {
      await asProducer();
      const caller = await createCaller();

      expect(
        await codeOf(() => caller.getCategoryCriteria({ categoryId: "cat-1" }))
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(() => caller.create({ categoryId: "cat-1", panel: "pro", name: "Arôme" }))
      ).toBe("FORBIDDEN");
      expect(await codeOf(() => caller.delete({ criterionId: "cri-1" }))).toBe(
        "FORBIDDEN"
      );
      expect(inserted).toHaveLength(0);
      expect(deleted).toHaveLength(0);
    });

    it("renvoie NOT_FOUND quand la catégorie n'existe pas", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.getCategoryCriteria({ categoryId: "inconnue" }))
      ).toBe("NOT_FOUND");
    });

    it("expose canEdit=false dès que la notation a commencé", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();

      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      await expect(
        caller.getCategoryCriteria({ categoryId: "cat-1" })
      ).resolves.toMatchObject({ canEdit: true });

      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("rating") as never
      );
      await expect(
        caller.getCategoryCriteria({ categoryId: "cat-1" })
      ).resolves.toMatchObject({ canEdit: false });
    });

    it.each(["rating", "completed"])(
      "refuse toute modification de critère quand la cup est en %s",
      async (status) => {
        await asOrganizer();
        const { db } = await import("~/server/db");
        vi.mocked(db.query.categories.findFirst).mockResolvedValue(
          categoryWithCup(status) as never
        );
        vi.mocked(db.query.ratingCriteria.findFirst).mockResolvedValue({
          id: "cri-1",
          categoryId: "cat-1",
          category: categoryWithCup(status),
        } as never);

        const caller = await createCaller();

        expect(
          await codeOf(() =>
            caller.create({ categoryId: "cat-1", panel: "pro", name: "Arôme", coefficient: 2 })
          )
        ).toBe("BAD_REQUEST");
        expect(
          await codeOf(() => caller.update({ criterionId: "cri-1", name: "Arôme" }))
        ).toBe("BAD_REQUEST");
        expect(await codeOf(() => caller.delete({ criterionId: "cri-1" }))).toBe(
          "BAD_REQUEST"
        );
        expect(
          await codeOf(() =>
            caller.reorder({ categoryId: "cat-1", panel: "pro", criterionIds: ["cri-1"] })
          )
        ).toBe("BAD_REQUEST");
        expect(
          await codeOf(() => caller.initializeDefaultCriteria({ categoryId: "cat-1" }))
        ).toBe("BAD_REQUEST");

        expect(inserted).toHaveLength(0);
        expect(updates).toHaveLength(0);
        expect(deleted).toHaveLength(0);
      }
    );

    it.each(["draft", "published", "registration_closed"])(
      "autorise la suppression d'un critère quand la cup est en %s",
      async (status) => {
        await asOrganizer();
        const { db } = await import("~/server/db");
        vi.mocked(db.query.ratingCriteria.findFirst).mockResolvedValue({
          id: "cri-1",
          categoryId: "cat-1",
          category: categoryWithCup(status),
        } as never);

        const caller = await createCaller();
        await expect(caller.delete({ criterionId: "cri-1" })).resolves.toEqual({
          success: true,
        });
        expect(deleted).toHaveLength(1);
      }
    );

    it("refuse un réordonnancement incomplet ou contenant un critère étranger", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1" },
        { id: "cri-2" },
      ] as never);

      const caller = await createCaller();

      // Critère étranger à la catégorie.
      expect(
        await codeOf(() =>
          caller.reorder({ categoryId: "cat-1", panel: "pro", criterionIds: ["cri-1", "cri-3"] })
        )
      ).toBe("BAD_REQUEST");

      // Liste partielle : réordonner sans tout inclure laisserait des rangs
      // en double.
      expect(
        await codeOf(() =>
          caller.reorder({ categoryId: "cat-1", panel: "pro", criterionIds: ["cri-1"] })
        )
      ).toBe("BAD_REQUEST");

      expect(updates).toHaveLength(0);
    });

    it("applique le rang de chaque critère selon sa position", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1" },
        { id: "cri-2" },
        { id: "cri-3" },
      ] as never);

      const caller = await createCaller();
      await caller.reorder({
        categoryId: "cat-1",
        panel: "pro",
        criterionIds: ["cri-3", "cri-1", "cri-2"],
      });

      expect(updates.map((u) => u.sortOrder)).toEqual([0, 1, 2]);
    });

    it("n'initialise pas deux fois les critères par défaut", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      // Les deux jurys ont déjà leur grille.
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1", panel: "pro" },
        { id: "cri-2", panel: "public" },
      ] as never);

      const caller = await createCaller();
      const result = await caller.initializeDefaultCriteria({ categoryId: "cat-1" });

      expect(result.created).toBe(0);
      expect(inserted).toHaveLength(0);
    });

    it("crée les critères par défaut sur une catégorie vide", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      const result = await caller.initializeDefaultCriteria({ categoryId: "cat-1" });

      // Une grille par défaut pour chacun des deux jurys.
      expect(result.created).toBe(DEFAULT_CRITERIA.length * 2);
      expect(inserted).toHaveLength(1);
      const rows = inserted[0] as { panel: string }[];
      expect(rows.filter((r) => r.panel === "pro")).toHaveLength(DEFAULT_CRITERIA.length);
      expect(rows.filter((r) => r.panel === "public")).toHaveLength(DEFAULT_CRITERIA.length);
    });

    it("ne complète que le jury encore sans critère", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(
        categoryWithCup("draft") as never
      );
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1", panel: "pro" },
      ] as never);

      const caller = await createCaller();
      const result = await caller.initializeDefaultCriteria({ categoryId: "cat-1" });

      expect(result.created).toBe(DEFAULT_CRITERIA.length);
      const rows = inserted[0] as { panel: string }[];
      expect(rows.every((r) => r.panel === "public")).toBe(true);
    });

    // Dupliquer d'une cup vers une autre mélangerait deux barèmes : le
    // routeur doit refuser, quel que soit le statut des deux cups.
    it("refuse une duplication entre deux cups différentes", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-1" }) as never)
        .mockResolvedValueOnce(
          categoryWithCup("draft", { id: "cat-9", cupId: "cup-2" }) as never
        );

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.duplicateFromCategory({
            sourceCategoryId: "cat-1",
            targetCategoryId: "cat-9",
          })
        )
      ).toBe("BAD_REQUEST");
      expect(inserted).toHaveLength(0);
    });

    it("duplique les critères à la suite de ceux déjà présents dans la cible", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-1" }) as never)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-2" }) as never);
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1", panel: "pro", name: "Arôme", description: null, coefficient: 2, sortOrder: 0 },
        { id: "cri-2", panel: "pro", name: "Goût", description: null, coefficient: 3, sortOrder: 1 },
        { id: "cri-3", panel: "public", name: "Plaisir", description: null, coefficient: 1, sortOrder: 0 },
      ] as never);
      // La catégorie cible a déjà des critères pro (rang max 1) et aucun
      // critère public.
      selectResults.push([{ panel: "pro", maxOrder: 1 }]);

      const caller = await createCaller();
      const result = await caller.duplicateFromCategory({
        sourceCategoryId: "cat-1",
        targetCategoryId: "cat-2",
      });

      expect(result.duplicated).toBe(3);
      const copied = inserted[0] as { sortOrder: number; categoryId: string; panel: string }[];
      // Chaque critère garde son jury et se range à la suite de la grille
      // de ce jury dans la cible.
      expect(copied.map((c) => [c.panel, c.sortOrder])).toEqual([
        ["pro", 2],
        ["pro", 3],
        ["public", 0],
      ]);
      expect(copied.every((c) => c.categoryId === "cat-2")).toBe(true);
    });

    it("repart du plus grand rang de la cible, même avec des trous", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-1" }) as never)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-2" }) as never);
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "cri-1", panel: "pro", name: "Arôme", description: null, coefficient: 2, sortOrder: 0 },
      ] as never);
      // Deux critères pro aux rangs 1 et 2 (le rang 0 a été supprimé) :
      // le suivant doit prendre le rang 3, pas 2.
      selectResults.push([{ panel: "pro", maxOrder: 2 }]);

      const caller = await createCaller();
      await caller.duplicateFromCategory({
        sourceCategoryId: "cat-1",
        targetCategoryId: "cat-2",
      });

      const copied = inserted[0] as { sortOrder: number; panel: string }[];
      expect(copied.map((c) => [c.panel, c.sortOrder])).toEqual([["pro", 3]]);
    });

    it("ne duplique rien quand la catégorie source est vide", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-1" }) as never)
        .mockResolvedValueOnce(categoryWithCup("draft", { id: "cat-2" }) as never);
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      await expect(
        caller.duplicateFromCategory({
          sourceCategoryId: "cat-1",
          targetCategoryId: "cat-2",
        })
      ).resolves.toEqual({ duplicated: 0 });
      expect(inserted).toHaveLength(0);
    });
  });
});
