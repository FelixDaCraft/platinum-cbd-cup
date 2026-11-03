import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { buildMessages } from "./messages";

/**
 * Configuration par requête. Hors segment `[locale]` (back-office,
 * routes API), aucune langue n'est transmise : on reste en français.
 *
 * Les messages français servent de base à chaque langue : une clé oubliée
 * dans une traduction s'affiche en français au lieu de casser la page.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = buildMessages(locale);

  return {
    locale,
    messages,
    timeZone: "Europe/Paris",
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
