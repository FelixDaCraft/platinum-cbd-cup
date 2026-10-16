import type { Metadata } from "next";

import { ArrowUp } from "lucide-react";
import { db } from "~/server/db";
import { PageHead } from "~/components/portal/street/street";
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
    <div className="pg pg--narrow legal">
      <PageHead edition="Conditions de participation" title="Règlement" lede={doc.lede || undefined} seed={10}>
        <p className="legal-updated">Dernière mise à jour : {updatedAt}</p>
      </PageHead>

      {headings.length > 1 && (
        <nav aria-label="Sommaire" className="legal-toc" id="sommaire">
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
            {/* Le règlement est long (11 000 px sur mobile) : retour au
                sommaire en fin d'article. */}
            {headings.length > 1 && (
              <a href="#sommaire" className="legal-top">
                Sommaire
                <ArrowUp size={14} aria-hidden="true" />
              </a>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
