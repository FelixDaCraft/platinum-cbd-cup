import { describe, expect, it } from "vitest";
import { DEFAULT_REGLEMENT_CONTENT } from "./reglement-default";
import { REGLEMENT_TRANSLATIONS } from "./reglement-translations";
import { tiptapFingerprint, tiptapTexts, translateTiptap, type TipTapNode } from "./tiptap-translate";
import { locales } from "~/i18n/locales";

const doc: TipTapNode = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Objet" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Voir la " },
        {
          type: "text",
          text: "politique",
          marks: [{ type: "link", attrs: { href: "/confidentialite" } }],
        },
        { type: "text", text: "." },
      ],
    },
  ],
};

describe("translateTiptap", () => {
  it("remplace le texte et garde la structure", () => {
    const out = translateTiptap(doc, ["1. Purpose", "See the ", "policy", "."], "en");
    expect(tiptapTexts(out!)).toEqual(["1. Purpose", "See the ", "policy", "."]);
    expect(out!.content![0]!.attrs).toEqual({ level: 2 });
  });

  it("préfixe les liens internes de la langue", () => {
    const out = translateTiptap(doc, ["a", "b", "c", "d"], "de");
    const link = out!.content![1]!.content![1]!.marks![0]!;
    expect(link.attrs?.href).toBe("/de/confidentialite");
  });

  it("ne touche pas au document d'origine", () => {
    translateTiptap(doc, ["a", "b", "c", "d"], "en");
    expect(tiptapTexts(doc)[0]).toBe("1. Objet");
  });

  it("refuse une traduction qui ne correspond pas au document", () => {
    expect(translateTiptap(doc, ["a", "b"], "en")).toBeNull();
  });

  it("l'empreinte change dès que le texte français change", () => {
    const edited: TipTapNode = JSON.parse(JSON.stringify(doc));
    edited.content![0]!.content![0]!.text = "1. Objet du concours";
    expect(tiptapFingerprint(edited)).not.toBe(tiptapFingerprint(doc));
  });
});

describe("traductions du règlement", () => {
  const source = tiptapTexts(DEFAULT_REGLEMENT_CONTENT as unknown as TipTapNode);

  for (const locale of locales.filter((l) => l !== "fr")) {
    const tr = REGLEMENT_TRANSLATIONS[locale];

    it(`${locale} : un texte par nœud du règlement en vigueur`, () => {
      expect(tr.sourceFingerprint).toBe(tiptapFingerprint(DEFAULT_REGLEMENT_CONTENT as unknown as TipTapNode));
      expect(tr.texts).toHaveLength(source.length);
      expect(tr.title.trim()).not.toBe("");
      expect(tr.lede.trim()).not.toBe("");
    });

    it(`${locale} : numéros d'articles, adresses et liens conservés`, () => {
      source.forEach((fr, i) => {
        const target = tr.texts[i]!;
        expect(target.trim(), `nœud ${i}`).not.toBe("");
        const article = /^(\d+)\. /.exec(fr)?.[1];
        if (article) expect(target.startsWith(`${article}. `), `nœud ${i}`).toBe(true);
        if (fr.includes("@")) expect(target).toBe(fr);
        for (const id of ["W442027639", "921 098 497 00016", "Viva.com"]) {
          if (fr.includes(id)) expect(target, `nœud ${i}`).toContain(id);
        }
      });
    });
  }
});
