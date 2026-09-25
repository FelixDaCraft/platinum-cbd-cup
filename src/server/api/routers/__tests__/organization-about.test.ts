import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Routeurs de contenu éditorial du portail : `organizationAbout` (page
 * /about) et `activity` (journal interne du tableau de bord).
 *
 * Les deux sont en lecture publique OU réservés à l'organisateur, sans état
 * intermédiaire — c'est précisément la frontière qu'on vérifie ici, plus le
 * comportement d'upsert de la ligne singleton.
 */

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
}));

const { updates, inserted } = dbState;

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      organizationAbout: { findFirst: vi.fn() },
      activityLogs: { findMany: vi.fn() },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        dbState.inserted.push(values);
        return { returning: () => Promise.resolve([{ id: "about-1", ...values }]) };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: "about-1", ...values }]),
          }),
        };
      },
    }),
  },
}));

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

async function codeOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    return (error as TRPCError).code;
  }
  throw new Error("La procédure aurait dû lever une erreur");
}

async function aboutCaller() {
  const { organizationAboutRouter } = await import("../organization-about");
  const { db } = await import("~/server/db");
  return organizationAboutRouter.createCaller({
    headers: new Headers(),
    db,
  } as never);
}

async function activityCaller() {
  const { activityRouter } = await import("../activity");
  const { db } = await import("~/server/db");
  return activityRouter.createCaller({ headers: new Headers(), db } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  inserted.length = 0;
});

describe("Organization About Router", () => {
  it("laisse un visiteur anonyme lire la page /about", async () => {
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue({
      id: "about-1",
      mission: "Valoriser le CBD français",
    } as never);

    await signIn(null);
    const caller = await aboutCaller();

    await expect(caller.get()).resolves.toMatchObject({
      mission: "Valoriser le CBD français",
    });
  });

  it("renvoie null plutôt que de lever quand la ligne n'existe pas encore", async () => {
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue(
      undefined as never
    );

    await signIn(null);
    const caller = await aboutCaller();

    await expect(caller.get()).resolves.toBeNull();
  });

  it("refuse l'écriture à un anonyme et à un producteur", async () => {
    await signIn(null);
    expect(await codeOf(() => aboutCaller().then((c) => c.update({})))).toBe(
      "UNAUTHORIZED"
    );

    await signIn({ isAdmin: false, role: "producer" });
    expect(await codeOf(() => aboutCaller().then((c) => c.update({})))).toBe(
      "FORBIDDEN"
    );

    expect(updates).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("insère la ligne singleton au premier enregistrement", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue(
      undefined as never
    );

    const caller = await aboutCaller();
    await caller.update({ mission: "Notre mission" });

    expect(inserted).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(inserted[0]).toMatchObject({ mission: "Notre mission" });
  });

  it("met à jour la ligne existante au lieu d'en créer une seconde", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue({
      id: "about-1",
    } as never);

    const caller = await aboutCaller();
    await caller.update({ history: "Depuis 2023" });

    expect(updates).toHaveLength(1);
    expect(inserted).toHaveLength(0);
  });

  it("remplace un champ omis par null et une liste omise par un tableau vide", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue({
      id: "about-1",
    } as never);

    const caller = await aboutCaller();
    await caller.update({ mission: "Mission" });

    // L'écriture est un remplacement complet : un champ absent de l'entrée
    // efface la valeur stockée, il n'est pas conservé.
    expect(updates[0]).toMatchObject({
      mission: "Mission",
      history: null,
      values: null,
      galleryImages: [],
      teamMembers: [],
    });
  });

  it("rejette une image de galerie qui n'est pas une URL", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const caller = await aboutCaller();

    await expect(
      caller.update({ galleryImages: ["/uploads/photo.jpg"] })
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it("rejette un membre d'équipe sans nom ou sans rôle", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const caller = await aboutCaller();

    await expect(
      caller.update({ teamMembers: [{ id: "t1", name: "", role: "Juge" }] })
    ).rejects.toThrow();
    await expect(
      caller.update({ teamMembers: [{ id: "t1", name: "Alice", role: "" }] })
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it("accepte une photo vide et la normalise en null", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const { db } = await import("~/server/db");
    vi.mocked(db.query.organizationAbout.findFirst).mockResolvedValue({
      id: "about-1",
    } as never);

    const caller = await aboutCaller();
    await caller.update({
      teamMembers: [{ id: "t1", name: "Alice", role: "Juge", photo: "" }],
    });

    expect(updates[0]!.teamMembers).toEqual([
      { id: "t1", name: "Alice", role: "Juge", photo: null, bio: null },
    ]);
  });
});

describe("Activity Router", () => {
  it("refuse le journal à un anonyme, à un producteur et à un juré", async () => {
    await signIn(null);
    expect(await codeOf(() => activityCaller().then((c) => c.getRecent()))).toBe(
      "UNAUTHORIZED"
    );

    for (const role of ["producer", "jury"]) {
      await signIn({ isAdmin: false, role });
      expect(await codeOf(() => activityCaller().then((c) => c.getRecent()))).toBe(
        "FORBIDDEN"
      );
    }
  });

  it("borne la taille de page demandée", async () => {
    await signIn({ isAdmin: false, role: "organizer" });
    const caller = await activityCaller();

    // Sans borne, un appel unique déverserait tout le journal.
    await expect(caller.getRecent({ limit: 51 })).rejects.toThrow();
    await expect(caller.getRecent({ limit: 0 })).rejects.toThrow();
  });

  it("décode les métadonnées et tolère leur absence", async () => {
    await signIn({ isAdmin: true, role: "producer" });
    const { db } = await import("~/server/db");
    vi.mocked(db.query.activityLogs.findMany).mockResolvedValue([
      {
        id: "log-1",
        action: "cup.published",
        description: "Concours publié",
        metadata: '{"cupId":"cup-1"}',
        createdAt: new Date("2026-02-01T09:00:00Z"),
        user: { id: "user-1", name: "Staff", image: null },
      },
      {
        id: "log-2",
        action: "user.login",
        description: "Connexion",
        metadata: null,
        createdAt: new Date("2026-02-01T08:00:00Z"),
        user: null,
      },
    ] as never);

    const caller = await activityCaller();
    const logs = await caller.getRecent();

    expect(logs[0]!.metadata).toEqual({ cupId: "cup-1" });
    expect(logs[1]!.metadata).toBeNull();
    // Un log dont l'auteur a été anonymisé (RGPD) ne doit pas faire échouer
    // l'affichage du journal.
    expect(logs[1]!.user).toBeNull();
  });
});
