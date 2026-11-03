import { createTranslator } from "next-intl";
import { buildMessages } from "./messages";
import { intlLocale, type Locale } from "./locales";

/**
 * Traducteur hors rendu de page (e-mails, PDF, routes API), pour une
 * langue donnée. Même catalogue et même repli sur le français que les pages.
 */
export function translatorFor(locale: Locale, namespace: string) {
  return createTranslator({
    locale: intlLocale(locale),
    messages: buildMessages(locale),
    namespace,
    timeZone: "Europe/Paris",
    // Une clé manquante dans un e-mail ne doit pas faire échouer l'envoi.
    onError: () => {},
    getMessageFallback: ({ namespace: ns, key }) => [ns, key].filter(Boolean).join("."),
  }) as (key: string, values?: Record<string, string | number | Date>) => string;
}
