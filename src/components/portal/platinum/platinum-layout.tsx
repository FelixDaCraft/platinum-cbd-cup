"use client";

import Link from "next/link";
import { platinumCSS } from "./platinum-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatinumLayoutProps {
  children: React.ReactNode;
  /** Display name of the organization */
  orgName: string;
  /** Absolute URL of the org logo, or null to show a text monogram */
  logoUrl: string | null;
  /**
   * ID of the currently active cup.
   * When provided an "Inscription" link pointing to the cup's registration
   * page is added to the navigation.
   */
  currentCupId: string | null;
  /**
   * Current route pathname (e.g. "/cups") used to highlight the active
   * nav item.  Pass `usePathname()` from next/navigation at the call site.
   */
  pathname: string;
}

// ---------------------------------------------------------------------------
// Navigation definition
// ---------------------------------------------------------------------------

type NavItem = {
  label: string;
  /** Either a fixed href or a function that returns one */
  href: string;
  /** If true this item is only rendered when `currentCupId` is present */
  requiresCupId?: boolean;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/" },
  { label: "Cup", href: "/cups" },
  {
    label: "Inscription",
    href: "/cups/:cupId/register",
    requiresCupId: true,
  },
  { label: "Palmarès", href: "/palmares" },
];

function resolveHref(item: NavItem, currentCupId: string | null): string {
  if (item.requiresCupId && currentCupId) {
    return item.href.replace(":cupId", currentCupId);
  }
  return item.href;
}

function isActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/") return pathname === "/";
  return pathname.startsWith(itemHref);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatinumLayout({
  children,
  orgName,
  logoUrl,
  currentCupId,
  pathname,
}: PlatinumLayoutProps) {
  const currentYear = new Date().getFullYear();

  const navItems = BASE_NAV_ITEMS.filter(
    (item) => !item.requiresCupId || currentCupId !== null
  );

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Font imports                                                         */}
      {/* ------------------------------------------------------------------ */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Scoped design-system styles                                          */}
      {/* ------------------------------------------------------------------ */}
      <style dangerouslySetInnerHTML={{ __html: platinumCSS }} />

      {/* ------------------------------------------------------------------ */}
      {/* Root wrapper — all pt-* selectors are scoped to this element         */}
      {/* ------------------------------------------------------------------ */}
      <div className="platinum-portal">
        {/* Dot-matrix decorative background */}
        <div className="pt-matrix" aria-hidden="true" />

        {/* ---------------------------------------------------------------- */}
        {/* Top navigation bar                                                */}
        {/* ---------------------------------------------------------------- */}
        <header className="pt-topbar">
          {/* Brand */}
          <Link href="/" className="pt-brand">
            <span className="pt-brand-mark">
              {logoUrl ? (
                <img src={logoUrl} alt={orgName} />
              ) : (
                <span
                  style={{
                    width: 34,
                    height: 34,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 8,
                    background: "var(--pt-accent-dim)",
                    border: "1px solid var(--pt-accent)",
                    color: "var(--pt-accent)",
                    fontFamily: "var(--pt-mono)",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {orgName.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span>{orgName}</span>
          </Link>

          {/* Navigation pills */}
          <nav className="pt-nav" aria-label="Navigation principale">
            {navItems.map((item) => {
              const href = resolveHref(item, currentCupId);
              const active = isActive(href, pathname);
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={active ? "active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Live indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--pt-mono)",
              fontSize: 11,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--pt-fg-3)",
            }}
            aria-hidden="true"
          >
            <span className="pt-live-dot" />
            <span>Live</span>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Page content                                                       */}
        {/* ---------------------------------------------------------------- */}
        <main
          className="pt-page pt-page-enter"
          style={{ position: "relative", zIndex: 1 }}
        >
          {children}
        </main>

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                             */}
        {/* ---------------------------------------------------------------- */}
        <footer className="pt-footer">
          <span>
            &copy; {currentYear} {orgName}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pt-live-dot" />
            Platinum CBD Cup
          </span>
          <nav
            style={{ display: "flex", gap: 20 }}
            aria-label="Liens de pied de page"
          >
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Accueil
            </Link>
            <Link
              href="/cups"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Cups
            </Link>
            <Link
              href="/palmares"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Palmarès
            </Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
