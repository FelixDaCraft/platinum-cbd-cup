import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ogLocale } from "~/i18n/locales";
import { currentLocale } from "~/i18n/server";
import { alternatesFor, localizedCanonical, OG_IMAGE_PAR_DEFAUT } from "./seo";

/**
 * Métadonnées d'une page du portail dans la langue courante : titre et
 * description lus dans `<namespace>.metaTitle` / `.metaDescription`,
 * canonique et hreflang de `path`.
 *
 * Next ne fusionne pas `openGraph` avec celui du layout : le bloc est donc
 * complet ici (image comprise), voir OG_IMAGE_PAR_DEFAUT.
 */
export async function localizedMetadata(
  path: string,
  namespace: string,
  overrides: Metadata = {}
): Promise<Metadata> {
  const locale = await currentLocale();
  const t = await getTranslations(namespace);
  const title = t("metaTitle");
  const description = t("metaDescription");
  return {
    title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      title: `${title} | Platinum CBD Cup`,
      description,
      url: localizedCanonical(path, locale),
      locale: ogLocale(locale),
      images: [OG_IMAGE_PAR_DEFAUT],
    },
    ...overrides,
  };
}
