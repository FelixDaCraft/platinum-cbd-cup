import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

/**
 * Dépôt du COA : producteur du produit ou organisation, PDF seulement ; un
 * nouveau dépôt remplace le précédent et supprime son fichier.
 */

const root = mkdtempSync(path.join(tmpdir(), "coa-route-"));
vi.spyOn(process, "cwd").mockReturnValue(root);

const { caller, product, updates } = vi.hoisted(() => ({
  caller: { value: null as null | { userId: string; role: string; isOrganizer: boolean } },
  product: { value: null as unknown },
  updates: [] as Record<string, unknown>[],
}));

vi.mock("../../_lib/route-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireCaller: async () =>
      caller.value ?? NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
    forbidden: () => NextResponse.json({ error: "Permission refusée" }, { status: 403 }),
  };
});

vi.mock("../_lib/budget", () => ({
  consumeUploadBudget: () => ({ allowed: true }),
  refundUploadBudget: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: { products: { findFirst: async () => product.value } },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
}));

afterAll(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  updates.length = 0;
  caller.value = { userId: "producer-user", role: "producer", isOrganizer: false };
  product.value = {
    id: "prod-1",
    coaFile: null,
    registration: { producer: { userId: "producer-user" } },
  };
});

async function post(content: string, productId = "prod-1") {
  const { POST } = await import("./route");
  const { NextRequest } = await import("next/server");
  const formData = new FormData();
  formData.append("file", new File([content], "coa.pdf", { type: "application/pdf" }));
  formData.append("productId", productId);
  return POST(new NextRequest("https://example.test/api/upload/coa", { method: "POST", body: formData }));
}

describe("POST /api/upload/coa", () => {
  it("enregistre le COA du producteur du produit", async () => {
    const response = await post("%PDF-1.4 certificat");
    const body = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(body.url).toMatch(/^\/uploads\/coa\/prod-1\/[A-Za-z0-9_-]+\.pdf$/);
    expect(existsSync(path.join(root, "public", body.url))).toBe(true);
    expect(updates.at(-1)).toMatchObject({ coaFile: body.url });
  });

  it("accepte un dépôt par l'organisation", async () => {
    caller.value = { userId: "org-user", role: "organizer", isOrganizer: true };
    expect((await post("%PDF-1.4 certificat")).status).toBe(200);
  });

  it("refuse le producteur d'un autre produit", async () => {
    caller.value = { userId: "other-producer", role: "producer", isOrganizer: false };
    expect((await post("%PDF-1.4 certificat")).status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("refuse un fichier qui n'est pas un PDF", async () => {
    expect((await post("<html>pas un pdf</html>")).status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("refuse un identifiant de produit qui pourrait sortir du dossier", async () => {
    expect((await post("%PDF-1.4", "../etc")).status).toBe(400);
  });

  it("supprime l'ancien fichier quand le COA est remplacé", async () => {
    const oldDir = path.join(root, "public", "uploads", "coa", "prod-1");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(path.join(oldDir, "ancien.pdf"), "%PDF-1.4 ancien");
    product.value = {
      id: "prod-1",
      coaFile: "/uploads/coa/prod-1/ancien.pdf",
      registration: { producer: { userId: "producer-user" } },
    };

    expect((await post("%PDF-1.4 nouveau")).status).toBe(200);
    expect(existsSync(path.join(oldDir, "ancien.pdf"))).toBe(false);
  });
});
