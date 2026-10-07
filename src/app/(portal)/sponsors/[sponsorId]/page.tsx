import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { baseUrl, imagePartage } from "../../_lib/seo";

interface Props {
  params: Promise<{ sponsorId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sponsorId } = await params;

  const sponsor = await db.query.sponsors.findFirst({
    where: eq(schema.sponsors.id, sponsorId),
    columns: { name: true, description: true, logo: true },
  });

  if (!sponsor) {
    return { title: "Partenaire introuvable", robots: { index: false, follow: false } };
  }

  const url = `${baseUrl()}/sponsors/${sponsorId}`;
  const description =
    sponsor.description ?? `${sponsor.name}, partenaire de la Platinum CBD Cup.`;
  // Le logo est stocké en chemin relatif (/uploads/…) : Open Graph exige un absolu.
  const image = sponsor.logo
    ? sponsor.logo.startsWith("http")
      ? sponsor.logo
      : `${baseUrl()}${sponsor.logo}`
    : null;

  return {
    title: sponsor.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: sponsor.name,
      description,
      url,
      images: imagePartage(image, sponsor.name),
    },
  };
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

  const links = [
    ...(sponsor.website ? [{ label: "Site web", href: sponsor.website }] : []),
    ...Object.entries(social)
      .filter(([, v]) => !!v)
      .map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), href: v })),
  ];

  return (
    <div className="pg">
      <header className="pg-head">
        <Link href="/sponsors" className="pg-link" style={{ fontSize: 15 }}>
          Tous les partenaires
        </Link>
        <p className="eyebrow">Partenaire</p>
        <h1 className="display">{sponsor.name}</h1>
        {sponsor.description && <p className="pg-lede">{sponsor.description}</p>}
      </header>

      {(sponsor.logo || links.length > 0) && (
        <section className="pg-section" style={{ paddingTop: 0 }}>
          <div className="pg-grid" style={{ alignItems: "start" }}>
            {sponsor.logo && (
              <div
                className="pg-tile"
                style={{ height: 200, alignItems: "center", justifyContent: "center" }}
              >
                <Image
                  src={sponsor.logo}
                  alt={sponsor.name}
                  width={240}
                  height={120}
                  style={{ objectFit: "contain", maxHeight: 120, width: "auto", maxWidth: "100%" }}
                />
              </div>
            )}
            {links.length > 0 && (
              <div className="pg-tile">
                <h2 style={{ margin: 0, fontSize: 22 }}>Liens</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {links.map((l) => (
                    <li key={l.href} style={{ fontSize: 16, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                      <span style={{ color: "var(--fg-2)", minWidth: 90 }}>{l.label}</span>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="pg-link"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {l.href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="pg-section" aria-labelledby="sponsor-gallery">
          <h2 id="sponsor-gallery" style={{ margin: 0, fontSize: 28 }}>
            Galerie
          </h2>
          <div
            className="pg-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}
          >
            {gallery.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                <div
                  style={{
                    aspectRatio: "1/1",
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
        <section className="pg-section" aria-labelledby="sponsor-testimonials">
          <h2 id="sponsor-testimonials" style={{ margin: 0, fontSize: 28 }}>
            Témoignages
          </h2>
          <div className="pg-grid">
            {testimonials.map((t) => (
              <figure key={t.id} className="pg-tile" style={{ margin: 0 }}>
                <blockquote style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "var(--fg)" }}>
                  «&nbsp;{t.text}&nbsp;»
                </blockquote>
                <figcaption className="pg-meta">
                  {t.authorName}
                  {t.authorRole ? `, ${t.authorRole}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="pg-section">
        <div className="pg-section-head">
          <h2 style={{ margin: 0, fontSize: 26 }}>Vous souhaitez devenir partenaire ?</h2>
          <Link href="/contact" className="btn accent">
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
