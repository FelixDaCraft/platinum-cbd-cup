import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "~/i18n/routing";
import { ogLocale, locales, type Locale } from "~/i18n/locales";
import { alternatesFor } from "./(portal)/_lib/seo";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Métadonnées communes à toutes les pages traduites : description dans la
 * langue, `og:locale`, et balises hreflang de la page courante (le
 * middleware transmet son chemin sans préfixe dans `x-pathname`). Une page
 * qui déclare ses propres `alternates` les remplace.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const path = (await headers()).get("x-pathname") ?? "/";
  const description = t("description");
  return {
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      locale: ogLocale(locale),
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale(l)),
      description,
    },
    twitter: { description },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  // Les messages de la langue (déjà fusionnés sur le français) suivent
  // automatiquement vers les composants client.
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
