import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db";
import { Eyebrow, Pill } from "~/components/portal/platinum";

export const metadata = {
  title: "Sponsors",
  description: "Les partenaires officiels de la Platinum CBD Cup.",
};

async function getSponsors() {
  try {
    return await db.query.sponsors.findMany({
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  } catch {
    return [];
  }
}

export default async function SponsorsPage() {
  const sponsors = await getSponsors();

  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Eyebrow idx={7}>Partenaires · Sponsors</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Sponsors<em>.</em>
        </h1>
        <p className="lede">
          Les marques et institutions qui rendent possible un concours
          indépendant et transparent.
        </p>
      </section>

      {sponsors.length === 0 ? (
        <div className="card">
          <Eyebrow>Pas encore de partenaires annoncés</Eyebrow>
          <p className="lede" style={{ marginTop: 12 }}>
            Les partenaires de l&apos;édition en cours seront communiqués à
            l&apos;ouverture officielle.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link href="/contact" className="btn accent">
              Devenir partenaire <span className="btn-arrow">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid g-3">
          {sponsors.map((s) => (
            <Link
              key={s.id}
              href={`/sponsors/${s.id}`}
              className="card card-hover"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  height: 96,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--bg)",
                  padding: 16,
                }}
              >
                {s.logo ? (
                  <Image
                    src={s.logo}
                    alt={s.name}
                    width={140}
                    height={64}
                    style={{ objectFit: "contain", maxHeight: 64 }}
                  />
                ) : (
                  <span
                    className="mono fg3"
                    style={{ fontSize: 11, letterSpacing: ".15em" }}
                  >
                    [ {s.name.slice(0, 3).toUpperCase()} ]
                  </span>
                )}
              </div>
              <div>
                <div className="mono" style={{ fontSize: 16 }}>{s.name}</div>
                {s.description && (
                  <p
                    style={{
                      color: "var(--fg-2)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      marginTop: 8,
                    }}
                  >
                    {s.description.slice(0, 120)}
                    {s.description.length > 120 ? "…" : ""}
                  </p>
                )}
              </div>
              <div style={{ marginTop: "auto" }}>
                <Pill>Voir le partenaire</Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
