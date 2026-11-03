import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { currentLocale } from "~/i18n/server";
import { db } from "~/server/db";
import { editionOrdinal, editionYear, formatDay } from "../_lib/edition";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/archives", "archives");
}

async function getArchivedCups() {
  try {
    return await db.query.cups.findMany({
      where: (c, { eq }) => eq(c.status, "completed"),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  } catch {
    return [];
  }
}

interface ArchivedEdition {
  year: number;
  location: string | null;
  eventDate: number | null;
}

/** Les anciennes éditions comptaient une cup par jury : on regroupe par année. */
function groupByYear(cups: Awaited<ReturnType<typeof getArchivedCups>>): ArchivedEdition[] {
  const byYear = new Map<number, ArchivedEdition>();
  for (const cup of cups) {
    const year = editionYear(cup);
    const entry = byYear.get(year) ?? { year, location: null, eventDate: null };
    entry.location ??= cup.eventLocation;
    entry.eventDate ??= cup.eventDate ? new Date(cup.eventDate).getTime() : null;
    byYear.set(year, entry);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

export default async function ArchivesPage() {
  const editions = groupByYear(await getArchivedCups());
  const locale = await currentLocale();
  const t = await getTranslations("archives");
  const tEdition = await getTranslations("edition");

  return (
    <div className="pg">
      <PageHead
        edition={
          <>
            {t("barSince")}
            <Sparkle size={12} />
            {t("barPalmares")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={4}
      />

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {editions.length === 0 ? (
          <div className="notice">
            {t("empty")}{" "}
            <Link href="/palmares" className="pg-link">
              {t("emptyLink")}
            </Link>
          </div>
        ) : (
          <div className="pg-grid pal-archives-grid">
            {editions.map((ed) => {
              const details = [
                ed.eventDate ? formatDay(ed.eventDate, locale) : null,
                ed.location,
              ].filter(Boolean);
              return (
                <Link
                  key={ed.year}
                  href={`/palmares?edition=${ed.year}`}
                  className="pg-tile"
                >
                  <span className="pg-meta">{editionOrdinal(ed.year, tEdition)}</span>
                  <h3 className="st-archive-year">{ed.year}</h3>
                  {details.length > 0 && <p>{details.join(" · ")}</p>}
                  <span className="pg-link" style={{ marginTop: "auto" }}>
                    {t("seePalmares")}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
