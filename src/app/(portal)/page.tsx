import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { and, asc, between, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { panelColumns } from "~/server/db/panel-columns";
import type { JuryPanel } from "~/lib/enums";
import { DesktopEmblem } from "./_components/desktop-emblem";
import {
  CategoryPrices,
  EditionStatus,
  EditionSteps,
  JuriesExplainer,
} from "./_components/edition-blocks";
import {
  editionYear,
  formatNumber,
  getCurrentEditionId,
  getEditionDetails,
  phaseOf,
  resolveTier,
  statusLine,
  stepsOf,
  tierName,
  type LabelTier,
} from "./_lib/edition";
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
// Data
// ---------------------------------------------------------------------------

async function getCurrentEdition() {
  const id = await getCurrentEditionId();
  return id ? getEditionDetails(id) : null;
}

interface Teaser {
  year: number;
  cupId: string;
  categoryId: string;
  categoryName: string;
  panel: JuryPanel;
  /** Le palmarès propose-t-il les deux classements pour cette édition ? */
  bothPanels: boolean;
  labels: LabelTier[];
  podium: {
    rank: number;
    productName: string;
    producerName: string;
    /** null quand l'édition ne publie pas ses notes (2023). */
    score: number | null;
  }[];
}

/**
 * Podium de la première catégorie de la dernière édition publiée : le
 * classement du jury public d'abord (c'est lui qui décerne les labels), celui
 * du jury pro à défaut. Mêmes règles que le palmarès : rien avant la
 * publication, ni produit écarté, ni disqualifié.
 */
async function getPalmaresTeaser(): Promise<Teaser | null> {
  const published = await db.query.cups.findMany({
    where: (c, { isNotNull: nn }) => nn(c.resultsPublishedAt),
    columns: { id: true, name: true, eventDate: true, ratingEndAt: true, createdAt: true },
  });
  if (published.length === 0) return null;

  const year = Math.max(...published.map(editionYear));
  const cupIds = published.filter((c) => editionYear(c) === year).map((c) => c.id);

  const podiumFor = async (panel: JuryPanel) => {
    const cols = panelColumns(panel);
    return db
      .select({
        cupId: schema.registrations.cupId,
        rank: cols.categoryRank,
        score: cols.finalScore,
        productName: schema.products.name,
        categoryId: schema.categories.id,
        categoryName: schema.categories.name,
        companyName: schema.producers.companyName,
        brandName: schema.producers.brandName,
      })
      .from(schema.products)
      .innerJoin(schema.registrations, eq(schema.products.registrationId, schema.registrations.id))
      .innerJoin(schema.producers, eq(schema.registrations.producerId, schema.producers.id))
      .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(
        and(
          inArray(schema.registrations.cupId, cupIds),
          eq(schema.products.excludedFromResults, false),
          eq(schema.products.disqualified, false),
          isNotNull(cols.finalScore),
          between(cols.categoryRank, 1, 3),
        ),
      )
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name), asc(cols.categoryRank));
  };

  const [publicRows, proRows] = await Promise.all([podiumFor("public"), podiumFor("pro")]);
  const panel: JuryPanel = publicRows.length > 0 ? "public" : "pro";
  const rows = panel === "public" ? publicRows : proRows;
  const first = rows[0];
  if (!first) return null;

  const podium = rows.filter((r) => r.categoryId === first.categoryId);
  const labels =
    panel === "public"
      ? (
          await db.query.cupLabels.findMany({
            where: (l, { eq: e }) => e(l.cupId, first.cupId),
            orderBy: (l, { desc }) => [desc(l.minScore)],
          })
        ).map((l) => ({ name: l.name, minScore: l.minScore, maxScore: l.maxScore, color: l.color }))
      : [];

  return {
    year,
    cupId: first.cupId,
    categoryId: first.categoryId,
    categoryName: first.categoryName,
    panel,
    bothPanels: publicRows.length > 0 && proRows.length > 0,
    labels,
    podium: podium.map((r) => ({
      rank: r.rank ?? 0,
      productName: r.productName ?? "",
      producerName: r.companyName ?? r.brandName ?? "—",
      // L'édition 2023 a été classée sans notes chiffrées (cf. palmarès).
      score: year === 2023 || r.score == null ? null : Number(r.score),
    })),
  };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cacheOptions = {
  revalidate: PORTAL_REVALIDATE,
  tags: [PORTAL_CACHE_TAGS.cups, PORTAL_CACHE_TAGS.results],
};

const getCachedCurrentEdition = unstable_cache(
  getCurrentEdition,
  ["home-current-edition"],
  cacheOptions,
);
const getCachedPalmaresTeaser = unstable_cache(
  getPalmaresTeaser,
  ["home-palmares-teaser"],
  cacheOptions,
);

/**
 * Un lecteur qui échoue ne doit ni faire tomber l'accueil, ni inventer du
 * contenu : sa section disparaît, et rien n'est mémorisé — la requête suivante
 * retentera.
 */
async function sansPanne<T>(promesse: Promise<T>, repli: T): Promise<T> {
  const [issue] = await Promise.allSettled([promesse]);
  if (issue.status === "fulfilled") return issue.value;
  console.error("[accueil] lecteur indisponible :", issue.reason);
  return repli;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortalHomePage() {
  const [edition, teaser] = await Promise.all([
    sansPanne(getCachedCurrentEdition(), null),
    sansPanne(getCachedPalmaresTeaser(), null),
  ]);

  const now = Date.now();
  const phase = edition ? phaseOf(edition, now) : null;
  const isOpen = phase === "open";
  const heroYear = edition?.year ?? teaser?.year ?? null;
  const tiers = edition?.labels.length ? edition.labels : (teaser?.labels ?? []);

  const palmaresHref = teaser ? "/palmares" : "/archives";
  const palmaresLabel = teaser ? `Voir le palmarès ${teaser.year}` : "Les éditions passées";
  const registerHref = edition ? `/cups/${edition.id}/register` : "/cups";

  const teaserHref = teaser
    ? `/palmares?edition=${teaser.cupId}&cat=${teaser.categoryId}${teaser.bothPanels ? `&jury=${teaser.panel}` : ""}`
    : null;

  return (
    <div className="home">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-hero-text">
          <EditionStatus
            open={isOpen}
            text={
              edition && phase
                ? statusLine(edition, phase)
                : teaser
                  ? `Palmarès ${teaser.year} publié · prochaine édition en préparation`
                  : "Prochaine édition en préparation"
            }
          />

          <div className="home-hero-title">
            <h1 className="display display--brand">
              Platinum
              <br />
              CBD Cup{heroYear != null && <> <em>{heroYear}</em></>}
            </h1>
            <img
              className="home-hero-mark"
              src="/brand/platinum-cbd-cup-logo.png"
              alt=""
              width={96}
              height={96}
              decoding="async"
            />
          </div>

          <p className="lede home-hero-lede">
            Le concours européen du CBD. Chaque produit est noté à l&apos;aveugle
            par deux jurys : des professionnels, et des consommateurs.
          </p>

          <div className="home-actions">
            {isOpen ? (
              <>
                <Link href={registerHref} className="btn accent btn-lg">
                  Inscrire mes produits
                </Link>
                <Link href={palmaresHref} className="btn ghost btn-lg">
                  {palmaresLabel}
                </Link>
              </>
            ) : (
              <>
                <Link href={palmaresHref} className="btn accent btn-lg">
                  {palmaresLabel}
                </Link>
                <Link href="/about" className="btn ghost btn-lg">
                  Découvrir le concours
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="home-hero-emblem" aria-hidden="true">
          {/* Monté uniquement au-dessus de 881px : sur mobile, l'emblème
              statique placé à côté du titre le remplace. */}
          <DesktopEmblem size={690} tiltZ={-0.18} />
        </div>
      </section>

      {/* ── CALENDRIER ─────────────────────────────────────────────────── */}
      {edition && <EditionSteps steps={stepsOf(edition, now)} year={edition.year} />}

      {/* ── DEUX JURYS ─────────────────────────────────────────────────── */}
      <JuriesExplainer labels={tiers} />

      {/* ── CATÉGORIES ET TARIFS ───────────────────────────────────────── */}
      {edition && phase && (
        <CategoryPrices edition={edition} phase={phase} registerHref={registerHref} />
      )}

      {/* ── PALMARÈS ───────────────────────────────────────────────────── */}
      {teaser && teaserHref && (
        <section className="home-band is-filled">
          <div className="home-section home-palmares">
            <div className="home-section-head is-split">
              <div>
                <p className="eyebrow">
                  <b>
                    Palmarès {teaser.year} · {teaser.categoryName} ·{" "}
                    {teaser.panel === "public" ? "Jury public" : "Jury professionnel"}
                  </b>
                </p>
                <h2 className="section-title">Les lauréats</h2>
              </div>
              <Link href="/palmares" className="home-link">
                Tout le palmarès {teaser.year} →
              </Link>
            </div>
            <ol className="home-podium">
              {teaser.podium.map((p) => {
                const tier =
                  teaser.panel === "public" && p.rank > 1 && p.score != null
                    ? resolveTier(p.score, teaser.labels)
                    : null;
                const distinction =
                  teaser.panel === "public" && p.rank === 1
                    ? "Prix du public"
                    : tier
                      ? `Label ${tierName(tier.name)}`
                      : null;
                const score = p.score != null ? `${formatNumber(p.score)} / 20` : null;
                return (
                  <li key={`${p.rank}-${p.productName}`} className={p.rank === 1 ? "is-first" : undefined}>
                    <span className="home-podium-rank">
                      {p.rank}
                      <sup>{p.rank === 1 ? "er" : "e"}</sup>
                    </span>
                    <span className="home-podium-name">{p.productName}</span>
                    <span className="home-podium-producer">{p.producerName}</span>
                    {(distinction ?? score) && (
                      <span className="home-podium-meta">
                        {[distinction, score].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <Link href={teaserHref} className="home-link home-palmares-more">
              Le classement complet de la catégorie →
            </Link>
          </div>
        </section>
      )}

      {/* ── PAR PUBLIC ─────────────────────────────────────────────────── */}
      <section className="home-section">
        <ul className="home-audiences">
          {[
            {
              href: edition ? `/cups/${edition.id}` : "/cups",
              title: "Producteur",
              text: "Inscrire vos produits, suivre vos échantillons, recevoir vos notes détaillées.",
              cta: "Participer",
            },
            {
              href: "/palmares",
              title: "Amateur",
              text: "Découvrir les meilleurs CBD d'Europe, édition après édition.",
              cta: "Le palmarès",
            },
            {
              href: "/activate",
              title: "Juré",
              text: "Vous avez reçu un code ou un QR code ? Activez votre accès en une minute.",
              cta: "Activer mon code",
            },
            {
              href: "/press",
              title: "Presse et partenaires",
              text: "Kit média, visuels, contacts et dossier de partenariat.",
              cta: "Espace presse",
            },
          ].map((a) => (
            <li key={a.title}>
              <Link href={a.href} className="home-audience">
                <span className="home-audience-title">{a.title}</span>
                <span className="home-audience-text">{a.text}</span>
                <span className="home-audience-cta">{a.cta} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
