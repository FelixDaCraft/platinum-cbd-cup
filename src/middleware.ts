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
 * Forward the current pathname to server components.
 *
 * Layouts cannot read the pathname in the App Router, but `/producer` needs
 * it to let a profile-less producer through to `/producer/complete-profile`
 * while redirecting them there from anywhere else.
 */
function next(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
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
