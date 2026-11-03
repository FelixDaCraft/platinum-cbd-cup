import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import Image from "next/image";
import { db } from "~/server/db";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/sponsors", "sponsors");
}

async function getSponsors() {
  try {
    return await db.query.sponsors.findMany({
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  } catch {
    return [];
  }
}

export default async function SponsorsPage() {
  const sponsors = await getSponsors();
  const t = await getTranslations("sponsors");

  return (
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            {t("barSponsors")}
            <Sparkle size={12} />
            {t("barSupport")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={6}
      />

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {sponsors.length === 0 ? (
          <div className="notice">{t("empty")}</div>
        ) : (
          <div className="pg-grid">
            {sponsors.map((s) => (
              <Link key={s.id} href={`/sponsors/${s.id}`} className="pg-tile">
                {s.logo && (
                  <div
                    style={{
                      height: 96,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 10,
                      background: "var(--bg)",
                      padding: 16,
                    }}
                  >
                    <Image
                      src={s.logo}
                      alt={s.name}
                      width={140}
                      height={64}
                      style={{ objectFit: "contain", maxHeight: 64, width: "auto" }}
                    />
                  </div>
                )}
                <h3>{s.name}</h3>
                {s.description && (
                  <p>
                    {s.description.slice(0, 120)}
                    {s.description.length > 120 ? "…" : ""}
                  </p>
                )}
                <span className="pg-link" style={{ marginTop: "auto" }}>
                  {t("see")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="pg-section">
        <div className="pg-section-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
            <h2 style={{ margin: 0, fontSize: 26 }}>{t("becomeTitle")}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)" }}>
              {t("becomeText")}
            </p>
          </div>
          <Link href="/contact" className="btn accent">
            {t("contactUs")}
          </Link>
        </div>
      </section>
    </div>
  );
}
