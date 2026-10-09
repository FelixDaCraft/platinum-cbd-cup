import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TipTapContent, tiptapHeadings } from "./tiptap-content";

const doc = (href: string) => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Objet" }] },
    {
      type: "paragraph",
      content: [{ type: "text", text: "lien", marks: [{ type: "link", attrs: { href } }] }],
    },
  ],
});

describe("TipTapContent", () => {
  it("neutralise les liens javascript:", () => {
    const html = renderToStaticMarkup(createElement(TipTapContent, { content: doc("javascript:alert(1)") }));
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a");
  });

  it("ouvre les liens externes dans un nouvel onglet, pas les liens internes", () => {
    expect(renderToStaticMarkup(createElement(TipTapContent, { content: doc("https://exemple.fr") }))).toContain(
      'target="_blank"'
    );
    expect(renderToStaticMarkup(createElement(TipTapContent, { content: doc("/confidentialite") }))).not.toContain(
      "target="
    );
  });

  it("ancre les intertitres de premier niveau comme le sommaire", () => {
    const html = renderToStaticMarkup(createElement(TipTapContent, { content: doc("/x"), anchorHeadings: true }));
    expect(html).toContain('<h2 id="article-1">');
    expect(tiptapHeadings(doc("/x"))).toEqual([{ id: "article-1", title: "1. Objet" }]);
  });
});
