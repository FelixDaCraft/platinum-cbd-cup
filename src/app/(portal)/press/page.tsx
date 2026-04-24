import Link from "next/link";
import { db } from "~/server/db";
import { Eyebrow, Placeholder } from "~/components/portal/platinum";

export const metadata = {
  title: "Presse",
  description: "Communiqués, kit média et galerie presse de la Platinum CBD Cup.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
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

export default async function PressPage() {
  const { releases, gallery, settings } = await getPressData();

  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Eyebrow idx={6}>Press · Media · Partners</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Press<em>.</em>
        </h1>
        <p className="lede">
          Communiqués, dossiers de presse, kit média et galerie photo en haute
          résolution. Pour toute demande, écrivez à{" "}
          <span className="mono" style={{ color: "var(--fg)" }}>
            {settings?.pressEmail ?? "press@platinum.aynn.fr"}
          </span>
          .
        </p>
      </section>

      {/* MEDIA KIT */}
      {(settings?.mediaKitUrl ?? settings?.showMediaKit) && (
        <section
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 28,
            marginBottom: 32,
          }}
        >
          <div>
            <Eyebrow>Media kit · Press</Eyebrow>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 22,
                marginTop: 12,
                lineHeight: 1.3,
              }}
            >
              Logos, photos, dossier de presse en un seul fichier.
            </div>
          </div>
          {settings?.mediaKitUrl && (
            <a
              href={settings.mediaKitUrl}
              className="btn accent"
              download={settings.mediaKitFileName ?? undefined}
            >
              Télécharger <span className="btn-arrow">↓</span>
            </a>
          )}
        </section>
      )}

      {/* PRESS RELEASES */}
      <section style={{ marginTop: 16 }}>
        <h2 className="section-title">Communiqués</h2>
        {releases.length === 0 ? (
          <div className="card" style={{ marginTop: 24 }}>
            <Eyebrow>Aucun communiqué publié</Eyebrow>
            <p className="lede" style={{ marginTop: 12 }}>
              Les premiers communiqués accompagneront l&apos;ouverture officielle
              de l&apos;édition en cours.
            </p>
          </div>
        ) : (
          <div className="grid g-2" style={{ marginTop: 24 }}>
            {releases.map((r) => (
              <div key={r.id} className="card card-hover">
                <div
                  className="mono fg3"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                  }}
                >
                  {formatDate(r.publishedAt)}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 18, marginTop: 12, lineHeight: 1.3 }}
                >
                  {r.title}
                </div>
                {r.excerpt && (
                  <p
                    style={{
                      color: "var(--fg-2)",
                      fontSize: 14,
                      lineHeight: 1.55,
                      marginTop: 12,
                    }}
                  >
                    {r.excerpt}
                  </p>
                )}
                {r.pdfUrl && (
                  <a
                    href={r.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn ghost"
                    style={{ marginTop: 20, padding: "10px 16px" }}
                  >
                    Lire le PDF <span className="btn-arrow">↓</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <h2 className="section-title">Galerie</h2>
          <div className="grid g-3" style={{ marginTop: 24 }}>
            {gallery.map((img) => (
              <a
                key={img.id}
                href={img.imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block" }}
              >
                <Placeholder
                  label={img.title}
                  caption={
                    img.width && img.height
                      ? `${img.width}×${img.height}`
                      : undefined
                  }
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section style={{ marginTop: 64 }}>
        <div className="card">
          <Eyebrow>Press contact</Eyebrow>
          <div className="kv" style={{ marginTop: 16 }}>
            <span className="kv-k">Email</span>
            <span className="kv-v">
              {settings?.pressEmail ?? "press@platinum.aynn.fr"}
            </span>
          </div>
          {settings?.pressPhone && (
            <div className="kv">
              <span className="kv-k">Téléphone</span>
              <span className="kv-v">{settings.pressPhone}</span>
            </div>
          )}
          <div style={{ marginTop: 24 }}>
            <Link href="/contact" className="btn ghost">
              Formulaire de contact <span className="btn-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
