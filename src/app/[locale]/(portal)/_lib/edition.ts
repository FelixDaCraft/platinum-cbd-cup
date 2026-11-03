/**
 * Lecture publique d'une édition : statut, calendrier, catégories (tarif et
 * places restantes) et paliers de label. Partagé par l'accueil, la liste des
 * éditions et la page d'une édition, pour qu'elles disent toutes la même
 * chose — et uniquement ce que la base contient.
 *
 * Les dates voyagent en millisecondes : ces objets passent par le cache de
 * données de Next (`unstable_cache`), qui sérialise en JSON.
 */

import { db } from "~/server/db";
import type { JuryPanel } from "~/lib/enums";
import { groupCriteriaByPanel } from "~/lib/criteria-panels";
import type { CupStatus } from "~/server/db/schema/cups";
import { getCategoryOccupancy } from "~/server/services/category-quota.service";
import { intlLocale, localizedField, type Locale } from "~/i18n/locales";

const TZ = "Europe/Paris";

/**
 * Traducteur de l'espace de messages `edition` (getTranslations côté
 * serveur, useTranslations dans un composant) : ces fonctions restent pures
 * et ne dépendent pas de next-intl.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function formatDay(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(ms);
}

export function formatNumber(n: number, locale: Locale, digits = 2): string {
  return n.toLocaleString(intlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Tarif d'une catégorie ; `free` est le libellé de la gratuité dans la langue. */
export function formatPrice(
  cents: number | null,
  currency: string,
  locale: Locale,
  free: string
): string {
  if (!cents) return free;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Millésime d'une édition : l'année du nom, sinon celle de la cérémonie. */
export function editionYear(cup: {
  name: string;
  eventDate: Date | string | null;
  ratingEndAt: Date | string | null;
  createdAt: Date | string;
}): number {
  const fromName = /\b(20\d{2})\b/.exec(cup.name)?.[1];
  if (fromName) return Number(fromName);
  return new Date(cup.eventDate ?? cup.ratingEndAt ?? cup.createdAt).getFullYear();
}

/** 2023 = 1re édition (`edition.ordinal`, ordinal ICU dans chaque langue). */
export function editionOrdinal(year: number, t: Translate): string {
  return t("ordinal", { n: Math.max(1, year - 2022) });
}

const ms = (d: Date | string | null) => (d == null ? null : new Date(d).getTime());

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------

export interface LabelTier {
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
}

export interface EditionCategory {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  /** null = pas de limite de places. */
  remaining: number | null;
  /** Noms des critères, grille par grille (jury pro puis jury public). */
  criteria: { panel: JuryPanel; names: string[] }[];
}

export interface EditionDetails {
  id: string;
  name: string;
  year: number;
  status: CupStatus;
  description: string | null;
  currency: string;
  registrationOpenAt: number | null;
  registrationCloseAt: number | null;
  ratingStartAt: number | null;
  ratingEndAt: number | null;
  eventDate: number | null;
  eventLocation: string | null;
  resultsPublished: boolean;
  categories: EditionCategory[];
  labels: LabelTier[];
}

/**
 * Une édition publique (ni brouillon ni inexistante), ou null. Noms et
 * descriptions des catégories, critères et labels dans la langue demandée,
 * avec repli sur le français.
 */
export async function getEditionDetails(
  cupId: string,
  locale: Locale = "fr"
): Promise<EditionDetails | null> {
  const cup = await db.query.cups.findFirst({
    where: (c, { and, eq, ne }) => and(eq(c.id, cupId), ne(c.status, "draft")),
    with: {
      categories: {
        orderBy: (cat, { asc }) => [asc(cat.sortOrder), asc(cat.name)],
        with: { criteria: { orderBy: (cr, { asc }) => [asc(cr.sortOrder)] } },
      },
      labels: { orderBy: (l, { desc }) => [desc(l.minScore)] },
    },
  });
  if (!cup) return null;

  const occupancy = await getCategoryOccupancy(db, cup.id);

  return {
    id: cup.id,
    name: cup.name,
    year: editionYear(cup),
    status: cup.status,
    // Une description vide en base ("" ou espaces) vaut absence de description.
    description: cup.publicPageDescription?.trim() || cup.description?.trim() || null,
    currency: cup.currency ?? "EUR",
    registrationOpenAt: ms(cup.registrationOpenAt),
    registrationCloseAt: ms(cup.registrationCloseAt),
    ratingStartAt: ms(cup.ratingStartAt),
    ratingEndAt: ms(cup.ratingEndAt),
    eventDate: ms(cup.eventDate),
    eventLocation: cup.eventLocation,
    resultsPublished: cup.resultsPublishedAt != null,
    categories: cup.categories.map((cat) => ({
      id: cat.id,
      name: localizedField(cat, "name", locale),
      description: localizedField(cat, "description", locale),
      priceCents: cat.priceOverride ?? cup.defaultPricePerProduct ?? null,
      remaining:
        cat.maxProducts == null
          ? null
          : Math.max(0, cat.maxProducts - (occupancy.get(cat.id) ?? 0)),
      criteria: groupCriteriaByPanel(cat.criteria).map((group) => ({
        panel: group.panel,
        names: group.criteria.map((cr) => localizedField(cr, "name", locale)),
      })),
    })),
    labels: cup.labels
      .filter((l) => l.isPublic)
      .map((l) => ({
        name: localizedField(l, "name", locale),
        minScore: l.minScore,
        maxScore: l.maxScore,
        color: l.color,
      })),
  };
}

/** Identifiant de l'édition en cours : la plus récente ni brouillon ni terminée. */
export async function getCurrentEditionId(): Promise<string | null> {
  const cup = await db.query.cups.findFirst({
    where: (c, { inArray }) => inArray(c.status, ["published", "registration_closed", "rating"]),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    columns: { id: true },
  });
  return cup?.id ?? null;
}

// ---------------------------------------------------------------------------
// Statut et calendrier
// ---------------------------------------------------------------------------

export type Phase = "upcoming" | "open" | "closed" | "rating" | "done";

type PhaseInput = Pick<
  EditionDetails,
  "status" | "registrationOpenAt" | "registrationCloseAt" | "ratingStartAt"
>;

export function phaseOf(ed: PhaseInput, now = Date.now()): Phase {
  if (ed.status === "completed") return "done";
  if (ed.status === "rating") return "rating";
  if (ed.status === "registration_closed") return "closed";
  if (ed.registrationOpenAt != null && ed.registrationOpenAt > now) return "upcoming";
  if (ed.registrationCloseAt != null && ed.registrationCloseAt <= now) return "closed";
  return "open";
}

export function statusLine(
  ed: PhaseInput,
  phase: Phase,
  t: Translate,
  locale: Locale,
  now = Date.now()
): string {
  switch (phase) {
    case "upcoming":
      return t("status.upcoming", { date: formatDay(ed.registrationOpenAt!, locale) });
    case "open":
      return ed.registrationCloseAt != null
        ? t("status.openUntil", { date: formatDay(ed.registrationCloseAt, locale) })
        : t("status.open");
    case "closed":
      return ed.ratingStartAt != null && ed.ratingStartAt > now
        ? t("status.closedRatingFrom", { date: formatDay(ed.ratingStartAt, locale) })
        : t("status.closed");
    case "rating":
      return t("status.rating");
    case "done":
      return t("status.done");
  }
}

export type StepState = "done" | "current" | "next";

export interface Step {
  title: string;
  when: string;
  state: StepState;
  /** Bornes en millisecondes, pour l'affichage condensé des dates. */
  start: number | null;
  end: number | null;
}

/**
 * « 10.10 » ou « 31.12.2026 » : dates courtes du calendrier, toujours jour
 * puis mois (lisible dans toutes les langues du site, y compris en anglais
 * britannique).
 */
export function formatShortDay(ms: number, withYear = false): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: withYear ? "numeric" : undefined,
    timeZone: TZ,
  }).formatToParts(ms);
  return parts
    .filter((p) => p.type !== "literal")
    .map((p) => p.value)
    .join(".");
}

/** Calendrier de l'édition, réduit aux étapes dont les dates sont connues. */
export function stepsOf(
  ed: Pick<
    EditionDetails,
    | "registrationOpenAt"
    | "registrationCloseAt"
    | "ratingStartAt"
    | "ratingEndAt"
    | "eventDate"
    | "eventLocation"
  >,
  t: Translate,
  locale: Locale,
  now = Date.now(),
): Step[] {
  const steps: Step[] = [];
  const stateOf = (start: number | null, end: number | null): StepState => {
    if (end != null && end <= now) return "done";
    if (start != null && start > now) return "next";
    return start != null || end != null ? "current" : "next";
  };
  const range = (start: number | null, end: number | null) =>
    start != null && end != null
      ? t("range.between", { start: formatDay(start, locale), end: formatDay(end, locale) })
      : end != null
        ? t("range.until", { date: formatDay(end, locale) })
        : t("range.from", { date: formatDay(start!, locale) });

  if (ed.registrationOpenAt != null || ed.registrationCloseAt != null) {
    steps.push({
      title: t("steps.registration"),
      when: range(ed.registrationOpenAt, ed.registrationCloseAt),
      state: stateOf(ed.registrationOpenAt, ed.registrationCloseAt),
      start: ed.registrationOpenAt,
      end: ed.registrationCloseAt,
    });
  }
  if (ed.ratingStartAt != null || ed.ratingEndAt != null) {
    steps.push({
      title: t("steps.rating"),
      when: range(ed.ratingStartAt, ed.ratingEndAt),
      state: stateOf(ed.ratingStartAt, ed.ratingEndAt),
      start: ed.ratingStartAt,
      end: ed.ratingEndAt,
    });
  }
  if (ed.eventDate != null) {
    steps.push({
      title: t("steps.ceremony"),
      when: ed.eventLocation
        ? t("range.onAt", { date: formatDay(ed.eventDate, locale), place: ed.eventLocation })
        : t("range.on", { date: formatDay(ed.eventDate, locale) }),
      state: ed.eventDate <= now ? "done" : "next",
      start: ed.eventDate,
      end: null,
    });
  }
  return steps;
}

export function placesLine(
  remaining: number | null,
  t: Translate
): {
  text: string;
  tone: "" | "low" | "full";
} {
  if (remaining == null) return { text: "", tone: "" };
  if (remaining === 0) return { text: t("places.full"), tone: "full" };
  if (remaining <= 3) return { text: t("places.low", { count: remaining }), tone: "low" };
  return { text: t("places.remaining", { count: remaining }), tone: "" };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function tierRange(l: LabelTier, t: Translate, locale: Locale): string {
  if (l.maxScore == null) return t("tier.andAbove", { min: formatNumber(l.minScore, locale) });
  return t("tier.between", {
    min: formatNumber(l.minScore, locale),
    max: formatNumber(l.maxScore, locale),
  });
}

/** « Label OR » → « Or ». */
export function tierName(name: string): string {
  const bare = name.replace(/^Label\s+/i, "").trim();
  return bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase();
}

/** Paliers dédoublonnés par nom affiché (la base historique a « OR » et « Or »). */
export function uniqueTiers(labels: LabelTier[]): LabelTier[] {
  const seen = new Set<string>();
  return labels.filter((l) => {
    const key = tierName(l.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveTier(score: number, labels: LabelTier[]): LabelTier | null {
  return (
    labels.find((l) => score >= l.minScore && (l.maxScore == null || score <= l.maxScore)) ??
    null
  );
}
