import { ArrowUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { db } from "~/server/db";
import { PageHead } from "~/components/portal/street/street";
import {
  getLegalDocument,
  localizeLegalDocument,
} from "~/server/services/legal-document.service";
import { TipTapContent, tiptapHeadings } from "../_components/tiptap-content";
import { localizedMetadata } from "../_lib/page-metadata";

/**
 * Le règlement s'édite dans le back-office (Contenu › Règlement) : la page
 * relit la version enregistrée à chaque affichage, sans cache, pour qu'une
 * correction soit en ligne immédiatement.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return localizedMetadata("/reglement", "rules", { robots: { index: true, follow: true } });
}

interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
}

const isSectionHeading = (n: DocNode) =>
  n.type === "heading" && Number(n.attrs?.level ?? 2) <= 2;

export default async function ReglementPage() {
  const locale = await currentLocale();
  const t = await getTranslations("rules");
  const source = await getLegalDocument(db, "reglement");
  const doc = { ...localizeLegalDocument(source, locale), updatedAt: source.updatedAt };
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

  const updatedAt = formatDate(doc.updatedAt, locale);
  const isFrenchText = doc.status === "french";

  return (
    <div className="pg pg--narrow legal">
      <PageHead
        edition={t("edition")}
        title={isFrenchText ? t("title") : doc.title}
        lede={(isFrenchText ? undefined : doc.lede) || undefined}
        seed={10}
      >
        <p className="legal-updated">{t("updated", { date: updatedAt })}</p>
      </PageHead>

      {/* Traduction : la version française fait foi. Sans traduction à
          jour, le texte français s'affiche et la page le dit. */}
      {locale !== "fr" && (
        <p className="notice" role="note">
          {isFrenchText ? t("frenchOnly") : t("frenchPrevails")}
        </p>
      )}

      {headings.length > 1 && (
        <nav aria-label={t("toc")} className="legal-toc" id="sommaire">
          <p className="legal-toc-title">{t("toc")}</p>
          <ol className="legal-toc-list">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div lang={isFrenchText ? "fr" : undefined}>
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
                {t("toc")}
                <ArrowUp size={14} aria-hidden="true" />
              </a>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
