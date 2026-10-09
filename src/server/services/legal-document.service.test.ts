import { describe, it, expect, vi } from "vitest";
import { getLegalDocument } from "./legal-document.service";
import { DEFAULT_REGLEMENT_CONTENT } from "~/lib/legal/reglement-default";

const dbWith = (row: unknown) =>
  ({
    query: { legalDocuments: { findFirst: vi.fn().mockResolvedValue(row) } },
  }) as never;

describe("getLegalDocument", () => {
  it("rend le règlement par défaut tant que rien n'est enregistré", async () => {
    const doc = await getLegalDocument(dbWith(undefined), "reglement");
    expect(doc.isCustom).toBe(false);
    expect(doc.title).toBe("Règlement");
    expect(doc.content).toBe(DEFAULT_REGLEMENT_CONTENT);
  });

  it("rend la version enregistrée par l'organisateur", async () => {
    const updatedAt = new Date("2026-10-09T10:00:00Z");
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    const doc = await getLegalDocument(
      dbWith({ slug: "reglement", title: "Conditions", lede: null, content, updatedAt }),
      "reglement"
    );
    expect(doc).toMatchObject({ isCustom: true, title: "Conditions", lede: null, content, updatedAt });
  });

  it("le texte par défaut couvre les 13 articles du règlement", () => {
    const headings = DEFAULT_REGLEMENT_CONTENT.content.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(13);
  });
});
