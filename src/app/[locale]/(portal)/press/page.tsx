import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { formatDate as formatLocalDate, type Locale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { db } from "~/server/db";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/press", "press");
}

function formatDate(date: Date | null | undefined, locale: Locale): string {
  if (!date) return "—";
  return formatLocalDate(date, locale);
}

async function getPressData() {
  try {
    const [releases, gallery, settings] = await Promise.all([
      db.query.pressReleases.findMany({
        where: (pr, { eq }) => eq(pr.status, "published"),
        orderBy: (pr, { desc }) => [desc(pr.publishedAt)],
      }),
      db.query.galleryImages.findMany({
        orderBy: (g, { asc }) => [asc(g.displayOrder)],
        limit: 9,
      }),
      db.query.pressSettings.findFirst({}),
    ]);
    return { releases, gallery, settings };
  } catch {
    return { releases: [], gallery: [], settings: null };
  }
}

const sectionTitle = { margin: 0, fontSize: 28 } as const;

export default async function PressPage() {
  const { releases, gallery, settings } = await getPressData();
  const locale = await currentLocale();
  const t = await getTranslations("press");

  // `??` ne se déclenche que sur null et undefined. Dès qu'une ligne
  // press_settings existait avec un `press_email` vide — ce que le formulaire
  // d'administration produit en enregistrant un champ non renseigné — la page
  // affichait « écrivez à . » et une fiche contact sans adresse, aux deux
  // endroits. Un site de presse sans adresse de presse.
  const emailPresse = settings?.pressEmail?.trim() || "press@platinumcbdcup.eu";
  const showMediaKit = settings?.showMediaKit !== false && !!settings?.mediaKitUrl;

  return (
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            {t("barReleases")}
            <Sparkle size={12} />
            {t("barKit")}
            <Sparkle size={12} />
            {t("barPhotos")}
          </>
        }
        title={t("title")}
        seed={8}
      >
        <p className="st-head-lede">
          {t.rich("lede", {
            email: emailPresse,
            mail: (chunks) => (
              <a href={`mailto:${emailPresse}`} className="pg-link">
                {chunks}
              </a>
            ),
          })}
        </p>
      </PageHead>

      {/* KIT MÉDIA */}
      {showMediaKit && settings?.mediaKitUrl && (
        <section className="pg-section" style={{ paddingTop: 0 }}>
          <div
            className="pg-tile"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: "1 1 260px" }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{t("kitTitle")}</h2>
              <p>{t("kitText")}</p>
            </div>
            <a
              href={settings.mediaKitUrl}
              className="btn accent editorial-cta"
              download={settings.mediaKitFileName ?? undefined}
            >
              {t("kitDownload")}
            </a>
          </div>
        </section>
      )}

      {/* COMMUNIQUÉS */}
      {settings?.showPressReleases !== false && (
        <section className="pg-section" aria-labelledby="press-releases">
          <h2 id="press-releases" style={sectionTitle}>
            {t("releasesTitle")}
          </h2>
          {releases.length === 0 ? (
            <div className="notice">{t("releasesEmpty")}</div>
          ) : (
            <div className="pg-grid">
              {releases.map((r) => (
                <article key={r.id} className="pg-tile">
                  <span className="pg-meta">{formatDate(r.publishedAt, locale)}</span>
                  <h3>{r.title}</h3>
                  {r.excerpt && <p>{r.excerpt}</p>}
                  {r.pdfUrl && (
                    <a
                      href={r.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pg-link"
                      style={{ marginTop: "auto" }}
                    >
                      {t("readRelease")}
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* GALERIE */}
      {settings?.showGallery !== false && gallery.length > 0 && (
        <section className="pg-section" aria-labelledby="press-gallery">
          <h2 id="press-gallery" style={sectionTitle}>
            {t("gallery")}
          </h2>
          <div
            className="pg-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}
          >
            {gallery.map((img) => (
              <a
                key={img.id}
                href={img.imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--fg)", textDecoration: "none" }}
              >
                {/* Image haute définition servie telle quelle : le lien ouvre l'original. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.title}
                  width={img.width ?? undefined}
                  height={img.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: "100%",
                    height: "auto",
                    aspectRatio: "4 / 3",
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                  }}
                />
                <span style={{ fontSize: 15 }}>{img.title}</span>
                {img.width && img.height && (
                  <span className="pg-meta">
                    {img.width} × {img.height} px
                  </span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      {settings?.showContact !== false && (
        <section className="pg-section" aria-labelledby="press-contact">
          <h2 id="press-contact" style={sectionTitle}>
            {t("contactTitle")}
          </h2>
          <div className="pg-tile" style={{ maxWidth: 560 }}>
            <p>
              {t("emailLabel")}{" "}
              <a href={`mailto:${emailPresse}`} className="pg-link">
                {emailPresse}
              </a>
            </p>
            {settings?.pressPhone && (
              <p>
                {t("phoneLabel")}{" "}
                <a href={`tel:${settings.pressPhone.replace(/\s+/g, "")}`} className="pg-link">
                  {settings.pressPhone}
                </a>
              </p>
            )}
            <div style={{ marginTop: 8 }}>
              <Link href="/contact" className={`${showMediaKit ? "btn ghost" : "btn accent"} editorial-cta`}>
                {t("contactForm")}
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
