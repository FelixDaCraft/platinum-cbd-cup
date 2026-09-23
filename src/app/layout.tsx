import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Providers } from "~/components/providers";

// NOTE: do NOT set `export const dynamic = "force-dynamic"` here. The root
// layout itself has no DB call, so forcing it dynamic propagates that
// constraint to every child segment and blocks any future `revalidate` /
// `unstable_cache` on public pages (palmares, articles…). Pages that read
// the DB declare `force-dynamic` themselves — see (portal)/layout.tsx and
// (portal)/page.tsx. Auth-gated subtrees (dashboard / jury / producer) are
// implicitly dynamic because they read cookies via auth.
import { PortalProvider } from "~/lib/portal/portal-provider";
import type { PortalContextValue, PortalThemeConfig } from "~/lib/portal/context";
import { generateCssVariables, sanitizeCustomCss } from "~/lib/portal/css-variables";
import { platinumCSS } from "~/components/portal/platinum/platinum-styles";
import {
  ORGANIZATION_NAME,
  ORGANIZATION_SLUG,
  ORGANIZATION_LOGO,
} from "~/lib/organization";

/**
 * Static organization identity for Platinum CBD Cup
 *
 * Single-tenant app — no DB lookup, no subdomain routing. The constants live
 * in ~/lib/organization so the server routers and this layout cannot drift.
 */
const ORGANIZATION = {
  id: ORGANIZATION_SLUG,
  name: ORGANIZATION_NAME,
  slug: ORGANIZATION_SLUG,
  logo: ORGANIZATION_LOGO,
  createdAt: new Date(0),
};

/**
 * Hardcoded theme configuration for Platinum CBD Cup.
 *
 * Values mirror what the old DB-driven portal theme returned; they satisfy
 * the shape expected by every component that calls `usePortal()` /
 * `usePortalTheme()`. Actual visual identity is driven by `platinumCSS`
 * injected below (dark + gold), not by these CSS variables.
 */
const THEME_CONFIG = {
  themePreset: "default",
  colorMode: "dark" as const,
  primaryColor: "#d4af37",
  secondaryColor: "#f5e6a8",
  customCss: null,
  headingFont: "Inter",
  bodyFont: "Inter",
};

const PORTAL_THEME: PortalThemeConfig = {
  themePreset: "default",
  colorMode: "dark",
  primaryColor: "#d4af37",
  secondaryColor: "#f5e6a8",
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  headingFont: "Inter",
  bodyFont: "Inter",
  customCss: null,
  cssVariables: generateCssVariables(THEME_CONFIG),
  defaultLocale: "fr",
  enabledLocales: ["fr"],
  showLanguageSelector: false,
  headerStyle: "classic",
  headerTransparent: false,
  showPersonasBar: false,
  hidePersonasOnScroll: true,
  heroTemplate: "personas",
  heroMediaType: "image",
  heroMediaUrl: null,
  heroOverlayOpacity: "0.4",
  heroTitle: null,
  heroSubtitle: null,
  heroCtaText: null,
  heroCtaUrl: null,
  homepageSections: null,
};

const PORTAL_CONTEXT: PortalContextValue = {
  organization: ORGANIZATION,
  theme: PORTAL_THEME,
  locale: "fr",
};

export const metadata: Metadata = {
  title: {
    default: ORGANIZATION_NAME,
    template: `%s | ${ORGANIZATION_NAME}`,
  },
  description:
    "Le concours de référence dédié aux meilleurs CBD de France. Découvrez les médaillés, les producteurs, et les résultats de la Platinum CBD Cup.",
  keywords: [
    "Platinum CBD Cup",
    "CBD",
    "concours CBD",
    "compétition CBD",
    "cannabis CBD",
    "médailles CBD",
    "producteurs CBD",
    "France",
  ],
  authors: [{ name: ORGANIZATION_NAME }],
  creator: ORGANIZATION_NAME,
  publisher: ORGANIZATION_NAME,
  icons: [{ rel: "icon", url: "/favicon.png" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: ORGANIZATION_NAME,
    title: ORGANIZATION_NAME,
    description:
      "Le concours de référence dédié aux meilleurs CBD de France.",
    url: "https://platinumcbdcup.eu",
    images: [
      {
        url: "https://platinumcbdcup.eu/og.png?v=1",
        width: 1200,
        height: 630,
        alt: "Platinum CBD Cup — le concours de référence des meilleurs CBD de France",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ORGANIZATION_NAME,
    description:
      "Le concours de référence dédié aux meilleurs CBD de France.",
    images: ["https://platinumcbdcup.eu/og.png?v=1"],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

/**
 * Generate CSS style string from variables
 */
function generateStyleString(cssVariables: Record<string, string>): string {
  return Object.entries(cssVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const styleString = generateStyleString(PORTAL_THEME.cssVariables);

  // CSS variables only. Heading + body fonts are owned by the Platinum
  // design system (Louize Display / Geist Mono / Inter via platinumCSS).
  // The legacy `#portal-root h1-h6 !important` font override was a remnant
  // of the multi-tenant CupMetrics theming and was overriding `.display`
  // and `.section-title` with Inter — preventing Louize from ever rendering.
  const portalRootCss = `
#portal-root, #portal-root * {
  ${styleString}
}
${PORTAL_THEME.customCss ? sanitizeCustomCss(PORTAL_THEME.customCss) : ""}
`.trim();

  return (
    <html lang="fr" suppressHydrationWarning className={geist.variable}>
      <head>
        {/* Google Fonts — Geist Mono + Inter (Louize Display served from public/fonts) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-theme="dark" data-density="regular" data-matrix="on">
        {/* Platinum design-system CSS — :root vars, all utility classes, animations */}
        <style dangerouslySetInnerHTML={{ __html: platinumCSS }} />

        {/* Portal CSS variables (kept for components that consume --portal-* vars) */}
        <style dangerouslySetInnerHTML={{ __html: portalRootCss }} />

        {/* Dot matrix decorative background */}
        <div className="matrix" aria-hidden="true" />

        <Providers>
          <div
            id="portal-root"
            lang="fr"
          >
            <PortalProvider value={PORTAL_CONTEXT}>{children}</PortalProvider>
          </div>
        </Providers>
      </body>
    </html>
  );
}
