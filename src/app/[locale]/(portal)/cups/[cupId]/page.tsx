import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { ogLocale, type Locale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
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
  editionYear,
  getEditionDetails,
  phaseOf,
  statusLine,
  stepsOf,
} from "../../_lib/edition";
import { alternatesFor, imagePartage, localizedCanonical } from "../../_lib/seo";
import { PageHead, Sparkle } from "~/components/portal/street/street";

interface PageProps {
  params: Promise<{ cupId: string }>;
}

/**
 * Les places restantes bougent à chaque paiement : une minute de cache, comme
 * le reste du portail, et le formulaire d'inscription revérifie de toute
 * façon les quotas au moment de payer.
 */
const getCachedEdition = unstable_cache(
  (cupId: string, locale: Locale) => getEditionDetails(cupId, locale),
  ["portal-edition-details-v3"],
  { revalidate: PORTAL_REVALIDATE, tags: [PORTAL_CACHE_TAGS.cups] },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cupId } = await params;
  const locale = await currentLocale();
  const t = await getTranslations("cup");

  const cup = await db.query.cups.findFirst({
    where: eq(schema.cups.id, cupId),
    columns: {
      name: true,
      status: true,
      description: true,
      publicPageDescription: true,
      bannerUrl: true,
      eventDate: true,
      ratingEndAt: true,
      createdAt: true,
    },
  });

  // Une cup inexistante ou en brouillon ne doit pas être indexée ; la page
  // elle-même renvoie un 404.
  if (!cup || cup.status === "draft") {
    return { title: t("notFound"), robots: { index: false, follow: false } };
  }

  const path = `/cups/${cupId}`;
  const url = localizedCanonical(path, locale);
  // Le nom en base (« PlatinumCBD CUP 2027 ») répétait la marque déjà portée
  // par le gabarit de titre : on titre par l'édition.
  const title = t("title", { year: editionYear(cup) });
  // La description saisie au back-office n'existe qu'en français.
  const description =
    (locale === "fr" && (cup.publicPageDescription?.trim() || cup.description?.trim())) ||
    t("metaDescription", { year: editionYear(cup) });

  return {
    title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type: "website",
      locale: ogLocale(locale),
      title,
      description,
      url,
      images: imagePartage(cup.bannerUrl, title),
    },
  };
}

export default async function CupDetailPage({ params }: PageProps) {
  const { cupId } = await params;
  const locale = await currentLocale();
  const edition = await getCachedEdition(cupId, locale);
  if (!edition) notFound();
  const [t, tEdition, tNav, tHome] = await Promise.all([
    getTranslations("cup"),
    getTranslations("edition"),
    getTranslations("nav"),
    getTranslations("home"),
  ]);

  const now = Date.now();
  const phase = phaseOf(edition, now);
  const isOpen = phase === "open";
  const registerHref = `/cups/${edition.id}/register`;

  return (
    <div className="st-home">
      <PageHead
        edition={
          <>
            {editionOrdinal(edition.year, tEdition)}
            <Sparkle size={12} />
            {edition.year}
          </>
        }
        title={t("title", { year: edition.year })}
        seed={5}
      >
        <EditionStatus open={isOpen} text={statusLine(edition, phase, tEdition, locale, now)} />
        <p className="st-head-lede">
          {(locale === "fr" && edition.description) ||
            t("lede", { ordinal: editionOrdinal(edition.year, tEdition) })}
        </p>
        <div className="st-actions">
          {isOpen && (
            <Link href={registerHref} className="btn accent btn-lg">
              {tNav("registerProducts")}
            </Link>
          )}
          {edition.resultsPublished && (
            <Link
              href={`/palmares?edition=${edition.year}`}
              className={`btn btn-lg ${isOpen ? "ghost" : "accent"}`}
            >
              {t("seePalmares", { year: edition.year })}
            </Link>
          )}
          <Link href="/reglement" className="btn ghost btn-lg">
            {tHome("readRules")}
          </Link>
        </div>
      </PageHead>

      <EditionSteps steps={stepsOf(edition, tEdition, locale, now)} year={edition.year} />

      <CategoryPrices
        edition={edition}
        phase={phase}
        registerHref={registerHref}
        showCriteria
      />

      <JuriesExplainer labels={edition.labels} />

    </div>
  );
}
