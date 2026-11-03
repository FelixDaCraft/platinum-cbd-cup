import { defaultLocale, locales, type Locale } from "./locales";
import { catalog } from "../../messages";

/**
 * Catalogue de messages : un fichier JSON par espace de noms (`messages/
 * nav.json`…), chacun portant les sept langues côte à côte pour qu'une
 * traduction se relise en regard du français.
 */
export type MessageTree = { [key: string]: string | MessageTree };
export type Catalog = Record<string, Partial<Record<Locale, MessageTree>>>;

/** Fusion profonde : `override` l'emporte, `base` comble les trous. */
export function mergeMessages(base: MessageTree, override: MessageTree | undefined): MessageTree {
  if (!override) return base;
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object"
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}

/**
 * Messages d'une langue, fusionnés sur le français : une clé manquante
 * s'affiche en français plutôt que de casser la page.
 */
export function buildMessages(locale: Locale, source: Catalog = catalog): MessageTree {
  const out: MessageTree = {};
  for (const [namespace, byLocale] of Object.entries(source)) {
    const base = byLocale[defaultLocale] ?? {};
    out[namespace] = locale === defaultLocale ? base : mergeMessages(base, byLocale[locale]);
  }
  return out;
}

export { locales };
