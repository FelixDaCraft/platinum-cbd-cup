"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileBottomNav } from "~/components/portal/mobile/mobile-bottom-nav";

// ---------------------------------------------------------------------------
// Nav definition — 4 segmented buttons per design
// ---------------------------------------------------------------------------

type NavEntry = {
  idx: string;
  label: string;
  href: string;
  /** pathname prefix that marks this entry active */
  match: string;
};

const NAV: NavEntry[] = [
  { idx: "01", label: "Index", href: "/", match: "/" },
  { idx: "02", label: "Cup", href: "/cups", match: "/cups" },
  { idx: "03", label: "Enter", href: "/cups", match: "/cups/" },
  { idx: "04", label: "Results", href: "/palmares", match: "/palmares" },
  { idx: "05", label: "Manifesto", href: "/about", match: "/about" },
];

function isActive(entry: NavEntry, pathname: string): boolean {
  if (entry.match === "/") return pathname === "/";
  return pathname.startsWith(entry.match);
}

// ---------------------------------------------------------------------------
// PlatinumShell
// ---------------------------------------------------------------------------

interface PlatinumShellProps {
  children: ReactNode;
  /**
   * System-wide activity status driving the topbar indicator:
   * - "live" → registrations open or rating phase active, glowing pulse + LIVE
   * - "idle" → nothing happening, glowing crosshair + WAITING FOR SIGNAL
   */
  liveStatus?: "live" | "idle";
}

/**
 * Public-facing layout shell for the Platinum CBD Cup portal.
 *
 * Renders the sticky topbar (brand + 5-item segmented nav + live indicator),
 * a <main class="page"> wrapper, and a footer with legal links.
 *
 * Uses .topbar / .nav / .brand / .page / .footer / .live / .live-dot
 * / .live-crosshair CSS classes defined in platinum-styles.ts.
 *
 * Must be used inside a parent that has `data-theme="dark"` on <body>
 * and a `.matrix` div sibling (both set in root layout).
 */
export function PlatinumShell({ children, liveStatus = "idle" }: PlatinumShellProps) {
  const pathname = usePathname();
  const isLive = liveStatus === "live";
  const liveLabel = isLive ? "LIVE" : "WAITING FOR SIGNAL";
  const year = new Date().getFullYear();

  return (
    <div className="shell">
      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="topbar">
        {/* Brand */}
        <Link href="/" className="brand" aria-label="Platinum CBD Cup — Accueil">
          <span className="brand-mark">
            <img
              src="/brand/platinum-cbd-cup-logo.png"
              alt="Platinum CBD Cup"
              width={34}
              height={34}
            />
          </span>
          <span className="brand-text">
            <b>Platinum CBD Cup</b>
            <span>Independent · ed. 04 · 2026</span>
          </span>
        </Link>

        {/* Segmented nav */}
        <nav className="nav" aria-label="Navigation principale">
          {NAV.map((entry) => {
            const active = isActive(entry, pathname);
            return (
              <Link
                key={entry.idx}
                href={entry.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {entry.idx} {entry.label}
              </Link>
            );
          })}
        </nav>

        {/* Live indicator — global system activity */}
        <div className="topbar-right" aria-hidden="true">
          <div className="live">
            {isLive ? (
              <span className="live-dot" />
            ) : (
              <span className="live-crosshair" />
            )}
            <span>{liveLabel}</span>
          </div>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────── */}
      <main className="page page-enter">{children}</main>

      {/* ── Mobile-only bottom navigation (≤880px) ─────────── */}
      <MobileBottomNav />

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="footer">
        <span>© {year} · Platinum CBD Cup · Independent ledger</span>

        <nav
          style={{ display: "flex", gap: 20, alignItems: "center" }}
          aria-label="Liens légaux"
        >
          <Link
            href="/about"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Manifesto
          </Link>
          <Link
            href="/press"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Presse
          </Link>
          <Link
            href="/contact"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Contact
          </Link>
        </nav>

        <span style={{ color: "var(--fg-3)", letterSpacing: ".08em" }}>
          EU · INDEPENDENT · BLIND PANEL
        </span>
      </footer>
    </div>
  );
}
