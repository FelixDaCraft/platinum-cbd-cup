import type { Metadata } from "next";

import { db } from "~/server/db";
import { getLegalDocument } from "~/server/services/legal-document.service";
import { TipTapContent, tiptapHeadings } from "../_components/tiptap-content";
import { canonical } from "../_lib/seo";

/**
 * Le règlement s'édite dans le back-office (Contenu › Règlement) : la page
 * relit la version enregistrée à chaque affichage, sans cache, pour qu'une
 * correction soit en ligne immédiatement.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/reglement") },
  title: "Règlement du concours",
  description:
    "Conditions de participation à la Platinum CBD Cup : inscription, frais, anonymisation, notation à l'aveugle, résultats et usage des distinctions.",
  robots: { index: true, follow: true },
};

interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
}

const isSectionHeading = (n: DocNode) =>
  n.type === "heading" && Number(n.attrs?.level ?? 2) <= 2;

export default async function ReglementPage() {
  const doc = await getLegalDocument(db, "reglement");
  const nodes = ((doc.content as { content?: DocNode[] }).content ?? []) as DocNode[];
  const headings = tiptapHeadings(doc.content);

  // Un article = un intertitre de premier niveau et ce qui le suit, rendu
  // dans sa propre section (ancre #article-N, filets entre les articles).
  const preamble: DocNode[] = [];
  const sections: DocNode[][] = [];
  for (const node of nodes) {
    if (isSectionHeading(node)) sections.push([node]);
    else if (sections.length > 0) sections[sections.length - 1]!.push(node);
    else preamble.push(node);
  }

  const updatedAt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(doc.updatedAt);

  return (
    <div className="pg pg--narrow page-enter legal">
      <header className="pg-head">
        <h1 className="display">{doc.title}</h1>
        {doc.lede && <p className="pg-lede">{doc.lede}</p>}
        <p className="pg-meta" style={{ margin: 0 }}>
          Dernière mise à jour : {updatedAt}
        </p>
      </header>

      {headings.length > 1 && (
        <nav aria-label="Sommaire" className="legal-toc">
          <p className="legal-toc-title">Sommaire</p>
          <ol className="legal-toc-list">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div>
        {preamble.length > 0 && (
          <div className="prose legal-section">
            <TipTapContent content={{ type: "doc", content: preamble }} />
          </div>
        )}
        {sections.map((section, i) => (
          <section key={i} id={`article-${i + 1}`} className="prose legal-section">
            <TipTapContent content={{ type: "doc", content: section }} />
          </section>
        ))}
      </div>
    </div>
  );
}
