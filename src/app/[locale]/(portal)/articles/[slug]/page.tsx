import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { formatDate as formatLocalDate, localizedContent, ogLocale, type Locale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { articleCategoryLabel } from "../_lib/category";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { alternatesFor, baseUrl, imagePartage, localizedCanonical } from "../../_lib/seo";
import { TipTapContent } from "../../_components/tiptap-content";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Une image stockée dans /uploads est relative : Open Graph exige un absolu. */
function absoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `${baseUrl()}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await currentLocale();
  const t = await getTranslations("articles");

  const found = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
    columns: {
      title: true,
      excerpt: true,
      content: true,
      translations: true,
      status: true,
      coverImage: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  // Brouillon ou article supprimé : la page renvoie un 404, le crawler ne
  // doit pas garder l'URL en mémoire.
  if (!found || found.status !== "published") {
    return { title: t("notFound"), robots: { index: false, follow: false } };
  }
  const article = localizedContent(found, locale);

  const path = `/articles/${slug}`;
  const url = localizedCanonical(path, locale);
  const description = article.excerpt ?? t("fallbackDescription", { title: article.title });

  return {
    title: article.title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type: "article",
      locale: ogLocale(locale),
      title: article.title,
      description,
      url,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      images: imagePartage(article.coverImage, article.title),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      ...(article.coverImage ? { images: [absoluteUrl(article.coverImage)] } : {}),
    },
  };
}

function formatDate(date: Date | null | undefined, locale: Locale): string {
  if (!date) return "—";
  return formatLocalDate(date, locale, { day: "2-digit", month: "long", year: "numeric" });
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;

  const found = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
  });

  if (!found || found.status !== "published") notFound();
  const locale = await currentLocale();
  const t = await getTranslations("articles");
  const article = localizedContent(found, locale);

  return (
    <article className="pg pg--narrow editorial">
      <header className="pg-head">
        <Link href="/articles" className="pg-link editorial-back" style={{ fontSize: 15 }}>
          {t("all")}
        </Link>
        <span className="pg-meta">
          {article.category ? (
            <>
              <span style={{ color: "var(--accent-hi)", fontWeight: 600 }}>
                {articleCategoryLabel(article.category, t)}
              </span>
              {" · "}
            </>
          ) : null}
          <time dateTime={article.publishedAt?.toISOString()}>
            {formatDate(article.publishedAt, locale)}
          </time>
        </span>
        <h1 className="display" style={{ fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.08 }}>
          {article.title}
        </h1>
        {article.excerpt && <p className="pg-lede">{article.excerpt}</p>}
      </header>

      {article.coverImage && (
        <div className="editorial-cover">
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 880px) 100vw, 760px"
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
      )}

      {/* Article non traduit : le corps reste en français, et le dit. */}
      {!article.translated && <p className="notice">{t("frenchOnly")}</p>}
      <div className="prose" lang={article.translated ? undefined : "fr"}>
        <TipTapContent content={article.content} />
      </div>
    </article>
  );
}
