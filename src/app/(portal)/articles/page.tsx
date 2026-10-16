import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db";
import { canonical } from "../_lib/seo";
import { PageHead, Sparkle } from "~/components/portal/street/street";

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
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            Actualités
            <Sparkle size={12} />
            Entretiens
            <Sparkle size={12} />
            Coulisses
          </>
        }
        title="Articles"
        lede="Actualités, entretiens et coulisses de la Platinum CBD Cup."
        seed={2}
      />

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
