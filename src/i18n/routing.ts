import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

/**
 * Routage par langue.
 *
 * `as-needed` : le français, langue d'origine, garde ses URL sans préfixe
 * (`/palmares`) — aucun lien existant, favori ou référencement n'est cassé.
 * Les autres langues sont préfixées (`/en/palmares`). Un `/fr/...` explicite
 * redirige vers la forme nue.
 *
 * Le cookie NEXT_LOCALE mémorise le choix fait dans le sélecteur ; à défaut,
 * la langue est négociée sur Accept-Language (voir middleware.ts).
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: {
    name: "NEXT_LOCALE",
    // Un an : un choix de langue explicite n'a pas à être refait à chaque visite.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
  // Les balises hreflang sont posées dans le <head> par generateMetadata
  // (alternates.languages) : l'en-tête Link de next-intl ferait doublon.
  alternateLinks: false,
});
