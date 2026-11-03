import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { db } from "~/server/db";
import type { TeamMember } from "~/server/db/schema/organization-about";
import { localizedMetadata } from "../_lib/page-metadata";
import { JuriesExplainer } from "../_components/edition-blocks";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/about", "about");
}

async function getTeamMembers(): Promise<TeamMember[]> {
  const aboutContent = await db.query.organizationAbout.findFirst({});
  return (aboutContent?.teamMembers ?? []) as TeamMember[];
}

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();
  const t = await getTranslations("about");
  const tNav = await getTranslations("nav");
  const tHome = await getTranslations("home");

  return (
    <div className="pg">
      <PageHead
        edition={
          <>
            {t("barSince")}
            <Sparkle size={12} />
            {t("barJuries")}
            <Sparkle size={12} />
            {t("barBlind")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={3}
      />

      {/* Même bloc que l'accueil et la page d'une édition : une seule
          formulation des deux jurys sur tout le site. */}
      <JuriesExplainer labels={[]} />

      <section className="pg-section" aria-labelledby="about-blind">
        <h2 id="about-blind">{t("blindTitle")}</h2>
        <div className="prose" style={{ maxWidth: 720 }}>
          <p>{t("blindP1")}</p>
          <p>{t("blindP2")}</p>
        </div>
        <div className="form-actions">
          <Link href="/palmares" className="btn accent">
            {tNav("seePalmares")}
          </Link>
          <Link href="/cups" className="btn ghost">
            {tNav("participate")}
          </Link>
          <Link href="/reglement" className="btn ghost">
            {tHome("readRules")}
          </Link>
        </div>
      </section>

      {teamMembers.length > 0 && (
        <section className="pg-section" aria-labelledby="about-team">
          <h2 id="about-team">{t("team")}</h2>
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
