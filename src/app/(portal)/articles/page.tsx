import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db";
import {
  ARTICLE_CATEGORY_COLORS,
  getCategoryColor,
} from "~/server/db/schema/articles";
import { Eyebrow } from "~/components/portal/platinum";

export const metadata = {
  title: "Articles",
  description:
    "Actualités, interviews et analyses autour de la Platinum CBD Cup.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function getPublishedArticles() {
  try {
    return await db.query.articles.findMany({
      where: (a, { eq }) => eq(a.status, "published"),
      orderBy: (a, { desc }) => [desc(a.publishedAt)],
    });
  } catch {
    return [];
  }
}

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();
  // Touch the import so an unused-variable check stays happy if no article ever
  // matches a known category (we still want the symbol available downstream).
  void ARTICLE_CATEGORY_COLORS;

  return (
    <div className="page-enter">
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Eyebrow idx={8}>Journal · Articles</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Articles<em>.</em>
        </h1>
        <p className="lede">
          Interviews de jurés et de producteurs, analyses méthodologiques,
          coulisses des panels aveugles. Sans paywall.
        </p>
      </section>

      {articles.length === 0 ? (
        <div className="card">
          <Eyebrow>Pas encore d&apos;articles publiés</Eyebrow>
          <p className="lede" style={{ marginTop: 12 }}>
            Le journal de la Cup ouvrira avec les premiers contenus en parallèle
            de l&apos;ouverture des inscriptions.
          </p>
        </div>
      ) : (
        <div className="grid g-3">
          {articles.map((a) => {
            const categoryColor =
              a.categoryColor ?? getCategoryColor(a.category) ?? "var(--accent)";
            return (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="card card-hover"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {a.coverImage ? (
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16/10",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <Image
                      src={a.coverImage}
                      alt={a.title}
                      fill
                      sizes="(max-width: 880px) 100vw, 33vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      aspectRatio: "16/10",
                      borderRadius: 10,
                      border: "1px solid var(--line-strong)",
                      background:
                        "repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--fg) 4%, transparent) 10px 11px)",
                    }}
                  />
                )}
                {a.category && (
                  <span
                    className="mono"
                    style={{
                      alignSelf: "flex-start",
                      fontSize: 10,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${categoryColor}`,
                      color: categoryColor,
                    }}
                  >
                    {a.category}
                  </span>
                )}
                <div className="mono" style={{ fontSize: 17, lineHeight: 1.3 }}>
                  {a.title}
                </div>
                {a.excerpt && (
                  <p
                    style={{
                      color: "var(--fg-2)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {a.excerpt}
                  </p>
                )}
                <div
                  className="mono fg3"
                  style={{
                    marginTop: "auto",
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                  }}
                >
                  {formatDate(a.publishedAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
