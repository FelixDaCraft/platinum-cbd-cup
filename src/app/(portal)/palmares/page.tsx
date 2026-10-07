import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { eq, desc, isNotNull, and, asc } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import type { Cup } from "~/server/db/schema/cups";
import { EditionSelect } from "./_components/edition-select";
import {
  PORTAL_CACHE_TAGS,
  PORTAL_REVALIDATE,
  reviveCupDates,
} from "../_lib/cache";
import { canonical, OG_IMAGE_PAR_DEFAUT } from "../_lib/seo";
import type { JuryPanel } from "~/lib/enums";
import { panelColumns } from "~/server/db/panel-columns";


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

/**
 * Le palmarès est la page la plus coûteuse du portail — cinq requêtes par
 * affichage — pour des données figées entre deux publications de résultats.
 * Chaque lecteur est mémoïsé une minute ; `unstable_cache` intègre les
 * arguments (l'identifiant d'édition) à sa clé, les éditions ne se mélangent
 * donc pas.
 */
const PALMARES_CACHE = {
  revalidate: PORTAL_REVALIDATE,
  tags: [PORTAL_CACHE_TAGS.cups, PORTAL_CACHE_TAGS.results],
};

const getCachedPublishedCups = unstable_cache(
  fetchPublishedCups,
  ["palmares-published-cups"],
  PALMARES_CACHE,
);

const getCachedCupLabels = unstable_cache(
  (cupId: string) => fetchCupLabels(cupId),
  ["palmares-cup-labels"],
  PALMARES_CACHE,
);

const getCachedCategories = unstable_cache(
  (cupId: string) => fetchCategories(cupId),
  ["palmares-categories"],
  PALMARES_CACHE,
);

const getCachedPublicJuries = unstable_cache(
  (cupId: string) => fetchPublicJuries(cupId),
  ["palmares-public-juries"],
  PALMARES_CACHE,
);

const getCachedCupProducts = unstable_cache(
  (cup: { id: string; ratingScale: string | null }, panel: JuryPanel) =>
    fetchPublishedCupProducts(cup, panel),
  ["palmares-cup-products"],
  PALMARES_CACHE,
);

interface PublicJury {
  id: string;
  displayName: string;
  expertise: string | null;
  bio: string | null;
  image: string | null;
}

/**
 * Public-facing jury list for a cup. Only jurors of the cup's PRO panel who
 * explicitly consented (showOnPublicResults=true) are exposed — public-panel
 * jurors stay anonymous by design.
 */
async function fetchPublicJuries(cupId: string): Promise<PublicJury[]> {
  const rows = await db
    .select({
      profileId: schema.juryProfiles.id,
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
        eq(schema.cupJuries.panel, "pro"),
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
  panel: JuryPanel,
): Promise<ProductRow[]> {
  // Classement d'un seul panel : ses codes, ses scores, ses rangs.
  const cols = panelColumns(panel);
  const rows = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      anonymousCode: cols.anonymousCode,
      finalScore: cols.finalScore,
      categoryRank: cols.categoryRank,
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
        isNotNull(cols.finalScore),
      ),
    )
    .orderBy(
      asc(schema.categories.sortOrder),
      asc(schema.categories.name),
      desc(cols.finalScore),
      // Départage des ex aequo par le rang officiel (computeResults), sans
      // quoi deux scores égaux s'affichaient dans un ordre arbitraire.
      asc(cols.categoryRank),
    );

  return rows
    .filter((r) => r.anonymousCode != null && r.finalScore != null)
    .map((r) => {
      const score = parseFloat(r.finalScore!);
      const dq = r.disqualified;
      // Seul le jury public décerne des labels.
      const label = dq || panel !== "public" ? null : resolveLabel(score, labels);
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
// Éditions et classements
// ---------------------------------------------------------------------------

/** Millésime d'une édition : l'année du nom, sinon celle de la cérémonie. */
function editionYear(cup: Cup): number {
  const fromName = /\b(20\d{2})\b/.exec(cup.name)?.[1];
  if (fromName) return Number(fromName);
  return new Date(cup.eventDate ?? cup.ratingEndAt ?? cup.createdAt).getFullYear();
}

/** 2023 = 1re édition. */
function editionOrdinal(year: number): string {
  const n = Math.max(1, year - 2022);
  return n === 1 ? "1re édition" : `${n}e édition`;
}

const PANEL_NAME: Record<JuryPanel, string> = {
  public: "Jury public",
  pro: "Jury professionnel",
};

/** Indice de nom des éditions historiques, une cup par jury (« … - Jury PRO »). */
const PANEL_HINT: Record<JuryPanel, RegExp> = {
  public: /jury\s+public/i,
  pro: /jury\s+pro\b/i,
};

/** Un classement publié : la cup qui le porte et ses lignes. */
interface Ranking {
  panel: JuryPanel;
  cup: Cup;
  rows: ProductRow[];
}

/** « OR » → « Or ». */
function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function scaleMax(scale: string | null | undefined): number {
  return Number((scale ?? "0-20").split("-")[1] ?? 20);
}

function frScore(score: number, scale: string | null | undefined): string {
  const digits = scale === "0-100" ? 1 : 2;
  return `${score.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} / ${scaleMax(scale)}`;
}

function frNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Canonique sans paramètre : ?edition=… et ?cat=… ne sont que des filtres
 * d'affichage d'un même palmarès, les indexer créerait du contenu dupliqué.
 * `metadataBase` n'étant pas défini, on construit l'absolu comme dans
 * robots.ts et sitemap.ts.
 */
export const metadata: Metadata = {
  title: "Palmarès",
  description:
    "Le palmarès complet de la Platinum CBD Cup : lauréats, labels et classements par catégorie de chaque édition, jury public et jury professionnel.",
  alternates: {
    canonical: canonical("/palmares"),
  },
  openGraph: {
    type: "website",
    title: "Palmarès — Platinum CBD Cup",
    description:
      "Lauréats, labels et classements par catégorie de chaque édition de la Platinum CBD Cup.",
    url: canonical("/palmares"),
    images: [OG_IMAGE_PAR_DEFAUT],
  },
};

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="pal">
      <section className="pal-head">
        <h1 className="display">Palmarès</h1>
      </section>
      <div className="pal-empty">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

/**
 * Une édition = une année. Les éditions récentes portent leurs deux
 * classements dans une seule cup ; les anciennes avaient une cup par jury
 * (« PlatinumCBD CUP 2025 - Jury PRO » / « - Jury Public »). Le sélecteur
 * d'édition regroupe donc par année, et le choix du jury désigne ensuite le
 * classement — quelle que soit la cup qui le porte.
 *
 * Paramètres : `edition` (année ; un identifiant de cup reste accepté pour
 * les anciens liens), `jury` (public | pro), `cat` (catégorie affichée).
 */
export default async function PalmaresPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string; cat?: string; jury?: string }>;
}) {
  const sp = await searchParams;
  const cups = (await getCachedPublishedCups()).map(reviveCupDates);

  if (cups.length === 0) {
    return (
      <EmptyState
        title="Aucun palmarès publié"
        text="Le palmarès de l'édition en cours sera publié à l'issue de la cérémonie."
      />
    );
  }

  const years = [...new Set(cups.map(editionYear))].sort((a, b) => b - a);
  const cupFromParam = cups.find((c) => c.id === sp.edition);
  const yearFromParam = sp.edition && /^\d{4}$/.test(sp.edition) ? Number(sp.edition) : null;
  const year = cupFromParam
    ? editionYear(cupFromParam)
    : yearFromParam && years.includes(yearFromParam)
      ? yearFromParam
      : years[0]!;

  // Seuls l'identifiant et l'échelle entrent dans la clé de cache : passer
  // la ligne entière y ferait entrer `updatedAt` et invaliderait tout à la
  // moindre écriture sur la cup.
  const yearCups = cups.filter((c) => editionYear(c) === year);
  const perCup = await Promise.all(
    yearCups.map(async (cup) => {
      const key = { id: cup.id, ratingScale: cup.ratingScale };
      const [publicRows, proRows] = await Promise.all([
        getCachedCupProducts(key, "public"),
        getCachedCupProducts(key, "pro"),
      ]);
      return { cup, public: publicRows, pro: proRows };
    }),
  );

  // Le classement public d'abord : c'est lui qui porte les labels.
  const rankings: Ranking[] = [];
  for (const panel of ["public", "pro"] as const) {
    const candidates = perCup
      .filter((x) => x[panel].length > 0)
      .sort(
        (a, b) =>
          Number(PANEL_HINT[panel].test(b.cup.name)) -
          Number(PANEL_HINT[panel].test(a.cup.name)),
      );
    const best = candidates[0];
    if (best) rankings.push({ panel, cup: best.cup, rows: best[panel] });
  }

  const editionOptions = years.map((y) => ({
    value: String(y),
    label: `${y} · ${editionOrdinal(y)}`,
  }));

  if (rankings.length === 0) {
    return (
      <EmptyState
        title="Pas encore de palmarès"
        text="Aucun résultat publié pour cette édition."
      />
    );
  }

  const ranking =
    rankings.find((r) => r.panel === sp.jury) ??
    rankings.find((r) => r.cup.id === cupFromParam?.id) ??
    rankings[0]!;
  const { panel, cup } = ranking;
  const isPublic = panel === "public";

  const proRanking = rankings.find((r) => r.panel === "pro");
  const [labels, allCategories, publicJuries] = await Promise.all([
    getCachedCupLabels(cup.id),
    getCachedCategories(cup.id),
    proRanking ? getCachedPublicJuries(proRanking.cup.id) : Promise.resolve([]),
  ]);

  // L'édition 2023 a été classée par placement, sans notes chiffrées : son
  // palmarès montre le classement sans aucun score (Thomas, 06/2026).
  const hideScores = year === 2023;

  // Politique d'affichage (décision du 07/10/2026) : pour chaque jury, le
  // classement COMPLET de la catégorie est publié, avec rang et note de
  // chaque produit — primé ou non. Elle remplace la règle de 06/2026 (notes
  // réservées au podium, produits non labellisés masqués) et ignore le
  // réglage `resultsVisibility` de la cup. Côté public, le premier reçoit le
  // « Prix du public », jamais un label de palier (Thomas, 06/2026), et les
  // autres affichent leur label s'ils en ont un ; le jury pro n'en décerne
  // pas. Un produit disqualifié est montré, comme tel, en fin de liste.

  const categories = allCategories.filter((c) =>
    ranking.rows.some((r) => r.categoryId === c.id),
  );
  const activeCategory =
    categories.find((c) => c.id === sp.cat) ?? categories[0]!;
  const categoryRows = ranking.rows.filter((r) => r.categoryId === activeCategory.id);
  const ranked = categoryRows.filter((r) => !r.disqualified);
  const podium = ranked
    .filter((r) => r.isPodium)
    .sort((a, b) => a.rank - b.rank);
  const disqualified = categoryRows.filter((r) => r.disqualified);

  // Paliers de label, dédoublonnés par nom (la base historique contient
  // « Label OR » et « Label Or », même seuil, même couleur).
  const tiers = Array.from(
    labels
      .slice()
      .sort((a, b) => b.minScore - a.minScore)
      .reduce((map, l) => {
        const key = cleanLabel(l.name) ?? l.name;
        if (!map.has(key)) map.set(key, { key, ...l });
        return map;
      }, new Map<string, CupLabel & { key: string }>())
      .values(),
  );

  const fullRanking = ranked.filter((r) => !r.isPodium);

  // 2025 : catégories dédoublées France / Europe. Les puces sont alors
  // groupées par région, sans répéter la région dans chaque libellé.
  const hasRegions = categories.some((c) => categoryRegion(c.name) !== null);
  const chipGroups: { label: string | null; items: typeof categories }[] = hasRegions
    ? (
        [
          { label: "France", items: categories.filter((c) => categoryRegion(c.name) === "FR") },
          { label: "Europe", items: categories.filter((c) => categoryRegion(c.name) === "EU") },
          { label: "Autres", items: categories.filter((c) => categoryRegion(c.name) === null) },
        ] as const
      ).filter((g) => g.items.length > 0)
    : [{ label: null, items: categories }];
  const chipName = (name: string) => (hasRegions ? stripRegion(name) : name);
  const categoryTitle = (name: string) => {
    const region = categoryRegion(name);
    return region ? `${stripRegion(name)} · ${region === "FR" ? "France" : "Europe"}` : name;
  };

  const href = (params: { jury?: JuryPanel; cat?: string }) => {
    const q = new URLSearchParams({ edition: String(year) });
    const j = params.jury ?? panel;
    if (rankings.length > 1) q.set("jury", j);
    if (params.cat) q.set("cat", params.cat);
    return `/palmares?${q.toString()}`;
  };

  const productCount = ranking.rows.length;
  const others = categories.filter((c) => c.id !== activeCategory.id);
  const countIn = (categoryId: string) =>
    ranking.rows.filter((r) => r.categoryId === categoryId).length;

  return (
    <div className="pal">
      {/* ── EN-TÊTE ──────────────────────────────────────────────────── */}
      <section className="pal-head">
        <div className="pal-head-title">
          <h1 className="display">
            Palmarès <em>{year}</em>
          </h1>
          <p>
            {titleCase(editionOrdinal(year))} · {productCount} produit
            {productCount > 1 ? "s" : ""} · {categories.length} catégorie
            {categories.length > 1 ? "s" : ""}
          </p>
        </div>
        <EditionSelect options={editionOptions} current={String(year)} />
      </section>

      {/* ── JURY ET CATÉGORIES ───────────────────────────────────────── */}
      <section className="pal-controls">
        {rankings.length > 1 && (
          <nav className="pal-jury" aria-label="Classement affiché">
            {rankings.map((r) => (
              <Link
                key={r.panel}
                href={href({ jury: r.panel, cat: activeCategory.id })}
                scroll={false}
                aria-current={r.panel === panel ? "true" : undefined}
              >
                {PANEL_NAME[r.panel]}
              </Link>
            ))}
          </nav>
        )}

        <p className="pal-explain">
          {isPublic ? (
            <>
              Des consommateurs ont noté chaque produit à l&apos;aveugle.
              {tiers.length > 0 && (
                <>
                  {" "}Leur note décerne les labels :{" "}
                  {tiers.map((t, i) => (
                    <span key={t.key}>
                      <b style={{ color: t.color ?? "var(--accent-hi)" }}>
                        {titleCase(t.key)}
                      </b>{" "}
                      {t.maxScore == null
                        ? `dès ${frNumber(t.minScore)}/${scaleMax(cup.ratingScale)}`
                        : `de ${frNumber(t.minScore)} à ${frNumber(t.maxScore)}`}
                      {i < tiers.length - 1 ? ", " : "."}
                    </span>
                  ))}
                </>
              )}{" "}
              Le premier de chaque catégorie reçoit le Prix du public.
            </>
          ) : (
            <>
              Des professionnels (producteurs, sommeliers, analystes) ont noté
              chaque produit à l&apos;aveugle. Leur note établit le classement
              de chaque catégorie ; le jury professionnel ne décerne pas de
              label.
            </>
          )}
        </p>

        {categories.length > 1 && (
          <nav className="pal-cats" aria-label="Catégories">
            {chipGroups.map((group) => (
              <div key={group.label ?? "all"} className="pal-cats-group">
                {group.label && <span className="pal-cats-label">{group.label}</span>}
                {group.items.map((c) => (
                  <Link
                    key={c.id}
                    href={href({ cat: c.id })}
                    scroll={false}
                    aria-current={c.id === activeCategory.id ? "true" : undefined}
                  >
                    {chipName(c.name)}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        )}
      </section>

      {/* ── CATÉGORIE AFFICHÉE ───────────────────────────────────────── */}
      <section className="pal-category">
        <div className="pal-category-head">
          <h2 className="section-title">{categoryTitle(activeCategory.name)}</h2>
          <p>
            {categoryRows.length} produit{categoryRows.length > 1 ? "s" : ""} en compétition
          </p>
        </div>

        {podium.length > 0 && (
          <ol className="pal-podium" aria-label="Podium">
            {podium.map((p) => {
              const showScore = !hideScores;
              const tier = isPublic && p.rank > 1 ? p.labelName : null;
              const meta = [
                showScore ? frScore(p.score, cup.ratingScale) : null,
                tier ? `Label ${titleCase(tier)}` : null,
              ].filter(Boolean);
              return (
                <li key={p.code} className={`is-rank-${Math.min(p.rank, 3)}`}>
                  {isPublic && p.rank === 1 && (
                    <span className="pal-podium-prize">Prix du public</span>
                  )}
                  <span className="pal-podium-rank">
                    {p.rank}
                    <sup>{p.rank === 1 ? "er" : "e"}</sup>
                  </span>
                  <span className="pal-podium-name">{p.productName || p.code}</span>
                  <span className="pal-podium-producer">{p.producerName}</span>
                  {meta.length > 0 && <span className="pal-podium-meta">{meta.join(" · ")}</span>}
                </li>
              );
            })}
          </ol>
        )}

        {fullRanking.length > 0 && (
          <div className="pal-medals">
            <h3>Classement complet</h3>
            <ol className="pal-list pal-ranking">
              {fullRanking.map((r) => (
                <li key={r.code}>
                  <span>
                    <span className="pal-rank">{r.rank > 0 ? `${r.rank}e` : "—"}</span>
                    <b>{r.productName || r.code}</b> ·{" "}
                    <span className="pal-muted">{r.producerName}</span>
                  </span>
                  <span className="pal-ranking-meta">
                    {isPublic && r.labelName && (
                      <span className="pal-tag">
                        <span
                          className="pal-medal-dot"
                          style={{ background: r.labelColor ?? "var(--accent)" }}
                          aria-hidden="true"
                        />
                        {titleCase(r.labelName)}
                      </span>
                    )}
                    {!hideScores && (
                      <span className="pal-score">{frScore(r.score, cup.ratingScale)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="pal-note">
              Le détail des notes par critère est envoyé à chaque producteur.
            </p>
          </div>
        )}

        {disqualified.length > 0 && (
          <div className="pal-medals">
            <h3>Disqualifiés</h3>
            <ul className="pal-list">
              {disqualified.map((r) => (
                <li key={r.code}>
                  <span>
                    <b>{r.productName || r.code}</b> ·{" "}
                    <span className="pal-muted">{r.producerName}</span>
                  </span>
                  <span className="pal-dq">Disqualifié</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── AUTRES CATÉGORIES ────────────────────────────────────────── */}
      {others.length > 0 && (
        <section className="pal-others" aria-label="Autres catégories">
          {others.map((c) => {
            const n = countIn(c.id);
            return (
              <Link key={c.id} href={href({ cat: c.id })} className="pal-other">
                <span className="pal-other-name">{categoryTitle(c.name)}</span>
                <span className="pal-muted">
                  {n} produit{n > 1 ? "s" : ""} · voir le classement →
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {/* ── JURY PROFESSIONNEL ───────────────────────────────────────────
          Les jurés pro qui y ont consenti. Le jury public reste anonyme. */}
      {publicJuries.length > 0 && (
        <section className="pal-juries">
          <h2 className="section-title">Le jury professionnel {year}</h2>
          <ul>
            {publicJuries.map((j) => (
              <li key={j.id} className="pal-juror">
                <div className="pal-juror-id">
                  <span className="pal-juror-avatar">
                    {j.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={j.image}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      j.displayName
                        .split(" ")
                        .map((s) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    )}
                  </span>
                  <span>
                    <b>{j.displayName}</b>
                    {j.expertise && <span className="pal-muted">{j.expertise}</span>}
                  </span>
                </div>
                {j.bio && <p>{j.bio}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Wrapper that fetches labels first then products (labels needed to compute
// label name per row in fetchProducts). Kept inline so the page reads top-down.
async function fetchPublishedCupProducts(
  cup: {
    id: string;
    ratingScale: string | null;
  },
  panel: JuryPanel,
): Promise<ProductRow[]> {
  const labels = await fetchCupLabels(cup.id);
  return fetchProducts(cup.id, cup, labels, panel);
}
