import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { db } from "~/server/db";
import { EditionStatus } from "../_components/edition-blocks";
import { PORTAL_CACHE_TAGS, PORTAL_REVALIDATE } from "../_lib/cache";
import {
  editionOrdinal,
  editionYear,
  formatDay,
  formatPrice,
  getEditionDetails,
  phaseOf,
  statusLine,
  type EditionDetails,
} from "../_lib/edition";
import { baseUrl, OG_IMAGE_PAR_DEFAUT } from "../_lib/seo";

export const metadata: Metadata = {
  title: "Participer",
  description:
    "Inscrire ses produits à la Platinum CBD Cup : éditions ouvertes, catégories, tarifs, calendrier, et les éditions passées.",
  alternates: { canonical: `${baseUrl()}/cups` },
  openGraph: {
    title: "Participer | Platinum CBD Cup",
    description:
      "Éditions ouvertes, catégories, tarifs et calendrier de la Platinum CBD Cup.",
    url: `${baseUrl()}/cups`,
    images: [OG_IMAGE_PAR_DEFAUT],
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface PastEdition {
  year: number;
  location: string | null;
  eventDate: number | null;
  resultsPublished: boolean;
}

/**
 * Éditions en cours (détaillées) et éditions passées, regroupées par année :
 * les anciennes éditions comptaient une cup par jury.
 */
async function getEditions(): Promise<{ current: EditionDetails[]; past: PastEdition[] }> {
  const cups = await db.query.cups.findMany({
    where: (c, { ne }) => ne(c.status, "draft"),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    columns: {
      id: true,
      name: true,
      status: true,
      eventDate: true,
      eventLocation: true,
      ratingEndAt: true,
      createdAt: true,
      resultsPublishedAt: true,
    },
  });

  const current = (
    await Promise.all(
      cups.filter((c) => c.status !== "completed").map((c) => getEditionDetails(c.id)),
    )
  ).filter((e): e is EditionDetails => e !== null);

  const byYear = new Map<number, PastEdition>();
  for (const cup of cups.filter((c) => c.status === "completed")) {
    const year = editionYear(cup);
    const entry = byYear.get(year) ?? {
      year,
      location: null,
      eventDate: null,
      resultsPublished: false,
    };
    entry.location ??= cup.eventLocation;
    entry.eventDate ??= cup.eventDate ? cup.eventDate.getTime() : null;
    entry.resultsPublished ||= cup.resultsPublishedAt != null;
    byYear.set(year, entry);
  }

  return { current, past: [...byYear.values()].sort((a, b) => b.year - a.year) };
}

const getCachedEditions = unstable_cache(getEditions, ["portal-editions"], {
  revalidate: PORTAL_REVALIDATE,
  tags: [PORTAL_CACHE_TAGS.cups, PORTAL_CACHE_TAGS.results],
});

function lowestPrice(edition: EditionDetails): string | null {
  const prices = edition.categories.map((c) => c.priceCents ?? 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const all = prices.every((p) => p === min);
  const label = formatPrice(min, edition.currency);
  return min === 0 ? label : all ? `${label} par produit` : `dès ${label} par produit`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CupsPage() {
  const { current, past } = await getCachedEditions();
  const now = Date.now();

  return (
    <div className="home">
      <section className="home-hero is-compact">
        <div className="home-hero-text">
          <h1 className="display">Participer</h1>
          <p className="lede home-hero-lede">
            Inscrivez vos produits dans une ou plusieurs catégories, en une seule
            commande. Chaque produit est noté à l&apos;aveugle par le jury
            professionnel et par le jury public.
          </p>
        </div>
      </section>

      <section className="home-section" style={{ paddingTop: 0 }}>
        {current.length === 0 ? (
          <div className="pal-empty" style={{ marginBottom: 0 }}>
            <h2>Aucune édition ouverte pour le moment</h2>
            <p>
              La prochaine édition sera annoncée ici. En attendant, découvrez le{" "}
              <Link href="/palmares">palmarès</Link> des éditions passées.
            </p>
          </div>
        ) : (
          <div className="eds-current">
            {current.map((ed) => {
              const phase = phaseOf(ed, now);
              const price = lowestPrice(ed);
              return (
                <article key={ed.id} className="eds-card">
                  <EditionStatus open={phase === "open"} text={statusLine(ed, phase, now)} />
                  <div>
                    <p className="eyebrow" style={{ margin: "0 0 8px" }}>
                      <b>
                        {ed.year} · {editionOrdinal(ed.year)}
                      </b>
                    </p>
                    <h2>{ed.name}</h2>
                  </div>
                  <ul className="eds-card-facts">
                    {ed.categories.length > 0 && (
                      <li>
                        <b>
                          {ed.categories.length} catégorie
                          {ed.categories.length > 1 ? "s" : ""}
                        </b>
                        {price ? ` · ${price}` : ""}
                      </li>
                    )}
                    {ed.ratingStartAt != null && (
                      <li>Notation à partir du {formatDay(ed.ratingStartAt)}</li>
                    )}
                    {ed.eventDate != null && (
                      <li>
                        Cérémonie le {formatDay(ed.eventDate)}
                        {ed.eventLocation ? `, ${ed.eventLocation}` : ""}
                      </li>
                    )}
                  </ul>
                  <div className="home-actions">
                    {phase === "open" && (
                      <Link href={`/cups/${ed.id}/register`} className="btn accent">
                        Inscrire mes produits
                      </Link>
                    )}
                    <Link href={`/cups/${ed.id}`} className="btn ghost">
                      Catégories et calendrier
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">Les éditions passées</h2>
          <ul className="eds-past">
            {past.map((ed) => {
              const meta = [
                ed.eventDate != null ? formatDay(ed.eventDate) : null,
                ed.location,
              ]
                .filter(Boolean)
                .join(" · ");
              const content = (
                <>
                  <span className="eds-past-year">
                    {ed.year} · {editionOrdinal(ed.year)}
                  </span>
                  <span className="eds-past-meta">{meta}</span>
                  <span className="eds-past-cta">
                    {ed.resultsPublished ? "Le palmarès →" : "Résultats à venir"}
                  </span>
                </>
              );
              return (
                <li key={ed.year}>
                  {ed.resultsPublished ? (
                    <Link href={`/palmares?edition=${ed.year}`}>{content}</Link>
                  ) : (
                    <div className="eds-past-row">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="home-section-spacer" />
    </div>
  );
}
