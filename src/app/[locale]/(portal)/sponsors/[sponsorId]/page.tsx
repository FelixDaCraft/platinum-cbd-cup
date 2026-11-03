import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { ogLocale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { alternatesFor, baseUrl, imagePartage, localizedCanonical } from "../../_lib/seo";

interface Props {
  params: Promise<{ sponsorId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sponsorId } = await params;
  const locale = await currentLocale();
  const t = await getTranslations("sponsors");

  const sponsor = await db.query.sponsors.findFirst({
    where: eq(schema.sponsors.id, sponsorId),
    columns: { name: true, description: true, logo: true },
  });

  if (!sponsor) {
    return { title: t("notFound"), robots: { index: false, follow: false } };
  }

  const path = `/sponsors/${sponsorId}`;
  const url = localizedCanonical(path, locale);
  // La présentation saisie au back-office n'existe qu'en français.
  const description =
    (locale === "fr" ? sponsor.description : null) ??
    t("fallbackDescription", { name: sponsor.name });
  // Le logo est stocké en chemin relatif (/uploads/…) : Open Graph exige un absolu.
  const image = sponsor.logo
    ? sponsor.logo.startsWith("http")
      ? sponsor.logo
      : `${baseUrl()}${sponsor.logo}`
    : null;

  return {
    title: sponsor.name,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type: "profile",
      locale: ogLocale(locale),
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
  const t = await getTranslations("sponsors");

  const social = (sponsor.socialLinks ?? {}) as Record<string, string>;
  const gallery = (sponsor.gallery ?? []) as string[];
  const testimonials = (sponsor.testimonials ?? []) as {
    id: string;
    text: string;
    authorName: string;
    authorRole?: string;
  }[];

  const links = [
    ...(sponsor.website ? [{ label: t("website"), href: sponsor.website }] : []),
    ...Object.entries(social)
      .filter(([, v]) => !!v)
      .map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), href: v })),
  ];

  return (
    <div className="pg editorial">
      <header className="pg-head">
        <Link href="/sponsors" className="pg-link editorial-back" style={{ fontSize: 15 }}>
          {t("all")}
        </Link>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display">{sponsor.name}</h1>
        {sponsor.description && (
          <p className="pg-lede" lang="fr">
            {sponsor.description}
          </p>
        )}
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
                <h2 style={{ margin: 0, fontSize: 22 }}>{t("links")}</h2>
                <ul className="sponsor-links" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
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
            {t("gallery")}
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
            {t("testimonials")}
          </h2>
          <div className="pg-grid">
            {testimonials.map((item) => (
              <figure key={item.id} className="pg-tile" style={{ margin: 0 }}>
                <blockquote
                  lang="fr"
                  style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "var(--fg)" }}
                >
                  «&nbsp;{item.text}&nbsp;»
                </blockquote>
                <figcaption className="pg-meta">
                  {item.authorName}
                  {item.authorRole ? `, ${item.authorRole}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="pg-section">
        <div className="pg-section-head">
          <h2 style={{ margin: 0, fontSize: 26 }}>{t("becomeQuestion")}</h2>
          <Link href="/contact" className="btn accent">
            {t("contactUs")}
          </Link>
        </div>
      </section>
    </div>
  );
}
