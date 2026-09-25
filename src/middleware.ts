import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Single-tenant auth middleware for Platinum CBD Cup.
 *
 * No subdomain parsing, no portal rewrites, no context headers — this app
 * is the portal. Only responsibility: redirect unauthenticated users away
 * from protected paths to `/login`.
 */

/**
 * Path prefixes that require an authenticated session.
 * A match is triggered when pathname === prefix OR pathname starts with `${prefix}/`.
 * `/jury` is protected, except `/jury/public/*` which is public (handled below).
 */
const PROTECTED_PREFIXES = ["/producer", "/jury", "/dashboard"];

/**
 * Explicit public exceptions that sit underneath a protected prefix.
 * Checked before PROTECTED_PREFIXES so e.g. `/jury/public/xyz` stays public.
 */
const PROTECTED_PUBLIC_EXCEPTIONS = ["/jury/public"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedPath(pathname: string): boolean {
  // Public exceptions override protected prefixes.
  if (PROTECTED_PUBLIC_EXCEPTIONS.some((p) => matchesPrefix(pathname, p))) {
    return false;
  }
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * SW-11 — phase d'observation du nonce CSP.
 *
 * La CSP appliquée (next.config.js) porte encore `'unsafe-inline'` sur
 * `script-src`, ce qui laisse s'exécuter n'importe quel script injecté dans
 * le HTML. Le remplacement est un nonce tiré par requête, et Next.js sait le
 * poser sur ses propres balises : il lit l'en-tête `content-security-policy`
 * de la REQUÊTE (cf. getScriptNonceFromHeader dans next/dist/server/
 * app-render) et le propage au bootstrap, aux flux de données inline et aux
 * balises insérées côté serveur.
 *
 * Ce qui n'est pas vérifiable sans un rendu réel — et donc la raison pour
 * laquelle on n'applique PAS encore la politique — c'est ce qui se passe une
 * fois les deux en-têtes en présence : la CSP statique de next.config.js et
 * celle du middleware ne peuvent pas coexister en mode appliqué (deux
 * politiques s'intersectent, et un script de Next qui raterait le nonce
 * rendrait la page blanche). Le mode `Report-Only` ci-dessous n'applique
 * rien : il fait simplement poser le nonce par Next et signaler dans la
 * console tout script qui ne le porte pas. Quand la console d'une page de
 * chaque famille (portail, tableau de bord, jury, producteur) est muette, le
 * basculement consiste à déplacer la politique de next.config.js vers ici et
 * à passer cet en-tête en `Content-Security-Policy`.
 *
 * Un seul script échappe à Next : celui que next-themes injecte pour poser la
 * classe de thème avant l'hydratation. Il reçoit le nonce par le prop `nonce`
 * de `ThemeProvider` (src/components/providers.tsx), que le layout racine lit
 * dans l'en-tête de requête posé ci-dessous. Sans ce câblage, ce script
 * signalerait sur CHAQUE page et le critère « console muette » serait
 * impossible à atteindre.
 *
 * Mettre à `false` pour couper l'observation.
 */
const CSP_NONCE_OBSERVATION = true;

/**
 * Seule `script-src` est mise à l'épreuve : une politique Report-Only réduite
 * à cette directive ne produit aucun signalement sur les images, les polices
 * ou les styles, et n'a donc rien à rester synchronisé avec next.config.js.
 * `'wasm-unsafe-eval'` est repris tel quel — le décodeur meshopt de l'emblème
 * 3D est un module WebAssembly, que CSP3 gate.
 */
function buildNonceScriptSrc(nonce: string): string {
  return `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`;
}

/**
 * Les routes /widget sont embarquées chez des tiers et vivent sous leur
 * propre CSP (`frame-ancestors *`) : on les laisse hors de l'observation.
 */
function isWidgetPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/widget");
}

/**
 * Forward the current pathname to server components.
 *
 * Layouts cannot read the pathname in the App Router, but `/producer` needs
 * it to let a profile-less producer through to `/producer/complete-profile`
 * while redirecting them there from anywhere else.
 */
function next(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);

  if (!CSP_NONCE_OBSERVATION || isWidgetPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // Les tirets sont retirés par simple hygiène — un nonce est transporté en
  // base64 dans l'en-tête et le tiret y est légal, mais une valeur sans
  // séparateur évite toute question d'échappement. Restent 122 bits d'aléa,
  // très au-delà des 128 bits d'entropie recommandés par le CSP Level 3 pour
  // un usage à requête unique.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const scriptSrc = buildNonceScriptSrc(nonce);

  // En-tête de REQUÊTE : c'est celui-là, et lui seul, que Next.js lit pour
  // décider de poser `nonce=` sur les scripts qu'il émet.
  headers.set("content-security-policy", scriptSrc);

  const response = NextResponse.next({ request: { headers } });
  // En-tête de RÉPONSE, en mode signalement : rien n'est bloqué, donc aucun
  // risque de page blanche. La CSP appliquée reste celle de next.config.js.
  response.headers.set("Content-Security-Policy-Report-Only", scriptSrc);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return next(request);
  }

  // better-auth session cookie — secure (HTTPS) and non-secure (dev HTTP) names
  const sessionToken =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return next(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/           (API routes handle their own auth)
     * - /_next/static   (Next.js static assets)
     * - /_next/image    (Next.js image optimizer)
     * - /fonts/         (Louize Display & other local fonts — must not be rewritten)
     * - /models/        (Three.js GLB / GLTF assets)
     * - favicon.ico
     * - sw.js           (service worker)
     * - static image files at any depth
     * - .glb / .gltf    (3D models served from anywhere under public/)
     */
    "/((?!api/|_next/static|_next/image|fonts/|models/|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf)$).*)",
  ],
};
