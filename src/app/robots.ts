import type { MetadataRoute } from "next";

/**
 * Base URL for the single-tenant Platinum CBD Cup app.
 * Falls back to localhost in dev.
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Static robots.txt for the single-tenant app.
 *
 * Allows crawling of all public pages, blocks authenticated areas
 * (dashboard, producer, jury — except /jury/public) and internal routes.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

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
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
