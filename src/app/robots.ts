import type { MetadataRoute } from "next";

// L'URL de base était recopiée ici, dans sitemap.ts et dans les pages du
// portail. Le jour où le domaine change, une copie oubliée annonce aux
// robots un plan de site hébergé ailleurs : on passe par le point unique.
import { baseUrl, canonical } from "./(portal)/_lib/seo";

/**
 * Static robots.txt for the single-tenant app.
 *
 * Allows crawling of all public pages, blocks authenticated areas
 * (dashboard, producer, jury — except /jury/public) and internal routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jury/public"],
        disallow: [
          "/api/",
          "/_next/",
          "/static/",
          "/dashboard",
          "/dashboard/",
          "/producer",
          "/producer/",
          "/jury",
          "/jury/",
          // Pages de compte : sans valeur pour un moteur, et les indexer
          // dilue le référencement des pages éditoriales. Chacune porte en
          // plus `robots: { index: false }` via son layout de segment.
          "/login",
          "/register",
          "/activate",
          "/forgot-password",
          "/reset-password",
          "/jury-invite",
        ],
      },
    ],
    sitemap: canonical("/sitemap.xml"),
    host: baseUrl(),
  };
}
