import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { db } from "~/server/db";
import { and, desc, isNotNull, eq, count, sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import {
  Eyebrow,
  Countdown,
  Ticker,
} from "~/components/portal/platinum";
import { MobileHomeHero } from "~/components/portal/mobile/mobile-home-hero";
import { DesktopEmblem } from "./_components/desktop-emblem";
import { PORTAL_CACHE_TAGS, PORTAL_REVALIDATE } from "./_lib/cache";
import { canonical } from "./_lib/seo";

export const dynamic = "force-dynamic";

/**
 * L'accueil hérite du titre et de la description du layout racine, mais pas
 * de l'URL canonique : sans elle, /?utm_source=… et / sont deux documents
 * distincts pour un moteur. `metadataBase` n'étant pas défini, on construit
 * l'absolu comme dans robots.ts et sitemap.ts.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: canonical("/"),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

type CountdownState =
  | {
      kind: "registration";
      target: number;
      cupName: string;
      specimenCount: number;
      categoryCount: number;
    }
  | {
      kind: "results";
      target: number;
      cupName: string;
      specimenCount: number;
      categoryCount: number;
    }
  | { kind: "next-year" };

async function getCupStats(
  cupId: string
): Promise<{ specimenCount: number; categoryCount: number }> {
  try {
    const [specimens, cats] = await Promise.all([
      db
        .select({ total: count() })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .where(eq(schema.registrations.cupId, cupId)),
      db
        .select({ total: count() })
        .from(schema.categories)
        .where(eq(schema.categories.cupId, cupId)),
    ]);
    return {
      specimenCount: specimens[0]?.total ?? 0,
      categoryCount: cats[0]?.total ?? 0,
    };
  } catch {
    return { specimenCount: 0, categoryCount: 0 };
  }
}

async function getCountdownState(): Promise<CountdownState> {
  const now = new Date();

  // 1. Latest published cup with registrations still open
  try {
    const cup = await db.query.cups.findFirst({
      where: (c, { and, eq: eqOp, isNotNull: nn, gt }) =>
        and(
          eqOp(c.status, "published"),
          nn(c.registrationCloseAt),
          gt(c.registrationCloseAt, now)
        ),
      orderBy: (c, { desc: dsc }) => [dsc(c.createdAt)],
      columns: { id: true, name: true, registrationCloseAt: true },
    });

    if (cup?.registrationCloseAt) {
      const stats = await getCupStats(cup.id);
      return {
        kind: "registration",
        target: cup.registrationCloseAt.getTime(),
        cupName: cup.name,
        ...stats,
      };
    }
  } catch {
    // DB unavailable — fall through
  }

  // 2. Cup awaiting results (registrations closed / rating phase, results not yet published)
  try {
    const cup = await db.query.cups.findFirst({
      where: (c, { and, inArray, isNotNull: nn, gt, isNull }) =>
        and(
          inArray(c.status, ["registration_closed", "rating"]),
          nn(c.ratingEndAt),
          gt(c.ratingEndAt, now),
          isNull(c.resultsPublishedAt)
        ),
      orderBy: (c, { asc }) => [asc(c.ratingEndAt)],
      columns: { id: true, name: true, ratingEndAt: true },
    });

    if (cup?.ratingEndAt) {
      const stats = await getCupStats(cup.id);
      return {
        kind: "results",
        target: cup.ratingEndAt.getTime(),
        cupName: cup.name,
        ...stats,
      };
    }
  } catch {
    // DB unavailable — fall through
  }

  return { kind: "next-year" };
}

/**
 * Le bandeau ne montre que des résultats réels.
 *
 * Il affichait auparavant six scores inventés (« CF23 · FLOWER INDOOR · 94.2 »)
 * dès que la requête échouait — sur le site public d'un concours, rien ne
 * distinguait ces notes des vraies. Une base indisponible remonte désormais
 * l'erreur : `unstable_cache` ne mémorise pas un rejet, et la page masque
 * simplement le bandeau.
 */
async function getTickerItems(): Promise<string[]> {
  {
    // Classement public d'abord ; les éditions antérieures, à jury pro seul,
    // n'ont de score que côté pro. Le code affiché est celui du même panel.
    const finalScore = sql<string>`coalesce(${schema.products.finalScorePublic}, ${schema.products.finalScorePro})`;
    const products = await db
      .select({
        anonymousCode: sql<string | null>`case when ${schema.products.finalScorePublic} is not null then ${schema.products.anonymousCodePublic} else ${schema.products.anonymousCodePro} end`,
        finalScore,
        categoryName: schema.categories.name,
      })
      .from(schema.products)
      .innerJoin(
        schema.categories,
        eq(schema.products.categoryId, schema.categories.id)
      )
      .innerJoin(schema.cups, eq(schema.categories.cupId, schema.cups.id))
      .where(
        and(
          sql`${finalScore} is not null`,
          // Rien avant la publication officielle des résultats de l'édition.
          isNotNull(schema.cups.resultsPublishedAt),
          eq(schema.products.excludedFromResults, false)
        )
      )
      .orderBy(desc(schema.products.updatedAt))
      .limit(6);

    return products.map(
      (p) =>
        `${p.anonymousCode ?? "—"} · ${p.categoryName.toUpperCase()} · ${Number(p.finalScore).toFixed(1)}`
    );
  }
}

interface CategoryRow {
  code: string;
  name: string;
  specimenCount: number;
}

interface LatestCupBadge {
  /** "EDITION 04" — uppercase, padded edition number derived from cup year. */
  edition: string;
  /** Human-readable state in FR: "Inscriptions ouvertes" / "Notation en cours" / etc. */
  state: string;
}

async function getLatestCupBadge(): Promise<LatestCupBadge> {
  // Default fallback — picked so the eyebrow stays sensible when the DB
  // is unreachable or there's literally no non-draft cup yet.
  const fallback: LatestCupBadge = {
    edition: "EDITION 04",
    state: "À venir",
  };

  try {
    const cup = await db.query.cups.findFirst({
      where: (c, { ne }) => ne(c.status, "draft"),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      columns: { name: true, status: true, registrationCloseAt: true },
    });

    if (!cup) return fallback;

    // Edition number = (year - 2022). 2023 = ed 1, 2026 = ed 4. Year is
    // extracted from the cup name (format: "PlatinumCBD CUP YYYY ...").
    const yearMatch = /\b(20\d{2})\b/.exec(cup.name);
    const year = yearMatch ? parseInt(yearMatch[1]!, 10) : new Date().getFullYear();
    const editionNum = Math.max(1, year - 2022);
    const edition = `EDITION ${String(editionNum).padStart(2, "0")}`;

    // Translate cup status → human-readable state.
    let state: string;
    switch (cup.status) {
      case "published": {
        const stillOpen =
          cup.registrationCloseAt && cup.registrationCloseAt.getTime() > Date.now();
        state = stillOpen ? "Inscriptions ouvertes" : "Inscriptions clôturées";
        break;
      }
      case "registration_closed":
        state = "Inscriptions clôturées";
        break;
      case "rating":
        state = "Notation en cours";
        break;
      case "completed":
        state = "Édition terminée";
        break;
      default:
        state = "À venir";
    }

    return { edition, state };
  } catch {
    return fallback;
  }
}

/** Même règle que le bandeau : aucune catégorie inventée, aucun effectif inventé. */
async function getCategories(): Promise<CategoryRow[]> {
  {
    const cup = await db.query.cups.findFirst({
      where: (c, { ne: neOp }) => neOp(c.status, "draft"),
      orderBy: (c, { desc: dsc }) => [dsc(c.createdAt)],
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    if (!cup || cup.categories.length === 0) return [];

    // Count products per category, joined through registrations to scope to this cup
    const counts = await db
      .select({
        categoryId: schema.products.categoryId,
        total: count(),
      })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(eq(schema.registrations.cupId, cup.id))
      .groupBy(schema.products.categoryId);

    const countMap = new Map(counts.map((r) => [r.categoryId, r.total]));

    return cup.categories.map((c) => ({
      code: categoryCode(c.name),
      name: c.name,
      specimenCount: countMap.get(c.id) ?? 0,
    }));
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * L'accueil enchaînait huit requêtes SQL à chaque affichage — pour un contenu
 * (édition en cours, catégories, derniers scores) qui bouge quelques fois par
 * an. Les quatre lecteurs ci-dessous ne renvoient que des valeurs primitives,
 * donc traversent sans dommage la sérialisation JSON du cache de données.
 *
 * Le compte à rebours reste juste : il transporte un horodatage cible, pas
 * une durée, et c'est le composant client qui décompte.
 */
const cacheOptions = {
  revalidate: PORTAL_REVALIDATE,
  tags: [PORTAL_CACHE_TAGS.cups, PORTAL_CACHE_TAGS.results],
};

const getCachedCountdownState = unstable_cache(
  getCountdownState,
  ["home-countdown"],
  cacheOptions,
);
const getCachedTickerItems = unstable_cache(
  getTickerItems,
  ["home-ticker"],
  cacheOptions,
);
const getCachedCategories = unstable_cache(
  getCategories,
  ["home-categories"],
  cacheOptions,
);
const getCachedLatestCupBadge = unstable_cache(
  getLatestCupBadge,
  ["home-latest-cup-badge"],
  cacheOptions,
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Un lecteur qui échoue ne doit ni faire tomber l'accueil, ni inventer du
 * contenu : sa section disparaît, et rien n'est mémorisé — la requête suivante
 * retentera. `Promise.allSettled` isole chaque lecteur des trois autres.
 */
async function sansPanne<T>(promesse: Promise<T>, repli: T): Promise<T> {
  const [issue] = await Promise.allSettled([promesse]);
  if (issue.status === "fulfilled") return issue.value;
  console.error("[accueil] lecteur indisponible :", issue.reason);
  return repli;
}

export default async function PortalHomePage() {
  const [countdown, tickerItems, categories, latestBadge] = await Promise.all([
    getCachedCountdownState(),
    sansPanne(getCachedTickerItems(), [] as string[]),
    sansPanne(getCachedCategories(), [] as CategoryRow[]),
    getCachedLatestCupBadge(),
  ]);

  return (
    <div className="page-enter">
      {/* ── HERO · DESKTOP (>880px) ──────────────────────────────────────── */}
      <section
        className="hero-desktop"
        style={{ paddingTop: 40, paddingBottom: 60, position: "relative" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 40,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          <div>
            <Eyebrow>
              <b>{latestBadge.edition}</b> · {latestBadge.state}
            </Eyebrow>
            <h1
              className="display"
              style={{ marginTop: 20, marginBottom: 24 }}
            >
              Platinum
              <br />
              <em>CBD Cup</em> 2026.
            </h1>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "var(--fg-3)",
                textTransform: "uppercase",
                marginTop: -8,
                marginBottom: 22,
              }}
            >
              · Europe · Independent · Blind ·
            </div>
            <p className="lede">
              La seule compétition européenne de CBD évaluée à l'aveugle par un
              panel indépendant d'analystes, de sommeliers et de laboratoires
              certifiés.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 36,
                flexWrap: "wrap",
              }}
            >
              <Link href="/cups" className="btn accent">
                Postulez à la prochaine Edition <span className="btn-arrow">→</span>
              </Link>
              <Link href="/cups" className="btn ghost">
                Voir l'édition en cours
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            {/* Monté uniquement au-dessus de 881px : masquer ce canvas en CSS
                laissait un second contexte WebGL vivant sous MobileHomeHero. */}
            <DesktopEmblem size={735} tiltZ={-0.18} />
          </div>
        </div>
      </section>

      {/* ── HERO · MOBILE (≤880px) ───────────────────────────────────────── */}
      <div className="hero-mobile">
        <MobileHomeHero
          edition={latestBadge.edition}
          state={latestBadge.state}
          primaryCta={{
            label: "Postulez à la prochaine Edition",
            href: "/cups",
          }}
          secondaryCta={{
            label: "Voir l'édition en cours",
            href: "/cups",
          }}
        />
      </div>

      {/* ── COUNTDOWN ────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 24 }}>
        {countdown.kind === "next-year" ? (
          <div>
            <Eyebrow>Prochaine édition</Eyebrow>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 300,
                letterSpacing: "-0.02em",
                marginTop: 14,
                lineHeight: 1.1,
              }}
            >
              Rendez-vous l'année prochaine.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <Eyebrow>
                {countdown.kind === "registration"
                  ? "Clôture des inscriptions"
                  : "Annonce des résultats"}
              </Eyebrow>
              <div style={{ marginTop: 14 }}>
                <Countdown target={countdown.target} />
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--fg-3)",
                letterSpacing: ".1em",
              }}
            >
              <div>
                STATUS ·{" "}
                <span style={{ color: "var(--accent)" }}>
                  {countdown.kind === "registration" ? "OPEN" : "RATING"}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                SPECIMENS · {String(countdown.specimenCount).padStart(2, "0")}
              </div>
              <div style={{ marginTop: 6 }}>
                CAT · {String(countdown.categoryCount).padStart(2, "0")}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────── */}
      {tickerItems.length > 0 && <Ticker items={tickerItems} />}

      {/* ── THREE-UP ─────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <h2 className="section-title">Ce qui se passe ici</h2>
        <div className="grid g-3" style={{ marginTop: 32 }}>
          {(
            [
              {
                i: "01",
                t: "Blind panel",
                d: "Chaque spécimen reçoit un code anonyme à 5 caractères. Les jurés ne voient jamais les marques, les origines, ni les prix.",
              },
              {
                i: "02",
                t: "Lab-backed",
                d: "Cannabinoïdes et terpènes sont mesurés par des laboratoires indépendants. Aucune analyse de contaminants.",
              },
              {
                i: "03",
                t: "Public ledger",
                d: "Les scores, coefficients et méthodologies sont publiés intégralement. Tout est vérifiable. Rien n'est caché.",
              },
            ] as const
          ).map((x) => (
            <div key={x.i} className="card card-hover">
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: ".15em",
                }}
              >
                · {x.i}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 22,
                  marginTop: 18,
                  letterSpacing: "-.01em",
                }}
              >
                {x.t}
              </div>
              <p
                style={{
                  color: "var(--fg-2)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginTop: 12,
                }}
              >
                {x.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
      {categories.length > 0 && (
      <section style={{ marginTop: 64 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 24,
          }}
        >
          <h2 className="section-title">
            Catégories · {String(categories.length).padStart(2, "0")}
          </h2>
          <span className="eyebrow">Edition 2026</span>
        </div>
        <div className="grid g-3">
          {categories.map((cat) => (
            <div
              key={cat.code + cat.name}
              className="card card-hover"
              style={{ display: "flex", alignItems: "center", gap: 18 }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 12,
                  border: "1px solid var(--line-strong)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 18,
                  color: "var(--fg)",
                  letterSpacing: ".02em",
                  flexShrink: 0,
                  background: "var(--bg)",
                }}
              >
                {cat.code}
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 15 }}>
                  {cat.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                    letterSpacing: ".1em",
                    marginTop: 4,
                  }}
                >
                  {cat.specimenCount > 0
                    ? `${cat.specimenCount} SPECIMENS`
                    : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ── PALMARÈS CTA ─────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64, marginBottom: 64 }}>
        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div>
            <Eyebrow>Palmarès</Eyebrow>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 22,
                marginTop: 12,
                lineHeight: 1.3,
              }}
            >
              Découvrez les lauréats des éditions précédentes.
            </div>
          </div>
          <Link href="/palmares" className="btn ghost">
            Voir le palmarès →
          </Link>
        </div>
      </section>

      {/* ── DESKTOP / MOBILE HERO SWITCH ─────────────────────────────────
          The desktop hero (with the 735px GeometricEmblem on the right) is
          rendered as-is above 880px. Below 880px we render a different hero
          (MobileHomeHero) that takes over the viewport with a scroll-driven
          3D backdrop. CSS-only show/hide keeps SSR markup stable and avoids
          hydration flashes. */}
      <style>{`
        .hero-mobile { display: none; }
        @media (max-width: 880px) {
          .hero-desktop { display: none; }
          .hero-mobile { display: block; }
        }
      `}</style>
    </div>
  );
}
