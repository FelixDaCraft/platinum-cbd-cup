import type { MetadataRoute } from "next";
import { db } from "~/server/db";

// Query the DB at request time, not at build time — avoids connecting to a
// placeholder DB during `next build`.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Base URL for the single-tenant Platinum CBD Cup app.
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Generate dynamic sitemap for the single-tenant Platinum CBD Cup app.
 * No org filter — the whole DB belongs to one tenant now.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const [cups, articles, sponsors, pressReleases] = await Promise.all([
    db.query.cups.findMany({
      where: (cups, { ne }) => ne(cups.status, "draft"),
      columns: { id: true, updatedAt: true },
      orderBy: (cups, { desc }) => [desc(cups.updatedAt)],
    }),
    db.query.articles.findMany({
      where: (articles, { eq }) => eq(articles.status, "published"),
      columns: { slug: true, updatedAt: true },
      orderBy: (articles, { desc }) => [desc(articles.publishedAt)],
    }),
    db.query.sponsors.findMany({
      columns: { id: true, updatedAt: true },
    }),
    db.query.pressReleases.findMany({
      where: (pr, { eq }) => eq(pr.status, "published"),
      columns: { id: true, updatedAt: true },
      orderBy: (pr, { desc }) => [desc(pr.publishedAt)],
    }),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/cups`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sponsors`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/archives`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/press`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/palmares`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const cupPages: MetadataRoute.Sitemap = cups.map((cup) => ({
    url: `${baseUrl}/cups/${cup.id}`,
    lastModified: cup.updatedAt ?? now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: article.updatedAt ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const sponsorPages: MetadataRoute.Sitemap = sponsors.map((sponsor) => ({
    url: `${baseUrl}/sponsors/${sponsor.id}`,
    lastModified: sponsor.updatedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const pressReleasePages: MetadataRoute.Sitemap = pressReleases.map((pr) => ({
    url: `${baseUrl}/press/${pr.id}`,
    lastModified: pr.updatedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...cupPages,
    ...articlePages,
    ...sponsorPages,
    ...pressReleasePages,
  ];
}
