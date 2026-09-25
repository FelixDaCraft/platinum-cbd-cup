import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Routeur user — c'est lui qui décide où atterrit chaque compte après
 * connexion. Une erreur d'aiguillage envoie un producteur sur /dashboard,
 * où seul le garde serveur du tableau de bord le rattrape.
 *
 * `getRedirectPath` est `publicProcedure` : elle lit la session elle-même et
 * doit renvoyer /login plutôt que lever quand personne n'est connecté.
 */

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
}));

const { selectResults } = dbState;

vi.mock("~/server/db", () => {
  const selectChain = () => {
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
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
        cupJuries: { findMany: vi.fn() },
        producers: { findFirst: vi.fn() },
      },
      select: selectChain,
    },
  };
});

async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");

  if (row === null) {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    return;
  }

  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "u@example.com", name: "Utilisateur" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
}

async function createCaller() {
  const { userRouter } = await import("../user");
  const { db } = await import("~/server/db");

  return userRouter.createCaller({ headers: new Headers(), db } as never);
}

beforeEach(async () => {
  vi.clearAllMocks();
  selectResults.length = 0;

  const { db } = await import("~/server/db");
  vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([] as never);
  vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined as never);
});

describe("User Router", () => {
  describe("getRedirectPath", () => {
    it("renvoie /login sans lever quand personne n'est connecté", async () => {
      await signIn(null);
      const caller = await createCaller();

      await expect(caller.getRedirectPath()).resolves.toEqual({
        path: "/login",
        role: null,
      });
    });

    it.each([
      [{ isAdmin: false, role: "organizer" }, "/dashboard", "organizer"],
      [{ isAdmin: false, role: "jury" }, "/jury/dashboard", "jury"],
      [{ isAdmin: false, role: "producer" }, "/producer/dashboard", "producer"],
    ])("aiguille %o vers %s", async (row, path, role) => {
      await signIn(row);
      const caller = await createCaller();

      await expect(caller.getRedirectPath()).resolves.toEqual({ path, role });
    });

    it("traite isAdmin comme organisateur quel que soit le rôle porté", async () => {
      // L'organisateur d'origine est `isAdmin` avec role=producer en base :
      // n'aiguiller que sur `role` le renverrait sur l'espace producteur.
      await signIn({ isAdmin: true, role: "producer" });
      const caller = await createCaller();

      await expect(caller.getRedirectPath()).resolves.toEqual({
        path: "/dashboard",
        role: "organizer",
      });
    });

    it("retombe sur l'accueil pour un rôle inconnu", async () => {
      await signIn({ isAdmin: false, role: "spectateur" });
      const caller = await createCaller();

      await expect(caller.getRedirectPath()).resolves.toEqual({
        path: "/",
        role: "user",
      });
    });

    it("retombe sur l'accueil quand la session pointe un utilisateur supprimé", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "fantome", email: "x@example.com" },
        session: { id: "s" },
      } as never);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      await expect(caller.getRedirectPath()).resolves.toEqual({
        path: "/",
        role: "user",
      });
    });
  });

  describe("getMyRoles", () => {
    it("refuse un appelant anonyme", async () => {
      await signIn(null);
      const caller = await createCaller();

      try {
        await caller.getMyRoles();
        throw new Error("La procédure aurait dû lever une erreur");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    it("n'expose aucun rôle pour un compte sans concours ni profil", async () => {
      await signIn({ isAdmin: false, role: "producer" });
      const caller = await createCaller();

      const result = await caller.getMyRoles();

      expect(result.roles).toEqual({
        organizer: null,
        jury: null,
        producer: null,
      });
      expect(result.hasMultipleRoles).toBe(false);
      expect(result.user).toMatchObject({ id: "user-1", email: "u@example.com" });
    });

    it("compte les concours actifs pour un organisateur", async () => {
      await signIn({ isAdmin: false, role: "organizer" });
      selectResults.push([{ count: 4 }]);

      const caller = await createCaller();
      const result = await caller.getMyRoles();

      expect(result.roles.organizer).toEqual({
        type: "organizer",
        activeCups: 4,
        href: "/cups",
      });
    });

    it("compte les notations restantes d'un juré, hors produits déjà soumis", async () => {
      await signIn({ isAdmin: false, role: "jury" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        {
          id: "jury-1",
          cupId: "cup-1",
          cup: { id: "cup-1", name: "Cup 2026", status: "rating" },
          categoryAssignments: [{ categoryId: "cat-1" }],
        },
      ] as never);

      // 3 produits à noter, 1 déjà soumis → 2 en attente.
      selectResults.push(
        [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        [{ productId: "p2" }]
      );

      const caller = await createCaller();
      const result = await caller.getMyRoles();

      expect(result.roles.jury).toEqual({
        type: "jury",
        cupCount: 1,
        cupsInRating: 1,
        pendingRatings: 2,
        href: "/jury/dashboard",
      });
    });

    it("ne compte aucune notation en attente sur un concours terminé", async () => {
      await signIn({ isAdmin: false, role: "jury" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        {
          id: "jury-1",
          cupId: "cup-1",
          cup: { id: "cup-1", name: "Cup 2025", status: "completed" },
          categoryAssignments: [{ categoryId: "cat-1" }],
        },
      ] as never);

      const caller = await createCaller();
      const result = await caller.getMyRoles();

      expect(result.roles.jury).toMatchObject({
        cupCount: 1,
        cupsInRating: 0,
        pendingRatings: 0,
      });
      // Aucune requête de produits ne doit partir pour un concours clos.
      expect(selectResults).toHaveLength(0);
    });

    it("signale hasMultipleRoles quand l'organisateur est aussi producteur", async () => {
      await signIn({ isAdmin: true, role: "producer" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "prod-1",
        companyName: "Ferme du Test",
      } as never);

      selectResults.push(
        [{ count: 2 }], // concours actifs (organisateur)
        [{ count: 9 }], // produits (producteur)
        [{ count: 1 }] // compétitions en cours (producteur)
      );

      const caller = await createCaller();
      const result = await caller.getMyRoles();

      expect(result.roles.organizer).toMatchObject({ activeCups: 2 });
      expect(result.roles.producer).toEqual({
        type: "producer",
        companyName: "Ferme du Test",
        productCount: 9,
        activeCompetitions: 1,
        href: "/producer/dashboard",
      });
      expect(result.hasMultipleRoles).toBe(true);
    });
  });
});
