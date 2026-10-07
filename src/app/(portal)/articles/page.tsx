import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db";
import { canonical } from "../_lib/seo";

export const metadata = {
  alternates: { canonical: canonical("/articles") },
  title: "Articles",
  description:
    "Actualités, interviews et analyses autour de la Platinum CBD Cup.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Les catégories sont souvent saisies en capitales : on les affiche en casse normale. */
function categoryLabel(category: string): string {
  if (category !== category.toUpperCase()) return category;
  const lower = category.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
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

  return (
    <div className="pg">
      <header className="pg-head">
        <p className="eyebrow">Journal</p>
        <h1 className="display">Articles</h1>
        <p className="pg-lede">
          Actualités, entretiens et coulisses de la Platinum CBD Cup.
        </p>
      </header>

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {articles.length === 0 ? (
          <div className="notice">Aucun article publié pour le moment.</div>
        ) : (
          <div className="pg-grid">
            {articles.map((a) => (
              <Link key={a.id} href={`/articles/${a.slug}`} className="pg-tile">
                {a.coverImage && (
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16/10",
                      borderRadius: 10,
                      overflow: "hidden",
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
                )}
                <span className="pg-meta">
                  {a.category ? (
                    <>
                      <span style={{ color: "var(--accent-hi)", fontWeight: 600 }}>
                        {categoryLabel(a.category)}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  {formatDate(a.publishedAt)}
                </span>
                <h3>{a.title}</h3>
                {a.excerpt && <p>{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
