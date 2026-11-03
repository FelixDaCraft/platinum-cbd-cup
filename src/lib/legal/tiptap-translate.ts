import { createHash } from "node:crypto";
import { localizePath, type Locale } from "~/i18n/locales";

/**
 * Traduction d'un document TipTap par remplacement de ses nœuds texte.
 *
 * Une traduction est une liste de chaînes, une par nœud texte du document
 * français, dans l'ordre de lecture : la structure (titres, listes, liens,
 * marques) est reprise telle quelle, seul le texte change. Les liens
 * internes (`/confidentialite`) reçoivent le préfixe de la langue.
 */

export interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: TipTapNode[];
}

/** Textes du document, dans l'ordre de lecture. */
export function tiptapTexts(doc: TipTapNode): string[] {
  const out: string[] = [];
  const walk = (node: TipTapNode) => {
    if (node.type === "text" && typeof node.text === "string") out.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
}

/**
 * Empreinte du texte français : une traduction enregistrée avec une autre
 * empreinte a été faite sur une version antérieure du document.
 */
export function tiptapFingerprint(doc: TipTapNode): string {
  return createHash("sha256").update(JSON.stringify(tiptapTexts(doc))).digest("hex").slice(0, 16);
}

/**
 * Document traduit, ou null si la traduction ne correspond pas au document
 * (nombre de nœuds différent) : mieux vaut le texte français qu'un mélange.
 */
export function translateTiptap(
  doc: TipTapNode,
  strings: readonly string[],
  locale: Locale
): TipTapNode | null {
  if (tiptapTexts(doc).length !== strings.length) return null;
  let i = 0;
  const walk = (node: TipTapNode): TipTapNode => {
    const copy: TipTapNode = { ...node };
    if (node.type === "text" && typeof node.text === "string") {
      copy.text = strings[i++];
    }
    if (node.marks) {
      copy.marks = node.marks.map((mark) => {
        const href = mark.attrs?.href;
        if (mark.type === "link" && typeof href === "string" && href.startsWith("/")) {
          return { ...mark, attrs: { ...mark.attrs, href: localizePath(href, locale) } };
        }
        return mark;
      });
    }
    if (node.content) copy.content = node.content.map(walk);
    return copy;
  };
  return walk(doc);
}
