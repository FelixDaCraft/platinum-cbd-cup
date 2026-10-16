import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

/**
 * Sous-dossiers privés de /uploads : un COA n'est servi qu'à l'organisation
 * et au producteur du produit, une analyse labo qu'à l'organisation. Aucun
 * fichier privé ne doit être gardé par un cache partagé (Cloudflare).
 */

const root = mkdtempSync(path.join(tmpdir(), "uploads-route-"));
vi.spyOn(process, "cwd").mockReturnValue(root);

const { session, users, productOwner } = vi.hoisted(() => ({
  session: { userId: null as string | null },
  users: new Map<string, { role: string; isAdmin: boolean }>(),
  productOwner: { userId: "producer-user" },
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => (session.userId ? { user: { id: session.userId } } : null),
    },
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: {
        findFirst: async () => (session.userId ? users.get(session.userId) : undefined),
      },
      products: {
        findFirst: async () => ({
          id: "prod-1",
          registration: { producer: { userId: productOwner.userId } },
        }),
      },
    },
  },
}));

beforeAll(() => {
  const coaDir = path.join(root, "public", "uploads", "coa", "prod-1");
  mkdirSync(coaDir, { recursive: true });
  writeFileSync(path.join(coaDir, "abc.pdf"), "%PDF-1.4 test");
  const labDir = path.join(root, "public", "uploads", "lab-analyses", "prod-1");
  mkdirSync(labDir, { recursive: true });
  writeFileSync(path.join(labDir, "lab.pdf"), "%PDF-1.4 lab");
  const logoDir = path.join(root, "public", "uploads", "producer-logos");
  mkdirSync(logoDir, { recursive: true });
  writeFileSync(path.join(logoDir, "logo.png"), "png");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  session.userId = null;
  users.clear();
  users.set("org-user", { role: "organizer", isAdmin: false });
  users.set("producer-user", { role: "producer", isAdmin: false });
  users.set("other-producer", { role: "producer", isAdmin: false });
  users.set("jury-user", { role: "jury", isAdmin: false });
});

async function get(...segments: string[]) {
  const { GET } = await import("./route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(`https://example.test/uploads/${segments.join("/")}`), {
    params: Promise.resolve({ path: segments }),
  });
}

describe("GET /uploads — sous-dossiers privés", () => {
  it("sert le COA au producteur du produit, sans cache partagé", async () => {
    session.userId = "producer-user";
    const response = await get("coa", "prod-1", "abc.pdf");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sert le COA à l'organisation", async () => {
    session.userId = "org-user";
    expect((await get("coa", "prod-1", "abc.pdf")).status).toBe(200);
  });

  it("cache le COA à un autre producteur, au jury et aux anonymes", async () => {
    for (const userId of ["other-producer", "jury-user", null]) {
      session.userId = userId;
      expect((await get("coa", "prod-1", "abc.pdf")).status).toBe(404);
    }
  });

  it("réserve les analyses labo à l'organisation, même pour le producteur", async () => {
    session.userId = "producer-user";
    expect((await get("lab-analyses", "prod-1", "lab.pdf")).status).toBe(404);

    session.userId = "org-user";
    const response = await get("lab-analyses", "prod-1", "lab.pdf");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("garde le cache public pour les visuels publics", async () => {
    const response = await get("producer-logos", "logo.png");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
  });
});
