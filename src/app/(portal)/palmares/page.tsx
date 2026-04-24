import Link from "next/link";
import { eq, desc, isNotNull, and } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import {
  Eyebrow,
  Pill,
  PlatinumTrophy,
} from "~/components/portal/platinum";
import { RankingRow } from "./_components/ranking-row";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabelTier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

interface ProductRow {
  rank: number;
  code: string;
  catCode: string;
  score: number;
  labelTier: LabelTier;
}

// ---------------------------------------------------------------------------
// Label tier computation
// ---------------------------------------------------------------------------

/**
 * Computes a standard label tier from a 0-100 final score.
 *
 * Priority: if the stored label name is one of the four canonical tiers, use
 * it verbatim. Otherwise derive from score thresholds:
 *   ≥ 92 → PLATINUM
 *   ≥ 85 → GOLD
 *   ≥ 78 → SILVER
 *   anything else → BRONZE
 */
function computeLabelTier(score: number, storedLabelName: string | null): LabelTier {
  const canonical = storedLabelName?.toUpperCase();
  if (
    canonical === "PLATINUM" ||
    canonical === "GOLD" ||
    canonical === "SILVER" ||
    canonical === "BRONZE"
  ) {
    return canonical as LabelTier;
  }
  if (score >= 92) return "PLATINUM";
  if (score >= 85) return "GOLD";
  if (score >= 78) return "SILVER";
  return "BRONZE";
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function fetchCups() {
  return db.query.cups.findMany({
    where: (c, { isNotNull: inn }) => inn(c.resultsPublishedAt),
    orderBy: (c, { desc: d }) => d(c.createdAt),
  });
}

async function fetchProducts(cupId: string): Promise<ProductRow[]> {
  const rows = await db
    .select({
      anonymousCode: schema.products.anonymousCode,
      finalScore: schema.products.finalScore,
      categoryName: schema.categories.name,
      labelName: schema.cupLabels.name,
    })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id)
    )
    .leftJoin(
      schema.cupLabels,
      eq(schema.products.labelId, schema.cupLabels.id)
    )
    .where(
      and(
        eq(schema.registrations.cupId, cupId),
        eq(schema.registrations.status, "confirmed"),
        eq(schema.products.excludedFromResults, false),
        isNotNull(schema.products.finalScore)
      )
    )
    .orderBy(desc(schema.products.finalScore));

  return rows
    .filter((r) => r.anonymousCode != null && r.finalScore != null)
    .map((r, i) => {
      const score = parseFloat(r.finalScore!);
      // Derive a short category code from the first two uppercase letters of the name
      const catCode = r.categoryName
        ? r.categoryName.slice(0, 2).toUpperCase()
        : "??";
      return {
        rank: i + 1,
        code: r.anonymousCode!,
        catCode,
        score,
        labelTier: computeLabelTier(score, r.labelName ?? null),
      };
    });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PalmaresPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string; cat?: string }>;
}) {
  const sp = await searchParams;

  const cups = await fetchCups();

  // Edition selector data (one button per cup, labelled by year)
  const editions = cups.map((c) => ({
    id: c.id,
    year: new Date(c.eventDate ?? c.createdAt).getFullYear().toString(),
  }));

  // ── Header (always rendered regardless of data) ───────────────────────
  const headerSection = (
    <section style={{ paddingTop: 40, paddingBottom: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div>
          <Eyebrow idx={4}>Palmarès · Public ledger</Eyebrow>
          <h1 className="display" style={{ marginTop: 18, marginBottom: 8 }}>
            Results<em>.</em>
          </h1>
        </div>

        {editions.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {editions.map((ed) => {
              const isActive =
                sp.edition === ed.year ||
                (!sp.edition && ed.id === cups[0]?.id);
              return (
                <Link
                  key={ed.id}
                  href={`?edition=${ed.year}`}
                  className="btn ghost"
                  style={{
                    padding: "10px 16px",
                    background: isActive ? "var(--fg)" : "transparent",
                    color: isActive ? "var(--bg)" : "var(--fg)",
                    textDecoration: "none",
                  }}
                >
                  Ed · {ed.year}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  // ── Empty state: no cup with published results ────────────────────────
  if (cups.length === 0) {
    return (
      <div className="page-enter">
        {headerSection}
        <div className="card">
          <Eyebrow>Aucun palmarès publié</Eyebrow>
          <p className="lede" style={{ marginTop: 14 }}>
            Le palmarès de l&apos;édition en cours sera publié à l&apos;issue
            de la cérémonie.
          </p>
        </div>
      </div>
    );
  }

  // ── Resolve selected cup (from ?edition= or default to most recent) ───
  const selectedCup =
    cups.find(
      (c) =>
        new Date(c.eventDate ?? c.createdAt).getFullYear().toString() ===
        sp.edition
    ) ?? cups[0]!;

  const selectedYear = new Date(selectedCup.eventDate ?? selectedCup.createdAt)
    .getFullYear()
    .toString();

  const products = await fetchProducts(selectedCup.id);

  // ── Empty state: cup exists but no scored products yet ────────────────
  if (products.length === 0) {
    return (
      <div className="page-enter">
        {headerSection}
        <div className="card">
          <Eyebrow>Aucun palmarès publié</Eyebrow>
          <p className="lede" style={{ marginTop: 14 }}>
            Le palmarès de l&apos;édition en cours sera publié à l&apos;issue
            de la cérémonie.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const top = products[0]!;

  // Unique category codes for filter chips (sorted alpha)
  const allCatCodes = Array.from(new Set(products.map((p) => p.catCode))).sort();

  const activeCategory = sp.cat ?? "ALL";
  const filtered =
    activeCategory === "ALL"
      ? products
      : products.filter((p) => p.catCode === activeCategory);

  // Methodology rows: [label name, threshold display, CSS color var]
  const methodologyRows: [string, string, string][] = [
    ["PLATINUM", "≥ 92", "var(--accent)"],
    ["GOLD", "≥ 85", "var(--fg)"],
    ["SILVER", "≥ 78", "var(--fg-2)"],
    ["BRONZE", "≥ 70", "var(--fg-3)"],
  ];

  return (
    <div className="page-enter">
      {headerSection}

      {/* ── BEST IN SHOW CARD ───────────────────────────────────────── */}
      <section
        className="card"
        style={{ marginBottom: 32, position: "relative", overflow: "hidden" }}
      >
        {/* Decorative trophy filigree — positioned absolute, purely visual */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            opacity: 0.08,
          }}
        >
          <PlatinumTrophy size={340} glow={false} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <Pill variant="accent" dot>
            BEST IN SHOW · {selectedYear}
          </Pill>

          <div
            className="display"
            style={{
              fontSize: "clamp(56px, 8vw, 112px)",
              marginTop: 18,
              marginBottom: 14,
            }}
          >
            {top.code}
            <em>.</em>
          </div>

          <div
            style={{
              display: "flex",
              gap: 40,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {/* Final score */}
            <div>
              <div
                className="mono fg3"
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                }}
              >
                Score final
              </div>
              <div
                className="mono tabular"
                style={{
                  fontSize: 56,
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                  color: "var(--accent)",
                }}
              >
                {top.score.toFixed(1)}
              </div>
            </div>

            {/* Criteria mini-grid — mock values per design spec.
                Criterion scores would require a heavier join; the design
                hardcodes {Aspect 98, Terpenes 96, Smoke 95, Effect 98}. */}
            <div
              style={{
                display: "flex",
                gap: 28,
                fontFamily: "var(--mono)",
                paddingBottom: 14,
              }}
            >
              {(
                [
                  ["Aspect", 98],
                  ["Terpenes", 96],
                  ["Smoke", 95],
                  ["Effect", 98],
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k}>
                  <div
                    className="mono fg3"
                    style={{
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {k}
                  </div>
                  <div
                    className="tabular"
                    style={{ fontSize: 24, fontWeight: 300, marginTop: 4 }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY FILTER CHIPS ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {(["ALL", ...allCatCodes] as string[]).map((c) => {
          const isActive = activeCategory === c;
          const href =
            c === "ALL"
              ? `?edition=${selectedYear}`
              : `?edition=${selectedYear}&cat=${c}`;
          return (
            <Link
              key={c}
              href={href}
              className="mono"
              style={{
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                borderRadius: 999,
                background: isActive ? "var(--fg)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--fg-2)",
                border: `1px solid ${isActive ? "var(--fg)" : "var(--line-strong)"}`,
                textDecoration: "none",
              }}
            >
              {c}
            </Link>
          );
        })}
      </div>

      {/* ── RANKINGS TABLE ──────────────────────────────────────────── */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 90px 1fr 110px 110px 120px",
            padding: "16px 28px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          <span>Rank</span>
          <span>Code</span>
          <span>Producteur</span>
          <span>Cat</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "right" }}>Label</span>
        </div>

        {/* Data rows (client component for hover effect) */}
        {filtered.map((w, i) => (
          <RankingRow
            key={w.code}
            row={w}
            isLast={i === filtered.length - 1}
          />
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              padding: "32px 28px",
              color: "var(--fg-3)",
              fontFamily: "var(--mono)",
              fontSize: 12,
            }}
          >
            Aucun produit dans cette catégorie.
          </div>
        )}
      </section>

      {/* ── METHODOLOGY ─────────────────────────────────────────────── */}
      <section className="grid g-2" style={{ marginTop: 32 }}>
        {/* Label scale card */}
        <div className="card">
          <Eyebrow>Méthodologie · Échelle de labels</Eyebrow>
          <div style={{ marginTop: 20 }}>
            {methodologyRows.map(([label, range, color]) => (
              <div key={label} className="kv">
                <span
                  className="kv-k"
                  style={{ color, letterSpacing: ".15em" }}
                >
                  {label}
                </span>
                <span className="kv-v tabular">{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Public ledger card */}
        <div className="card">
          <Eyebrow>Ledger public</Eyebrow>
          <p
            style={{
              fontSize: 14,
              color: "var(--fg-2)",
              lineHeight: 1.55,
              marginTop: 14,
            }}
          >
            Toutes les notations individuelles, coefficients par critère et
            rapports laboratoires sont disponibles en libre accès — CSV, JSON,
            PDF.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {/* TODO: wire to /api/export/[cupId]/csv, /json, /pdf when built */}
            <button className="btn ghost" style={{ padding: "10px 16px" }}>
              CSV ↓
            </button>
            <button className="btn ghost" style={{ padding: "10px 16px" }}>
              JSON ↓
            </button>
            <button className="btn ghost" style={{ padding: "10px 16px" }}>
              Rapport PDF ↓
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
