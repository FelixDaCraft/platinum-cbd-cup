import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Routeur newsletter — le seul routeur qui mêle des procédures publiques
 * écrivant en base (subscribe/confirm/unsubscribe) et des procédures
 * organisateur qui exposent la liste complète des adresses.
 *
 * Ce qui est réellement exercé ici : le garde de rôle sur les six procédures
 * d'administration, l'absence d'énumération d'adresses sur `subscribe`, et
 * l'invalidation du jeton de confirmation après usage.
 */

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  updates: [] as Record<string, unknown>[],
  deleted: [] as true[],
  inserted: [] as Record<string, unknown>[],
}));

const { selectResults, updates, deleted, inserted } = dbState;

vi.mock("~/server/db", () => {
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
        newsletterSubscribers: { findFirst: vi.fn(), findMany: vi.fn() },
      },
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
          return { where: () => Promise.resolve(undefined) };
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

/** Chaque test consomme sa propre IP : les seaux de débit sont globaux au processus. */
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter % 250}`;

async function createCaller(ip = nextIp()) {
  const { newsletterRouter } = await import("../newsletter");
  const { db } = await import("~/server/db");

  return newsletterRouter.createCaller({
    headers: new Headers({ "cf-connecting-ip": ip }),
    db,
  } as never);
}

async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");

  if (row === null) {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    return;
  }

  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "staff@example.com", name: "Staff" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
}

const asOrganizer = () => signIn({ isAdmin: false, role: "organizer" });
const asProducer = () => signIn({ isAdmin: false, role: "producer" });
const asAnonymous = () => signIn(null);

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
  selectResults.length = 0;
  updates.length = 0;
  deleted.length = 0;
  inserted.length = 0;
});

describe("Newsletter Router", () => {
  describe("Garde de rôle", () => {
    it("refuse un appelant anonyme sur toutes les procédures d'administration", async () => {
      await asAnonymous();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getStats())).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.list({}))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.add({ email: "a@b.fr" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(await codeOf(() => caller.delete({ id: "sub-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(await codeOf(() => caller.export({}))).toBe("UNAUTHORIZED");
    });

    it("refuse un producteur authentifié sur toutes les procédures d'administration", async () => {
      await asProducer();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getStats())).toBe("FORBIDDEN");
      expect(await codeOf(() => caller.list({}))).toBe("FORBIDDEN");
      expect(await codeOf(() => caller.add({ email: "a@b.fr" }))).toBe(
        "FORBIDDEN"
      );
      expect(await codeOf(() => caller.delete({ id: "sub-1" }))).toBe(
        "FORBIDDEN"
      );
      expect(await codeOf(() => caller.export({}))).toBe("FORBIDDEN");

      // Le garde doit court-circuiter AVANT toute écriture.
      expect(inserted).toHaveLength(0);
      expect(deleted).toHaveLength(0);
    });

    it("laisse passer un administrateur dont le rôle n'est pas « organizer »", async () => {
      await signIn({ isAdmin: true, role: "producer" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findMany).mockResolvedValue(
        [] as never
      );

      const caller = await createCaller();
      await expect(caller.export({ status: "active" })).resolves.toMatchObject({
        count: 0,
      });
    });
  });

  describe("subscribe (public)", () => {
    it("renvoie exactement le même message quel que soit l'état de l'adresse", async () => {
      const { db } = await import("~/server/db");
      const caller = await createCaller();

      // Les quatre états possibles, pas seulement deux : un message propre à
      // « active » ou à « unsubscribed » suffirait à énumérer la liste depuis
      // un formulaire public qui n'exige aucune preuve de possession.
      const etats = [undefined, "pending", "active", "unsubscribed"] as const;
      const messages: string[] = [];

      for (const status of etats) {
        vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue(
          (status === undefined ? undefined : { id: "sub-1", status }) as never
        );
        const reponse = await caller.subscribe({ email: `${status}@example.com` });
        expect(reponse.success).toBe(true);
        messages.push(reponse.message);
      }

      // Égalité stricte : une assertion « ne contient pas tel mot » passerait
      // aussi bien sur des messages parfaitement distinctifs.
      expect(new Set(messages).size).toBe(1);
    });

    it("normalise l'adresse en minuscules avant insertion", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue(
        undefined as never
      );

      const caller = await createCaller();
      await caller.subscribe({ email: "Jean.Dupont@Example.COM", name: "Jean" });

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        email: "jean.dupont@example.com",
        status: "pending",
        source: "portal",
      });
    });

    it("remet une adresse désinscrite en attente avec un jeton neuf", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "unsubscribed",
        confirmationToken: "ancien-jeton",
      } as never);

      const caller = await createCaller();
      await caller.subscribe({ email: "revenu@example.com" });

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ status: "pending", unsubscribedAt: null });
      // Rejouer l'ancien lien de confirmation ne doit plus rien valider.
      expect(updates[0]!.confirmationToken).toEqual(expect.any(String));
      expect(updates[0]!.confirmationToken).not.toBe("ancien-jeton");
    });

    it("n'écrit rien pour une adresse déjà active", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "active",
      } as never);

      const caller = await createCaller();
      await caller.subscribe({ email: "actif@example.com" });

      expect(updates).toHaveLength(0);
      expect(inserted).toHaveLength(0);
    });

    it("rejette une adresse mal formée avant tout accès base", async () => {
      const { db } = await import("~/server/db");
      const caller = await createCaller();

      await expect(caller.subscribe({ email: "pas-une-adresse" })).rejects.toThrow();
      expect(db.query.newsletterSubscribers.findFirst).not.toHaveBeenCalled();
    });

    it("plafonne les inscriptions à 5 par minute et par IP", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue(
        undefined as never
      );

      // Même IP pour les six appels : c'est la limite stricte des endpoints
      // qui déclenchent un envoi d'email qui est vérifiée ici.
      const caller = await createCaller("198.51.100.7");

      for (let i = 0; i < 5; i++) {
        await caller.subscribe({ email: `spam${i}@example.com` });
      }

      expect(await codeOf(() => caller.subscribe({ email: "spam5@example.com" }))).toBe(
        "TOO_MANY_REQUESTS"
      );
      expect(inserted).toHaveLength(5);
    });
  });

  describe("confirm / unsubscribe (public, jeton)", () => {
    it("renvoie NOT_FOUND sur un jeton inconnu, sans distinguer confirm et unsubscribe", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue(
        undefined as never
      );

      const caller = await createCaller();
      expect(await codeOf(() => caller.confirm({ token: "bidon" }))).toBe("NOT_FOUND");
      expect(await codeOf(() => caller.unsubscribe({ token: "bidon" }))).toBe(
        "NOT_FOUND"
      );
      expect(updates).toHaveLength(0);
    });

    it("efface le jeton de confirmation une fois consommé", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "pending",
        confirmationToken: "jeton-valide",
      } as never);

      const caller = await createCaller();
      await caller.confirm({ token: "jeton-valide" });

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ status: "active", confirmationToken: null });
    });

    it("est idempotent sur un abonné déjà actif ou déjà désinscrit", async () => {
      const { db } = await import("~/server/db");
      const caller = await createCaller();

      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "active",
      } as never);
      await expect(caller.confirm({ token: "t" })).resolves.toMatchObject({
        success: true,
      });

      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "unsubscribed",
      } as never);
      await expect(caller.unsubscribe({ token: "t" })).resolves.toMatchObject({
        success: true,
      });

      expect(updates).toHaveLength(0);
    });

    it("désinscrit un abonné actif sans supprimer sa ligne", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "active",
      } as never);

      const caller = await createCaller();
      await caller.unsubscribe({ token: "jeton-desinscription" });

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ status: "unsubscribed" });
      // Une suppression physique ferait réapparaître l'adresse au prochain
      // import : la désinscription doit rester une trace.
      expect(deleted).toHaveLength(0);
    });
  });

  describe("Procédures organisateur", () => {
    it("refuse d'ajouter une adresse déjà inscrite", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue({
        id: "sub-1",
        status: "active",
      } as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.add({ email: "deja@example.com" }))).toBe(
        "CONFLICT"
      );
      expect(inserted).toHaveLength(0);
    });

    it("renvoie NOT_FOUND à la suppression d'un abonné inexistant", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findFirst).mockResolvedValue(
        undefined as never
      );

      const caller = await createCaller();
      expect(await codeOf(() => caller.delete({ id: "inconnu" }))).toBe("NOT_FOUND");
      expect(deleted).toHaveLength(0);
    });

    it("agrège les quatre compteurs de getStats dans l'ordre des requêtes", async () => {
      await asOrganizer();
      selectResults.push([{ count: 12 }], [{ count: 7 }], [{ count: 3 }], [{ count: 2 }]);

      const caller = await createCaller();
      await expect(caller.getStats()).resolves.toEqual({
        total: 12,
        active: 7,
        pending: 3,
        unsubscribed: 2,
      });
    });

    it("calcule la pagination de list à partir du compte total", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      selectResults.push([{ count: 130 }]);
      vi.mocked(db.query.newsletterSubscribers.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      await expect(caller.list({ page: 2, limit: 50 })).resolves.toMatchObject({
        pagination: {
          currentPage: 2,
          totalPages: 3,
          totalCount: 130,
          hasNextPage: true,
          hasPrevPage: true,
        },
      });
    });

    it("exporte un CSV avec une ligne d'en-tête et une ligne par abonné", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.newsletterSubscribers.findMany).mockResolvedValue([
        {
          email: "a@example.com",
          name: "Alice",
          status: "active",
          source: "portal",
          createdAt: new Date("2026-01-02T10:00:00Z"),
          confirmedAt: new Date("2026-01-02T10:05:00Z"),
        },
        {
          email: "b@example.com",
          name: null,
          status: "pending",
          source: null,
          createdAt: new Date("2026-01-03T10:00:00Z"),
          confirmedAt: null,
        },
      ] as never);

      const caller = await createCaller();
      const { csv, count } = await caller.export({ status: "all" });
      const lines = csv.split("\n");

      expect(count).toBe(2);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe(
        "email,name,status,source,subscribed_at,confirmed_at"
      );
      expect(lines[1]).toContain("a@example.com");
      // `source` absent retombe sur "portal", `confirmedAt` absent sur vide.
      expect(lines[2]).toBe(
        "b@example.com,,pending,portal,2026-01-03T10:00:00.000Z,"
      );
    });
  });
});
