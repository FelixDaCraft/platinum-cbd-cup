"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { Pill, Countdown, Eyebrow } from "~/components/portal/platinum";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "timeline" | "categories" | "jury" | "rules";

interface TimelineRow {
  date: string;
  label: string;
  status: "past" | "current" | "next" | "final";
}

interface CategoryRow {
  code: string;
  name: string;
  fee: string;
  criteria: string[];
}

interface CupTabsProps {
  cupId: string;
  timeline: TimelineRow[];
  categories: CategoryRow[];
  juryCount: number;
  editionLabel: string;
}

// ---------------------------------------------------------------------------
// Tab nav (inner — reads searchParams)
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "categories", label: "Catégories" },
  { id: "jury", label: "Panel · Labs" },
  { id: "rules", label: "Règlement" },
];

const JURY_BREAKDOWN: [string, number][] = [
  ["Analystes sensoriels", 14],
  ["Sommeliers / somm. cannabis", 9],
  ["Cultivateurs certifiés", 8],
  ["Chimistes laboratoire", 6],
  ["Journalistes indépendants", 5],
];

const LABS: [string, string][] = [
  ["HELVETIA LAB · Zürich", "Cannabinoïdes · HPLC"],
  ["TERPA INST. · Amsterdam", "Terpènes · GC-MS"],
  ["BIOCERT EU · Lisbonne", "Contaminants · métaux · pesticides"],
];

const RULES: [string, string, string][] = [
  [
    "01",
    "Légal",
    "Tous les spécimens doivent respecter la limite réglementaire de 0,3% Δ9-THC en vigueur dans l'Union européenne. Vérification systématique par laboratoire partenaire.",
  ],
  [
    "02",
    "Anonymisation",
    "À réception, chaque spécimen reçoit un code à 5 caractères (ex: CF23, OG14). Aucune information identifiante n'est transmise au panel.",
  ],
  [
    "03",
    "Notation",
    "Échelle 0–100. Moyenne pondérée des critères par catégorie. Un juré note au minimum 12 spécimens, au maximum 24.",
  ],
  [
    "04",
    "Labels",
    "Platinum ≥ 92 · Or ≥ 85 · Argent ≥ 78 · Bronze ≥ 70. Les producteurs hors top reçoivent un rapport détaillé.",
  ],
];

// ---------------------------------------------------------------------------
// Inner client component that reads searchParams
// ---------------------------------------------------------------------------

function CupTabsInner({
  timeline,
  categories,
  juryCount,
  editionLabel,
}: Omit<CupTabsProps, "cupId">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) ?? "timeline";

  function setTab(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      {/* Tab nav */}
      <div
        className="nav"
        role="tablist"
        aria-label="Sections de la cup"
        style={{ display: "inline-flex", marginBottom: 24 }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={activeTab === id}
            aria-controls={`tab-panel-${id}`}
            id={`tab-${id}`}
            className={activeTab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id={`tab-panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {/* ── Timeline ────────────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <section className="card">
            <h2 className="section-title" style={{ fontSize: 22 }}>
              Calendrier · {editionLabel}
            </h2>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
              {timeline.map((t, i) => {
                const color =
                  t.status === "past"
                    ? "var(--fg-3)"
                    : t.status === "current"
                    ? "var(--accent)"
                    : "var(--fg)";
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 20px 1fr auto",
                      alignItems: "center",
                      gap: 18,
                      padding: "18px 0",
                      borderTop: i === 0 ? 0 : "1px solid var(--line)",
                    }}
                  >
                    <div className="mono tabular" style={{ fontSize: 13, color }}>
                      {t.date}
                    </div>
                    <div style={{ display: "grid", placeItems: "center" }}>
                      <span
                        style={{
                          width: t.status === "current" ? 10 : 6,
                          height: t.status === "current" ? 10 : 6,
                          borderRadius: "50%",
                          background:
                            t.status === "past" ? "var(--line-strong)" : color,
                          boxShadow:
                            t.status === "current"
                              ? `0 0 14px ${color}`
                              : "none",
                        }}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 15,
                        color:
                          t.status === "past" ? "var(--fg-3)" : "var(--fg)",
                      }}
                    >
                      {t.label}
                    </div>
                    <div>
                      {t.status === "current" && (
                        <Pill variant="accent">Now</Pill>
                      )}
                      {t.status === "past" && (
                        <span
                          className="mono fg3"
                          style={{ fontSize: 10, letterSpacing: ".1em" }}
                        >
                          DONE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Categories ──────────────────────────────────────────────────── */}
        {activeTab === "categories" && (
          <section className="grid g-2">
            {categories.length === 0 ? (
              <div className="card">
                <Eyebrow>Aucune catégorie configurée</Eyebrow>
                <p className="lede" style={{ marginTop: 12 }}>
                  Les catégories seront publiées prochainement.
                </p>
              </div>
            ) : (
              categories.map((c) => (
                <div key={c.code} className="card card-hover">
                  <div
                    style={{ display: "flex", gap: 18, alignItems: "flex-start" }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        border: "1px solid var(--line-strong)",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--mono)",
                        fontSize: 20,
                        letterSpacing: ".02em",
                        background: "var(--bg)",
                        flexShrink: 0,
                      }}
                    >
                      {c.code}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mono" style={{ fontSize: 17 }}>
                        {c.name}
                      </div>
                      <div
                        className="mono fg3"
                        style={{
                          fontSize: 11,
                          letterSpacing: ".1em",
                          marginTop: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        Frais {c.fee}
                      </div>
                    </div>
                  </div>
                  {c.criteria.length > 0 && (
                    <div
                      style={{
                        marginTop: 20,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {c.criteria.map((cr) => (
                        <span
                          key={cr}
                          className="mono"
                          style={{
                            fontSize: 10,
                            padding: "5px 10px",
                            border: "1px solid var(--line)",
                            borderRadius: 999,
                            color: "var(--fg-2)",
                            letterSpacing: ".06em",
                            textTransform: "uppercase",
                          }}
                        >
                          {cr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {/* ── Jury / Labs ─────────────────────────────────────────────────── */}
        {activeTab === "jury" && (
          <section className="grid g-2">
            <div className="card">
              <Eyebrow>
                Panel · {juryCount > 0 ? juryCount : 42} jurés
              </Eyebrow>
              <div style={{ marginTop: 16 }}>
                {JURY_BREAKDOWN.map(([role, n]) => (
                  <div key={role} className="kv">
                    <span className="kv-k">{role}</span>
                    <span className="kv-v">
                      {String(n).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <Eyebrow>Laboratoires · ISO 17025</Eyebrow>
              <div style={{ marginTop: 16 }}>
                {LABS.map(([name, spec]) => (
                  <div
                    key={name}
                    style={{
                      padding: "16px 0",
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <div className="mono" style={{ fontSize: 13 }}>
                      {name}
                    </div>
                    <div
                      className="mono fg3"
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {spec}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Rules ───────────────────────────────────────────────────────── */}
        {activeTab === "rules" && (
          <section className="card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 40,
              }}
            >
              {RULES.map(([idx, title, desc]) => (
                <div key={idx}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--accent)",
                      letterSpacing: ".15em",
                    }}
                  >
                    · {idx}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 18, marginTop: 10 }}
                  >
                    {title}
                  </div>
                  <p
                    style={{
                      color: "var(--fg-2)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      marginTop: 10,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper with Suspense (required because useSearchParams is inside)
// ---------------------------------------------------------------------------

export function CupTabs(props: CupTabsProps) {
  return (
    <Suspense
      fallback={
        <div
          className="nav"
          style={{ display: "inline-flex", marginBottom: 24, opacity: 0.5 }}
        >
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" disabled>
              {label}
            </button>
          ))}
        </div>
      }
    >
      <CupTabsInner {...props} />
    </Suspense>
  );
}
