import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db";
import { canonical } from "../_lib/seo";

export const metadata = {
  alternates: { canonical: canonical("/sponsors") },
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
    <div className="pg">
      <header className="pg-head">
        <p className="eyebrow">Partenaires</p>
        <h1 className="display">Nos partenaires</h1>
        <p className="pg-lede">
          Les marques et structures qui soutiennent la Platinum CBD Cup.
        </p>
      </header>

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {sponsors.length === 0 ? (
          <div className="notice">Aucun partenaire n&apos;est annoncé pour le moment.</div>
        ) : (
          <div className="pg-grid">
            {sponsors.map((s) => (
              <Link key={s.id} href={`/sponsors/${s.id}`} className="pg-tile">
                {s.logo && (
                  <div
                    style={{
                      height: 96,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 10,
                      background: "var(--bg)",
                      padding: 16,
                    }}
                  >
                    <Image
                      src={s.logo}
                      alt={s.name}
                      width={140}
                      height={64}
                      style={{ objectFit: "contain", maxHeight: 64, width: "auto" }}
                    />
                  </div>
                )}
                <h3>{s.name}</h3>
                {s.description && (
                  <p>
                    {s.description.slice(0, 120)}
                    {s.description.length > 120 ? "…" : ""}
                  </p>
                )}
                <span className="pg-link" style={{ marginTop: "auto" }}>
                  Voir le partenaire
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="pg-section">
        <div className="pg-section-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
            <h2 style={{ margin: 0, fontSize: 26 }}>Devenir partenaire</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)" }}>
              Écrivez-nous en choisissant le sujet « Partenariat » dans le
              formulaire de contact.
            </p>
          </div>
          <Link href="/contact" className="btn accent">
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
