import Link from "next/link";
import { eq, desc, isNotNull, and, asc } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import {
  Eyebrow,
  Pill,
  GeometricEmblem,
} from "~/components/portal/platinum";
import { RankingRow } from "./_components/ranking-row";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CupLabel {
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
}

interface ProductRow {
  rank: number;
  code: string;
  productName: string;
  producerName: string;
  categoryName: string;
  categoryId: string;
  score: number;
  scoreFormatted: string;
  labelName: string | null;
  labelColor: string | null;
}

interface CategoryGroup {
  id: string;
  name: string;
  rows: ProductRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the cup_label tier for a given final score, picking the highest
 * threshold that the score meets. Returns the full label so callers can also
 * use its configured color. null if no tier matches.
 */
function resolveLabel(score: number, labels: CupLabel[]): CupLabel | null {
  // Sort descending by minScore so we pick the strongest tier first
  const sorted = [...labels].sort((a, b) => b.minScore - a.minScore);
  for (const l of sorted) {
    const passesMin = score >= l.minScore;
    const passesMax = l.maxScore == null || score <= l.maxScore;
    if (passesMin && passesMax) return l;
  }
  return null;
}

/**
 * Strip "Label" prefix (FR) from cup_label names for display: "Label OR" → "OR".
 */
function cleanLabel(name: string | null): string | null {
  if (!name) return null;
  return name.replace(/^Label\s+/i, "").trim().toUpperCase();
}

function formatScore(score: number, scale: string | null | undefined): string {
  if (scale === "0-100") return score.toFixed(1);
  if (scale === "0-5") return score.toFixed(2);
  // 0-20 default
  return score.toFixed(2);
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

async function fetchPublishedCups() {
  return db.query.cups.findMany({
    where: (c, { isNotNull: inn }) => inn(c.resultsPublishedAt),
    orderBy: (c, { desc: d }) => [d(c.eventDate), d(c.createdAt)],
  });
}

async function fetchCupLabels(cupId: string): Promise<CupLabel[]> {
  const rows = await db.query.cupLabels.findMany({
    where: (l, { eq: e }) => e(l.cupId, cupId),
    orderBy: (l, { desc: d }) => [d(l.minScore)],
  });
  return rows.map((r) => ({
    name: r.name,
    minScore: r.minScore,
    maxScore: r.maxScore,
    color: r.color,
  }));
}

async function fetchCategories(cupId: string) {
  return db.query.categories.findMany({
    where: (c, { eq: e }) => e(c.cupId, cupId),
    orderBy: (c, { asc: a }) => [a(c.sortOrder), a(c.name)],
  });
}

async function fetchProducts(
  cupId: string,
  cup: { ratingScale: string | null },
  labels: CupLabel[],
): Promise<ProductRow[]> {
  const rows = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      anonymousCode: schema.products.anonymousCode,
      finalScore: schema.products.finalScore,
      categoryRank: schema.products.categoryRank,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      categorySort: schema.categories.sortOrder,
      brandName: schema.producers.brandName,
      companyName: schema.producers.companyName,
    })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id),
    )
    .innerJoin(
      schema.producers,
      eq(schema.registrations.producerId, schema.producers.id),
    )
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id),
    )
    .where(
      and(
        eq(schema.registrations.cupId, cupId),
        eq(schema.products.excludedFromResults, false),
        isNotNull(schema.products.finalScore),
      ),
    )
    .orderBy(
      asc(schema.categories.sortOrder),
      asc(schema.categories.name),
      desc(schema.products.finalScore),
    );

  return rows
    .filter((r) => r.anonymousCode != null && r.finalScore != null)
    .map((r) => {
      const score = parseFloat(r.finalScore!);
      const label = resolveLabel(score, labels);
      return {
        rank: r.categoryRank ?? 0,
        code: r.anonymousCode!,
        productName: r.productName ?? "",
        // Company first (the entity), brand second as a fallback when the
        // producer registered without a company (rare, single-person).
        producerName: r.companyName ?? r.brandName ?? "—",
        categoryName: r.categoryName ?? "",
        categoryId: r.categoryId ?? "",
        score,
        scoreFormatted: formatScore(score, cup.ratingScale),
        labelName: cleanLabel(label?.name ?? null),
        labelColor: label?.color ?? null,
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
  const cups = await fetchPublishedCups();

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

        {cups.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {cups.map((c) => {
              const isActive =
                sp.edition === c.id || (!sp.edition && c.id === cups[0]?.id);
              const label = c.name.replace(/^PlatinumCBD CUP /i, "Ed · ");
              return (
                <Link
                  key={c.id}
                  href={`?edition=${c.id}`}
                  scroll={false}
                  className="btn ghost"
                  style={{
                    padding: "10px 16px",
                    background: isActive ? "var(--fg)" : "transparent",
                    color: isActive ? "var(--bg)" : "var(--fg)",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

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

  const selectedCup = cups.find((c) => c.id === sp.edition) ?? cups[0]!;
  const selectedYear = new Date(selectedCup.eventDate ?? selectedCup.createdAt)
    .getFullYear()
    .toString();

  const [labels, allCategories, allProducts] = await Promise.all([
    fetchCupLabels(selectedCup.id),
    fetchCategories(selectedCup.id),
    fetchPublishedCupProducts(selectedCup),
  ]);

  // Apply the cup's resultsVisibility setting before rendering. Choices made
  // by the organizer in the dashboard:
  //  - "podium"            → top 3 ranks per category only
  //  - "labels"            → only products that earned a label (Or/Argent/Bronze)
  //  - "labels_and_podium" → union of the two
  //  - "all"               → no filtering (every scored product shown)
  const visibility = (selectedCup.resultsVisibility ?? "labels") as
    | "podium"
    | "labels"
    | "labels_and_podium"
    | "all";
  const PODIUM_DEPTH = 3;
  const products =
    visibility === "all"
      ? allProducts
      : visibility === "podium"
        ? allProducts.filter((p) => p.rank > 0 && p.rank <= PODIUM_DEPTH)
        : visibility === "labels"
          ? allProducts.filter((p) => p.labelName != null)
          : // labels_and_podium
            allProducts.filter(
              (p) =>
                p.labelName != null ||
                (p.rank > 0 && p.rank <= PODIUM_DEPTH),
            );

  const visibilityCopy: Record<typeof visibility, string> = {
    podium: "Podium uniquement — les 3 premiers de chaque catégorie",
    labels: "Produits médaillés uniquement",
    labels_and_podium:
      "Podium + médaillés — top 3 de chaque catégorie et tous les produits avec un label",
    all: "Palmarès intégral",
  };

  // When the organizer publishes podium-only, labels are deliberately hidden
  // from the public view (no Or/Argent/Bronze pills, no methodology table).
  const showLabels = visibility !== "podium";

  if (products.length === 0) {
    return (
      <div className="page-enter">
        {headerSection}
        <div className="card">
          <Eyebrow>Pas encore de palmarès</Eyebrow>
          <p className="lede" style={{ marginTop: 14 }}>
            Aucun résultat publié pour cette édition.
          </p>
        </div>
      </div>
    );
  }

  // Best-in-show = highest absolute score across all VISIBLE products
  const top = [...products].sort((a, b) => b.score - a.score)[0]!;

  // Filter chips use real category metadata (sorted)
  const activeCategoryId = sp.cat;
  const filtered = activeCategoryId
    ? products.filter((p) => p.categoryId === activeCategoryId)
    : products;

  // Group filtered rows by category (preserves the SQL order: by sort_order
  // then category name then score desc within category)
  const grouped: CategoryGroup[] = [];
  for (const row of filtered) {
    let g = grouped.find((x) => x.id === row.categoryId);
    if (!g) {
      g = { id: row.categoryId, name: row.categoryName, rows: [] };
      grouped.push(g);
    }
    g.rows.push(row);
  }

  // Dedupe labels by name (the prod data has duplicate rows like "Label OR" /
  // "Label OR" or "Label Argent" / "Label ARGENT" — same threshold + color).
  const labelLegend = Array.from(
    labels
      .slice()
      .sort((a, b) => b.minScore - a.minScore)
      .reduce((map, l) => {
        const cleanName = cleanLabel(l.name) ?? l.name;
        if (!map.has(cleanName)) {
          map.set(cleanName, {
            name: cleanName,
            color: l.color ?? "var(--accent)",
            range:
              l.maxScore != null
                ? `${l.minScore.toFixed(1)} – ${l.maxScore.toFixed(1)}`
                : `≥ ${l.minScore.toFixed(1)}`,
          });
        }
        return map;
      }, new Map<string, { name: string; color: string; range: string }>())
      .values(),
  );

  return (
    <div className="page-enter" style={{ position: "relative" }}>
      {/* Page-level 3D emblem — same size + tilt as the home hero, fixed
          to the viewport top-right so it stays visible while scrolling.
          Non-interactive so clicks fall through. The .topbar (z-index 50)
          renders above and frost-blurs over it via its backdrop-filter. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <GeometricEmblem size={735} tiltZ={-0.18} interactive={false} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {headerSection}

        {/* ── BEST IN SHOW ─────────────────────────────────────────────── */}
        <section
          className="card"
          style={{
            marginBottom: 32,
            background: "color-mix(in srgb, var(--bg-2) 55%, transparent)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
          }}
        >
          <div>
          <Pill variant="accent" dot>
            BEST IN SHOW · {selectedYear}
          </Pill>

          <div
            className="display"
            style={{
              fontSize: "clamp(48px, 7vw, 96px)",
              marginTop: 18,
              marginBottom: 6,
            }}
          >
            {top.productName || top.code}
            <em>.</em>
          </div>

          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--fg-2)",
              letterSpacing: ".06em",
              marginBottom: 22,
            }}
          >
            {top.producerName} · {top.categoryName}
            {top.code ? ` · ${top.code}` : ""}
          </div>

          <div
            style={{
              display: "flex",
              gap: 40,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                className="mono fg3"
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                }}
              >
                Score final · {selectedCup.ratingScale ?? "0-20"}
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
                {top.scoreFormatted}
              </div>
            </div>

            {showLabels && top.labelName && (
              <div>
                <div
                  className="mono fg3"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                  }}
                >
                  Label
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    letterSpacing: ".05em",
                    marginTop: 4,
                    color: top.labelColor ?? "var(--accent)",
                  }}
                >
                  {top.labelName}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── VISIBILITY NOTE ─────────────────────────────────────────── */}
      <div
        className="mono"
        style={{
          marginBottom: 16,
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--accent)" }}>· Mode</span>
        <span>{visibilityCopy[visibility]}</span>
      </div>

      {/* ── CATEGORY FILTER CHIPS ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {[{ id: "ALL", name: "Toutes" } as { id: string; name: string }]
          .concat(allCategories.map((c) => ({ id: c.id, name: c.name })))
          .map((c) => {
            const isActive =
              c.id === "ALL" ? !activeCategoryId : activeCategoryId === c.id;
            const href =
              c.id === "ALL"
                ? `?edition=${selectedCup.id}`
                : `?edition=${selectedCup.id}&cat=${c.id}`;
            return (
              <Link
                key={c.id}
                href={href}
                scroll={false}
                className="mono"
                style={{
                  padding: "8px 14px",
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  borderRadius: 999,
                  background: isActive ? "var(--fg)" : "transparent",
                  color: isActive ? "var(--bg)" : "var(--fg-2)",
                  border: `1px solid ${
                    isActive ? "var(--fg)" : "var(--line-strong)"
                  }`,
                  textDecoration: "none",
                }}
              >
                {c.name}
              </Link>
            );
          })}
      </div>

      {/* ── RANKINGS GROUPED BY CATEGORY ────────────────────────────── */}
      <section
        className="card"
        style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
      >
        {grouped.length === 0 ? (
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
        ) : (
          grouped.map((group, gi) => (
            <div key={group.id}>
              {/* Category header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  padding: "20px 28px 14px",
                  borderTop: gi === 0 ? 0 : "1px solid var(--line)",
                  background: "var(--bg)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 17,
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--fg)",
                  }}
                >
                  {group.name}
                </div>
                <div
                  className="mono fg3"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                  }}
                >
                  {group.rows.length} {group.rows.length > 1 ? "produits" : "produit"}
                </div>
              </div>

              {/* Column header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: showLabels
                    ? "60px 80px 1.2fr 1fr 90px 110px"
                    : "60px 80px 1.2fr 1fr 90px",
                  padding: "10px 28px",
                  borderTop: "1px solid var(--line)",
                  borderBottom: "1px solid var(--line)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                }}
              >
                <span>Rang</span>
                <span>Code</span>
                <span>Variété</span>
                <span>Producteur</span>
                <span style={{ textAlign: "right" }}>Score</span>
                {showLabels && <span style={{ textAlign: "right" }}>Label</span>}
              </div>

              {/* Rows */}
              {group.rows.map((row, i) => (
                <RankingRow
                  key={row.code + row.categoryId}
                  row={row}
                  isLast={i === group.rows.length - 1}
                  showLabel={showLabels}
                />
              ))}
            </div>
          ))
        )}
      </section>

      {/* ── METHODOLOGY ─────────────────────────────────────────────── */}
      <section
        className={showLabels ? "grid g-2" : ""}
        style={{ marginTop: 32 }}
      >
        {showLabels && (
          <div className="card">
            <Eyebrow>
              Méthodologie · Échelle {selectedCup.ratingScale ?? "0-20"}
            </Eyebrow>
            <div style={{ marginTop: 20 }}>
              {labelLegend.length === 0 ? (
                <p
                  className="lede"
                  style={{ marginTop: 4, color: "var(--fg-3)" }}
                >
                  Aucun palier de label défini pour cette édition.
                </p>
              ) : (
                labelLegend.map((l) => (
                  <div key={l.name} className="kv">
                    <span
                      className="kv-k"
                      style={{
                        color: l.color,
                        letterSpacing: ".15em",
                      }}
                    >
                      {l.name}
                    </span>
                    <span className="kv-v tabular">{l.range}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </section>
      </div>
    </div>
  );
}

// Wrapper that fetches labels first then products (labels needed to compute
// label name per row in fetchProducts). Kept inline so the page reads top-down.
async function fetchPublishedCupProducts(cup: {
  id: string;
  ratingScale: string | null;
}): Promise<ProductRow[]> {
  const labels = await fetchCupLabels(cup.id);
  return fetchProducts(cup.id, cup, labels);
}
