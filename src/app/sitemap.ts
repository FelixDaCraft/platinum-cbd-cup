import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { db } from "~/server/db";

// Même point unique que robots.ts et que les pages du portail : une copie
// locale de l'URL de base finit par diverger, et un plan de site qui pointe
// vers l'ancien domaine se traduit par autant d'URL mortes à l'indexation.
import { canonical } from "./(portal)/_lib/seo";

// Query the DB at request time, not at build time — avoids connecting to a
// placeholder DB during `next build`. Le rendu reste dynamique pour cette
// raison, mais les lectures sont mémoïsées ci-dessous : un robot
// insistant ne doit pas rejouer l'inventaire complet du site à chaque passage.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Le plan du site ne change qu'à la publication d'un contenu : une heure de
 *  retard sur un fichier destiné aux robots n'a aucune conséquence. */
const SITEMAP_REVALIDATE = 3600;

/**
 * Inventaire des contenus référençables.
 *
 * Regroupé en une seule fonction mémoïsée plutôt qu'en trois : le plan du
 * site est produit d'un bloc, une entrée de cache suffit.
 *
 * Les communiqués de presse en sont absents : il n'existe pas de route
 * `/press/<id>`, la page /press liste chaque communiqué et pointe vers son
 * PDF. Le plan annonçait donc autant de 404 que de communiqués publiés.
 */
const getIndexableContent = unstable_cache(
  async () => {
    return Promise.all([
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
    ]);
  },
  ["sitemap-indexable-content"],
  {
    revalidate: SITEMAP_REVALIDATE,
    tags: ["cups", "articles", "sponsors"],
  },
);

/**
 * Generate dynamic sitemap for the single-tenant Platinum CBD Cup app.
 * No org filter — the whole DB belongs to one tenant now.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [cups, articles, sponsors] = await getIndexableContent();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: canonical(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonical("/cups"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: canonical("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: canonical("/sponsors"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: canonical("/articles"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: canonical("/archives"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: canonical("/press"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: canonical("/palmares"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: canonical("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: canonical("/reglement"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: canonical("/mentions-legales"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: canonical("/confidentialite"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const cupPages: MetadataRoute.Sitemap = cups.map((cup) => ({
    url: canonical(`/cups/${cup.id}`),
    lastModified: cup.updatedAt ?? now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: canonical(`/articles/${article.slug}`),
    lastModified: article.updatedAt ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const sponsorPages: MetadataRoute.Sitemap = sponsors.map((sponsor) => ({
    url: canonical(`/sponsors/${sponsor.id}`),
    lastModified: sponsor.updatedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...cupPages,
    ...articlePages,
    ...sponsorPages,
  ];
}
