import { createElement, type ComponentProps } from "react";
import NextLink from "next/link";
import { createNavigation } from "next-intl/navigation";
import { isLocalizedRoute } from "./locales";
import { routing } from "./routing";

const intl = createNavigation(routing);

/**
 * `redirect`, `useRouter`, `usePathname`… conscients de la langue : un href
 * interne (`/palmares`) reçoit le préfixe de la langue courante, et
 * `usePathname` renvoie le chemin sans préfixe.
 */
export const { redirect, usePathname, useRouter, getPathname } = intl;

/**
 * Lien interne conscient de la langue. Les routes restées hors traduction
 * (back-office `/dashboard`, API, fichiers téléversés) gardent un lien
 * Next ordinaire : un préfixe `/en/dashboard` mènerait à une 404.
 */
export function Link(props: ComponentProps<typeof intl.Link>) {
  const { href } = props;
  const path = typeof href === "string" ? href : href.pathname;
  if (typeof path === "string" && path.startsWith("/") && !isLocalizedRoute(path)) {
    const { locale: _locale, ...rest } = props;
    return createElement(NextLink, rest as ComponentProps<typeof NextLink>);
  }
  return createElement(intl.Link, props);
}
