import { describe, it, expect } from "vitest";

import { tiptapDocumentInput } from "../tiptap";

/**
 * Le contenu riche des articles arrive du client en JSON libre. Trois choses
 * doivent tenir : un document normal passe sans être abîmé, un document
 * imbriqué trop profond est refusé (le rendu serveur du portail le parcourt
 * récursivement), et aucune URL exécutable ne peut se glisser dans un lien ou
 * une image.
 */

/** Construit un document imbriqué de `depth` niveaux sous la racine. */
function nest(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { type: "text", text: "fond" };
  for (let i = 0; i < depth; i++) {
    node = { type: "paragraph", content: [node] };
  }
  return { type: "doc", content: [node] };
}

describe("tiptapDocumentInput", () => {
  it("accepte un document tel que l'éditeur du dashboard le produit", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, textAlign: "left" },
          content: [{ type: "text", text: "Résultats 2026" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Le palmarès",
                      marks: [
                        { type: "bold" },
                        {
                          type: "link",
                          attrs: { href: "https://platinumcbdcup.eu/resultats" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "horizontalRule" },
        { type: "image", attrs: { src: "/uploads/podium.jpg", alt: "Podium" } },
      ],
    };

    const parsed = tiptapDocumentInput.parse(doc);
    expect(parsed).toEqual(doc);
  });

  it("accepte un document vide", () => {
    expect(tiptapDocumentInput.parse({ type: "doc", content: [] })).toEqual({
      type: "doc",
      content: [],
    });
  });

  it("refuse une racine qui n'est pas un document TipTap", () => {
    expect(() => tiptapDocumentInput.parse({ foo: "bar" })).toThrow();
    expect(() =>
      tiptapDocumentInput.parse({ type: "paragraph", content: [] })
    ).toThrow();
  });

  it("accepte une imbrication raisonnable et refuse au-delà de la borne", () => {
    // 10 niveaux : plus que l'éditeur n'en produit, sous la limite.
    expect(() => tiptapDocumentInput.parse(nest(10))).not.toThrow();
    // Le cas qui faisait tomber le rendu serveur en dépassement de pile.
    expect(() => tiptapDocumentInput.parse(nest(400))).toThrow();
  });

  it("refuse une URL exécutable dans un lien", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "cliquez",
              // eslint-disable-next-line no-script-url
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };

    expect(() => tiptapDocumentInput.parse(doc)).toThrow();
  });

  it("refuse une URL exécutable dans une image", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "data:text/html;base64,PHNjcmlwdD4=" } },
      ],
    };

    expect(() => tiptapDocumentInput.parse(doc)).toThrow();
  });

  it("accepte les liens relatifs, mailto et ancres", () => {
    for (const href of ["/contact", "mailto:contact@platinumcbdcup.eu", "#podium"]) {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "lien", marks: [{ type: "link", attrs: { href } }] },
            ],
          },
        ],
      };
      expect(() => tiptapDocumentInput.parse(doc)).not.toThrow();
    }
  });

  it("refuse un attribut qui transporte un objet arbitraire", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { payload: { a: 1 } } }],
    };

    expect(() => tiptapDocumentInput.parse(doc)).toThrow();
  });

  it("retire les clés inconnues au lieu de les stocker", () => {
    const parsed = tiptapDocumentInput.parse({
      type: "doc",
      content: [{ type: "paragraph", sneaky: "valeur", content: [] }],
    });

    expect(parsed.content?.[0]).toEqual({ type: "paragraph", content: [] });
  });
});
