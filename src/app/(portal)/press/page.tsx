import Link from "next/link";
import { db } from "~/server/db";
import { canonical } from "../_lib/seo";

export const metadata = {
  alternates: { canonical: canonical("/press") },
  title: "Presse",
  description: "Communiqués, kit média et galerie presse de la Platinum CBD Cup.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

  // `??` ne se déclenche que sur null et undefined. Dès qu'une ligne
  // press_settings existait avec un `press_email` vide — ce que le formulaire
  // d'administration produit en enregistrant un champ non renseigné — la page
  // affichait « écrivez à . » et une fiche contact sans adresse, aux deux
  // endroits. Un site de presse sans adresse de presse.
  const emailPresse = settings?.pressEmail?.trim() || "press@platinumcbdcup.eu";
  const showMediaKit = settings?.showMediaKit !== false && !!settings?.mediaKitUrl;

  return (
    <div className="pg editorial">
      <header className="pg-head">
        <p className="eyebrow">Presse</p>
        <h1 className="display">Espace presse</h1>
        <p className="pg-lede">
          Communiqués, kit média et photos de la Platinum CBD Cup. Pour toute
          demande, écrivez à{" "}
          <a href={`mailto:${emailPresse}`} className="pg-link">
            {emailPresse}
          </a>
          .
        </p>
      </header>

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
              <h2 style={{ margin: 0, fontSize: 22 }}>Kit média</h2>
              <p>Logos, photos et dossier de presse réunis dans un seul fichier.</p>
            </div>
            <a
              href={settings.mediaKitUrl}
              className="btn accent editorial-cta"
              download={settings.mediaKitFileName ?? undefined}
            >
              Télécharger le kit média
            </a>
          </div>
        </section>
      )}

      {/* COMMUNIQUÉS */}
      {settings?.showPressReleases !== false && (
        <section className="pg-section" aria-labelledby="press-releases">
          <h2 id="press-releases" style={sectionTitle}>
            Communiqués
          </h2>
          {releases.length === 0 ? (
            <div className="notice">Aucun communiqué publié pour le moment.</div>
          ) : (
            <div className="pg-grid">
              {releases.map((r) => (
                <article key={r.id} className="pg-tile">
                  <span className="pg-meta">{formatDate(r.publishedAt)}</span>
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
                      Lire le communiqué (PDF)
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
            Galerie
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
            Contact presse
          </h2>
          <div className="pg-tile" style={{ maxWidth: 560 }}>
            <p>
              Email :{" "}
              <a href={`mailto:${emailPresse}`} className="pg-link">
                {emailPresse}
              </a>
            </p>
            {settings?.pressPhone && (
              <p>
                Téléphone :{" "}
                <a href={`tel:${settings.pressPhone.replace(/\s+/g, "")}`} className="pg-link">
                  {settings.pressPhone}
                </a>
              </p>
            )}
            <div style={{ marginTop: 8 }}>
              <Link href="/contact" className={`${showMediaKit ? "btn ghost" : "btn accent"} editorial-cta`}>
                Formulaire de contact
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
