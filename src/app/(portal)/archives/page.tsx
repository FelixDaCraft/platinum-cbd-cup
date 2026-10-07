import Link from "next/link";
import { db } from "~/server/db";
import { editionOrdinal, editionYear, formatDay } from "../_lib/edition";
import { canonical } from "../_lib/seo";

export const metadata = {
  alternates: { canonical: canonical("/archives") },
  title: "Archives",
  description: "Toutes les éditions passées de la Platinum CBD Cup.",
};

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

  return (
    <div className="pg">
      <header className="pg-head">
        <p className="eyebrow">Éditions</p>
        <h1 className="display">Les éditions passées</h1>
        <p className="pg-lede">
          Chaque édition de la Platinum CBD Cup et son palmarès, depuis la
          première en 2023.
        </p>
      </header>

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {editions.length === 0 ? (
          <div className="notice">
            Aucune édition terminée n&apos;est encore archivée.{" "}
            <Link href="/palmares" className="pg-link">
              Consulter le palmarès
            </Link>
          </div>
        ) : (
          <div className="pg-grid">
            {editions.map((ed) => {
              const details = [
                ed.eventDate ? formatDay(ed.eventDate) : null,
                ed.location,
              ].filter(Boolean);
              return (
                <Link
                  key={ed.year}
                  href={`/palmares?edition=${ed.year}`}
                  className="pg-tile"
                >
                  <span className="pg-meta">{editionOrdinal(ed.year)}</span>
                  <h3 style={{ fontSize: 32 }}>{ed.year}</h3>
                  {details.length > 0 && <p>{details.join(" · ")}</p>}
                  <span className="pg-link" style={{ marginTop: "auto" }}>
                    Voir le palmarès
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
