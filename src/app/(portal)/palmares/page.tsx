import Link from "next/link";
import { eq, desc, isNotNull, and, asc } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import {
  Eyebrow,
  Pill,
  GeometricEmblem,
} from "~/components/portal/platinum";
import { MobilePalmaresBackdrop } from "~/components/portal/mobile/mobile-palmares-backdrop";
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
  /** True for the top-3 of a category — only these rows expose their score. */
  isPodium: boolean;
  /** Disqualified (cheating): shown at the bottom with a "DISQUALIFIÉ" badge,
   *  no score/rank/label, always visible regardless of the cup's display rule. */
  disqualified: boolean;
}

/** Top-N ranks per category shown WITH their final score. Other label-winners
 *  are listed without a score (see the public results policy in the page). */
const PODIUM_DEPTH = 3;

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

type Region = "FR" | "EU";

/**
 * 2025 introduced a France/Europe geographic split. A category encodes its
 * region as a "(France)" / "(Europe)" suffix in its name. Returns null for
 * editions that don't use the convention (2023/2024/2026), so those keep the
 * flat category list.
 */
function categoryRegion(name: string): Region | null {
  if (/\(\s*france\s*\)\s*$/i.test(name)) return "FR";
  if (/\(\s*europe\s*\)\s*$/i.test(name)) return "EU";
  return null;
}

/** Drops the trailing "(France)"/"(Europe)" tag — the section banner carries
 *  the region, so the per-category header doesn't repeat it. */
function stripRegion(name: string): string {
  return name.replace(/\s*\(\s*(?:france|europe)\s*\)\s*$/i, "").trim();
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

interface PublicJury {
  id: string;
  displayName: string;
  expertise: string | null;
  bio: string | null;
  image: string | null;
}

/**
 * Public-facing jury list for a cup. Only `pro` jurys who explicitly
 * consented (showOnPublicResults=true) are exposed — `public` jurys
 * stay anonymous by design.
 */
async function fetchPublicJuries(cupId: string): Promise<PublicJury[]> {
  const rows = await db
    .select({
      profileId: schema.juryProfiles.id,
      profileType: schema.juryProfiles.juryType,
      profileDisplayName: schema.juryProfiles.displayName,
      profileExpertise: schema.juryProfiles.expertise,
      profileBio: schema.juryProfiles.bio,
      profileShow: schema.juryProfiles.showOnPublicResults,
      userName: schema.users.name,
      userImage: schema.users.image,
    })
    .from(schema.cupJuries)
    .innerJoin(
      schema.juryProfiles,
      eq(schema.cupJuries.juryProfileId, schema.juryProfiles.id),
    )
    .innerJoin(schema.users, eq(schema.cupJuries.userId, schema.users.id))
    .where(
      and(
        eq(schema.cupJuries.cupId, cupId),
        eq(schema.cupJuries.isActive, true),
        eq(schema.juryProfiles.juryType, "pro"),
        eq(schema.juryProfiles.showOnPublicResults, true),
      ),
    );

  return rows.map((r) => ({
    id: r.profileId,
    displayName: r.profileDisplayName ?? r.userName,
    expertise: r.profileExpertise,
    bio: r.profileBio,
    image: r.userImage,
  }));
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
      disqualified: schema.products.disqualified,
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
      const dq = r.disqualified;
      const label = dq ? null : resolveLabel(score, labels);
      const rank = r.categoryRank ?? 0;
      return {
        rank,
        code: r.anonymousCode!,
        productName: r.productName ?? "",
        // Company first (the entity), brand second as a fallback when the
        // producer registered without a company (rare, single-person).
        producerName: r.companyName ?? r.brandName ?? "—",
        categoryName: r.categoryName ?? "",
        categoryId: r.categoryId ?? "",
        score,
        scoreFormatted: formatScore(score, cup.ratingScale),
        // Disqualified products never carry a label or a podium slot.
        labelName: dq ? null : cleanLabel(label?.name ?? null),
        labelColor: dq ? null : (label?.color ?? null),
        isPodium: !dq && rank > 0 && rank <= PODIUM_DEPTH,
        disqualified: dq,
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
          <div
            className="palmares-edition-strip"
            style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
          >
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

  // The 2023 edition was ranked by the judges' placement, not by numeric notes,
  // so its palmarès shows the ranking WITHOUT any score (Thomas, 06/2026).
  const hideScores = selectedYear === "2023";

  const [labels, allCategories, allProducts, publicJuries] = await Promise.all([
    fetchCupLabels(selectedCup.id),
    fetchCategories(selectedCup.id),
    fetchPublishedCupProducts(selectedCup),
    fetchPublicJuries(selectedCup.id),
  ]);

  // Public results policy depends on the cup's jury model:
  //
  //  • PUBLIC-JURY cups → restricted display, regardless of resultsVisibility:
  //      - Podium    : top 3 of each category, shown WITH their final score.
  //      - Médaillés : every other label-winner, shown WITH the label but
  //                    WITHOUT the score ("Médaillé" placeholder).
  //      - Everything else (no podium, no label) is hidden.
  //
  //  • PRO-PANEL cups → the organizer-configured resultsVisibility, with full
  //    scores shown for every visible product (the historical behaviour).
  const isPublicJuryCup = selectedCup.type === "public";

  const proVisibility = (selectedCup.resultsVisibility ?? "labels") as
    | "podium"
    | "labels"
    | "labels_and_podium"
    | "all";

  // A disqualified product is ALWAYS shown (as "DISQUALIFIÉ"), overriding the
  // cup's normal display rule. Otherwise the standard public/pro logic applies.
  const isVisible = (p: ProductRow): boolean => {
    if (p.disqualified) return true;
    if (isPublicJuryCup) return p.isPodium || p.labelName != null;
    switch (proVisibility) {
      case "all":
        return true;
      case "podium":
        return p.isPodium;
      case "labels":
        return p.labelName != null;
      default: // labels_and_podium
        return p.isPodium || p.labelName != null;
    }
  };
  // Public winner medal: each public category's rank-1 keeps a "Prix du public"
  // badge even when its real (often low) score earns no score-based label, so
  // the winner is never left bare (Thomas, 06/2026).
  const withPublicMedal = isPublicJuryCup
    ? allProducts.map((p) =>
        p.rank === 1 && !p.disqualified && !p.labelName
          ? { ...p, labelName: "Prix du public", labelColor: "var(--accent)" }
          : p,
      )
    : allProducts;
  const products = withPublicMedal.filter(isVisible);

  // Public-jury cups mask the score everywhere except the podium; pro cups
  // always reveal it.
  const maskNonPodiumScore = isPublicJuryCup;

  // Labels/medals are a PUBLIC-jury signal only — the Pro jury never shows label
  // badges, on any edition (Thomas, 06/2026). This also keeps the methodology
  // table public-only.
  const showLabels = isPublicJuryCup;

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

  // Best-in-show = highest-scoring product. Scores are a podium-only signal,
  // so the hero is drawn from the podium first. In practice the global top
  // scorer is always a category rank-1 (podium), so this matches the absolute
  // max; the fallback only guards degenerate editions where ranks were never
  // committed (it then loses its score below, never contradicting the table).
  const top =
    [...products].filter((p) => p.isPodium).sort((a, b) => b.score - a.score)[0] ??
    [...products]
      .filter((p) => !p.disqualified)
      .sort((a, b) => b.score - a.score)[0] ??
    [...products].sort((a, b) => b.score - a.score)[0]!;

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
  // Disqualified products always sink to the bottom of their category (the sort
  // is stable, so ranked rows keep their score-desc order above them).
  for (const g of grouped) {
    g.rows.sort((a, b) => Number(a.disqualified) - Number(b.disqualified));
  }

  // Geographic split (2025+): when the cup's categories carry a "(France)" /
  // "(Europe)" tag, the rankings are presented under two "Classement" banners
  // — France first, then Europe — each preserving the category sort order.
  // Editions without the tag (2023/2024/2026) fall through to the flat list.
  const cupHasRegions = allCategories.some(
    (c) => categoryRegion(c.name) !== null,
  );
  const regionSections: { label: string; groups: CategoryGroup[] }[] = [];
  if (cupHasRegions) {
    const franceGroups = grouped.filter((g) => categoryRegion(g.name) === "FR");
    const europeGroups = grouped.filter((g) => categoryRegion(g.name) === "EU");
    const otherGroups = grouped.filter((g) => categoryRegion(g.name) === null);
    if (franceGroups.length > 0)
      regionSections.push({ label: "France", groups: franceGroups });
    if (europeGroups.length > 0)
      regionSections.push({ label: "Europe", groups: europeGroups });
    if (otherGroups.length > 0)
      regionSections.push({ label: "Autres", groups: otherGroups });
  }

  // Single category block (header + column labels + rows). Reused by both the
  // flat list and the region-grouped layout. `withTopBorder` draws the divider
  // between consecutive categories (the first in a list/section omits it).
  const renderCategory = (group: CategoryGroup, withTopBorder: boolean) => (
    <div key={group.id}>
      {/* Category header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "20px 28px 14px",
          borderTop: withTopBorder ? "1px solid var(--line)" : 0,
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
          {cupHasRegions ? stripRegion(group.name) : group.name}
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

      {/* Column header — desktop only. The mobile card layout is
          self-explanatory so the column header is hidden via CSS below 880px. */}
      <div
        className="ranking-header"
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
          maskNonPodiumScore={maskNonPodiumScore}
          hideScore={hideScores}
        />
      ))}
    </div>
  );

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
    <>
      {/* Page-level 3D emblem — same size + tilt as the home hero, fixed
          to the viewport top-right so it stays visible while scrolling.
          Rendered OUTSIDE the .page-enter wrapper because that wrapper
          animates a transform on mount, and any ancestor with a transform
          becomes the containing block for `position: fixed` — which would
          collapse the emblem back to absolute-style behaviour and make
          it scroll with the content. Non-interactive so clicks fall through. */}
      <div
        aria-hidden="true"
        className="palmares-desktop-emblem"
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

      {/* Mobile-only fixed full-viewport 3D backdrop. Returns null above
          880px (the useMediaQuery gate inside the component handles that),
          so desktop renders the existing top-right emblem only. */}
      <MobilePalmaresBackdrop />

      <div className="page-enter" style={{ position: "relative", zIndex: 1 }}>
        {headerSection}

        {/* ── BEST IN SHOW ─────────────────────────────────────────────── */}
        <section
          className="card"
          data-best-in-show
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
            {/* Public-jury cups expose the hero score only when the best-in-show
                is a podium product (consistent with the table's top-3-only
                policy); pro cups always show it. */}
            {!hideScores && (top.isPodium || !maskNonPodiumScore) && (
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
            )}

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

      {/* ── CATEGORY FILTER CHIPS ───────────────────────────────────── */}
      <div
        className="palmares-category-strip"
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
        data-rankings-card
        style={{
          padding: 0,
          overflow: "hidden",
          marginBottom: 24,
          // Mostly opaque so the table text stays legible over the 3D emblem
          // backdrop (the glass blur is kept for a subtle depth hint only).
          background: "color-mix(in srgb, var(--bg-2) 94%, transparent)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
        }}
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
        ) : cupHasRegions ? (
          regionSections.map((section, si) => (
            <div key={section.label}>
              {/* Region banner — "CLASSEMENT FRANCE" / "CLASSEMENT EUROPE" */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "24px 28px 16px",
                  borderTop:
                    si === 0 ? 0 : "1px solid var(--line-strong)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  Classement {section.label}
                </span>
                <span
                  aria-hidden="true"
                  style={{ flex: 1, height: 1, background: "var(--line)" }}
                />
                <span
                  className="mono fg3"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section.groups.length} catégorie
                  {section.groups.length > 1 ? "s" : ""}
                </span>
              </div>
              {section.groups.map((group, gi) =>
                renderCategory(group, gi !== 0),
              )}
            </div>
          ))
        ) : (
          grouped.map((group, gi) => renderCategory(group, gi !== 0))
        )}
      </section>

      {/* ── JURY ────────────────────────────────────────────────────────
          Pro jurys who opted in via their profile. Public jurys never
          appear here — they remain anonymous by design. */}
      {publicJuries.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <Eyebrow>Jury · {publicJuries.length} membre{publicJuries.length > 1 ? "s" : ""}</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            {publicJuries.map((j) => (
              <article
                key={j.id}
                className="card"
                style={{
                  padding: 20,
                  background: "color-mix(in srgb, var(--bg-2) 60%, transparent)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  WebkitBackdropFilter: "blur(14px) saturate(140%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--bg)",
                      border: "1px solid var(--line-strong)",
                      flexShrink: 0,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {j.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={j.image}
                        alt={j.displayName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                          color: "var(--fg-2)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {j.displayName
                          .split(" ")
                          .map((s) => s[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--fg)",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {j.displayName}
                    </p>
                    {j.expertise && (
                      <p
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "var(--fg-3)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          margin: 0,
                          marginTop: 2,
                        }}
                      >
                        {j.expertise}
                      </p>
                    )}
                  </div>
                </div>
                {j.bio && (
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "var(--fg-2)",
                      margin: 0,
                    }}
                  >
                    {j.bio}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── METHODOLOGY ─────────────────────────────────────────────── */}
      {showLabels && (
        <section className="grid g-2" style={{ marginTop: 32 }}>
          <div
            className="card"
            data-methodology-card
            style={{
              background: "color-mix(in srgb, var(--bg-2) 60%, transparent)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
            }}
          >
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
        </section>
      )}
      </div>
    </>
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
