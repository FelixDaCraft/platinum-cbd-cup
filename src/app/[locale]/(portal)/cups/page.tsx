import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import type { Locale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { db } from "~/server/db";
import { EditionStatus } from "../_components/edition-blocks";
import { PORTAL_CACHE_TAGS, PORTAL_REVALIDATE } from "../_lib/cache";
import {
  editionOrdinal,
  editionYear,
  formatDay,
  samplesDeadlineMs,
  formatPrice,
  getEditionDetails,
  phaseOf,
  statusLine,
  type EditionDetails,
} from "../_lib/edition";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/cups", "cups");
}

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
async function getEditions(
  locale: Locale,
): Promise<{ current: EditionDetails[]; past: PastEdition[] }> {
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
      cups.filter((c) => c.status !== "completed").map((c) => getEditionDetails(c.id, locale)),
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

function lowestPrice(
  edition: EditionDetails,
  t: (key: string, values?: Record<string, string>) => string,
  locale: Locale,
  free: string,
): string | null {
  const prices = edition.categories.map((c) => c.priceCents ?? 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const all = prices.every((p) => p === min);
  const label = formatPrice(min, edition.currency, locale, free);
  return min === 0 ? label : t(all ? "pricePerProduct" : "priceFrom", { price: label });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CupsPage() {
  const locale = await currentLocale();
  const [t, tEdition, tNav] = await Promise.all([
    getTranslations("cups"),
    getTranslations("edition"),
    getTranslations("nav"),
  ]);
  const { current, past } = await getCachedEditions(locale);
  const now = Date.now();

  return (
    <div className="st-home st-cups">
      <PageHead
        edition={
          <>
            {t("barProducers")}
            <Sparkle size={12} />
            {t("barRegistration")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={5}
      />

      <section className="home-section" style={{ paddingTop: 0 }}>
        {current.length === 0 ? (
          <div className="pal-empty" style={{ marginBottom: 0 }}>
            <h2>{t("emptyTitle")}</h2>
            <p>
              {t.rich("emptyText", { link: (chunks) => <Link href="/palmares">{chunks}</Link> })}
            </p>
          </div>
        ) : (
          <div className="eds-current">
            {current.map((ed) => {
              const phase = phaseOf(ed, now);
              const price = lowestPrice(ed, t, locale, tEdition("free"));
              return (
                <article key={ed.id} className="eds-card">
                  <EditionStatus open={phase === "open"} text={statusLine(ed, phase, tEdition, locale, now)} />
                  <div>
                    <p className="eyebrow" style={{ margin: "0 0 8px" }}>
                      <b>
                        {ed.year} · {editionOrdinal(ed.year, tEdition)}
                      </b>
                    </p>
                    <h2>{ed.name}</h2>
                  </div>
                  <ul className="eds-card-facts">
                    {ed.categories.length > 0 && (
                      <li>
                        <b>{t("categoryCount", { count: ed.categories.length })}</b>
                        {price ? ` · ${price}` : ""}
                      </li>
                    )}
                    {samplesDeadlineMs(ed.samplesDeadline) != null && (
                      <li>
                        {t("samplesBy", {
                          date: formatDay(samplesDeadlineMs(ed.samplesDeadline)!, locale),
                        })}
                      </li>
                    )}
                    {ed.ratingStartAt != null && (
                      <li>{t("ratingFrom", { date: formatDay(ed.ratingStartAt, locale) })}</li>
                    )}
                    {ed.eventDate != null && (
                      <li>
                        {ed.eventLocation
                          ? t("ceremonyOnAt", {
                              date: formatDay(ed.eventDate, locale),
                              place: ed.eventLocation,
                            })
                          : t("ceremonyOn", { date: formatDay(ed.eventDate, locale) })}
                      </li>
                    )}
                  </ul>
                  <div className="home-actions">
                    {phase === "open" && (
                      <Link href={`/cups/${ed.id}/register`} className="btn accent">
                        {tNav("registerProducts")}
                      </Link>
                    )}
                    <Link href={`/cups/${ed.id}`} className="btn ghost">
                      {t("categoriesAndCalendar")}
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
          <h2 className="section-title">{t("pastTitle")}</h2>
          <ul className="eds-past">
            {past.map((ed) => {
              const meta = [
                ed.eventDate != null ? formatDay(ed.eventDate, locale) : null,
                ed.location,
              ]
                .filter(Boolean)
                .join(" · ");
              const content = (
                <>
                  <span className="eds-past-year">
                    {ed.year} · {editionOrdinal(ed.year, tEdition)}
                  </span>
                  <span className="eds-past-meta">{meta}</span>
                  <span className="eds-past-cta">
                    {ed.resultsPublished ? t("palmaresArrow") : t("resultsSoon")}
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
