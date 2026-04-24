"use client";

import { useState } from "react";
import Link from "next/link";
import { PtCountdown, PtPill, PtEyebrow } from "./platinum-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatinumCupProps {
  cup: {
    id: string;
    name: string;
    description: string | null;
    bannerUrl: string | null;
    eventDate: Date | null;
    eventLocation: string | null;
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
    ratingEndAt: Date | null;
    status: string;
  };
  categories: {
    id: string;
    name: string;
    description: string | null;
    criteriaCount: number;
    productCount: number;
  }[];
  stats: {
    totalProducts: number;
    totalCategories: number;
    totalJuries: number;
  };
}

type TabId = "timeline" | "categories" | "panel" | "reglement";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOpenStatus(status: string): boolean {
  return status === "published" || status === "open";
}

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Derive a 2-3 char category code from name */
function categoryCode(name: string, idx: number): string {
  const words = name.trim().split(/\s+/);
  const w0 = words[0] ?? "";
  const w1 = words[1] ?? "";
  if (words.length >= 2 && w0.length > 0 && w1.length > 0) {
    return ((w0[0] ?? "") + (w1[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() + String(idx + 1).padStart(2, "0").slice(-1);
}

// ---------------------------------------------------------------------------
// Timeline tab
// ---------------------------------------------------------------------------

interface TimelineEvent {
  label: string;
  date: Date | null;
  key: string;
}

function buildTimeline(cup: PlatinumCupProps["cup"]): TimelineEvent[] {
  return [
    { key: "reg_open", label: "Ouverture des inscriptions", date: cup.registrationOpenAt },
    { key: "reg_close", label: "Clôture des inscriptions", date: cup.registrationCloseAt },
    { key: "rating_end", label: "Fin de la notation", date: cup.ratingEndAt },
    { key: "event", label: "Événement / Palmarès", date: cup.eventDate },
  ];
}

function TimelineTab({ cup }: { cup: PlatinumCupProps["cup"] }) {
  const now = Date.now();
  const events = buildTimeline(cup);

  // Find the "current" step: last past event (or first future)
  let currentIdx = -1;
  events.forEach((ev, i) => {
    if (ev.date && new Date(ev.date).getTime() <= now) {
      currentIdx = i;
    }
  });
  const nextIdx = currentIdx + 1;

  return (
    <div style={{ maxWidth: "560px" }}>
      {events.map((ev, i) => {
        const isPast = ev.date ? new Date(ev.date).getTime() < now : false;
        const isCurrent = i === nextIdx;
        const isFuture = !isPast && !isCurrent;

        return (
          <div
            key={ev.key}
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              paddingBottom: i < events.length - 1 ? "32px" : 0,
              position: "relative",
            }}
          >
            {/* Vertical connector line */}
            {i < events.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "24px",
                  width: "2px",
                  bottom: 0,
                  background: isPast
                    ? "var(--pt-accent)"
                    : "var(--pt-line)",
                  opacity: isPast ? 0.5 : 1,
                }}
              />
            )}

            {/* Node */}
            <div
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                border: isCurrent
                  ? "2px solid var(--pt-accent)"
                  : isPast
                  ? "2px solid var(--pt-accent)"
                  : "2px solid var(--pt-line-strong)",
                background: isCurrent
                  ? "var(--pt-accent)"
                  : isPast
                  ? "color-mix(in srgb, var(--pt-accent) 30%, transparent)"
                  : "var(--pt-bg)",
                display: "grid",
                placeItems: "center",
                position: "relative",
                zIndex: 1,
                boxShadow: isCurrent
                  ? "0 0 12px var(--pt-accent-glow)"
                  : undefined,
              }}
            >
              {isPast && !isCurrent && (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  style={{ width: "10px", height: "10px" }}
                >
                  <path
                    d="M2 5l2.5 2.5L8 3"
                    stroke="var(--pt-accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: "2px", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "4px",
                }}
              >
                <span
                  className="pt-mono"
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: isCurrent
                      ? "var(--pt-fg)"
                      : isPast
                      ? "var(--pt-fg-2)"
                      : "var(--pt-fg-2)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {ev.label}
                </span>
                {isCurrent && (
                  <PtPill variant="accent" dot>
                    Now
                  </PtPill>
                )}
              </div>

              <span
                className="pt-mono pt-tabular"
                style={{
                  fontSize: "13px",
                  color: isCurrent
                    ? "var(--pt-accent)"
                    : isPast
                    ? "var(--pt-fg-3)"
                    : "var(--pt-fg)",
                  opacity: isFuture ? 0.55 : 1,
                }}
              >
                {ev.date ? formatDateLong(ev.date) : "Date à confirmer"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories tab
// ---------------------------------------------------------------------------

function CategoriesTab({
  categories,
}: {
  categories: PlatinumCupProps["categories"];
}) {
  if (categories.length === 0) {
    return (
      <p
        className="pt-mono pt-muted"
        style={{ fontSize: "12px", letterSpacing: ".06em" }}
      >
        Aucune catégorie configurée pour cette cup.
      </p>
    );
  }

  return (
    <div className="pt-grid pt-g3">
      {categories.map((cat, i) => (
        <article key={cat.id} className="pt-card pt-card-hover" style={{ position: "relative", overflow: "hidden" }}>
          {/* Code watermark */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-8px",
              right: "16px",
              fontFamily: "var(--pt-mono)",
              fontSize: "56px",
              fontWeight: 700,
              color: "var(--pt-accent)",
              opacity: 0.06,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {categoryCode(cat.name, i)}
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Code pill */}
            <div style={{ marginBottom: "12px" }}>
              <span
                className="pt-mono"
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: ".14em",
                  color: "var(--pt-accent)",
                  fontWeight: 600,
                }}
              >
                {categoryCode(cat.name, i)}
              </span>
            </div>

            {/* Name */}
            <h3
              className="pt-mono"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: ".01em",
                color: "var(--pt-fg)",
                margin: 0,
                marginBottom: "8px",
              }}
            >
              {cat.name}
            </h3>

            {/* Description */}
            {cat.description && (
              <p
                className="pt-muted"
                style={{
                  fontSize: "12px",
                  lineHeight: 1.5,
                  marginBottom: "20px",
                  marginTop: "8px",
                }}
              >
                {cat.description}
              </p>
            )}

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                gap: "20px",
                marginTop: cat.description ? 0 : "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--pt-line)",
              }}
            >
              <div>
                <div
                  className="pt-mono"
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "var(--pt-fg-3)",
                    marginBottom: "4px",
                  }}
                >
                  Critères
                </div>
                <div
                  className="pt-mono pt-tabular"
                  style={{ fontSize: "18px", fontWeight: 600, color: "var(--pt-fg)" }}
                >
                  {cat.criteriaCount}
                </div>
              </div>
              <div
                aria-hidden="true"
                style={{
                  width: "1px",
                  background: "var(--pt-line)",
                  alignSelf: "stretch",
                }}
              />
              <div>
                <div
                  className="pt-mono"
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "var(--pt-fg-3)",
                    marginBottom: "4px",
                  }}
                >
                  Produits
                </div>
                <div
                  className="pt-mono pt-tabular"
                  style={{ fontSize: "18px", fontWeight: 600, color: "var(--pt-fg)" }}
                >
                  {cat.productCount}
                </div>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel tab
// ---------------------------------------------------------------------------

function PanelTab({ stats }: { stats: PlatinumCupProps["stats"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Intro card */}
      <div className="pt-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <PtPill variant="solid">Panneau aveugle</PtPill>
          <span
            className="pt-mono pt-fg3"
            style={{ fontSize: "11px", letterSpacing: ".08em" }}
          >
            Panel indépendant
          </span>
        </div>

        <p
          className="pt-muted"
          style={{ fontSize: "13px", lineHeight: 1.6, maxWidth: "56ch", marginBottom: "0" }}
        >
          Le jury est composé d&apos;experts indépendants sélectionnés pour leur expertise
          sensorielle et leur impartialité. Chaque produit est évalué à l&apos;aveugle —
          producteur, origine et prix sont masqués pendant toute la durée de la notation.
        </p>
      </div>

      {/* KV list */}
      <div className="pt-card">
        <div className="pt-kv">
          <span className="pt-kv-k">Protocole</span>
          <span className="pt-kv-v">Double-aveugle</span>
        </div>
        <div className="pt-kv">
          <span className="pt-kv-k">Notation</span>
          <span className="pt-kv-v">Individuelle, puis consensus</span>
        </div>
        <div className="pt-kv">
          <span className="pt-kv-k">Conflits d&apos;intérêt</span>
          <span className="pt-kv-v">Déclaration obligatoire</span>
        </div>
      </div>

      {/* Note */}
      <p
        className="pt-mono pt-fg3"
        style={{ fontSize: "11px", letterSpacing: ".06em", lineHeight: 1.6 }}
      >
        La composition détaillée du panel sera publiée après la clôture de la notation,
        conformément au protocole d&apos;anonymisation.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Règlement tab
// ---------------------------------------------------------------------------

const REGLEMENT_ITEMS = [
  {
    idx: "01",
    title: "Éligibilité",
    body: "Tout producteur légalement établi peut inscrire ses produits. Les produits doivent être conformes à la réglementation en vigueur dans leur pays d'origine et dans le pays d'organisation du concours.",
  },
  {
    idx: "02",
    title: "Anonymisation",
    body: "Dès la réception, chaque produit reçoit un code aléatoire. Toute identification du producteur ou de l'origine est supprimée. Le code est la seule information visible des jurés.",
  },
  {
    idx: "03",
    title: "Calcul des scores",
    body: "Les notes individuelles sont agrégées via une méthode statistique robuste (moyenne tronquée). Les valeurs aberrantes sont écartées. Le score final est arrondi à deux décimales.",
  },
  {
    idx: "04",
    title: "Attribution des labels",
    body: "Les labels (Or, Argent, Bronze, etc.) sont attribués sur la base de seuils absolus définis avant l'ouverture du concours. Ils ne dépendent pas du classement relatif des produits.",
  },
] as const;

function ReglementTab() {
  return (
    <div className="pt-grid pt-g2" style={{ alignItems: "start" }}>
      {REGLEMENT_ITEMS.map((item) => (
        <article key={item.idx} className="pt-card">
          {/* Index */}
          <div
            className="pt-mono"
            style={{
              fontSize: "10px",
              letterSpacing: ".18em",
              color: "var(--pt-accent)",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {item.idx}
          </div>

          {/* Title */}
          <h3
            className="pt-mono"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--pt-fg)",
              margin: 0,
              marginBottom: "12px",
            }}
          >
            {item.title}
          </h3>

          {/* Body */}
          <p
            className="pt-muted"
            style={{ fontSize: "12px", lineHeight: 1.6, margin: 0 }}
          >
            {item.body}
          </p>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

interface StatsBarProps {
  stats: PlatinumCupProps["stats"];
  registrationCloseAt: Date | null;
}

function StatsBar({ stats, registrationCloseAt }: StatsBarProps) {
  const closeTarget = registrationCloseAt
    ? new Date(registrationCloseAt).getTime()
    : null;
  const showCountdown = closeTarget !== null && closeTarget > Date.now();

  const items = [
    { label: "Produits inscrits", value: stats.totalProducts },
    { label: "Catégories", value: stats.totalCategories },
  ];

  return (
    <div
      className="pt-card"
      style={{
        display: "grid",
        gridTemplateColumns: showCountdown ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
        gap: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: "var(--pt-pad-y)",
            borderRight: "1px solid var(--pt-line)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            className="pt-mono pt-tabular"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 600,
              lineHeight: 1,
              color: "var(--pt-fg)",
              letterSpacing: "-0.02em",
            }}
          >
            {item.value}
          </div>
          <div
            className="pt-mono pt-fg3"
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: ".12em",
            }}
          >
            {item.label}
          </div>
        </div>
      ))}

      {/* Countdown cell */}
      {showCountdown && closeTarget && (
        <div
          style={{
            padding: "var(--pt-pad-y)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <PtCountdown target={closeTarget} compact />
          <div
            className="pt-mono pt-fg3"
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: ".12em",
            }}
          >
            Clôture des inscriptions
          </div>
        </div>
      )}

      {/* If no countdown, remove the last border */}
      <style>{`
        .pt-stats-bar-last { border-right: 0 !important; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PlatinumCup — Cup detail page for the Platinum portal template.
 *
 * Displays cup metadata, stats, and a 4-tab interface:
 * Timeline · Categories · Panel · Règlement
 */
export function PlatinumCup({ cup, categories, stats }: PlatinumCupProps) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const isOpen = isOpenStatus(cup.status);

  const TABS: { id: TabId; label: string }[] = [
    { id: "timeline", label: "Timeline" },
    { id: "categories", label: "Catégories" },
    { id: "panel", label: "Panel" },
    { id: "reglement", label: "Règlement" },
  ];

  return (
    <div
      className="pt-page-enter"
      style={{ padding: "0 var(--pt-pad-x)", paddingBottom: "80px" }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header
        style={{
          paddingTop: "clamp(48px, 8vh, 96px)",
          paddingBottom: "clamp(32px, 5vh, 56px)",
        }}
      >
        {/* Eyebrow */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <PtEyebrow>002 · Édition en cours</PtEyebrow>
          {isOpen && (
            <PtPill variant="accent" dot>
              Open for Submissions
            </PtPill>
          )}
        </div>

        {/* Title */}
        <h1 className="pt-display" style={{ marginBottom: "28px" }}>
          {cup.name}
        </h1>

        {/* Location + dates */}
        <div
          className="pt-mono pt-muted"
          style={{
            fontSize: "12px",
            letterSpacing: ".06em",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 20px",
            marginBottom: cup.description ? "20px" : "32px",
          }}
        >
          {cup.eventLocation && (
            <span>
              <span className="pt-fg3" style={{ marginRight: "6px" }}>
                &#8599;
              </span>
              {cup.eventLocation}
            </span>
          )}
          {cup.registrationOpenAt && (
            <span>
              <span className="pt-fg3" style={{ marginRight: "6px" }}>
                Inscriptions
              </span>
              {formatDateShort(cup.registrationOpenAt)}
              {cup.registrationCloseAt && (
                <> → {formatDateShort(cup.registrationCloseAt)}</>
              )}
            </span>
          )}
          {cup.eventDate && (
            <span>
              <span className="pt-fg3" style={{ marginRight: "6px" }}>
                Événement
              </span>
              {formatDateShort(cup.eventDate)}
            </span>
          )}
        </div>

        {/* Description */}
        {cup.description && (
          <p
            className="pt-muted"
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              maxWidth: "60ch",
              marginBottom: "32px",
            }}
          >
            {cup.description}
          </p>
        )}

        {/* CTA */}
        {isOpen && (
          <Link href={`/cups/${cup.id}/register`} className="pt-btn accent">
            S&apos;inscrire à la cup
          </Link>
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* STATS BAR                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Statistiques" style={{ marginBottom: "48px" }}>
        <StatsBar stats={stats} registrationCloseAt={cup.registrationCloseAt} />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TABS                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Détails de la cup">
        {/* Tab navigation */}
        <div
          role="tablist"
          aria-label="Sections de la cup"
          className="pt-nav"
          style={{
            display: "inline-flex",
            marginBottom: "32px",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`tab-panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "timeline" && <TimelineTab cup={cup} />}
          {activeTab === "categories" && (
            <CategoriesTab categories={categories} />
          )}
          {activeTab === "panel" && <PanelTab stats={stats} />}
          {activeTab === "reglement" && <ReglementTab />}
        </div>
      </section>
    </div>
  );
}
