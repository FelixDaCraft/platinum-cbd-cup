"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Nav definition — 4 segmented buttons per design
// ---------------------------------------------------------------------------

type NavEntry = {
  idx: string;
  label: string;
  href: string;
  /** pathname prefix that marks this entry active */
  match: string;
  /** live indicator label shown on the right when this route is active */
  liveLabel: string;
};

const NAV: NavEntry[] = [
  { idx: "01", label: "Index", href: "/", match: "/", liveLabel: "LIVE" },
  { idx: "02", label: "Cup", href: "/cups", match: "/cups", liveLabel: "ED·03" },
  { idx: "03", label: "Enter", href: "/cups", match: "/cups/", liveLabel: "SUBMIT" },
  { idx: "04", label: "Results", href: "/palmares", match: "/palmares", liveLabel: "LEDGER" },
  { idx: "05", label: "Manifesto", href: "/about", match: "/about", liveLabel: "STANCE" },
];

function isActive(entry: NavEntry, pathname: string): boolean {
  if (entry.match === "/") return pathname === "/";
  return pathname.startsWith(entry.match);
}

function getLiveLabel(pathname: string): string {
  // More specific matches first
  if (/\/cups\/[^/]+\/register/.test(pathname)) return "SUBMIT";
  if (pathname.startsWith("/palmares")) return "LEDGER";
  if (pathname.startsWith("/about")) return "STANCE";
  if (pathname.startsWith("/cups")) return "ED·03";
  if (pathname === "/") return "LIVE";
  return "ED·03";
}

// ---------------------------------------------------------------------------
// PlatinumShell
// ---------------------------------------------------------------------------

interface PlatinumShellProps {
  children: ReactNode;
}

/**
 * Public-facing layout shell for the Platinum CBD Cup portal.
 *
 * Renders the sticky topbar (brand + 4-item segmented nav + live indicator),
 * a <main class="page"> wrapper, and a footer with legal links.
 *
 * Uses .topbar / .nav / .brand / .page / .footer / .live / .live-dot CSS
 * classes defined in platinum-styles.ts — all on :root, no scoping.
 *
 * Must be used inside a parent that has `data-theme="dark"` on <body>
 * and a `.matrix` div sibling (both set in root layout).
 */
export function PlatinumShell({ children }: PlatinumShellProps) {
  const pathname = usePathname();
  const liveLabel = getLiveLabel(pathname);
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
            <span>Independent · ed. 03 · 2026</span>
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

        {/* Live indicator */}
        <div className="topbar-right" aria-hidden="true">
          <div className="live">
            <span className="live-dot" />
            <span>{liveLabel}</span>
          </div>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────── */}
      <main className="page page-enter">{children}</main>

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
