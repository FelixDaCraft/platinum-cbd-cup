import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { db } from "~/server/db";

// Même point unique que robots.ts et que les pages du portail : une copie
// locale de l'URL de base finit par diverger, et un plan de site qui pointe
// vers l'ancien domaine se traduit par autant d'URL mortes à l'indexation.
import { languageAlternates, localizedCanonical } from "./[locale]/(portal)/_lib/seo";
import { locales } from "~/i18n/locales";

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
  // Les `url` ci-dessous sont des chemins ; ils sont rendus absolus, une fois
  // par langue, au moment de l'assemblage final.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "/",
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "/cups",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "/about",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "/sponsors",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "/articles",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: "/archives",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: "/press",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "/palmares",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "/contact",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "/reglement",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: "/mentions-legales",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "/confidentialite",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const cupPages: MetadataRoute.Sitemap = cups.map((cup) => ({
    url: `/cups/${cup.id}`,
    lastModified: cup.updatedAt ?? now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `/articles/${article.slug}`,
    lastModified: article.updatedAt ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const sponsorPages: MetadataRoute.Sitemap = sponsors.map((sponsor) => ({
    url: `/sponsors/${sponsor.id}`,
    lastModified: sponsor.updatedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Une entrée par page ET par langue, chacune annonçant ses équivalents
  // (balises xhtml:link hreflang) : c'est la forme que Google attend pour un
  // site dont chaque langue a sa propre URL.
  return [...staticPages, ...cupPages, ...articlePages, ...sponsorPages].flatMap((entry) =>
    locales.map((locale) => ({
      ...entry,
      url: localizedCanonical(entry.url, locale),
      alternates: { languages: languageAlternates(entry.url) },
    }))
  );
}
