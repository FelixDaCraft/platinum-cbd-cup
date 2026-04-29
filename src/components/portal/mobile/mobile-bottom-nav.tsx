"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavEntry {
  idx: string;
  label: string;
  href: string;
  match: string;
}

const NAV: NavEntry[] = [
  { idx: "01", label: "Home", href: "/", match: "/" },
  { idx: "02", label: "Cup", href: "/cups", match: "/cups" },
  { idx: "03", label: "Enter", href: "/cups", match: "/cups/" },
  { idx: "04", label: "Results", href: "/palmares", match: "/palmares" },
  { idx: "05", label: "About", href: "/about", match: "/about" },
];

function isActive(entry: NavEntry, pathname: string): boolean {
  if (entry.match === "/") return pathname === "/";
  return pathname.startsWith(entry.match);
}

/**
 * Bottom segmented navigation for mobile (≤880px).
 *
 * 5 equal segments edge-to-edge, position fixed on the bottom of the
 * viewport with safe-area-inset handling. Active item is gold with a
 * 2px top accent bar; inactive items are muted. Hidden via CSS at
 * desktop breakpoints — desktop continues to use the segmented topbar
 * nav rendered by `PlatinumShell`.
 *
 * Uses the existing `--bg / --accent / --fg / --line` tokens so it
 * inherits theme switching automatically.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Navigation principale mobile"
    >
      {NAV.map((entry) => {
        const active = isActive(entry, pathname);
        return (
          <Link
            key={entry.idx}
            href={entry.href}
            className={`mobile-bottom-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-bottom-nav__idx">{entry.idx}</span>
            <span className="mobile-bottom-nav__label">{entry.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
