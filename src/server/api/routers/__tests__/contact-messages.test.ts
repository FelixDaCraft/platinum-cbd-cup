import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Routeur contact-messages — un formulaire ouvert à tous qui écrit en base
 * et déclenche un email vers les organisateurs. Trois choses doivent tenir :
 * le garde de rôle sur la boîte de réception, l'échappement HTML du contenu
 * saisi avant interpolation dans l'email, et le plafond de débit par IP.
 */

const mocks = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null }),
}));

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("nanoid", () => ({ nanoid: () => "msg-test-1" }));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mocks.send };
  },
}));

vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "https://test.platinumcbdcup.eu",
    NODE_ENV: "test",
  },
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
        users: { findFirst: vi.fn(), findMany: vi.fn() },
        contactMessages: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      select: selectChain,
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          dbState.inserted.push(values);
          return Promise.resolve(undefined);
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
const nextIp = () => `192.0.2.${++ipCounter % 250}`;

async function createCaller(ip = nextIp()) {
  const { contactMessagesRouter } = await import("../contact-messages");
  const { db } = await import("~/server/db");

  return contactMessagesRouter.createCaller({
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

async function codeOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    return (error as TRPCError).code;
  }
  throw new Error("La procédure aurait dû lever une erreur");
}

/** HTML du dernier email envoyé par Resend. */
function lastEmailHtml(): string {
  const call = mocks.send.mock.calls.at(-1);
  return (call?.[0] as { html: string }).html;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  selectResults.length = 0;
  updates.length = 0;
  deleted.length = 0;
  inserted.length = 0;

  const { db } = await import("~/server/db");
  vi.mocked(db.query.users.findMany).mockResolvedValue([
    { email: "organisateur@platinumcbdcup.eu" },
  ] as never);
});

const validSubmission = {
  senderName: "Jean Dupont",
  senderEmail: "jean@example.com",
  subject: "general" as const,
  message: "Bonjour, je souhaite des informations sur le concours 2026.",
};

describe("Contact Messages Router", () => {
  describe("Garde de rôle sur la boîte de réception", () => {
    it("refuse un appelant anonyme sur toutes les procédures", async () => {
      await signIn(null);
      const caller = await createCaller();

      expect(await codeOf(() => caller.list({}))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.getById({ id: "m1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.markAsRead({ id: "m1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.toggleStar({ id: "m1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.archive({ id: "m1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.delete({ id: "m1" }))).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.getUnreadCount())).toBe("UNAUTHORIZED");
    });

    it("refuse un producteur et un juré authentifiés", async () => {
      for (const role of ["producer", "jury"]) {
        await signIn({ isAdmin: false, role });
        const caller = await createCaller();

        expect(await codeOf(() => caller.list({}))).toBe("FORBIDDEN");
        expect(await codeOf(() => caller.getById({ id: "m1" }))).toBe("FORBIDDEN");
        expect(await codeOf(() => caller.markAsRead({ id: "m1" }))).toBe("FORBIDDEN");
        expect(await codeOf(() => caller.toggleStar({ id: "m1" }))).toBe("FORBIDDEN");
        expect(await codeOf(() => caller.archive({ id: "m1" }))).toBe("FORBIDDEN");
        expect(await codeOf(() => caller.delete({ id: "m1" }))).toBe("FORBIDDEN");
        // Le volume de courrier reçu est déjà une information : même le
        // compteur de pastille reste réservé à l'organisateur.
        expect(await codeOf(() => caller.getUnreadCount())).toBe("FORBIDDEN");
      }

      expect(deleted).toHaveLength(0);
      expect(updates).toHaveLength(0);
    });

    it("renvoie NOT_FOUND sur un identifiant inconnu plutôt que null", async () => {
      await signIn({ isAdmin: false, role: "organizer" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.contactMessages.findFirst).mockResolvedValue(
        undefined as never
      );

      const caller = await createCaller();
      expect(await codeOf(() => caller.getById({ id: "inconnu" }))).toBe("NOT_FOUND");
      expect(await codeOf(() => caller.toggleStar({ id: "inconnu" }))).toBe(
        "NOT_FOUND"
      );
      expect(updates).toHaveLength(0);
    });

    it("inverse l'étoile à partir de l'état stocké, pas d'une valeur fournie", async () => {
      await signIn({ isAdmin: false, role: "organizer" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.contactMessages.findFirst).mockResolvedValue({
        id: "m1",
        isStarred: true,
      } as never);

      const caller = await createCaller();
      await expect(caller.toggleStar({ id: "m1" })).resolves.toEqual({
        success: true,
        isStarred: false,
      });
      expect(updates[0]).toMatchObject({ isStarred: false });
    });

    it("filtre la recherche sur le nom, l'email et le corps du message", async () => {
      await signIn({ isAdmin: true, role: "producer" });
      const { db } = await import("~/server/db");
      vi.mocked(db.query.contactMessages.findMany).mockResolvedValue([
        { senderName: "Alice", senderEmail: "a@x.fr", message: "Bonjour" },
        { senderName: "Bob", senderEmail: "bob@sponsor.fr", message: "Partenariat" },
        { senderName: "Carl", senderEmail: "c@x.fr", message: "Question SPONSOR" },
      ] as never);

      const caller = await createCaller();
      const result = await caller.list({ search: "sponsor" });

      // La recherche est insensible à la casse et couvre les trois champs.
      expect(result.map((m) => m.senderName)).toEqual(["Bob", "Carl"]);
    });

    it("renvoie 0 quand aucun message n'est non lu", async () => {
      await signIn({ isAdmin: false, role: "organizer" });
      selectResults.push([]);

      const caller = await createCaller();
      await expect(caller.getUnreadCount()).resolves.toEqual({ count: 0 });
    });
  });

  describe("submit (public)", () => {
    it("enregistre le message en non lu et notifie les organisateurs", async () => {
      const caller = await createCaller();
      await expect(caller.submit(validSubmission)).resolves.toMatchObject({
        success: true,
      });

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        id: "msg-test-1",
        status: "unread",
        isStarred: false,
        senderEmail: "jean@example.com",
      });

      expect(mocks.send).toHaveBeenCalledTimes(1);
      const email = mocks.send.mock.calls[0]![0] as {
        to: string[];
        replyTo: string;
      };
      expect(email.to).toEqual(["organisateur@platinumcbdcup.eu"]);
      // Répondre depuis la boîte de réception doit écrire au visiteur.
      expect(email.replyTo).toBe("jean@example.com");
    });

    it("échappe le HTML saisi par le visiteur dans l'email de notification", async () => {
      const caller = await createCaller();
      await caller.submit({
        ...validSubmission,
        senderName: '<img src=x onerror="alert(1)">',
        message: "<script>fetch('//evil')</script> merci de me rappeler",
      });

      const html = lastEmailHtml();
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
      expect(html).toContain("&lt;script&gt;");
    });

    it("retombe sur l'adresse publique quand aucun organisateur n'existe", async () => {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.users.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      await caller.submit(validSubmission);

      const email = mocks.send.mock.calls[0]![0] as { to: string[] };
      expect(email.to).toEqual(["contact@platinumcbdcup.eu"]);
    });

    it("confirme l'envoi au visiteur même si Resend échoue", async () => {
      // Le message est déjà en base : une panne d'email ne doit pas se
      // traduire par une erreur côté formulaire, sinon le visiteur renvoie.
      mocks.send.mockRejectedValue(new Error("Resend down"));

      const caller = await createCaller();
      await expect(caller.submit(validSubmission)).resolves.toMatchObject({
        success: true,
      });
      expect(inserted).toHaveLength(1);
    });

    it.each([
      ["nom trop court", { senderName: "J" }],
      ["email invalide", { senderEmail: "pas-une-adresse" }],
      ["message trop court", { message: "court" }],
      ["message trop long", { message: "a".repeat(5001) }],
      ["sujet hors liste", { subject: "spam" as never }],
    ])("rejette une soumission au %s sans rien écrire", async (_label, patch) => {
      const caller = await createCaller();

      await expect(caller.submit({ ...validSubmission, ...patch })).rejects.toThrow();
      expect(inserted).toHaveLength(0);
      expect(mocks.send).not.toHaveBeenCalled();
    });

    it("plafonne les soumissions à 5 par minute et par IP", async () => {
      const caller = await createCaller("198.51.100.42");

      for (let i = 0; i < 5; i++) {
        await caller.submit({ ...validSubmission, message: `Message numéro ${i} ok` });
      }

      expect(await codeOf(() => caller.submit(validSubmission))).toBe(
        "TOO_MANY_REQUESTS"
      );
      expect(inserted).toHaveLength(5);
    });
  });
});
