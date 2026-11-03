import { describe, it, expect, vi } from "vitest";
import { getLegalDocument, localizeLegalDocument } from "./legal-document.service";
import { tiptapFingerprint, tiptapTexts, type TipTapNode } from "~/lib/legal/tiptap-translate";
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

describe("localizeLegalDocument", () => {
  const base = {
    slug: "reglement" as const,
    title: "Règlement",
    lede: "Chapeau",
    content: DEFAULT_REGLEMENT_CONTENT as unknown as Record<string, unknown>,
    updatedAt: new Date(),
    isCustom: false,
    translations: {},
  };

  it("en français, rend le document tel quel", () => {
    expect(localizeLegalDocument(base, "fr")).toMatchObject({ title: "Règlement", status: "translated" });
  });

  it("sans traduction en base, utilise la traduction fournie du règlement en vigueur", () => {
    const de = localizeLegalDocument(base, "de");
    expect(de.status).toBe("translated");
    expect(de.title).toBe("Reglement");
    expect(tiptapTexts(de.content as TipTapNode)[0]).toBe("1. Gegenstand und Veranstalter");
  });

  it("préfère une traduction en base faite sur le texte actuel", () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Custom" }] }] };
    const doc = {
      ...base,
      translations: {
        en: { title: "Custom rules", content, sourceFingerprint: tiptapFingerprint(base.content as TipTapNode) },
      },
    };
    expect(localizeLegalDocument(doc, "en")).toMatchObject({ title: "Custom rules", content, status: "translated" });
  });

  it("revient au français si le texte a été modifié depuis la traduction", () => {
    const edited = JSON.parse(JSON.stringify(DEFAULT_REGLEMENT_CONTENT));
    edited.content[1].content[0].text = "Texte modifié par l'organisateur.";
    const doc = {
      ...base,
      isCustom: true,
      content: edited,
      translations: { it: { title: "Regolamento", content: { type: "doc" }, sourceFingerprint: "ancienne" } },
    };
    const it = localizeLegalDocument(doc, "it");
    expect(it.status).toBe("french");
    expect(it.content).toBe(edited);
  });
});
