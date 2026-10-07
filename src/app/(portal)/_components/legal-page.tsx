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
    <section
      id={`article-${numeral}`}
      className="prose legal-section"
      style={{
        paddingTop: 36,
        paddingBottom: 36,
        borderTop: "1px solid var(--line)",
        // La barre de navigation est collante : sans marge, le titre visé
        // par une ancre passerait dessous.
        scrollMarginTop: 96,
      }}
    >
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
    <nav
      aria-label="Sommaire"
      style={{
        marginBottom: 16,
        padding: "20px 22px",
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "var(--bg-2)",
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
        Sommaire
      </p>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          columns: "2 240px",
          columnGap: 32,
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        {items.map(({ numeral, title }) => (
          <li key={numeral} style={{ breakInside: "avoid", padding: "4px 0" }}>
            <a
              href={`#article-${numeral}`}
              style={{
                color: "var(--fg-2)",
                textDecorationColor: "var(--line-strong)",
                textUnderlineOffset: 4,
              }}
            >
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
    <div className="pg pg--narrow page-enter">
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
    <dl
      style={{
        marginBottom: 0,
        padding: "4px 22px",
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "var(--bg-2)",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      {rows.map(({ k, v }, i) => (
        <div
          key={k}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2px 20px",
            padding: "12px 0",
            borderTop: i === 0 ? 0 : "1px solid var(--line)",
          }}
        >
          <dt style={{ flex: "0 0 190px", color: "var(--fg-3)" }}>{k}</dt>
          <dd
            style={{
              flex: "1 1 260px",
              minWidth: 0,
              margin: 0,
              color: "var(--fg)",
              overflowWrap: "break-word",
            }}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
