import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import Image from "next/image";
import { formatDate as formatLocalDate, localizedContent, type Locale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { articleCategoryLabel } from "./_lib/category";
import { db } from "~/server/db";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/articles", "articles");
}

function formatDate(date: Date | null | undefined, locale: Locale): string {
  if (!date) return "—";
  return formatLocalDate(date, locale);
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
  const locale = await currentLocale();
  const t = await getTranslations("articles");
  const articles = (await getPublishedArticles()).map((a) => localizedContent(a, locale));

  return (
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            {t("barNews")}
            <Sparkle size={12} />
            {t("barInterviews")}
            <Sparkle size={12} />
            {t("barBehind")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={2}
      />

      <section className="pg-section" style={{ paddingTop: 0 }}>
        {articles.length === 0 ? (
          <div className="notice">{t("empty")}</div>
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
                        {articleCategoryLabel(a.category, t)}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  {formatDate(a.publishedAt, locale)}
                  {!a.translated && <> · {t("frenchOnlyShort")}</>}
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
