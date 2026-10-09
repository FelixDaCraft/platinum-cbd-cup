import { z } from "zod";
import { juryPanelEnum } from "~/server/db/schema/juries";

// Schémas d'entrée de la mise en place des jurys (back-office), partagés
// entre le routeur et les formulaires.

export const juryPanelSchema = z.enum(juryPanelEnum, {
  errorMap: () => ({ message: "Jury invalide : « pro » ou « public » attendu" }),
});

/** Vivier de jurés : recherche texte, appartenance à une cup, pagination. */
export const listJuryDirectorySchema = z.object({
  search: z.string().trim().max(100, "Recherche trop longue (100 caractères maximum)").optional(),
  /** Si fourni, chaque entrée indique si le juré est déjà dans cette cup. */
  cupId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/** Ajout direct de jurés existants à une cup, sans invitation. */
export const addExistingJurorsSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  userIds: z
    .array(z.string().min(1))
    .min(1, "Au moins un juré requis")
    .max(100, "Maximum 100 jurés par ajout"),
  panel: juryPanelSchema,
  categoryIds: z.array(z.string().min(1)).max(50).default([]),
  notify: z.boolean().default(false),
});

/** Changement de jury (panel) d'un juré dans une cup. */
export const setJuryPanelSchema = z.object({
  cupJuryId: z.string().min(1, "Jury ID requis"),
  panel: juryPanelSchema,
});

/** Réception des échantillons, posée ou retirée par l'organisation. */
export const setSamplesReceivedSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  cupJuryIds: z
    .array(z.string().min(1))
    .min(1, "Au moins un juré requis")
    .max(500, "Maximum 500 jurés à la fois"),
  received: z.boolean(),
});

export const juryCoverageSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
});

export type ListJuryDirectoryInput = z.input<typeof listJuryDirectorySchema>;
export type AddExistingJurorsInput = z.input<typeof addExistingJurorsSchema>;
export type SetJuryPanelInput = z.input<typeof setJuryPanelSchema>;
export type SetSamplesReceivedInput = z.input<typeof setSamplesReceivedSchema>;
