"use client";

import Link from "next/link";
import { PlatinumTrophy } from "./platinum-trophy";
import { PtEyebrow, PtPill, PtCountdown, PtTicker } from "./platinum-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatinumLandingProps {
  orgName: string;
  logoUrl: string | null;
  currentCup: {
    id: string;
    name: string;
    eventDate: Date | null;
    registrationCloseDate: Date | null;
    status: string;
    totalProducts: number;
    maxProducts: number;
    totalCategories: number;
  } | null;
  categories: {
    id: string;
    name: string;
    code: string;
    productCount: number;
  }[];
  stats: {
    totalCups: number;
    totalProducts: number;
    totalWinners: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEditionYear(date: Date | null): string {
  if (!date) return new Date().getFullYear().toString();
  return new Date(date).getFullYear().toString();
}

function isOpen(status: string): boolean {
  return status === "published" || status === "open";
}

/** Derive anonymised ticker codes from category names */
function buildTickerItems(
  categories: PlatinumLandingProps["categories"]
): string[] {
  if (categories.length === 0) return ["CM-001", "CM-002", "CM-003", "CM-004", "CM-005"];
  // Each category contributes a few dummy produit codes
  return categories.flatMap((cat) => {
    const prefix = cat.code.slice(0, 3).toUpperCase();
    return [
      `${prefix}-${String(Math.abs(hashStr(cat.id) % 900) + 100)}`,
      `${prefix}-${String(Math.abs(hashStr(cat.id + "x") % 900) + 100)}`,
      `${prefix}-${String(Math.abs(hashStr(cat.id + "y") % 900) + 100)}`,
    ];
  });
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Info cards data (static copy)
// ---------------------------------------------------------------------------

const INFO_CARDS = [
  {
    idx: 1,
    title: "Panneau aveugle",
    body: "Chaque produit est anonymisé dès la réception. Les jurés évaluent sans connaître le producteur ni l'origine — seul le produit parle.",
    label: "BLIND PANEL",
  },
  {
    idx: 2,
    title: "Notation laboratoire",
    body: "Les scores sont calculés selon une méthodologie scientifique reproductible. Aucune note ne dépend d'un seul évaluateur.",
    label: "LAB-BACKED",
  },
  {
    idx: 3,
    title: "Résultats publics",
    body: "Chaque palmarès est publié dans son intégralité, vérifiable par tous. Pas de liste partielle, pas de tri discrétionnaire.",
    label: "PUBLIC LEDGER",
  },
] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PlatinumLanding — homepage template for the Platinum portal theme.
 *
 * All layout uses `pt-*` CSS classes defined in platinum-styles.ts.
 * No hardcoded data — everything is derived from props.
 */
export function PlatinumLanding({
  orgName,
  logoUrl,
  currentCup,
  categories,
  stats,
}: PlatinumLandingProps) {
  const cupOpen = currentCup ? isOpen(currentCup.status) : false;
  const editionYear = formatEditionYear(currentCup?.eventDate ?? null);
  const editionNumber = stats.totalCups;

  const registrationTarget =
    currentCup?.registrationCloseDate
      ? new Date(currentCup.registrationCloseDate).getTime()
      : null;

  const tickerItems = buildTickerItems(categories);

  const lede = `Le concours de référence pour les producteurs exigeants. ${stats.totalProducts.toLocaleString("fr-FR")} produits évalués en ${stats.totalCups} éditions.`;

  return (
    <div className="pt-root">
      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="pt-hero" aria-label="Présentation">
        <div className="pt-hero-grid">
          {/* Left column */}
          <div className="pt-hero-content">
            <PtEyebrow>
              Édition {String(editionNumber).padStart(2, "0")} · {editionYear} ·{" "}
              <PtPill variant="accent" dot={cupOpen}>
                {cupOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"}
              </PtPill>
            </PtEyebrow>

            <h1 className="pt-display">
              {orgName}
            </h1>

            <p className="pt-lede">{lede}</p>

            <div className="pt-hero-ctas">
              {currentCup && cupOpen ? (
                <Link href={`/cups/${currentCup.id}/register`} className="pt-btn accent">
                  S&apos;inscrire
                </Link>
              ) : (
                <Link href="/cups" className="pt-btn accent">
                  S&apos;inscrire
                </Link>
              )}
              {currentCup ? (
                <Link href={`/cups/${currentCup.id}`} className="pt-btn ghost">
                  Voir la cup
                </Link>
              ) : (
                <Link href="/cups" className="pt-btn ghost">
                  Voir les cups
                </Link>
              )}
            </div>
          </div>

          {/* Right column: 3D trophy */}
          <div className="pt-hero-trophy" aria-hidden="true">
            {logoUrl ? (
              <PlatinumTrophy logoUrl={logoUrl} size={420} />
            ) : (
              /* Fallback placeholder when no logo is configured */
              <div
                className="pt-trophy-placeholder"
                style={{
                  width: 420,
                  height: 420,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: "2px dashed var(--pt-border, rgba(255,255,255,0.1))",
                  color: "var(--pt-accent, #c8a03c)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "4rem",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  opacity: 0.6,
                }}
              >
                {orgName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* COUNTDOWN BAR                                                       */}
      {/* ------------------------------------------------------------------ */}
      {currentCup && (
        <section className="pt-section pt-section-sm" aria-label="Compte à rebours">
          <div className="pt-card pt-countdown-bar">
            {/* Left: countdown or closed label */}
            <div className="pt-countdown-bar-left">
              {registrationTarget && cupOpen ? (
                <>
                  <span className="pt-label">Fermeture des inscriptions</span>
                  <PtCountdown target={registrationTarget} />
                </>
              ) : (
                <>
                  <span className="pt-label">Statut des inscriptions</span>
                  <PtPill variant={cupOpen ? "accent" : "default"} dot={cupOpen}>
                    {cupOpen ? "OUVERTES" : "FERMÉES"}
                  </PtPill>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="pt-countdown-bar-divider" aria-hidden="true" />

            {/* Middle: produits */}
            <div className="pt-countdown-bar-stat">
              <span className="pt-stat-value">
                {currentCup.totalProducts}
                <span
                  style={{
                    fontSize: "0.5em",
                    opacity: 0.5,
                    marginLeft: "0.3em",
                    fontWeight: 400,
                  }}
                >
                  / {currentCup.maxProducts}
                </span>
              </span>
              <span className="pt-stat-label">Produits inscrits</span>
            </div>

            <div className="pt-countdown-bar-divider" aria-hidden="true" />

            {/* Right: categories */}
            <div className="pt-countdown-bar-stat">
              <span className="pt-stat-value">{currentCup.totalCategories}</span>
              <span className="pt-stat-label">Catégories</span>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TICKER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <PtTicker items={tickerItems} />

      {/* ------------------------------------------------------------------ */}
      {/* THREE-UP INFO CARDS                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="pt-section" aria-labelledby="pt-info-heading">
        <div className="pt-section-header">
          <PtEyebrow idx={1}>Méthodologie</PtEyebrow>
          <h2 id="pt-info-heading" className="pt-section-title">
            Ce qui se passe ici
          </h2>
        </div>

        <div className="pt-cards-grid pt-cards-3">
          {INFO_CARDS.map((card) => (
            <article key={card.idx} className="pt-card pt-card-hover">
              <PtPill variant="solid">{card.label}</PtPill>
              <h3 className="pt-card-title">{card.title}</h3>
              <p className="pt-card-body">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CATEGORIES GRID                                                     */}
      {/* ------------------------------------------------------------------ */}
      {categories.length > 0 && (
        <section className="pt-section" aria-labelledby="pt-categories-heading">
          <div className="pt-section-header">
            <PtEyebrow idx={2}>Compétition</PtEyebrow>
            <h2 id="pt-categories-heading" className="pt-section-title">
              Catégories{" "}
              <span
                style={{
                  color: "var(--pt-accent, #c8a03c)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                · {String(categories.length).padStart(2, "0")}
              </span>
            </h2>
          </div>

          <div className="pt-categories-grid">
            {categories.map((cat) => (
              <div key={cat.id} className="pt-category-card">
                {/* 2-letter code */}
                <span className="pt-category-code" aria-hidden="true">
                  {cat.code.slice(0, 2).toUpperCase()}
                </span>
                <span className="pt-category-name">{cat.name}</span>
                <span className="pt-category-count">
                  {cat.productCount}{" "}
                  <span style={{ opacity: 0.5, fontSize: "0.8em" }}>
                    produit{cat.productCount !== 1 ? "s" : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="pt-section pt-section-cta" aria-label="Appel à l'action">
        <div className="pt-card pt-cta-card">
          <PtEyebrow idx={3}>Participation</PtEyebrow>
          <h2 className="pt-cta-title">
            Faites évaluer vos produits
          </h2>
          <p className="pt-cta-body">
            {orgName} accueille des producteurs du monde entier. Notre protocole d&apos;évaluation
            à l&apos;aveugle garantit une notation objective, reproductible et auditée. Les
            résultats sont publiés dans leur intégralité et certifiés par notre comité
            scientifique. Idéal pour valoriser votre gamme auprès des acheteurs, de la presse
            spécialisée et du grand public.
          </p>
          <div className="pt-cta-actions">
            {currentCup && cupOpen ? (
              <Link href={`/cups/${currentCup.id}/register`} className="pt-btn accent">
                Déposer un produit
              </Link>
            ) : (
              <Link href="/cups" className="pt-btn accent">
                Voir les prochaines cups
              </Link>
            )}
          </div>

          {/* Global stats bar */}
          <div className="pt-cta-stats">
            <div className="pt-cta-stat">
              <span className="pt-stat-value">{stats.totalCups}</span>
              <span className="pt-stat-label">Éditions</span>
            </div>
            <div className="pt-cta-stat-divider" aria-hidden="true" />
            <div className="pt-cta-stat">
              <span className="pt-stat-value">{stats.totalProducts.toLocaleString("fr-FR")}</span>
              <span className="pt-stat-label">Produits évalués</span>
            </div>
            <div className="pt-cta-stat-divider" aria-hidden="true" />
            <div className="pt-cta-stat">
              <span className="pt-stat-value">{stats.totalWinners.toLocaleString("fr-FR")}</span>
              <span className="pt-stat-label">Lauréats distingués</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
