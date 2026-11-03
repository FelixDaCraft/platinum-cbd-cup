import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { hrefFor, type Locale } from "./locales";

/** Langue de la requête en cours (français hors segment `[locale]`). */
export async function currentLocale(): Promise<Locale> {
  return (await getLocale()) as Locale;
}

/**
 * `redirect` de Next vers un chemin interne, préfixé de la langue courante
 * (sauf routes non traduites comme `/dashboard`).
 */
export async function localizedRedirect(path: string): Promise<never> {
  redirect(hrefFor(path, await currentLocale()));
}
