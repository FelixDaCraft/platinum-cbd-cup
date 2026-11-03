import { isLocale, localeFromPathname, pickLocale, type Locale } from "~/i18n/locales";

/**
 * Langue d'un e-mail d'authentification, par ordre de fiabilité :
 * 1. la page d'où part la demande : le lien Better Auth porte l'URL de
 *    retour (`callbackURL` / `redirectTo`), préfixée de la langue ;
 * 2. le choix explicite mémorisé (cookie NEXT_LOCALE) ;
 * 3. la langue enregistrée sur le compte ;
 * 4. la langue du navigateur.
 */
export function emailLocale(input: {
  url?: string | null;
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
  stored?: string | null;
}): Locale {
  const fromUrl = callbackLocale(input.url);
  if (fromUrl) return fromUrl;
  const cookie = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(input.cookieHeader ?? "")?.[1];
  if (isLocale(cookie)) return cookie;
  if (isLocale(input.stored)) return input.stored;
  return pickLocale({ acceptLanguage: input.acceptLanguage });
}

function callbackLocale(url: string | null | undefined): Locale | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "http://local");
    const target = parsed.searchParams.get("callbackURL") ?? parsed.searchParams.get("redirectTo");
    if (!target) return null;
    const path = new URL(target, "http://local").pathname;
    return localeFromPathname(path);
  } catch {
    return null;
  }
}

/** Raccourci pour les callbacks Better Auth, qui reçoivent la requête. */
export function emailLocaleFromRequest(
  url: string,
  request: Request | undefined,
  stored?: string | null
): Locale {
  return emailLocale({
    url,
    cookieHeader: request?.headers.get("cookie"),
    acceptLanguage: request?.headers.get("accept-language"),
    stored,
  });
}
