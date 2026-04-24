import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { eq, and, desc, ne } from "drizzle-orm";
import { articles } from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { ArticleContent } from "~/components/portal/article-content";
import type { Metadata } from "next";

/**
 * Get base URL from request headers for absolute URLs (needed for OG images)
 */
async function getBaseUrl(): Promise<string> {
  const headersList = await headers();

  const host = headersList.get("host") ?? headersList.get("x-forwarded-host");

  const protocol = host?.includes("localhost") || host?.includes("lvh.me")
    ? "http"
    : "https";

  return host ? `${protocol}://${host}` : "";
}

/**
 * Convert relative URL to absolute URL
 */
function toAbsoluteUrl(relativeUrl: string | null, baseUrl: string): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http")) return relativeUrl;
  return `${baseUrl}${relativeUrl}`;
}

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Published article by slug (single-tenant).
 */
async function getArticle(slug: string) {
  const article = await db.query.articles.findFirst({
    where: and(
      eq(articles.slug, slug),
      eq(articles.status, "published")
    ),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
      sponsor: {
        columns: { id: true, name: true, logo: true },
      },
    },
  });

  return article;
}

/**
 * Related articles (same category), excluding current one.
 */
async function getRelatedArticles(
  currentArticleId: string,
  category: string | null,
  limit = 3
) {
  const conditions = [
    eq(articles.status, "published"),
    ne(articles.id, currentArticleId),
  ];

  if (category) {
    conditions.push(eq(articles.category, category));
  }

  const related = await db.query.articles.findMany({
    where: and(...conditions),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
    },
    orderBy: [desc(articles.publishedAt)],
    limit,
  });

  return related;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = await getBaseUrl();
  const article = await getArticle(slug);

  if (!article) {
    return { title: "Article non trouvé" };
  }

  const absoluteCoverImage = toAbsoluteUrl(article.coverImage, baseUrl);
  const articleUrl = `${baseUrl}/articles/${article.slug}`;

  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      type: "article",
      url: articleUrl,
      publishedTime: article.publishedAt?.toISOString(),
      authors: article.author.name ? [article.author.name] : undefined,
      images: absoluteCoverImage
        ? [
            {
              url: absoluteCoverImage,
              width: 1200,
              height: 630,
              alt: article.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: absoluteCoverImage ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt ?? undefined,
      images: absoluteCoverImage ? [absoluteCoverImage] : undefined,
    },
  };
}

export default async function PortalArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedArticles(
    article.id,
    article.category
  );

  return (
    <>
      <PortalHeader />
      <ArticleContent article={article} relatedArticles={relatedArticles} />
      <PortalFooter />
    </>
  );
}
