import type { Metadata } from "next";
import Link from "next/link";
import { db } from "~/server/db";
import type { TeamMember } from "~/server/db/schema/organization-about";
import { canonical } from "../_lib/seo";
import { JuriesExplainer } from "../_components/edition-blocks";
import { PageHead, Sparkle } from "~/components/portal/street/street";

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

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="pg">
      <PageHead
        edition={
          <>
            Depuis 2023
            <Sparkle size={12} />
            Deux jurys
            <Sparkle size={12} />
            À l&apos;aveugle
          </>
        }
        title="Le concours"
        lede="La Platinum CBD Cup est un concours européen de CBD, organisé chaque année depuis 2023. Chaque produit est noté à l'aveugle par deux jurys : il est jugé sur ce qu'il est, pas sur son nom."
        seed={3}
      />

      {/* Même bloc que l'accueil et la page d'une édition : une seule
          formulation des deux jurys sur tout le site. */}
      <JuriesExplainer labels={[]} />

      <section className="pg-section" aria-labelledby="about-blind">
        <h2 id="about-blind">
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
          <h2 id="about-team">
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
                    className="st-team-photo"
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
