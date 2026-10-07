"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "~/lib/auth-client";
import { accountHref, isNavActive } from "~/components/portal/platinum/nav";

/**
 * Navigation basse du mobile (≤ 880 px) : les entrées les plus utilisées,
 * avec les mêmes libellés que l'en-tête bureau. Le reste du menu (Le
 * concours, Éditions, Presse) est accessible depuis le pied de page.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const entries = [
    { label: "Accueil", href: "/", match: "/" },
    { label: "Participer", href: "/cups", match: "/cups" },
    { label: "Palmarès", href: "/palmares", match: "/palmares" },
    {
      label: session?.user ? "Mon espace" : "Connexion",
      href: accountHref(role),
      match: "/login",
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale mobile">
      {entries.map((entry) => {
        const active = isNavActive(entry, pathname);
        return (
          <Link
            key={entry.label}
            href={entry.href}
            className={`mobile-bottom-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-bottom-nav__label">{entry.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
