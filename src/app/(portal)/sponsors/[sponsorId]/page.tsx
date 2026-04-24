import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { Eyebrow, Pill } from "~/components/portal/platinum";

interface Props {
  params: Promise<{ sponsorId: string }>;
}

export default async function SponsorDetailPage({ params }: Props) {
  const { sponsorId } = await params;

  const sponsor = await db.query.sponsors.findFirst({
    where: eq(schema.sponsors.id, sponsorId),
  });

  if (!sponsor) notFound();

  const social = (sponsor.socialLinks ?? {}) as Record<string, string>;
  const gallery = (sponsor.gallery ?? []) as string[];
  const testimonials = (sponsor.testimonials ?? []) as {
    id: string;
    text: string;
    authorName: string;
    authorRole?: string;
  }[];

  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Link
          href="/sponsors"
          className="mono fg3"
          style={{
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Sponsors
        </Link>
        <Eyebrow>Partenaire</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          {sponsor.name}
          <em>.</em>
        </h1>
        {sponsor.description && (
          <p className="lede">{sponsor.description}</p>
        )}
      </section>

      <section
        className="grid g-2"
        style={{ alignItems: "start", marginBottom: 32 }}
      >
        <div className="card">
          <Eyebrow>Identité</Eyebrow>
          <div
            style={{
              marginTop: 18,
              height: 160,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "var(--bg)",
              padding: 16,
            }}
          >
            {sponsor.logo ? (
              <Image
                src={sponsor.logo}
                alt={sponsor.name}
                width={240}
                height={120}
                style={{ objectFit: "contain", maxHeight: 120 }}
              />
            ) : (
              <span
                className="mono fg3"
                style={{ fontSize: 12, letterSpacing: ".15em" }}
              >
                [ NO LOGO ]
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <Eyebrow>Liens</Eyebrow>
          <div style={{ marginTop: 16 }}>
            {sponsor.website && (
              <div className="kv">
                <span className="kv-k">Site web</span>
                <a
                  href={sponsor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="kv-v"
                  style={{ color: "var(--accent)", textDecoration: "none" }}
                >
                  {sponsor.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {Object.entries(social).map(([k, v]) =>
              v ? (
                <div key={k} className="kv">
                  <span className="kv-k">{k}</span>
                  <a
                    href={v}
                    target="_blank"
                    rel="noreferrer"
                    className="kv-v"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    {v.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </div>
              ) : null,
            )}
            {!sponsor.website && Object.values(social).every((v) => !v) && (
              <p className="lede" style={{ marginTop: 4 }}>
                Aucun lien renseigné.
              </p>
            )}
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-title">Galerie</h2>
          <div className="grid g-3" style={{ marginTop: 20 }}>
            {gallery.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block" }}
              >
                <div
                  style={{
                    aspectRatio: "1/1",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    src={url}
                    alt={`${sponsor.name} ${i + 1}`}
                    fill
                    sizes="(max-width: 880px) 100vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-title">Témoignages</h2>
          <div className="grid g-2" style={{ marginTop: 20 }}>
            {testimonials.map((t) => (
              <div key={t.id} className="card">
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    color: "var(--fg)",
                  }}
                >
                  «&nbsp;{t.text}&nbsp;»
                </p>
                <div
                  className="mono fg3"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    marginTop: 16,
                  }}
                >
                  — {t.authorName}
                  {t.authorRole ? ` · ${t.authorRole}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 48 }}>
        <Pill>Vous souhaitez devenir partenaire ?</Pill>
        <div style={{ marginTop: 20 }}>
          <Link href="/contact" className="btn accent">
            Nous contacter <span className="btn-arrow">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
