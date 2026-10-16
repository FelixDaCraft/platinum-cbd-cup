"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileBottomNav } from "~/components/portal/mobile/mobile-bottom-nav";
import { Instagram } from "lucide-react";
import { StreetDefs } from "~/components/portal/street/street";
import { ScrollReveal } from "~/components/portal/street/scroll-reveal";
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

const FOOTER_LINKS = [
  { href: "/about", label: "Le concours" },
  { href: "/cups", label: "Participer" },
  { href: "/palmares", label: "Palmarès" },
  { href: "/archives", label: "Éditions" },
  { href: "/reglement", label: "Règlement" },
  { href: "/articles", label: "Articles" },
  { href: "/press", label: "Presse" },
  { href: "/sponsors", label: "Partenaires" },
  { href: "/contact", label: "Contact" },
  { href: "/activate", label: "Activer un code juré" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
];

/** Réseaux sociaux de la cup ; ajouter ici les prochains comptes. */
const SOCIAL_LINKS = [
  {
    href: "https://www.instagram.com/platinum_cup_france/",
    label: "Instagram",
    handle: "@platinum_cup_france",
    Icon: Instagram,
  },
];

/**
 * Coquille du portail public (direction « street » 2027) : en-tête collant
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
      <StreetDefs />
      <ScrollReveal />
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
                data-hide-below={entry.hideBelow}
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

      <footer className="footer st-footer">
        <div className="st-footer-inner">
          <div className="st-footer-top">
            <div className="st-footer-brand">
              <span className="st-footer-name">Platinum CBD Cup</span>
              <p className="st-footer-tag">
                Le concours européen du CBD. Chaque produit est noté à l&apos;aveugle par un
                jury professionnel et par un jury public, depuis 2023.
              </p>
            </div>
            <div className="st-footer-links">
              <nav className="st-footer-nav" aria-label="Liens du pied de page">
                {FOOTER_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <ul className="st-footer-social" aria-label="Réseaux sociaux">
                {SOCIAL_LINKS.map(({ href, label, handle, Icon }) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                      <span>
                        <b>{label}</b>
                        {handle}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="st-footer-base">
            <span suppressHydrationWarning>© {year} Association Platinum CBD</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
