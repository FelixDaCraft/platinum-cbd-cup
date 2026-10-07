import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  categoryFormSchema,
} from "~/lib/validations/category";

vi.mock("nanoid", () => ({
  nanoid: () => "test-category-id",
}));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

/**
 * État de la base simulée, partagé entre le test et la fabrique de mock.
 * `vi.hoisted` est indispensable : vitest remonte les `vi.mock` au-dessus
 * des déclarations du module.
 */
const dbState = vi.hoisted(() => ({
  /** File des résultats renvoyés par les `select()` successifs, dans l'ordre. */
  selectResults: [] as unknown[][],
  /** Valeurs passées à chaque `update().set()`. */
  updates: [] as Record<string, unknown>[],
  /** Un élément par `delete()` exécuté. */
  deleted: [] as true[],
  /** Valeurs passées à chaque `insert().values()`. */
  inserted: [] as Record<string, unknown>[],
}));

const { selectResults, updates, deleted } = dbState;

vi.mock("~/server/db", () => {
  // Les chaînes Drizzle sont « thenables » : on rend chaque maillon
  // chaînable et le dernier awaitable.
  const selectChain = () => {
    const chain = {
      from: () => chain,
      where: () => Promise.resolve(dbState.selectResults.shift() ?? []),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(dbState.selectResults.shift() ?? []).then(resolve),
    };
    return chain;
  };

  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
        cups: { findFirst: vi.fn() },
        categories: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      // Remplissage des quotas (getCategoryOccupancy) : SQL brut.
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: selectChain,
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          dbState.inserted.push(values);
          return { returning: () => Promise.resolve([values]) };
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          dbState.updates.push(values);
          // `where` est awaité directement (reorder) ou suivi de `returning` (update).
          const done = Promise.resolve(undefined);
          return {
            where: () =>
              Object.assign(done, { returning: () => Promise.resolve([values]) }),
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
  dbState.inserted.length = 0;
});

describe("Category Router", () => {
  describe("Input Validation - createCategorySchema", () => {
    it("rejects missing cupId", () => {
      const result = createCategorySchema.safeParse({
        name: "Valid Name",
        description: "Description",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty cupId", () => {
      const result = createCategorySchema.safeParse({
        cupId: "",
        name: "Valid Name",
      });

      expect(result.success).toBe(false);
    });

    it("rejects name shorter than 2 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "A",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("2 caractères");
      }
    });

    it("rejects name longer than 100 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "A".repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it("rejects description longer than 500 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Name",
        description: "A".repeat(501),
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid input with all fields", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Category Name",
        description: "A valid description",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cupId).toBe("cup-1");
        expect(result.data.name).toBe("Valid Category Name");
      }
    });

    it("accepts valid input without description", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Name",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - updateCategorySchema", () => {
    it("rejects missing id", () => {
      const result = updateCategorySchema.safeParse({
        name: "New Name",
      });

      expect(result.success).toBe(false);
    });

    it("accepts update with only name", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        name: "Updated Name",
      });

      expect(result.success).toBe(true);
    });

    it("accepts update with only description", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        description: "Updated description",
      });

      expect(result.success).toBe(true);
    });

    it("accepts null description (to clear it)", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        description: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - reorderCategoriesSchema", () => {
    it("rejects missing cupId", () => {
      const result = reorderCategoriesSchema.safeParse({
        categoryIds: ["cat-1", "cat-2"],
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty categoryIds array", () => {
      const result = reorderCategoriesSchema.safeParse({
        cupId: "cup-1",
        categoryIds: [],
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid reorder input", () => {
      const result = reorderCategoriesSchema.safeParse({
        cupId: "cup-1",
        categoryIds: ["cat-3", "cat-1", "cat-2"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryIds).toHaveLength(3);
        expect(result.data.categoryIds[0]).toBe("cat-3");
      }
    });
  });

  describe("Input Validation - categoryFormSchema", () => {
    it("transforms empty string description to undefined", () => {
      const result = categoryFormSchema.safeParse({
        name: "Valid Name",
        description: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });

    it("preserves non-empty description", () => {
      const result = categoryFormSchema.safeParse({
        name: "Valid Name",
        description: "Some description",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("Some description");
      }
    });
  });


  // ---------------------------------------------------------------------
  // Procédures du routeur
  //
  // Les blocs « Business Logic » et « Multi-tenancy Validation » d'origine
  // ne touchaient jamais category.ts : ils recopiaient la logique dans le
  // test puis se comparaient à eux-mêmes (`expect("org-1").toBe("org-1")`).
  // Le multi-tenant a par ailleurs disparu avec le fork. On appelle ici les
  // procédures pour de vrai, via createCaller et une base simulée.
  // ---------------------------------------------------------------------
  describe("Procédures", () => {
    /** Authentifie l'appelant ; `row` est ce que organizerProcedure lira. */
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

    async function createCaller() {
      const { categoryRouter } = await import("../category");
      const { db } = await import("~/server/db");

      return categoryRouter.createCaller({ headers: new Headers(), db } as never);
    }

    /** Exécute `fn` et renvoie le code tRPC levé. */
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

      expect(await codeOf(() => caller.list({ cupId: "cup-1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.count({ cupId: "cup-1" }))).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() => caller.create({ cupId: "cup-1", name: "Indoor" }))
      ).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.update({ id: "cat-1", name: "Indoor" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(await codeOf(() => caller.delete({ id: "cat-1" }))).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() => caller.reorder({ cupId: "cup-1", categoryIds: ["cat-1"] }))
      ).toBe("UNAUTHORIZED");
    });

    it("refuse un producteur authentifié sur chaque procédure", async () => {
      await asProducer();
      const caller = await createCaller();

      expect(await codeOf(() => caller.list({ cupId: "cup-1" }))).toBe("FORBIDDEN");
      expect(
        await codeOf(() => caller.create({ cupId: "cup-1", name: "Indoor" }))
      ).toBe("FORBIDDEN");
      expect(await codeOf(() => caller.delete({ id: "cat-1" }))).toBe("FORBIDDEN");
      expect(
        await codeOf(() => caller.reorder({ cupId: "cup-1", categoryIds: ["cat-1"] }))
      ).toBe("FORBIDDEN");
    });

    it("refuse un utilisateur dont la ligne users a disparu", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { id: "session-1" },
      } as never);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.list({ cupId: "cup-1" }))).toBe("FORBIDDEN");
    });

    it("renvoie NOT_FOUND quand la cup n'existe pas", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.list({ cupId: "inconnue" }))).toBe("NOT_FOUND");
    });

    it("liste les catégories de la cup", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({ id: "cup-1" } as never);
      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat-1", cupId: "cup-1", name: "Indoor", sortOrder: 0 },
        { id: "cat-2", cupId: "cup-1", name: "Outdoor", sortOrder: 1 },
      ] as never);

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ category_id: "cat-1", taken: 7 }],
      } as never);

      const caller = await createCaller();
      const result = await caller.list({ cupId: "cup-1" });

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("Indoor");
      // Places prises (payées ou réservées) jointes à chaque catégorie.
      expect(result[0]!.takenProducts).toBe(7);
      expect(result[1]!.takenProducts).toBe(0);
    });

    it("enregistre les quotas d'une catégorie", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);

      const caller = await createCaller();
      await caller.update({ id: "cat-1", maxProducts: 20, maxProductsPerProducer: null });

      expect(updates.at(-1)).toMatchObject({ maxProducts: 20, maxProductsPerProducer: null });
    });

    it("refuse de supprimer une catégorie qui contient des produits", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);
      // Premier select() : le compte de produits.
      selectResults.push([{ count: 3 }]);

      const caller = await createCaller();
      expect(await codeOf(() => caller.delete({ id: "cat-1" }))).toBe("CONFLICT");
    });

    it("refuse de supprimer une catégorie dont dépendent des jurés", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);
      // produits = 0, assignations = 2, codes = 0
      selectResults.push([{ count: 0 }], [{ count: 2 }], [{ count: 0 }]);

      const caller = await createCaller();
      expect(await codeOf(() => caller.delete({ id: "cat-1" }))).toBe("CONFLICT");
      expect(deleted).toHaveLength(0);
    });

    it("supprime une catégorie libre de toute dépendance", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);
      selectResults.push([{ count: 0 }], [{ count: 0 }], [{ count: 0 }]);

      const caller = await createCaller();
      await expect(caller.delete({ id: "cat-1" })).resolves.toEqual({ success: true });
      expect(deleted).toHaveLength(1);
    });

    it("refuse un réordonnancement contenant une catégorie étrangère à la cup", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({ id: "cup-1" } as never);
      // La cup ne contient que cat-1 et cat-2 : cat-3 vient d'ailleurs.
      selectResults.push([{ id: "cat-1" }, { id: "cat-2" }]);

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.reorder({ cupId: "cup-1", categoryIds: ["cat-1", "cat-2", "cat-3"] })
        )
      ).toBe("BAD_REQUEST");
      expect(updates).toHaveLength(0);
    });

    it("applique le rang de chaque catégorie selon sa position", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({ id: "cup-1" } as never);
      selectResults.push([{ id: "cat-1" }, { id: "cat-2" }, { id: "cat-3" }]);

      const caller = await createCaller();
      await caller.reorder({ cupId: "cup-1", categoryIds: ["cat-3", "cat-1", "cat-2"] });

      expect(updates.map((u) => u.sortOrder)).toEqual([0, 1, 2]);
    });
  });
});
