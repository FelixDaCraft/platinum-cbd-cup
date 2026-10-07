import type { Metadata } from "next";
import Link from "next/link";
import { db } from "~/server/db";
import type { TeamMember } from "~/server/db/schema/organization-about";
import { canonical } from "../_lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/about") },
  title: "Le concours",
  description:
    "Le fonctionnement de la Platinum CBD Cup : deux jurys qui notent chaque produit à l'aveugle, les labels du jury public et l'équipe organisatrice.",
};

async function getTeamMembers(): Promise<TeamMember[]> {
  const aboutContent = await db.query.organizationAbout.findFirst({});
  return (aboutContent?.teamMembers ?? []) as TeamMember[];
}

const JURIES = [
  {
    title: "Le jury professionnel",
    body: "Producteurs, sommeliers et analystes notent chaque produit sans connaître sa marque. Leurs notes établissent un classement par catégorie. Ce jury ne décerne pas de label.",
  },
  {
    title: "Le jury public",
    body: "Des consommateurs reçoivent une box d'échantillons et notent les produits chez eux. Selon la note obtenue, un produit reçoit le label Or, Argent ou Bronze, et le premier de chaque catégorie remporte le Prix du public.",
  },
];

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="pg">
      <header className="pg-head">
        <p className="eyebrow">Le concours</p>
        <h1 className="display">
          Chaque produit noté à l&apos;aveugle par <em>deux</em> jurys
        </h1>
        <p className="pg-lede">
          La Platinum CBD Cup est un concours européen de CBD, organisé chaque
          année depuis 2023. Les produits sont jugés sur ce qu&apos;ils sont, pas
          sur leur nom.
        </p>
      </header>

      <section className="pg-section" aria-labelledby="about-juries">
        <h2 id="about-juries" style={{ margin: 0, fontSize: 28 }}>
          Deux jurys, deux regards
        </h2>
        <div className="pg-grid">
          {JURIES.map((j) => (
            <article key={j.title} className="pg-tile">
              <h3>{j.title}</h3>
              <p>{j.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pg-section" aria-labelledby="about-blind">
        <h2 id="about-blind" style={{ margin: 0, fontSize: 28 }}>
          L&apos;anonymat des échantillons
        </h2>
        <div className="prose" style={{ maxWidth: 720 }}>
          <p>
            Avant d&apos;être goûté, chaque échantillon est anonymisé : les jurés ne
            voient qu&apos;un code, jamais la marque. Ce code est différent pour
            chaque jury, si bien qu&apos;un produit ne peut pas être reconnu
            d&apos;un jury à l&apos;autre.
          </p>
          <p>
            Les seuils de note des labels Or, Argent et Bronze sont fixés pour
            chaque édition. Le détail des règles figure dans le{" "}
            <Link href="/reglement">règlement</Link>.
          </p>
        </div>
        <div className="form-actions">
          <Link href="/palmares" className="btn accent">
            Voir le palmarès
          </Link>
          <Link href="/cups" className="btn ghost">
            Participer
          </Link>
        </div>
      </section>

      {teamMembers.length > 0 && (
        <section className="pg-section" aria-labelledby="about-team">
          <h2 id="about-team" style={{ margin: 0, fontSize: 28 }}>
            L&apos;équipe
          </h2>
          <div
            className="pg-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}
          >
            {teamMembers.map((m, i) => (
              <figure key={m.id ?? i} className="pg-tile" style={{ margin: 0 }}>
                {m.photo && (
                  // Le rapport 4/5 est réservé par aspect-ratio ; le décodage
                  // asynchrone évite qu'une galerie de portraits bloque le
                  // thread principal pendant le défilement.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo}
                    alt={m.name}
                    width={400}
                    height={500}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%",
                      height: "auto",
                      aspectRatio: "4 / 5",
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                )}
                <figcaption style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <h3>{m.name}</h3>
                  {m.role && <span className="pg-meta">{m.role}</span>}
                  {m.bio && <p>{m.bio}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
