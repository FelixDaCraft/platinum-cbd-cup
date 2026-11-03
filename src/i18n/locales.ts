/**
 * Langues du site public, de l'espace producteur et de l'espace juré.
 *
 * Module pur (aucune dépendance Next) : il est partagé par le middleware,
 * les composants serveur et client, les e-mails et les scripts. La
 * configuration next-intl (routing.ts) en dérive.
 *
 * « Autrichien » n'est pas une langue distincte : les visiteurs d'Autriche
 * (de-AT) reçoivent la version allemande, rédigée en allemand standard,
 * compris et usité tel quel en Autriche pour ce type de contenu.
 */

export const locales = ["fr", "en", "it", "de", "cs", "nl", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Langue proposée quand le navigateur n'en demande aucune que l'on ait. */
const FOREIGN_FALLBACK: Locale = "en";

/** Nom de chaque langue dans sa propre langue (sélecteur du header). */
export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  it: "Italiano",
  de: "Deutsch",
  cs: "Čeština",
  nl: "Nederlands",
  es: "Español",
};

const INTL_TAGS: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  it: "it-IT",
  de: "de-DE",
  cs: "cs-CZ",
  nl: "nl-NL",
  es: "es-ES",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Étiquette BCP 47 complète, pour Intl et `hreflang`. */
export function intlLocale(locale: Locale): string {
  return INTL_TAGS[locale];
}

/** Forme attendue par Open Graph (`og:locale`). */
export function ogLocale(locale: Locale): string {
  return INTL_TAGS[locale].replace("-", "_");
}

/**
 * Choisit la langue d'après l'en-tête Accept-Language.
 *
 * - aucun en-tête (robots, outils) ou joker seul : français, la langue
 *   d'origine du site ;
 * - une langue prise en charge, quelle que soit sa variante régionale
 *   (de-AT → de, fr-BE → fr) : celle de plus fort poids ;
 * - seulement des langues non prises en charge : anglais, plus utile à un
 *   visiteur polonais ou portugais que le français.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage?.trim()) return defaultLocale;

  const entries = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return {
        primary: tag.trim().toLowerCase().split("-")[0] ?? "",
        q: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((e) => e.primary !== "" && e.q > 0 && /^[a-z*]+$/.test(e.primary))
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { primary } of entries) {
    if (isLocale(primary)) return primary;
  }
  const onlyWildcard = entries.length > 0 && entries.every((e) => e.primary === "*");
  return entries.length === 0 || onlyWildcard ? defaultLocale : FOREIGN_FALLBACK;
}

/**
 * Langue d'un utilisateur hors rendu de page (e-mails, PDF) : choix explicite
 * mémorisé dans le cookie, sinon le navigateur, sinon la langue du compte.
 */
export function pickLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
  stored?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  if (input.acceptLanguage?.trim()) return negotiateLocale(input.acceptLanguage);
  if (isLocale(input.stored)) return input.stored;
  return defaultLocale;
}

/** Préfixe une URL interne : `/palmares` → `/en/palmares` ; le français reste nu. */
export function localizePath(path: string, locale: Locale): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return normalized;
  if (normalized === "/") return `/${locale}`;
  if (normalized.startsWith("/?") || normalized.startsWith("/#")) {
    return `/${locale}${normalized.slice(1)}`;
  }
  return `/${locale}${normalized}`;
}

const PREFIX_RE = new RegExp(`^/(${locales.join("|")})(?=/|$|\\?|#)`);

/** Retire un éventuel préfixe de langue : `/en/palmares` → `/palmares`. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(PREFIX_RE, "");
  if (stripped === "") return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function localeFromPathname(pathname: string): Locale {
  const match = PREFIX_RE.exec(pathname)?.[1];
  return isLocale(match) ? match : defaultLocale;
}

/** Colonne `translations` des contenus en base : `{ en: { name: "…" } }`. */
export type Translations<F extends string = string> = Partial<
  Record<Locale, Partial<Record<F, string | null>>>
>;

/**
 * Valeur traduite d'un champ texte, avec repli sur le français (la colonne
 * d'origine) quand la traduction manque ou est vide.
 */
export function localizedField<T extends object, F extends keyof T & string>(
  entity: T,
  field: F,
  locale: Locale
): T[F] {
  if (locale !== defaultLocale) {
    const translations = (entity as { translations?: Translations | null }).translations;
    const value = translations?.[locale]?.[field];
    if (typeof value === "string" && value.trim() !== "") return value as T[F];
  }
  return entity[field];
}

/**
 * Prix en euros à partir de centimes. Pas de décimales pour un montant rond
 * (« 200 € », « €200 »), deux sinon.
 */
export function formatPrice(cents: number, locale: Locale): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(INTL_TAGS[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** Date longue (« 31 décembre 2026 », « 31 December 2026 »), heure de Paris. */
export function formatDate(
  date: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  return new Intl.DateTimeFormat(INTL_TAGS[locale], {
    timeZone: "Europe/Paris",
    ...options,
  }).format(typeof date === "string" ? new Date(date) : date);
}

/**
 * Le back-office organisateur (`/dashboard`) reste en français et hors du
 * segment `[locale]`, comme les routes techniques : aucun préfixe de langue.
 */
const UNLOCALIZED_PREFIXES = ["/dashboard", "/api", "/uploads", "/fonts", "/_next"];

export function isLocalizedRoute(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? "/";
  return !UNLOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Comme localizePath, mais laisse intactes les routes non traduites. Un
 * chemin déjà préfixé (lien d'e-mail, callbackUrl) est d'abord ramené à sa
 * forme nue : pas de `/en/en/…`.
 */
export function hrefFor(path: string, locale: Locale): string {
  const bare = stripLocale(path);
  return isLocalizedRoute(bare) ? localizePath(bare, locale) : bare;
}

/** Traductions d'un contenu riche (règlement, article) : corps TipTap compris. */
export type ContentTranslations = Partial<
  Record<
    Locale,
    {
      title?: string | null;
      lede?: string | null;
      excerpt?: string | null;
      content?: Record<string, unknown> | null;
      /**
       * Empreinte du texte français traduit (tiptapFingerprint) : permet de
       * détecter une traduction devenue périmée après une modification.
       */
      sourceFingerprint?: string | null;
    }
  >
>;

/**
 * Version d'un contenu riche dans une langue : chaque champ traduit
 * remplace l'original, les autres restent en français. `translated` indique
 * si le corps lui-même est traduit (sinon la page signale le texte français).
 */
export function localizedContent<
  T extends {
    title: string;
    content: Record<string, unknown>;
    lede?: string | null;
    excerpt?: string | null;
    translations?: ContentTranslations | null;
  },
>(doc: T, locale: Locale): T & { translated: boolean } {
  const tr = locale === defaultLocale ? undefined : doc.translations?.[locale];
  const has = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
  const content =
    tr?.content && typeof tr.content === "object" && Object.keys(tr.content).length > 0
      ? tr.content
      : null;
  return {
    ...doc,
    title: has(tr?.title) ? tr.title : doc.title,
    ...("lede" in doc ? { lede: has(tr?.lede) ? tr.lede : doc.lede } : {}),
    ...("excerpt" in doc ? { excerpt: has(tr?.excerpt) ? tr.excerpt : doc.excerpt } : {}),
    content: content ?? doc.content,
    translated: locale === defaultLocale || content != null,
  };
}

/**
 * Langue d'une requête serveur (tRPC, route API) : en-tête `x-locale` posé
 * par le client tRPC d'après `<html lang>`, sinon celui que le middleware
 * next-intl pose sur les pages, sinon le cookie, sinon le français.
 */
export function requestLocale(headers: Headers): Locale {
  const explicit = headers.get("x-locale");
  if (isLocale(explicit)) return explicit;
  const fromMiddleware = headers.get("x-next-intl-locale");
  if (isLocale(fromMiddleware)) return fromMiddleware;
  const cookie = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(headers.get("cookie") ?? "")?.[1];
  return isLocale(cookie) ? cookie : defaultLocale;
}

/**
 * Copie d'une ligne de contenu (catégorie, critère, label) dont `name` et
 * `description` / `condition` sont remplacés par leur traduction.
 */
export function localizeRow<T extends { name: string; translations?: unknown }>(
  row: T,
  locale: Locale
): T {
  if (locale === defaultLocale) return row;
  const out = { ...row, name: localizedField(row, "name", locale) };
  for (const field of ["description", "condition"] as const) {
    if (field in row) {
      (out as Record<string, unknown>)[field] = localizedField(
        row as unknown as Record<string, unknown>,
        field,
        locale
      );
    }
  }
  return out;
}
