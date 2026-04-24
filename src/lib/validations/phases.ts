import { z } from "zod";
import type { CupStatus } from "~/server/db/schema/cups";

/**
 * Schema for updating phase dates on a cup
 * All dates are optional/nullable - organizer can choose manual transitions
 */
export const updatePhaseDatesSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  registrationOpenAt: z.date().nullable().optional(),
  registrationCloseAt: z.date().nullable().optional(),
  ratingStartAt: z.date().nullable().optional(),
  ratingEndAt: z.date().nullable().optional(),
}).refine(
  (data) => {
    // Si les deux dates d'inscription sont définies, open doit être avant close
    if (data.registrationOpenAt && data.registrationCloseAt) {
      return data.registrationOpenAt < data.registrationCloseAt;
    }
    return true;
  },
  { message: "La date d'ouverture doit être avant la date de clôture des inscriptions", path: ["registrationCloseAt"] }
).refine(
  (data) => {
    // Si les deux dates de notation sont définies, start doit être avant end
    if (data.ratingStartAt && data.ratingEndAt) {
      return data.ratingStartAt < data.ratingEndAt;
    }
    return true;
  },
  { message: "La date de début doit être avant la date de fin de notation", path: ["ratingEndAt"] }
).refine(
  (data) => {
    // Si clôture inscriptions et début notation définis, clôture <= début notation
    if (data.registrationCloseAt && data.ratingStartAt) {
      return data.registrationCloseAt <= data.ratingStartAt;
    }
    return true;
  },
  { message: "La clôture des inscriptions doit être avant ou égale au début de la notation", path: ["ratingStartAt"] }
);

export type UpdatePhaseDatesInput = z.infer<typeof updatePhaseDatesSchema>;

/**
 * Phase status derived from cup state and dates
 */
export type PhaseStatus =
  | "draft"           // Cup is in draft mode
  | "pending"         // Waiting for registration to open
  | "registration"    // Registration is open
  | "closed"          // Registration closed, waiting for rating
  | "rating"          // Rating phase active
  | "completed";      // Cup completed

/**
 * Format a phase date for display
 */
export function formatPhaseDate(date: Date | null): string {
  if (!date) return "Non définie";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Get the current phase status based on cup state and dates
 */
export function getPhaseStatus(cup: {
  status: CupStatus;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
}): PhaseStatus {
  const now = new Date();

  // Status-based determination (manual transitions)
  if (cup.status === "draft") return "draft";
  if (cup.status === "completed") return "completed";
  if (cup.status === "rating") return "rating";
  if (cup.status === "registration_closed") return "closed";

  // For published status, check dates
  if (cup.status === "published") {
    // If registration open date is in the future
    if (cup.registrationOpenAt && cup.registrationOpenAt > now) {
      return "pending";
    }
    return "registration";
  }

  return "draft";
}

/**
 * Get the list of editable date fields based on cup status
 * Dates are locked as the cup progresses through phases
 */
export function getEditableDates(status: CupStatus): string[] {
  switch (status) {
    case "draft":
      return ["registrationOpenAt", "registrationCloseAt", "ratingStartAt", "ratingEndAt"];
    case "published":
      return ["registrationCloseAt", "ratingStartAt", "ratingEndAt"];
    case "registration_closed":
      return ["ratingStartAt", "ratingEndAt"];
    case "rating":
      return ["ratingEndAt"];
    case "completed":
      return [];
  }
}

/**
 * Check if a specific date field can be edited based on cup status
 */
export function canEditDate(status: CupStatus, dateField: string): boolean {
  return getEditableDates(status).includes(dateField);
}
