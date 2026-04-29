import type { Metadata } from "next";
import { db } from "~/server/db";
import { Eyebrow } from "~/components/portal/platinum";
import type { TeamMember } from "~/server/db/schema/organization-about";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase() || "??";
}

export const metadata: Metadata = {
  title: "Manifesto",
  description: "Notre mission, notre histoire et notre équipe derrière la seule compétition CBD évaluée à l'aveugle en Europe.",
};

async function getTeamMembers(): Promise<TeamMember[]> {
  const aboutContent = await db.query.organizationAbout.findFirst({});
  return (aboutContent?.teamMembers ?? []) as TeamMember[];
}

interface ManifestoArticle {
  numeral: string;
  lead: string;
  body: string;
}

const MANIFESTO: ManifestoArticle[] = [
  {
    numeral: "I",
    lead: "Le code précède le nom.",
    body: "Cinq caractères, anonymes. Le panel ne voit ni la marque, ni le terroir, ni le prix. La cécité est notre point de départ — pas notre limite.",
  },
  {
    numeral: "II",
    lead: "Une seule mesure, pour toutes les mains.",
    body: "Du géant industriel au paysan des Cévennes, le même protocole, le même verre, le même silence. L'égalité n'est pas une promesse : c'est une procédure.",
  },
  {
    numeral: "III",
    lead: "Aucun jugement n'est dû.",
    body: "Aucun favori. Aucune redevance. Aucun raccourci. Si le score déçoit, le score reste. Le marché s'adaptera, pas nous.",
  },
  {
    numeral: "IV",
    lead: "L'excellence se prouve, ne se déclame pas.",
    body: "Un laboratoire indépendant. Un panel professionnel, un panel public. Un protocole publié dans son intégralité. Tout ce que nous écrivons peut être vérifié. Tout ce qui ne peut l'être n'est pas écrit.",
  },
  {
    numeral: "V",
    lead: "L'archive est plus longue que l'édition.",
    body: "Une cup dure quelques semaines. Un palmarès dure des décennies. Nous écrivons pour ceux qui n'étaient pas là — et pour ceux qui n'existent pas encore.",
  },
];

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="page-enter">
      {/* Hero */}
      <section style={{ paddingTop: 40, paddingBottom: 56 }}>
        <Eyebrow idx={5}>Manifesto</Eyebrow>
        <h1 className="display" style={{ marginTop: 20, marginBottom: 20 }}>
          Manifesto<em>.</em>
        </h1>
        <p className="lede" style={{ maxWidth: 560 }}>
          La Platinum CBD Cup est la seule compétition européenne de CBD
          évaluée à l'aveugle par un panel indépendant d'analystes, sommeliers
          et laboratoires partenaires.
        </p>
      </section>

      {/* ── MANIFESTO · Aphorism Posters ─────────────────────────────────
          Five numbered articles. Roman numeral eyebrow in accent gold,
          lead sentence in Louize Display (clamp 40 → 88px), body in
          Geist Mono. Hairline separator between articles. */}
      <section style={{ marginTop: 24, marginBottom: 96 }}>
        {MANIFESTO.map((article, i) => (
          <article
            key={article.numeral}
            style={{
              paddingTop: i === 0 ? 0 : 64,
              paddingBottom: 64,
              borderTop: i === 0 ? 0 : "1px solid var(--line)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                letterSpacing: ".18em",
                color: "var(--accent)",
                textTransform: "uppercase",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>{article.numeral}</span>
              <span
                aria-hidden="true"
                style={{
                  flex: "0 0 48px",
                  height: 1,
                  background: "var(--accent)",
                  display: "inline-block",
                }}
              />
            </div>

            <h2
              style={{
                fontSize: "clamp(40px, 6.5vw, 88px)",
                lineHeight: 1.05,
                margin: 0,
                maxWidth: "20ch",
              }}
            >
              {article.lead}
            </h2>

            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 14,
                lineHeight: 1.7,
                color: "var(--fg-2)",
                marginTop: 32,
                maxWidth: "62ch",
                letterSpacing: ".01em",
              }}
            >
              {article.body}
            </p>
          </article>
        ))}

        {/* Signature */}
        <div
          style={{
            paddingTop: 48,
            borderTop: "1px solid var(--line)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".15em",
            color: "var(--fg-3)",
            textTransform: "uppercase",
          }}
        >
          — Platinum CBD Cup · depuis 2023
        </div>
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
          <div className="team-roster">
            {teamMembers.map((member, i) => {
              const m = member as TeamMember;
              return (
                <figure key={m.id ?? i} className="team-member">
                  <div className="team-photo-frame">
                    {m.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo} alt={m.name} loading="lazy" />
                    ) : (
                      <span className="team-photo-placeholder">
                        {getInitials(m.name)}
                      </span>
                    )}
                  </div>
                  <figcaption>
                    <span className="team-idx">
                      · {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="team-nm">{m.name}</span>
                    {m.role && <span className="team-rl">{m.role}</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
