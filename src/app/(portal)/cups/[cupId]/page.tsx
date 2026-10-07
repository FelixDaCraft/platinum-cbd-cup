import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import {
  CategoryPrices,
  EditionStatus,
  EditionSteps,
  JuriesExplainer,
} from "../../_components/edition-blocks";
import { PORTAL_CACHE_TAGS, PORTAL_REVALIDATE } from "../../_lib/cache";
import {
  editionOrdinal,
  getEditionDetails,
  phaseOf,
  statusLine,
  stepsOf,
} from "../../_lib/edition";
import { baseUrl, imagePartage } from "../../_lib/seo";

interface PageProps {
  params: Promise<{ cupId: string }>;
}

/**
 * Les places restantes bougent à chaque paiement : une minute de cache, comme
 * le reste du portail, et le formulaire d'inscription revérifie de toute
 * façon les quotas au moment de payer.
 */
const getCachedEdition = unstable_cache(
  (cupId: string) => getEditionDetails(cupId),
  ["portal-edition-details"],
  { revalidate: PORTAL_REVALIDATE, tags: [PORTAL_CACHE_TAGS.cups] },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cupId } = await params;

  const cup = await db.query.cups.findFirst({
    where: eq(schema.cups.id, cupId),
    columns: {
      name: true,
      status: true,
      description: true,
      publicPageDescription: true,
      bannerUrl: true,
    },
  });

  // Une cup inexistante ou en brouillon ne doit pas être indexée ; la page
  // elle-même renvoie un 404.
  if (!cup || cup.status === "draft") {
    return { title: "Cup introuvable", robots: { index: false, follow: false } };
  }

  const url = `${baseUrl()}/cups/${cupId}`;
  const description =
    cup.publicPageDescription ??
    cup.description ??
    `Catégories, tarifs et calendrier de ${cup.name}.`;

  return {
    title: cup.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: cup.name,
      description,
      url,
      images: imagePartage(cup.bannerUrl, cup.name),
    },
  };
}

export default async function CupDetailPage({ params }: PageProps) {
  const { cupId } = await params;
  const edition = await getCachedEdition(cupId);
  if (!edition) notFound();

  const now = Date.now();
  const phase = phaseOf(edition, now);
  const isOpen = phase === "open";
  const registerHref = `/cups/${edition.id}/register`;

  return (
    <div className="home">
      <section className="home-hero is-compact">
        <div className="home-hero-text">
          <EditionStatus open={isOpen} text={statusLine(edition, phase, now)} />
          <div className="home-section-head">
            <p className="eyebrow">
              <b>
                Édition {edition.year} · {editionOrdinal(edition.year)}
              </b>
            </p>
            <h1 className="display">{edition.name}</h1>
          </div>
          {edition.description && (
            <p className="lede home-hero-lede">{edition.description}</p>
          )}
          <div className="home-actions">
            {isOpen && (
              <Link href={registerHref} className="btn accent btn-lg">
                Inscrire mes produits
              </Link>
            )}
            {edition.resultsPublished && (
              <Link
                href={`/palmares?edition=${edition.year}`}
                className={`btn btn-lg ${isOpen ? "ghost" : "accent"}`}
              >
                Voir le palmarès {edition.year}
              </Link>
            )}
            <Link href="/reglement" className="btn ghost btn-lg">
              Lire le règlement
            </Link>
          </div>
        </div>
      </section>

      <EditionSteps steps={stepsOf(edition, now)} year={edition.year} />

      <CategoryPrices
        edition={edition}
        phase={phase}
        registerHref={registerHref}
        showCriteria
      />

      <JuriesExplainer labels={edition.labels} />

      <div className="home-section-spacer" />
    </div>
  );
}
