import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Hanken_Grotesk } from "next/font/google";

// L'URL de base était recopiée ici aussi (metadataBase, openGraph.url et les
// deux images de partage en dur sur platinumcbdcup.eu) : sur un
// environnement de préproduction, les cartes de partage pointaient vers la
// production. Même point unique que robots.ts, sitemap.ts et les pages.
import { baseUrl, canonical, OG_IMAGE_PAR_DEFAUT } from "./(portal)/_lib/seo";

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
  headingFont: "Hanken Grotesk",
  bodyFont: "Hanken Grotesk",
};

const PORTAL_THEME: PortalThemeConfig = {
  themePreset: "default",
  colorMode: "dark",
  primaryColor: "#d4af37",
  secondaryColor: "#f5e6a8",
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  headingFont: "Hanken Grotesk",
  bodyFont: "Hanken Grotesk",
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
  // Sans elle, Next résout toute image Open Graph relative contre
  // http://localhost:3000 (avertissement au build, carte de partage cassée).
  metadataBase: new URL(baseUrl()),
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
  // Manifeste et icône iOS : ils étaient injectés depuis un effet client
  // (PWAProvider), donc absents du HTML initial — et ce composant n'est
  // monté que dans les coquilles authentifiées (jury, producteur,
  // organisateur). Le portail public n'a donc jamais déclaré de manifeste :
  // aucune proposition « ajouter à l'écran d'accueil », et iOS retombait sur
  // une capture d'écran en guise d'icône. Déclarés ici, ils partent avec le
  // document, pour toutes les pages.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Platinum Cup",
  },
  // C'est l'inverse de ce qu'on croit : `appleWebApp.capable` fait poser à Next
  // la forme STANDARD `mobile-web-app-capable` (AppleWebAppMeta dans
  // next/dist/lib/metadata/generate/basic.js), pas la préfixée. La redéclarer
  // ici produisait une seconde balise identique — `MetaFilter` ne dédoublonne
  // pas. La seule que Next n'émette par aucun chemin est la variante Apple,
  // dépréciée mais toujours lue par iOS : c'est donc elle qui va ici.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
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
    url: canonical(),
    images: [OG_IMAGE_PAR_DEFAUT],
  },
  twitter: {
    card: "summary_large_image",
    title: ORGANIZATION_NAME,
    description:
      "Le concours de référence dédié aux meilleurs CBD de France.",
    images: [OG_IMAGE_PAR_DEFAUT.url],
  },
};

/**
 * Couleur de barre d'adresse, déclarée pour tout le site.
 *
 * Elle était posée par un effet client : sur mobile, la barre s'affichait
 * d'abord en couleur système puis basculait en doré une fois le JS exécuté.
 * `width` / `initialScale` sont repris explicitement — et toujours sans
 * `maximumScale` ni `userScalable: false`, le pinch-zoom devant rester
 * possible (WCAG 1.4.4).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PORTAL_THEME.primaryColor,
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

/**
 * Hanken Grotesk (texte et titres du portail, direction « Grand Cru ») et
 * Geist Mono (codes et chiffres ponctuels).
 *
 * Elles arrivaient par un <link rel="stylesheet"> vers fonts.googleapis.com :
 * une résolution DNS + un handshake TLS vers un tiers, bloquants avant le
 * premier rendu. next/font les auto-héberge, génère le @font-face à la
 * compilation et pose lui-même les <link rel="preload"> sur les .woff2.
 *
 * Les deux sont chargées en fonte variable (aucun `weight` déclaré) : un seul
 * fichier couvre toute la plage 100-900 utilisée par le design system, là où
 * l'ancienne feuille Google en téléchargeait une par graisse.
 */
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

/**
 * Branche les familles auto-hébergées sur les variables du design system.
 *
 * platinumCSS déclare `--sans: "Hanken Grotesk", …` et `--mono: "Geist Mono", …` avec
 * les noms littéraux des polices Google. Cette surcharge doit être injectée
 * APRÈS platinumCSS (même spécificité, la dernière règle gagne). Les noms
 * littéraux restent en repli : si une autre feuille charge encore la police,
 * le rendu est identique.
 */
const fontVariablesCss = `
:root{
  --sans: var(--font-hanken), "Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --mono: var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
`.trim();

/**
 * Generate CSS style string from variables
 */
function generateStyleString(cssVariables: Record<string, string>): string {
  return Object.entries(cssVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

/**
 * Le nonce est relu dans l'en-tête de requête que le middleware a posé — le
 * même que Next consulte pour nonce-er ses propres balises. Il n'existe que
 * pour next-themes, dont le script d'initialisation du thème est injecté par
 * la bibliothèque et échappe donc à Next : sans lui, ce script serait le seul
 * de l'application à ne pas porter le nonce, il apparaîtrait dans chaque
 * signalement de la CSP Report-Only, et il serait bloqué au basculement — le
 * site s'afficherait alors en thème clair le temps de l'hydratation.
 *
 * Coût mesuré de ce `headers()` : la seule page qui perd son rendu statique
 * est /_not-found. Le portail est déjà dynamique sur 96 routes sur 99, ses
 * données venant de la base.
 */
async function lireNonce(): Promise<string | undefined> {
  const csp = (await headers()).get("content-security-policy");
  return csp?.match(/'nonce-([^']+)'/)?.[1];
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = await lireNonce();
  const styleString = generateStyleString(PORTAL_THEME.cssVariables);

  // CSS variables only. Heading + body fonts are owned by the Platinum
  // design system (Hanken Grotesk, Louize Display pour le logo, via platinumCSS).
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
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geist.variable} ${hanken.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Louize Display — logo et nom de la cup, au-dessus de la ligne de flottaison.
            Déclarée en @font-face à l'intérieur de platinumCSS, elle n'est
            donc découverte qu'après l'analyse de ce bloc : sans preload, les
            titres s'affichaient d'abord en serif système puis basculaient
            (FOUT + décalage de mise en page). */}
        <link
          rel="preload"
          as="font"
          type="font/ttf"
          href="/fonts/LouizeDisplay-BoldItalic.ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body data-theme="dark" data-density="regular" data-matrix="on">
        {/* Platinum design-system CSS — :root vars, all utility classes, animations */}
        <style dangerouslySetInnerHTML={{ __html: platinumCSS }} />

        {/* Familles auto-hébergées branchées sur --sans / --mono (après platinumCSS) */}
        <style dangerouslySetInnerHTML={{ __html: fontVariablesCss }} />

        {/* Portal CSS variables (kept for components that consume --portal-* vars) */}
        <style dangerouslySetInnerHTML={{ __html: portalRootCss }} />

        {/* Dot matrix decorative background */}
        <div className="matrix" aria-hidden="true" />

        <Providers nonce={nonce}>
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
