import type { ReactNode } from "react";

import { Eyebrow } from "~/components/portal/platinum";

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
  /** Numéro d'article, imprimé en vis-à-vis du titre. */
  numeral: string;
  title: string;
  children: ReactNode;
}

/**
 * Un article du document. La numérotation n'est pas décorative : elle rend
 * les articles citables (« article 4 du règlement ») dans un échange avec un
 * participant ou une autorité.
 */
export function LegalSection({ numeral, title, children }: LegalSectionProps) {
  return (
    <section
      id={`article-${numeral}`}
      style={{
        display: "grid",
        gridTemplateColumns: "52px minmax(0, 1fr)",
        gap: 20,
        paddingTop: 28,
        paddingBottom: 28,
        borderTop: "1px solid var(--line, rgba(255,255,255,.08))",
      }}
      className="legal-section"
    >
      <span
        className="mono fg3"
        style={{ fontSize: 13, paddingTop: 4, letterSpacing: ".06em" }}
        aria-hidden="true"
      >
        {numeral}
      </span>
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: 20,
            lineHeight: 1.25,
            margin: "0 0 12px",
            textWrap: "balance",
          }}
        >
          {title}
        </h2>
        <div className="legal-body" style={{ maxWidth: "66ch" }}>
          {children}
        </div>
      </div>
    </section>
  );
}

interface LegalPageProps {
  eyebrow: string;
  eyebrowIdx?: number;
  title: string;
  lede: string;
  /** Date de dernière mise à jour, affichée en tête du document. */
  updatedAt: string;
  children: ReactNode;
}

export function LegalPage({
  eyebrow,
  eyebrowIdx = 8,
  title,
  lede,
  updatedAt,
  children,
}: LegalPageProps) {
  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Eyebrow idx={eyebrowIdx}>{eyebrow}</Eyebrow>
        <h1 className="display" style={{ marginTop: 20, marginBottom: 20 }}>
          {title}
          <em>.</em>
        </h1>
        <p className="lede" style={{ maxWidth: 560 }}>
          {lede}
        </p>
        <p className="mono fg3" style={{ fontSize: 12, marginTop: 24 }}>
          Dernière mise à jour : {updatedAt}
        </p>
      </section>

      <div style={{ marginBottom: 80 }}>{children}</div>
    </div>
  );
}

/** Paragraphe de corps de texte, avec l'interligne des documents longs. */
export function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 14px", lineHeight: 1.65 }}>{children}</p>;
}

/** Liste à puces sobre, alignée sur le corps de texte. */
export function List({ children }: { children: ReactNode }) {
  return (
    <ul
      style={{
        margin: "0 0 14px",
        paddingLeft: 18,
        lineHeight: 1.65,
        display: "grid",
        gap: 6,
      }}
    >
      {children}
    </ul>
  );
}

/**
 * Tableau clé / valeur, pour les blocs d'identité et les durées de
 * conservation. Défile horizontalement plutôt que de déborder sur mobile.
 */
export function KeyValues({
  rows,
}: {
  rows: readonly { k: string; v: ReactNode }[];
}) {
  return (
    <div className="card" style={{ marginBottom: 14, overflowX: "auto" }}>
      {rows.map(({ k, v }) => (
        <div key={k} className="kv">
          <span className="kv-k">{k}</span>
          <span className="kv-v">{v}</span>
        </div>
      ))}
    </div>
  );
}
