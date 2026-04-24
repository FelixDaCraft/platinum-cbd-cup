"use client";

import { createContext, useContext } from "react";
import type { Locale } from "~/i18n/config";

/**
 * Portal context types for the single-tenant Platinum CBD Cup app.
 *
 * These types used to flow from the DB (organizations, portal_themes),
 * but the app is now single-tenant with a hardcoded theme injected by the
 * root layout. The shape is preserved so components using `usePortal()`,
 * `useOrganization()`, and `usePortalTheme()` keep working untouched.
 */

/**
 * Inlined color-mode union (previously from portal_themes schema)
 */
export type ColorMode = "light" | "dark";

/**
 * Inlined header-style union (previously from portal_themes schema)
 */
export type HeaderStyle =
  | "classic"
  | "modern"
  | "minimal"
  | "bold"
  | "centered"
  | "ultra-premium";

/**
 * Inlined hero-template union (previously from portal_themes schema)
 */
export type HeroTemplate =
  | "personas"
  | "countdown"
  | "split"
  | "minimal"
  | "video"
  | "immersive"
  | "story-stats"
  | "minimalist";

/**
 * Inlined hero-media-type union (previously from portal_themes schema)
 */
export type HeroMediaType = "image" | "video" | "gradient" | "color";

/**
 * Public-facing organization shape (previously from get-organization.ts).
 * For Platinum CBD Cup this is hardcoded in the root layout.
 */
export interface PublicOrganization {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: Date;
}

/**
 * Portal theme configuration.
 *
 * Single-tenant: hardcoded in root layout, never fetched.
 */
export interface PortalThemeConfig {
  themePreset: string;
  colorMode: ColorMode;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  // Typography - Google Fonts
  headingFont: string;
  bodyFont: string;
  customCss: string | null;
  cssVariables: Record<string, string>;
  // Language settings
  defaultLocale: Locale;
  enabledLocales: Locale[];
  showLanguageSelector: boolean;
  // Header & Navigation
  headerStyle: HeaderStyle;
  headerTransparent: boolean;
  showPersonasBar: boolean;
  hidePersonasOnScroll: boolean;
  // Hero Section
  heroTemplate: HeroTemplate;
  heroMediaType: HeroMediaType;
  heroMediaUrl: string | null;
  heroOverlayOpacity: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaText: string | null;
  heroCtaUrl: string | null;
  // Homepage Sections
  homepageSections: string | null;
}

/**
 * Portal context value
 */
export interface PortalContextValue {
  organization: PublicOrganization;
  theme: PortalThemeConfig;
  locale: Locale;
}

/**
 * Portal context for accessing organization and theme data
 */
export const PortalContext = createContext<PortalContextValue | null>(null);

/**
 * Hook to access portal context
 */
export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return context;
}

/**
 * Hook to access organization from portal context
 */
export function useOrganization(): PublicOrganization {
  return usePortal().organization;
}

/**
 * Hook to access theme from portal context
 */
export function usePortalTheme(): PortalThemeConfig {
  return usePortal().theme;
}

/**
 * Hook to access current locale from portal context
 */
export function usePortalLocale(): Locale {
  return usePortal().locale;
}
