import type { Metadata } from "next";
import { db } from "~/server/db";
import { Eyebrow, Pill } from "~/components/portal/platinum";
import type { TeamMember } from "~/server/db/schema/organization-about";

export const metadata: Metadata = {
  title: "À Propos",
  description: "Notre mission, notre histoire et notre équipe derrière la seule compétition CBD évaluée à l'aveugle en Europe.",
};

async function getAboutContent() {
  const aboutContent = await db.query.organizationAbout.findFirst({});
  return {
    history: aboutContent?.history ?? null,
    mission: aboutContent?.mission ?? null,
    values: aboutContent?.values ?? null,
    teamMembers: (aboutContent?.teamMembers ?? []) as TeamMember[],
  };
}

export default async function AboutPage() {
  const { history, mission, values, teamMembers } = await getAboutContent();

  const principles = [
    {
      code: "01",
      title: "Indépendance",
      body: "Aucun sponsor ne siège au jury. Aucune marque n'est informée de son score avant publication. Le panel est recruté et rémunéré indépendamment.",
    },
    {
      code: "02",
      title: "Blind panel",
      body: "Chaque spécimen reçoit un code anonyme à 5 caractères. Les jurés ne voient jamais les marques, origines ou prix pendant toute la durée de la notation.",
    },
    {
      code: "03",
      title: "Public ledger",
      body: "Scores bruts, coefficients, méthodologie et protocole de prélèvement sont publiés intégralement après chaque édition. Rien n'est caché.",
    },
  ];

  return (
    <div className="page-enter">
      {/* Hero */}
      <section style={{ paddingTop: 40, paddingBottom: 56 }}>
        <Eyebrow idx={5}>À propos</Eyebrow>
        <h1 className="display" style={{ marginTop: 20, marginBottom: 20 }}>
          About<em>.</em>
        </h1>
        <p className="lede" style={{ maxWidth: 560 }}>
          La Platinum CBD Cup est la seule compétition européenne de CBD
          évaluée à l'aveugle par un panel indépendant d'analystes, sommeliers
          et laboratoires certifiés ISO 17025.
        </p>
      </section>

      {/* Mission */}
      <section style={{ marginBottom: 48 }}>
        <div className="card">
          <Eyebrow>Mission</Eyebrow>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 22,
              lineHeight: 1.35,
              marginTop: 18,
              letterSpacing: "-.01em",
            }}
          >
            {mission ??
              "Offrir au marché CBD européen une référence analytique indépendante, vérifiable et reproductible — sans conflit d'intérêt, sans biais commercial."}
          </div>
        </div>
      </section>

      {/* History */}
      {history && (
        <section style={{ marginBottom: 48 }}>
          <h2 className="section-title" style={{ marginBottom: 24 }}>
            Histoire
          </h2>
          <div className="card">
            <p style={{ color: "var(--fg-2)", lineHeight: 1.65, fontSize: 15 }}>
              {history}
            </p>
          </div>
        </section>
      )}

      {/* Values / principles */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title" style={{ marginBottom: 28 }}>
          Principes
        </h2>
        <div className="grid g-3">
          {principles.map((p) => (
            <div key={p.code} className="card card-hover">
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: ".15em",
                }}
              >
                · {p.code}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 20,
                  marginTop: 18,
                }}
              >
                {p.title}
              </div>
              <p
                style={{
                  color: "var(--fg-2)",
                  fontSize: 14,
                  lineHeight: 1.55,
                  marginTop: 12,
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* DB-provided values override / append */}
        {values && (
          <div className="card" style={{ marginTop: 24 }}>
            <Eyebrow>Nos valeurs</Eyebrow>
            <p
              style={{
                color: "var(--fg-2)",
                lineHeight: 1.65,
                fontSize: 15,
                marginTop: 12,
              }}
            >
              {values}
            </p>
          </div>
        )}
      </section>

      {/* Team */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title" style={{ marginBottom: 28 }}>
          Équipe
        </h2>

        {teamMembers.length === 0 ? (
          <div className="card">
            <Eyebrow>Team · Platinum CBD Cup</Eyebrow>
            <p className="lede" style={{ marginTop: 12 }}>
              L'équipe organisatrice sera présentée ici lors de l'édition 2026.
            </p>
          </div>
        ) : (
          <div className="grid g-3">
            {teamMembers.map((member, i) => (
              <div key={i} className="card card-hover">
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--accent)",
                    letterSpacing: ".15em",
                    marginBottom: 14,
                  }}
                >
                  · {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 17,
                    letterSpacing: "-.01em",
                  }}
                >
                  {(member as { name?: string }).name ?? "—"}
                </div>
                {(member as { role?: string }).role && (
                  <div style={{ marginTop: 6 }}>
                    <Pill>{(member as { role: string }).role}</Pill>
                  </div>
                )}
                {(member as { bio?: string }).bio && (
                  <p
                    style={{
                      color: "var(--fg-2)",
                      fontSize: 13,
                      lineHeight: 1.55,
                      marginTop: 12,
                    }}
                  >
                    {(member as { bio: string }).bio}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
