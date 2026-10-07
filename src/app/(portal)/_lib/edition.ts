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
import type { CupStatus } from "~/server/db/schema/cups";
import { getCategoryOccupancy } from "~/server/services/category-quota.service";

const TZ = "Europe/Paris";

export function formatDay(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(ms);
}

export function formatNumber(n: number, digits = 2): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatPrice(cents: number | null, currency: string): string {
  if (!cents) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
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

/** 2023 = 1re édition. */
export function editionOrdinal(year: number): string {
  const n = Math.max(1, year - 2022);
  return n === 1 ? "1re édition" : `${n}e édition`;
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
  criteria: string[];
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

/** Une édition publique (ni brouillon ni inexistante), ou null. */
export async function getEditionDetails(cupId: string): Promise<EditionDetails | null> {
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
    description: cup.publicPageDescription ?? cup.description,
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
      name: cat.name,
      description: cat.description,
      priceCents: cat.priceOverride ?? cup.defaultPricePerProduct ?? null,
      remaining:
        cat.maxProducts == null
          ? null
          : Math.max(0, cat.maxProducts - (occupancy.get(cat.id) ?? 0)),
      criteria: cat.criteria.map((cr) => cr.name),
    })),
    labels: cup.labels
      .filter((l) => l.isPublic)
      .map((l) => ({
        name: l.name,
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

export function statusLine(ed: PhaseInput, phase: Phase, now = Date.now()): string {
  switch (phase) {
    case "upcoming":
      return `Inscriptions dès le ${formatDay(ed.registrationOpenAt!)}`;
    case "open":
      return ed.registrationCloseAt != null
        ? `Inscriptions ouvertes jusqu'au ${formatDay(ed.registrationCloseAt)}`
        : "Inscriptions ouvertes";
    case "closed":
      return ed.ratingStartAt != null && ed.ratingStartAt > now
        ? `Inscriptions closes · notation dès le ${formatDay(ed.ratingStartAt)}`
        : "Inscriptions closes";
    case "rating":
      return "Notation à l'aveugle en cours";
    case "done":
      return "Édition terminée";
  }
}

export type StepState = "done" | "current" | "next";

export interface Step {
  title: string;
  when: string;
  state: StepState;
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
      ? `Du ${formatDay(start)} au ${formatDay(end)}`
      : end != null
        ? `Jusqu'au ${formatDay(end)}`
        : `À partir du ${formatDay(start!)}`;

  if (ed.registrationOpenAt != null || ed.registrationCloseAt != null) {
    steps.push({
      title: "Inscriptions",
      when: range(ed.registrationOpenAt, ed.registrationCloseAt),
      state: stateOf(ed.registrationOpenAt, ed.registrationCloseAt),
    });
  }
  if (ed.ratingStartAt != null || ed.ratingEndAt != null) {
    steps.push({
      title: "Notation à l'aveugle",
      when: range(ed.ratingStartAt, ed.ratingEndAt),
      state: stateOf(ed.ratingStartAt, ed.ratingEndAt),
    });
  }
  if (ed.eventDate != null) {
    steps.push({
      title: "Cérémonie et palmarès",
      when: ed.eventLocation
        ? `Le ${formatDay(ed.eventDate)}, ${ed.eventLocation}`
        : `Le ${formatDay(ed.eventDate)}`,
      state: ed.eventDate <= now ? "done" : "next",
    });
  }
  return steps;
}

export function placesLine(remaining: number | null): {
  text: string;
  tone: "" | "low" | "full";
} {
  if (remaining == null) return { text: "", tone: "" };
  if (remaining === 0) return { text: "Complet", tone: "full" };
  if (remaining <= 3)
    return { text: `Plus que ${remaining} place${remaining > 1 ? "s" : ""}`, tone: "low" };
  return { text: `${remaining} places restantes`, tone: "" };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function tierRange(l: LabelTier): string {
  if (l.maxScore == null) return `${formatNumber(l.minScore)} et plus`;
  return `${formatNumber(l.minScore)} à ${formatNumber(l.maxScore)}`;
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
