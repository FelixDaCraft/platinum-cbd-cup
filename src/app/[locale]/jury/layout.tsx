import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Platinum CBD Cup — Jury",
  description: "Espace jury - Notez les produits en compétition",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jury",
  },
};

// Pas de maximumScale ni userScalable: false — le pinch-zoom doit rester
// possible (WCAG 1.4.4), l'espace jury étant utilisé sur tablette pendant les
// dégustations. Le zoom auto d'iOS au focus est évité par des inputs >= 16px.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Outer Jury Layout
 * Provides shared metadata for all jury pages.
 * Access control is handled by the (auth) route group layout,
 * allowing public pages like jury/public/[token] to be accessible
 * without an existing jury profile.
 */
export default function JuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
