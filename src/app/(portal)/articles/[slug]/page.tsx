import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { baseUrl, imagePartage } from "../../_lib/seo";
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

  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
    columns: {
      title: true,
      excerpt: true,
      status: true,
      coverImage: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  // Brouillon ou article supprimé : la page renvoie un 404, le crawler ne
  // doit pas garder l'URL en mémoire.
  if (!article || article.status !== "published") {
    return { title: "Article introuvable", robots: { index: false, follow: false } };
  }

  const url = `${baseUrl()}/articles/${slug}`;
  const description =
    article.excerpt ?? `${article.title} — actualité de la Platinum CBD Cup.`;

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
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

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
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

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;

  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
  });

  if (!article || article.status !== "published") notFound();

  return (
    <article className="pg pg--narrow editorial">
      <header className="pg-head">
        <Link href="/articles" className="pg-link editorial-back" style={{ fontSize: 15 }}>
          Tous les articles
        </Link>
        <span className="pg-meta">
          {article.category ? (
            <>
              <span style={{ color: "var(--accent-hi)", fontWeight: 600 }}>
                {categoryLabel(article.category)}
              </span>
              {" · "}
            </>
          ) : null}
          <time dateTime={article.publishedAt?.toISOString()}>
            {formatDate(article.publishedAt)}
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

      <div className="prose">
        <TipTapContent content={article.content} />
      </div>
    </article>
  );
}
