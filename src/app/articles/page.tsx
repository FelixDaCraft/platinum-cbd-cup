import type { Metadata } from "next";
import { db } from "~/server/db";
import { eq, and, desc, sql, ilike, or, ne } from "drizzle-orm";
import { articles, getCategoryColor } from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PortalArticlesList } from "~/components/portal/portal-articles-list";
import { calculateReadingTime } from "~/lib/utils/reading-time";

export const metadata: Metadata = {
  title: "Articles",
  description: "Découvrez nos derniers articles et actualités.",
};

const ARTICLES_PER_PAGE = 9;

interface SearchParams {
  page?: string;
  category?: string;
  tag?: string;
  search?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * Featured article (most recent featured / published).
 */
async function getFeaturedArticle() {
  const featured = await db.query.articles.findFirst({
    where: and(
      eq(articles.status, "published"),
      eq(articles.isFeatured, true)
    ),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
      sponsor: {
        columns: { id: true, name: true, logo: true },
      },
    },
    orderBy: [desc(articles.publishedAt)],
  });

  if (!featured) return null;

  const color = featured.categoryColor ?? getCategoryColor(featured.category);
  const readingTime = calculateReadingTime(featured.content as Record<string, unknown> | null);
  return { ...featured, computedCategoryColor: color, readingTime };
}

/**
 * Published articles with pagination + filters. Excludes a given featured id.
 */
async function getPublishedArticles(options: {
  page: number;
  category?: string;
  tag?: string;
  search?: string;
  excludeFeaturedId?: string;
}) {
  const offset = (options.page - 1) * ARTICLES_PER_PAGE;

  const conditions = [eq(articles.status, "published")];

  if (options.excludeFeaturedId) {
    conditions.push(ne(articles.id, options.excludeFeaturedId));
  }

  if (options.category) {
    conditions.push(eq(articles.category, options.category));
  }

  if (options.tag) {
    conditions.push(
      sql`${articles.tags}::jsonb @> ${JSON.stringify([options.tag])}::jsonb`
    );
  }

  if (options.search) {
    conditions.push(
      or(
        ilike(articles.title, `%${options.search}%`),
        ilike(articles.excerpt, `%${options.search}%`)
      )!
    );
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(and(...conditions));

  const totalCount = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE);

  const articlesList = await db.query.articles.findMany({
    where: and(...conditions),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
      sponsor: {
        columns: { id: true, name: true, logo: true },
      },
    },
    orderBy: [desc(articles.publishedAt)],
    limit: ARTICLES_PER_PAGE,
    offset,
  });

  const articlesWithExtras = articlesList.map((article) => ({
    ...article,
    computedCategoryColor: article.categoryColor ?? getCategoryColor(article.category),
    readingTime: calculateReadingTime(article.content as Record<string, unknown> | null),
  }));

  return {
    articles: articlesWithExtras,
    pagination: {
      currentPage: options.page,
      totalPages,
      totalCount,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1,
    },
  };
}

/**
 * All unique categories and tags across published articles.
 */
async function getFilters() {
  const allArticles = await db.query.articles.findMany({
    where: eq(articles.status, "published"),
    columns: {
      category: true,
      tags: true,
    },
  });

  const categoriesSet = new Set<string>();
  const tagsSet = new Set<string>();

  for (const article of allArticles) {
    if (article.category) {
      categoriesSet.add(article.category);
    }
    if (article.tags) {
      for (const tag of article.tags) {
        tagsSet.add(tag);
      }
    }
  }

  return {
    categories: Array.from(categoriesSet).sort(),
    tags: Array.from(tagsSet).sort(),
  };
}

export default async function PortalArticlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const hasFilters = params.category || params.tag || params.search;

  const featuredArticle = !hasFilters && currentPage === 1
    ? await getFeaturedArticle()
    : null;

  const [{ articles: articlesList, pagination }, filters] = await Promise.all([
    getPublishedArticles({
      page: currentPage,
      category: params.category,
      tag: params.tag,
      search: params.search,
      excludeFeaturedId: featuredArticle?.id,
    }),
    getFilters(),
  ]);

  return (
    <>
      <PortalHeader />
      <main className="container mx-auto py-8 md:py-12 min-h-[60vh] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Actualités</h1>
          <p className="mt-2 text-muted-foreground">
            Découvrez nos dernières actualités et articles.
          </p>
        </div>

        <PortalArticlesList
          articles={articlesList}
          featuredArticle={featuredArticle}
          pagination={pagination}
          filters={filters}
          currentFilters={{
            category: params.category,
            tag: params.tag,
            search: params.search,
          }}
        />
      </main>
      <PortalFooter />
    </>
  );
}
