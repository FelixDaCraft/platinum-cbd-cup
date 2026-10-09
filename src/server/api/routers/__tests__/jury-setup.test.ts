import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  addExistingJurorsSchema,
  listJuryDirectorySchema,
  setJuryPanelSchema,
  setSamplesReceivedSchema,
} from "~/lib/validations/jury-setup";
import { updateCategorySchema, createCategorySchema } from "~/lib/validations/category";

vi.mock("nanoid", () => ({ nanoid: () => "new-id" }));

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

const { mockSendAdded } = vi.hoisted(() => ({ mockSendAdded: vi.fn() }));

vi.mock("~/server/services/jury-invitation.service", () => ({
  sendJuryAddedToCupEmail: mockSendAdded,
}));

/** Base simulée : chaque test règle les `findFirst`/`findMany` dont il a besoin. */
const dbState = vi.hoisted(() => ({
  /** Résultats successifs des `select()` (comptages). */
  selectResults: [] as unknown[][],
  /** Valeurs passées à `update().set()`. */
  updates: [] as Record<string, unknown>[],
  /** Valeurs passées à `insert().values()`. */
  inserted: [] as unknown[],
  /** Lignes renvoyées par `update(...).returning()`. */
  updateReturning: [] as unknown[],
  /** Lignes renvoyées par `delete(...).returning()`. */
  deleteReturning: [] as unknown[],
}));

vi.mock("~/server/db", () => {
  const selectChain = () => {
    const chain = {
      from: () => chain,
      where: () => Promise.resolve(dbState.selectResults.shift() ?? []),
    };
    return chain;
  };

  const db = {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      cups: { findFirst: vi.fn() },
      categories: { findMany: vi.fn().mockResolvedValue([]) },
      cupJuries: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      juryProfiles: { findMany: vi.fn().mockResolvedValue([]) },
      producers: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn() },
    },
    select: selectChain,
    insert: () => ({
      values: (values: unknown) => {
        dbState.inserted.push(values);
        return Object.assign(Promise.resolve(undefined), {
          returning: () => Promise.resolve([{ id: "profile-new", ...(values as object) }]),
        });
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () =>
            Object.assign(Promise.resolve(undefined), {
              returning: () => Promise.resolve(dbState.updateReturning),
            }),
        };
      },
    }),
    delete: () => ({
      where: () =>
        Object.assign(Promise.resolve(undefined), {
          returning: () => Promise.resolve(dbState.deleteReturning),
        }),
    }),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };

  return { db };
});

beforeEach(() => {
  vi.clearAllMocks();
  dbState.selectResults.length = 0;
  dbState.updates.length = 0;
  dbState.inserted.length = 0;
  dbState.updateReturning = [];
  dbState.deleteReturning = [];
});

describe("Validation des entrées", () => {
  it("addExistingJurors exige au moins un juré et un panel connu", () => {
    expect(
      addExistingJurorsSchema.safeParse({ cupId: "cup-1", userIds: [], panel: "pro" }).success
    ).toBe(false);

    const badPanel = addExistingJurorsSchema.safeParse({
      cupId: "cup-1",
      userIds: ["u1"],
      panel: "vip",
    });
    expect(badPanel.success).toBe(false);
    if (!badPanel.success) {
      expect(badPanel.error.issues[0]?.message).toContain("« pro » ou « public »");
    }
  });

  it("addExistingJurors : catégories vides et sans email par défaut", () => {
    const parsed = addExistingJurorsSchema.parse({ cupId: "cup-1", userIds: ["u1"], panel: "public" });
    expect(parsed.categoryIds).toEqual([]);
    expect(parsed.notify).toBe(false);
  });

  it("setPanel refuse un panel inconnu", () => {
    expect(setJuryPanelSchema.safeParse({ cupJuryId: "cj-1", panel: "jury" }).success).toBe(false);
  });

  it("setSamplesReceived exige des jurés et un booléen", () => {
    expect(
      setSamplesReceivedSchema.safeParse({ cupId: "cup-1", cupJuryIds: [], received: true }).success
    ).toBe(false);
    expect(
      setSamplesReceivedSchema.safeParse({ cupId: "cup-1", cupJuryIds: ["cj-1"] }).success
    ).toBe(false);
  });

  it("listDirectory borne la taille de page et applique des défauts", () => {
    expect(listJuryDirectorySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listJuryDirectorySchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  it("les objectifs de jurés d'une catégorie sont des entiers positifs ou null", () => {
    expect(updateCategorySchema.safeParse({ id: "c", targetProJurors: 0 }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ id: "c", targetPublicJurors: 2.5 }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ id: "c", targetProJurors: null }).success).toBe(true);
    expect(
      createCategorySchema.safeParse({ cupId: "cup", name: "Fleurs", targetPublicJurors: 20 }).success
    ).toBe(true);
  });
});

describe("Procédures de mise en place des jurys", () => {
  async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
    const { auth } = await import("~/lib/auth");
    const { db } = await import("~/server/db");

    if (row === null) {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);
      return;
    }

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "org-1", email: "org@example.com" },
      session: { id: "session-1" },
    } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
  }

  const asOrganizer = () => signIn({ isAdmin: false, role: "organizer" });

  async function createCaller() {
    const { createTRPCRouter } = await import("~/server/api/trpc");
    const { jurySetupProcedures } = await import("../jury-setup");
    const { db } = await import("~/server/db");
    return createTRPCRouter(jurySetupProcedures).createCaller({
      headers: new Headers(),
      db,
    } as never);
  }

  async function errorOf(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      return error as TRPCError;
    }
    throw new Error("La procédure aurait dû lever une erreur");
  }

  const calls = (caller: Awaited<ReturnType<typeof createCaller>>) => [
    () => caller.listDirectory({}),
    () => caller.getCoverage({ cupId: "cup-1" }),
    () => caller.addExistingJurors({ cupId: "cup-1", userIds: ["u1"], panel: "pro" }),
    () => caller.setPanel({ cupJuryId: "cj-1", panel: "public" }),
    () => caller.setSamplesReceived({ cupId: "cup-1", cupJuryIds: ["cj-1"], received: true }),
  ];

  it("refuse un appelant anonyme", async () => {
    await signIn(null);
    const caller = await createCaller();
    for (const call of calls(caller)) {
      expect((await errorOf(call)).code).toBe("UNAUTHORIZED");
    }
  });

  it("refuse un producteur ou un juré", async () => {
    const caller = await createCaller();
    for (const role of ["producer", "jury"]) {
      await signIn({ isAdmin: false, role });
      for (const call of calls(caller)) {
        expect((await errorOf(call)).code).toBe("FORBIDDEN");
      }
    }
  });

  describe("setPanel", () => {
    it("ne fait rien si le panel est déjà le bon", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "cj-1",
        cupId: "cup-1",
        userId: "u1",
        panel: "pro",
      } as never);

      const caller = await createCaller();
      const result = await caller.setPanel({ cupJuryId: "cj-1", panel: "pro" });

      expect(result).toEqual({ success: true, changed: false, panel: "pro", draftsDeleted: 0 });
      expect(dbState.updates).toHaveLength(0);
    });

    it("refuse un juré introuvable", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const caller = await createCaller();
      const error = await errorOf(() => caller.setPanel({ cupJuryId: "cj-x", panel: "pro" }));
      expect(error.code).toBe("NOT_FOUND");
    });

    it("refuse dès qu'une note a été soumise dans la cup", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "cj-1",
        cupId: "cup-1",
        userId: "u1",
        panel: "pro",
      } as never);
      dbState.selectResults.push([{ count: 3 }]);

      const caller = await createCaller();
      const error = await errorOf(() => caller.setPanel({ cupJuryId: "cj-1", panel: "public" }));

      expect(error.code).toBe("PRECONDITION_FAILED");
      expect(error.message).toContain("3 note(s)");
      expect(dbState.updates).toHaveLength(0);
    });

    it("refuse de placer au jury public un producteur qui concourt", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "cj-1",
        cupId: "cup-1",
        userId: "u1",
        panel: "pro",
      } as never);
      vi.mocked(db.query.producers.findFirst).mockResolvedValue({ id: "prod-1" } as never);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({ id: "reg-1" } as never);
      dbState.selectResults.push([{ count: 0 }]);

      const caller = await createCaller();
      const error = await errorOf(() => caller.setPanel({ cupJuryId: "cj-1", panel: "public" }));

      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toContain("jury public");
    });

    it("change le panel et supprime les brouillons", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "cj-1",
        cupId: "cup-1",
        userId: "u1",
        panel: "public",
      } as never);
      dbState.selectResults.push([{ count: 0 }]);
      dbState.deleteReturning = [{ id: "r1" }, { id: "r2" }];

      const caller = await createCaller();
      const result = await caller.setPanel({ cupJuryId: "cj-1", panel: "pro" });

      expect(result).toEqual({ success: true, changed: true, panel: "pro", draftsDeleted: 2 });
      expect(dbState.updates[0]).toMatchObject({ panel: "pro" });
      // Profil passé en pro.
      expect(dbState.updates[1]).toMatchObject({ juryType: "pro" });
    });
  });

  describe("setSamplesReceived", () => {
    it("refuse un juré d'une autre cup", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([{ id: "cj-1" }] as never);

      const caller = await createCaller();
      const error = await errorOf(() =>
        caller.setSamplesReceived({ cupId: "cup-1", cupJuryIds: ["cj-1", "cj-2"], received: true })
      );
      expect(error.code).toBe("BAD_REQUEST");
    });

    it("pose la date de réception et renvoie le nombre de jurés modifiés", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        { id: "cj-1" },
        { id: "cj-2" },
      ] as never);
      dbState.updateReturning = [{ id: "cj-1" }];

      const caller = await createCaller();
      const result = await caller.setSamplesReceived({
        cupId: "cup-1",
        cupJuryIds: ["cj-1", "cj-2", "cj-1"],
        received: true,
      });

      expect(result).toEqual({ success: true, received: true, updated: 1 });
      expect(dbState.updates[0]?.samplesReceivedAt).toBeInstanceOf(Date);
    });

    it("retire la réception", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([{ id: "cj-1" }] as never);
      dbState.updateReturning = [{ id: "cj-1" }];

      const caller = await createCaller();
      await caller.setSamplesReceived({ cupId: "cup-1", cupJuryIds: ["cj-1"], received: false });

      expect(dbState.updates[0]?.samplesReceivedAt).toBeNull();
    });
  });

  describe("addExistingJurors", () => {
    async function withCup() {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({ id: "cup-1", name: "Cup" } as never);
      return db;
    }

    it("refuse une catégorie d'une autre cup", async () => {
      const db = await withCup();
      vi.mocked(db.query.categories.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      const error = await errorOf(() =>
        caller.addExistingJurors({
          cupId: "cup-1",
          userIds: ["u1"],
          panel: "pro",
          categoryIds: ["cat-x"],
        })
      );
      expect(error.code).toBe("BAD_REQUEST");
    });

    it("rapporte les refus juré par juré sans bloquer les autres", async () => {
      const db = await withCup();
      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat-1", name: "Fleurs", sortOrder: 0 },
      ] as never);
      vi.mocked(db.query.users.findMany).mockResolvedValue([
        { id: "u-new", name: "Nouveau", email: "n@x.fr" },
        { id: "u-never", name: "Jamais", email: "j@x.fr" },
        { id: "u-public", name: "Public", email: "p@x.fr" },
      ] as never);
      vi.mocked(db.query.juryProfiles.findMany).mockResolvedValue([
        { id: "jp-new", userId: "u-new", juryType: "pro", notifyOnAssignment: true },
        { id: "jp-pub", userId: "u-public", juryType: "public", notifyOnAssignment: true },
      ] as never);
      vi.mocked(db.query.cupJuries.findMany)
        // Jurés ayant déjà siégé, toutes cups confondues.
        .mockResolvedValueOnce([{ userId: "u-public" }] as never)
        // Membres de la cup.
        .mockResolvedValueOnce([
          {
            id: "cj-pub",
            userId: "u-public",
            panel: "public",
            isActive: true,
            juryProfileId: "jp-pub",
            categoryAssignments: [],
          },
        ] as never);
      mockSendAdded.mockResolvedValue({ success: true });

      const caller = await createCaller();
      const result = await caller.addExistingJurors({
        cupId: "cup-1",
        userIds: ["u-new", "u-never", "u-public", "u-ghost"],
        panel: "pro",
        categoryIds: ["cat-1"],
        notify: true,
      });

      expect(result.added).toBe(1);
      expect(result.failed).toBe(3);
      expect(result.results.map((r) => [r.userId, r.status])).toEqual([
        ["u-new", "added"],
        ["u-never", "error"],
        ["u-public", "error"],
        ["u-ghost", "error"],
      ]);
      expect(result.results[1]?.error).toContain("invitation");
      expect(result.results[2]?.error).toContain("Déjà juré public");
      expect(result.results[3]?.error).toBe("Utilisateur introuvable");

      // Un email, pour le seul juré ajouté.
      expect(mockSendAdded).toHaveBeenCalledTimes(1);
      expect(mockSendAdded).toHaveBeenCalledWith({
        userId: "u-new",
        cupId: "cup-1",
        panel: "pro",
        categoryNames: ["Fleurs"],
      });
      expect(result.emailsSent).toBe(1);
      expect(result.results[0]?.notified).toBe(true);
    });

    it("n'envoie pas d'email sans notify", async () => {
      const db = await withCup();
      vi.mocked(db.query.users.findMany).mockResolvedValue([
        { id: "u1", name: "Un", email: "u@x.fr" },
      ] as never);
      vi.mocked(db.query.juryProfiles.findMany).mockResolvedValue([
        { id: "jp-1", userId: "u1", juryType: "pro", notifyOnAssignment: true },
      ] as never);

      const caller = await createCaller();
      const result = await caller.addExistingJurors({
        cupId: "cup-1",
        userIds: ["u1"],
        panel: "pro",
      });

      expect(result.added).toBe(1);
      expect(mockSendAdded).not.toHaveBeenCalled();
    });

    it("exclut du jury public un producteur qui concourt", async () => {
      const db = await withCup();
      vi.mocked(db.query.users.findMany).mockResolvedValue([
        { id: "u1", name: "Un", email: "u@x.fr" },
      ] as never);
      vi.mocked(db.query.juryProfiles.findMany).mockResolvedValue([
        { id: "jp-1", userId: "u1", juryType: "public", notifyOnAssignment: true },
      ] as never);
      vi.mocked(db.query.producers.findFirst).mockResolvedValue({ id: "prod-1" } as never);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({ id: "reg-1" } as never);

      const caller = await createCaller();
      const result = await caller.addExistingJurors({
        cupId: "cup-1",
        userIds: ["u1"],
        panel: "public",
      });

      expect(result.failed).toBe(1);
      expect(result.results[0]?.error).toContain("producteur");
      expect(dbState.inserted).toHaveLength(0);
    });
  });
});
