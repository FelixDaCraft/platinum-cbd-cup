import { Children, isValidElement, type ReactNode } from "react";

/**
 * Identité de l'entité qui édite le site et organise le concours.
 *
 * Source : annuaire des entreprises (SIREN 921 098 497, établissement actif).
 * Ces valeurs sont reprises telles quelles dans les mentions légales, le
 * règlement et sur les factures — un seul endroit pour les corriger.
 */
export const ASSOCIATION = {
  name: "Platinum CBD",
  legalForm: "Association déclarée (loi du 1er juillet 1901)",
  rna: "W442027639",
  siren: "921 098 497",
  siret: "921 098 497 00016",
  ape: "94.99Z — Autres organisations fonctionnant par adhésion volontaire",
  address: "9 rue de Beaulieu, 44340 Bouguenais, France",
  email: "contact@platinumcbdcup.eu",
  site: "platinumcbdcup.eu",
  /** Non assujettie : association à but non lucratif. */
  vatMention:
    "TVA non applicable — article 261-7-1° du code général des impôts",
} as const;

interface LegalSectionProps {
  /** Numéro d'article, repris dans le titre et dans l'ancre. */
  numeral: string;
  title: string;
  children: ReactNode;
}

/**
 * Un article du document. La numérotation n'est pas décorative : elle rend
 * les articles citables (« article 4 du règlement ») dans un échange avec un
 * participant ou une autorité, et l'ancre `#article-N` permet d'y renvoyer.
 */
export function LegalSection({ numeral, title, children }: LegalSectionProps) {
  return (
    // Marges et `scroll-margin-top` (la barre de navigation est collante : sans
    // marge, le titre visé par une ancre passerait dessous) dans
    // responsive/editorial-legal.ts, pour suivre la hauteur de l'en-tête.
    <section id={`article-${numeral}`} className="prose legal-section">
      <h2 style={{ marginTop: 0, textWrap: "balance" }}>
        <span style={{ color: "var(--accent-hi)" }}>{numeral}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

/** Sommaire cliquable, construit à partir des articles du document. */
function LegalToc({
  items,
}: {
  items: readonly { numeral: string; title: string }[];
}) {
  return (
    <nav aria-label="Sommaire" className="legal-toc">
      <p className="legal-toc-title">Sommaire</p>
      <ol className="legal-toc-list">
        {items.map(({ numeral, title }) => (
          <li key={numeral}>
            <a href={`#article-${numeral}`}>
              {numeral}. {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface LegalPageProps {
  title: string;
  lede: string;
  /** Date de dernière mise à jour, affichée en tête du document. */
  updatedAt: string;
  /** Affiche le sommaire des articles (par défaut : oui). */
  toc?: boolean;
  children: ReactNode;
}

export function LegalPage({
  title,
  lede,
  updatedAt,
  toc = true,
  children,
}: LegalPageProps) {
  // Le sommaire est dérivé des <LegalSection> enfants : une seule source pour
  // les titres, pas de liste à tenir à jour à côté du texte.
  const items = Children.toArray(children).flatMap((child) =>
    isValidElement<LegalSectionProps>(child) && child.type === LegalSection
      ? [{ numeral: child.props.numeral, title: child.props.title }]
      : [],
  );

  return (
    <div className="pg pg--narrow page-enter legal">
      <header className="pg-head">
        <h1 className="display">{title}</h1>
        <p className="pg-lede">{lede}</p>
        <p className="pg-meta" style={{ margin: 0 }}>
          Dernière mise à jour : {updatedAt}
        </p>
      </header>

      {toc && items.length > 1 && <LegalToc items={items} />}

      <div>{children}</div>
    </div>
  );
}

/** Paragraphe de corps de texte (mis en forme par `.prose`). */
export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

/** Liste à puces (mise en forme par `.prose`). */
export function List({ children }: { children: ReactNode }) {
  return <ul>{children}</ul>;
}

/**
 * Tableau clé / valeur, pour les blocs d'identité et les durées de
 * conservation. Chaque ligne passe sur deux lignes quand la largeur manque
 * (mobile) au lieu de déborder.
 */
export function KeyValues({
  rows,
}: {
  rows: readonly { k: string; v: ReactNode }[];
}) {
  return (
    <dl className="legal-kv">
      {rows.map(({ k, v }) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
