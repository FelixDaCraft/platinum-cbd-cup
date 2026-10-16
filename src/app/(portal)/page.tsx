import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { and, asc, between, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { panelColumns } from "~/server/db/panel-columns";
import type { JuryPanel } from "~/lib/enums";
import { DesktopEmblem } from "./_components/desktop-emblem";
import {
  EditionBar,
  GoldList,
  LiquidText,
  longestWord,
  Sparkle,
  Tape,
} from "~/components/portal/street/street";
import {
  CategoryPrices,
  EditionStatus,
  EditionSteps,
  JuriesExplainer,
} from "./_components/edition-blocks";
import {
  editionOrdinal,
  editionYear,
  formatNumber,
  formatPrice,
  formatShortDay,
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
    /** Logo du producteur (chemin /uploads/…), s'il en a déposé un. */
    logo: string | null;
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
        logo: schema.producers.logo,
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
      logo: r.logo ?? null,
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
  const palmaresLabel = teaser ? `Palmarès ${teaser.year}` : "Les éditions passées";
  const registerHref = edition ? `/cups/${edition.id}/register` : "/cups";

  const teaserHref = teaser
    ? `/palmares?edition=${teaser.cupId}&cat=${teaser.categoryId}${teaser.bothPanels ? `&jury=${teaser.panel}` : ""}`
    : null;

  const status =
    edition && phase
      ? statusLine(edition, phase)
      : teaser
        ? `Palmarès ${teaser.year} publié · prochaine édition en préparation`
        : "Prochaine édition en préparation";

  const ordinal = heroYear != null ? editionOrdinal(heroYear) : null;
  const categoryNames = edition?.categories.map((c) => c.name) ?? [];

  // Tarif affiché seulement s'il est réellement enregistré pour l'édition.
  const prices = edition?.categories.map((c) => c.priceCents ?? 0) ?? [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const priceText =
    edition && minPrice > 0
      ? `${prices.every((p) => p === minPrice) ? "" : "Dès "}${formatPrice(minPrice, edition.currency)} par produit`
      : null;

  const closeAt = edition?.registrationCloseAt ?? null;
  const tapeItems = edition
    ? [
        isOpen && closeAt != null
          ? `Inscriptions ouvertes jusqu'au ${formatShortDay(closeAt, true)}`
          : status,
        categoryNames.length > 0
          ? `${categoryNames.length} catégorie${categoryNames.length > 1 ? "s" : ""}`
          : null,
        priceText,
        "Notation à l'aveugle",
        "Jury pro et jury public",
        ordinal && heroYear != null ? `${ordinal} · ${heroYear}` : null,
      ].filter((x): x is string => Boolean(x))
    : [];

  const heroTitle = ["Mesure-toi", "aux", "meilleurs"];

  return (
    <div className="st-home">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="st-hero">
        {ordinal && heroYear != null && (
          <EditionBar>
            {ordinal}
            <Sparkle size={12} />
            {heroYear}
          </EditionBar>
        )}

        <div className="st-hero-grid">
          <div className="st-hero-text">
            <EditionStatus open={isOpen} text={status} />

            <LiquidText
              as="h1"
              className="st-hero-title"
              seed={5}
              fit={longestWord(...heroTitle)}
            >
              <span className="sr-only">Platinum CBD Cup{heroYear != null ? ` ${heroYear}` : ""} : </span>
              {heroTitle.map((line, i) => (
                <Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </LiquidText>

            <p className="st-hero-lede">
              Le concours européen du CBD. Vos produits sont notés à l&apos;aveugle par
              un jury professionnel et par un jury public, chacun avec son propre code
              d&apos;anonymat.
            </p>

            {categoryNames.length > 0 && <GoldList items={categoryNames} />}

            <div className="st-actions">
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

          <div className="st-hero-visual">
            {/* Emblème 3D : rotation lente, penché vers la droite, et
                manipulable au cliquer-glisser. Bureau avec souris seulement
                (voir DesktopEmblem) ; ailleurs, le logo fixe le remplace. */}
            <DesktopEmblem size={750} tiltZ={-0.22} glow={false} />
            <img
              className="st-hero-mark"
              src="/brand/platinum-cbd-cup-logo.png"
              alt=""
              width={220}
              height={220}
              decoding="async"
            />
          </div>
        </div>
      </section>

      {tapeItems.length > 0 && <Tape items={tapeItems} />}

      {/* ── CALENDRIER ─────────────────────────────────────────────────── */}
      {edition && <EditionSteps steps={stepsOf(edition, now)} year={edition.year} />}

      {/* ── CATÉGORIES ET TARIFS ───────────────────────────────────────── */}
      {edition && phase && (
        <CategoryPrices edition={edition} phase={phase} registerHref={registerHref} />
      )}

      {/* ── DEUX JURYS ─────────────────────────────────────────────────── */}
      <JuriesExplainer labels={tiers} />

      {/* ── PALMARÈS ───────────────────────────────────────────────────── */}
      {teaser && teaserHref && (
        <section className="st-sec st-podium-sec" aria-labelledby="laureats">
          <div className="st-sec-head is-split">
            <div className="st-podium-head">
              <LiquidText
                as="h2"
                className="st-h2-liquid"
                seed={11}
                fit={longestWord("Palmarès", teaser.year)}
              >
                <span id="laureats">Palmarès {teaser.year}</span>
              </LiquidText>
              <p className="st-sec-lede">
                {teaser.categoryName} ·{" "}
                {teaser.panel === "public" ? "Jury public" : "Jury professionnel"}
              </p>
            </div>
            <Link href="/palmares" className="home-link st-link-arrow">
              Tout le palmarès {teaser.year}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ol className="st-podium">
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
                <li key={`${p.rank}-${p.productName}`} className={`is-rank-${p.rank}`}>
                  <span className="st-podium-rank">
                    {p.rank}
                    <sup>{p.rank === 1 ? "er" : "e"}</sup>
                  </span>
                  {/* Logo du producteur s'il en a déposé un ; sinon la case
                      porte la note, qui est l'information du podium. */}
                  {p.logo ? (
                    <span className="st-podium-logo">
                      <img
                        src={p.logo}
                        alt={`Logo ${p.producerName}`}
                        width={160}
                        height={160}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ) : p.score != null ? (
                    <span className="st-podium-logo is-score">
                      <b>{formatNumber(p.score)}</b>
                      <small>sur 20</small>
                    </span>
                  ) : null}
                  <span className="st-podium-name">{p.productName}</span>
                  <span className="st-podium-producer">{p.producerName}</span>
                  {distinction && <span className="st-podium-prize">{distinction}</span>}
                  {score && p.logo && <span className="st-podium-score">{score}</span>}
                </li>
              );
            })}
          </ol>
          <Link href={teaserHref} className="home-link st-link-arrow">
            Le classement complet de la catégorie
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* ── PAR PROFIL ─────────────────────────────────────────────────── */}
      <section className="st-sec st-routes" aria-labelledby="par-profil">
        <h2 id="par-profil" className="st-h2">
          Vous êtes
        </h2>
        <ul>
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
              title: "Presse",
              text: "Kit média, visuels, contacts et dossier de partenariat.",
              cta: "Espace presse",
            },
          ].map((a) => (
            <li key={a.title}>
              <Link href={a.href} className="st-route">
                <span className="st-route-name">{a.title}</span>
                <span className="st-route-text">{a.text}</span>
                <span className="st-route-cta">
                  {a.cta}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CLÔTURE ────────────────────────────────────────────────────── */}
      {edition && isOpen && closeAt != null && (
        <section className="st-close" aria-labelledby="cloture">
          <div className="st-close-text">
            <EditionBar>
              {ordinal}
              <Sparkle size={12} />
              {edition.year}
            </EditionBar>
            <LiquidText as="h2" className="st-close-title" seed={7} fit={8}>
              <span id="cloture">
                Jusqu&apos;au
                <br />
                {formatShortDay(closeAt)}
              </span>
            </LiquidText>
            <p className="st-hero-lede">
              {statusLine(edition, "open")}. Une seule commande pour toutes vos
              catégories.
            </p>
            <div className="st-actions">
              <Link href={registerHref} className="btn accent btn-lg">
                Inscrire mes produits
              </Link>
              <Link href="/reglement" className="btn ghost btn-lg">
                Lire le règlement
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
