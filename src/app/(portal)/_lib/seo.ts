/**
 * Construction des URL absolues du portail.
 *
 * `metadataBase` n'est pas défini sur le layout racine : Next ne peut donc
 * pas résoudre lui-même les chemins relatifs des balises canoniques et Open
 * Graph, il faut les donner en absolu. La même base servait déjà, recopiée,
 * dans robots.ts, sitemap.ts et cinq pages — d'où ce point unique.
 */
export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * URL canonique d'une page, sans paramètre de requête : /palmares?edition=…
 * et /palmares sont la même page pour un moteur, seul le filtre d'affichage
 * change.
 */
export function canonical(path = "/"): string {
  if (path === "/" || path === "") return baseUrl();
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Image de partage par défaut.
 *
 * Next ne fusionne pas `openGraph` : un bloc défini dans une page REMPLACE
 * celui du layout racine. Une page qui déclare un titre et une description
 * sans `images` perd donc l'og.png hérité, et son aperçu de partage devient
 * une carte sans visuel. Toute page qui ouvre un bloc `openGraph` doit donc
 * fournir une image — la sienne, ou celle-ci.
 */
export const OG_IMAGE_PAR_DEFAUT = {
  url: `${baseUrl()}/og.png?v=1`,
  width: 1200,
  height: 630,
  alt: "Platinum CBD Cup — le concours de référence des meilleurs CBD de France",
};

/**
 * Absolutise l'URL d'un visuel téléversé (`/uploads/…`) pour les métadonnées,
 * et retombe sur l'image par défaut quand la page n'en a pas.
 */
export function imagePartage(
  url: string | null | undefined,
  alt: string
): { url: string; alt: string; width?: number; height?: number }[] {
  if (!url) return [OG_IMAGE_PAR_DEFAUT];
  const absolue = url.startsWith("http")
    ? url
    : `${baseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
  return [{ url: absolue, alt }];
}
