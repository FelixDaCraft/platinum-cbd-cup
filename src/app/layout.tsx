import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Providers } from "~/components/providers";
import { PortalProvider } from "~/lib/portal/portal-provider";
import type { PortalContextValue, PortalThemeConfig } from "~/lib/portal/context";
import { generateCssVariables, sanitizeCustomCss } from "~/lib/portal/css-variables";
import { FontLoader } from "~/components/portal/font-loader";
import { platinumCSS } from "~/components/portal/platinum/platinum-styles";

/**
 * Static organization identity for Platinum CBD Cup
 *
 * Single-tenant app — no DB lookup, no subdomain routing.
 */
const ORGANIZATION_NAME = "Platinum CBD Cup";
const ORGANIZATION_SLUG = "platinum-cbd-cup";
const ORGANIZATION_ID = "platinum-cbd-cup";

const ORGANIZATION = {
  id: ORGANIZATION_ID,
  name: ORGANIZATION_NAME,
  slug: ORGANIZATION_SLUG,
  logo: null,
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
    "Le concours de référence dédié aux meilleurs CBD de France. Découvrez les médaillés, les producteurs, et les résultats du Platinum CBD Cup.",
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
  },
  twitter: {
    card: "summary_large_image",
    title: ORGANIZATION_NAME,
    description:
      "Le concours de référence dédié aux meilleurs CBD de France.",
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

  // CSS variables + portal-root font scoping (kept for parity with previous portal layout).
  const portalRootCss = `
#portal-root, #portal-root * {
  ${styleString}
}
#portal-root h1, #portal-root h2, #portal-root h3, #portal-root h4, #portal-root h5, #portal-root h6 {
  font-family: var(--portal-heading-font) !important;
}
#portal-root {
  font-family: var(--portal-body-font) !important;
}
#portal-root p, #portal-root span, #portal-root div, #portal-root a, #portal-root li, #portal-root td, #portal-root th {
  font-family: inherit;
}
${PORTAL_THEME.customCss ? sanitizeCustomCss(PORTAL_THEME.customCss) : ""}
`.trim();

  return (
    <html lang="fr" suppressHydrationWarning className={geist.variable}>
      <body>
        {/* Load Louize Display (Platinum headline font) — see platinum-styles.ts */}
        <FontLoader fonts={["Louize Display"]} />

        {/* Platinum design-system CSS (dark + gold theme, scoped to .platinum-portal) */}
        <style dangerouslySetInnerHTML={{ __html: platinumCSS }} />

        {/* Portal CSS variables (kept for components that consume --portal-* vars) */}
        <style dangerouslySetInnerHTML={{ __html: portalRootCss }} />

        <Providers>
          <div
            id="portal-root"
            className="min-h-screen antialiased"
            style={{
              backgroundColor: `hsl(${PORTAL_THEME.cssVariables["--portal-background"]})`,
              color: `hsl(${PORTAL_THEME.cssVariables["--portal-foreground"]})`,
            }}
            lang="fr"
          >
            <PortalProvider value={PORTAL_CONTEXT}>{children}</PortalProvider>
          </div>
        </Providers>
      </body>
    </html>
  );
}
