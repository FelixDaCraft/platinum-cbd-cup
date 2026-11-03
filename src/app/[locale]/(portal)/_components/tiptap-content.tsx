import { Fragment, type ReactNode } from "react";

/**
 * Rendu d'un document TipTap (JSON) en éléments HTML, pour le portail :
 * articles et règlement. Couvre paragraphes, intertitres, listes, citations,
 * images et marques (gras, italique, souligné, lien) ; un nœud inconnu rend
 * ses enfants.
 */

interface TipTapNode {
  type?: string;
  content?: unknown[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, string> }[];
  attrs?: Record<string, string>;
}

/** Liens admis : web, mail, téléphone et chemins du site. Le reste (javascript:, data:…) est neutralisé. */
function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith("#")) return h;
  return null;
}

function textOf(node: TipTapNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map((c) => textOf(c as TipTapNode)).join("");
}

/** Intertitres de premier niveau (h2) d'un document, pour un sommaire. */
export function tiptapHeadings(doc: unknown): { id: string; title: string }[] {
  const nodes = ((doc as TipTapNode)?.content ?? []) as TipTapNode[];
  return nodes
    .filter((n) => n.type === "heading" && Number(n.attrs?.level ?? 2) <= 2)
    .map((n, i) => ({ id: `article-${i + 1}`, title: textOf(n).trim() }));
}

function renderNode(raw: unknown, key: number, headingId?: string): ReactNode {
  const node = raw as TipTapNode;
  if (!node) return null;

  if (node.type === "text") {
    let el: ReactNode = node.text ?? "";
    for (const m of node.marks ?? []) {
      if (m.type === "bold") el = <strong>{el}</strong>;
      else if (m.type === "italic") el = <em>{el}</em>;
      else if (m.type === "underline") el = <u>{el}</u>;
      else if (m.type === "link") {
        const href = safeHref(m.attrs?.href);
        if (href) {
          const external = /^https?:/i.test(href);
          el = (
            <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {el}
            </a>
          );
        }
      }
    }
    return <Fragment key={key}>{el}</Fragment>;
  }

  const children = (node.content ?? []).map((c, i) => renderNode(c, i));

  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      // Le titre de la page occupe le h1 : les intertitres commencent à h2.
      const level = Number(node.attrs?.level ?? 2);
      return level <= 2 ? (
        <h2 key={key} id={headingId}>
          {children}
        </h2>
      ) : (
        <h3 key={key}>{children}</h3>
      );
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule":
      return <hr key={key} className="hr" />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      if (!node.attrs?.src) return null;
      // Dimensions enregistrées par l'éditeur : avec height:auto, le
      // navigateur réserve la place avant le chargement (pas de saut).
      const largeur = Number(node.attrs.width);
      const hauteur = Number(node.attrs.height);
      const dimensions =
        Number.isFinite(largeur) && largeur > 0 && Number.isFinite(hauteur) && hauteur > 0
          ? { width: largeur, height: hauteur }
          : {};
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          {...dimensions}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "auto" }}
        />
      );
    }
    default:
      return <Fragment key={key}>{children}</Fragment>;
  }
}

/**
 * @param anchorHeadings - donne aux h2 de premier niveau les ancres
 *   `article-1`, `article-2`… (celles de `tiptapHeadings`).
 */
export function TipTapContent({
  content,
  anchorHeadings = false,
}: {
  content: unknown;
  anchorHeadings?: boolean;
}) {
  const nodes = ((content as TipTapNode)?.content ?? []) as TipTapNode[];
  let h = 0;
  return (
    <>
      {nodes.map((n, i) => {
        const isAnchor =
          anchorHeadings && n.type === "heading" && Number(n.attrs?.level ?? 2) <= 2;
        return renderNode(n, i, isAnchor ? `article-${++h}` : undefined);
      })}
    </>
  );
}
