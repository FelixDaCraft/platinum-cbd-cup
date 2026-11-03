"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "~/i18n/navigation";
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
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");

  const entries = [
    { label: t("home"), href: "/", match: "/" },
    { label: t("participate"), href: "/cups", match: "/cups" },
    { label: t("palmares"), href: "/palmares", match: "/palmares" },
    {
      label: session?.user ? t("mySpace") : t("login"),
      href: accountHref(role),
      match: "/login",
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label={tShell("mobileNav")}>
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
