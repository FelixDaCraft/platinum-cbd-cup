"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileBottomNav } from "~/components/portal/mobile/mobile-bottom-nav";
import { useSession } from "~/lib/auth-client";
import { currentEdition } from "./edition";
import { accountHref, isNavActive, PORTAL_NAV } from "./nav";

// ---------------------------------------------------------------------------
// PlatinumShell
// ---------------------------------------------------------------------------

interface PlatinumShellProps {
  children: ReactNode;
  /**
   * Activité de la plateforme : « live » quand une édition prend des
   * inscriptions ou est en notation. Le bouton principal de l'en-tête en
   * dépend : inscrire ses produits, ou consulter le palmarès.
   */
  liveStatus?: "live" | "idle";
}

/**
 * Coquille du portail public (direction « Grand Cru ») : en-tête collant
 * (logo, navigation, compte, bouton principal), contenu, pied de page, et
 * barre de navigation basse sur mobile.
 */
export function PlatinumShell({ children, liveStatus = "idle" }: PlatinumShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { year } = currentEdition();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isLive = liveStatus === "live";

  return (
    <div className="shell">
      {/* Lien d'évitement : premier élément focalisable de la page. */}
      <a href="#contenu-principal" className="skip-link">
        Aller au contenu
      </a>

      <header className="topbar">
        <Link href="/" className="brand" aria-label="Platinum CBD Cup — Accueil">
          <span className="brand-mark">
            <img
              src="/brand/platinum-cbd-cup-logo.png"
              alt=""
              width={36}
              height={36}
              decoding="async"
            />
          </span>
          <span className="brand-name">Platinum CBD Cup</span>
        </Link>

        <nav className="nav" aria-label="Navigation principale">
          {PORTAL_NAV.map((entry) => {
            const active = isNavActive(entry, pathname);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {entry.label}
              </Link>
            );
          })}
        </nav>

        <div className="topbar-right">
          <Link href={accountHref(role)} className="topbar-link">
            {session?.user ? "Mon espace" : "Se connecter"}
          </Link>
          {isLive ? (
            <Link href="/cups" className="btn accent">
              Inscrire mes produits
            </Link>
          ) : (
            <Link href="/palmares" className="btn ghost">
              Voir le palmarès
            </Link>
          )}
        </div>
      </header>

      {/* tabIndex=-1 : sans lui, la cible du lien d'évitement reçoit le focus
          du navigateur mais pas celui du clavier sur WebKit. */}
      <main id="contenu-principal" tabIndex={-1} className="page page-enter">
        {children}
      </main>

      <MobileBottomNav />

      <footer className="footer">
        <span className="brand-name" style={{ fontSize: 20, color: "var(--fg)" }}>
          Platinum CBD Cup
        </span>

        <nav
          style={{ display: "flex", gap: "10px 24px", alignItems: "center", flexWrap: "wrap" }}
          aria-label="Liens du pied de page"
        >
          {[
            { href: "/about", label: "Le manifeste" },
            { href: "/reglement", label: "Règlement" },
            { href: "/press", label: "Presse" },
            { href: "/sponsors", label: "Partenaires" },
            { href: "/contact", label: "Contact" },
            { href: "/mentions-legales", label: "Mentions légales" },
            { href: "/confidentialite", label: "Confidentialité" },
          ].map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <span suppressHydrationWarning>© {year} Association Platinum CBD</span>
      </footer>
    </div>
  );
}
