import Link from "next/link";
import { db } from "~/server/db";
import { Eyebrow, Pill } from "~/components/portal/platinum";

export const metadata = {
  title: "Archives",
  description: "Toutes les éditions passées de la Platinum CBD Cup.",
};

function categoryCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

function formatYear(date: Date | null | undefined): string {
  if (!date) return "—";
  return String(new Date(date).getFullYear());
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

export default async function ArchivesPage() {
  const cups = await getArchivedCups();

  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Eyebrow idx={5}>Archives · Past editions</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Archives<em>.</em>
        </h1>
        <p className="lede">
          L&apos;historique complet des éditions passées de la Platinum CBD Cup.
          Palmarès, ledger public et rapports laboratoires en libre accès.
        </p>
      </section>

      {cups.length === 0 ? (
        <div className="card">
          <Eyebrow>Aucune édition archivée</Eyebrow>
          <p className="lede" style={{ marginTop: 12 }}>
            La première édition est en cours. Les archives seront publiées à
            l&apos;issue de la cérémonie.
          </p>
        </div>
      ) : (
        <div className="grid g-3">
          {cups.map((cup) => (
            <div key={cup.id} className="card card-hover">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    border: "1px solid var(--line-strong)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--mono)",
                    fontSize: 16,
                    flexShrink: 0,
                    background: "var(--bg)",
                  }}
                >
                  {categoryCode(cup.name) || "ED"}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 15 }}>{cup.name}</div>
                  <div
                    className="mono fg3"
                    style={{
                      fontSize: 11,
                      letterSpacing: ".1em",
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    Ed · {formatYear(cup.eventDate ?? cup.createdAt)}
                  </div>
                </div>
                <Pill>DONE</Pill>
              </div>
              <div style={{ marginTop: 20 }}>
                <Link
                  href={`/palmares?edition=${cup.id}`}
                  className="btn ghost"
                  style={{ padding: "10px 16px" }}
                >
                  Palmarès <span className="btn-arrow">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
