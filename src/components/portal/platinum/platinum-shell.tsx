"use client";

import { Suspense, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "~/i18n/navigation";
import { MobileBottomNav } from "~/components/portal/mobile/mobile-bottom-nav";
import { Instagram } from "lucide-react";
import { StreetDefs } from "~/components/portal/street/street";
import { ScrollReveal } from "~/components/portal/street/scroll-reveal";
import { useSession } from "~/lib/auth-client";
import { currentEdition } from "./edition";
import { accountHref, isNavActive, PORTAL_NAV } from "./nav";
import { LanguageSwitcher } from "./language-switcher";

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

/** Libellés : espace de messages `nav`. */
const FOOTER_LINKS = [
  { href: "/about", label: "about" },
  { href: "/cups", label: "participate" },
  { href: "/palmares", label: "palmares" },
  { href: "/archives", label: "editions" },
  { href: "/reglement", label: "rules" },
  { href: "/articles", label: "articles" },
  { href: "/press", label: "press" },
  { href: "/sponsors", label: "partners" },
  { href: "/contact", label: "contact" },
  { href: "/activate", label: "activateJury" },
  { href: "/mentions-legales", label: "legal" },
  { href: "/confidentialite", label: "privacy" },
] as const;

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
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");

  return (
    <div className="shell">
      <StreetDefs />
      <ScrollReveal />
      {/* Lien d'évitement : premier élément focalisable de la page. */}
      <a href="#contenu-principal" className="skip-link">
        {t("skipToContent")}
      </a>

      <header className="topbar">
        <Link href="/" className="brand" aria-label={t("homeAria")}>
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

        <nav className="nav" aria-label={t("mainNav")}>
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
                {tNav(entry.label)}
              </Link>
            );
          })}
        </nav>

        {/* Hors de .topbar-right, masqué sous 880 px : le sélecteur reste
            visible sur mobile, à droite du logo. */}
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>

        <div className="topbar-right">
          <Link href={accountHref(role)} className="topbar-link">
            {session?.user ? tNav("mySpace") : tNav("signIn")}
          </Link>
          {isLive ? (
            <Link href="/cups" className="btn accent">
              {tNav("registerProducts")}
            </Link>
          ) : (
            <Link href="/palmares" className="btn ghost">
              {tNav("seePalmares")}
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
              <p className="st-footer-tag">{t("footerTag")}</p>
            </div>
            <div className="st-footer-links">
              <nav className="st-footer-nav" aria-label={t("footerNav")}>
                {FOOTER_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {tNav(link.label)}
                  </Link>
                ))}
              </nav>
              <ul className="st-footer-social" aria-label={t("social")}>
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
            <span suppressHydrationWarning>{t("copyright", { year })}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
