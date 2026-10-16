import { z } from "zod";
import { passwordSchema } from "./auth";

/**
 * SIRET validation - French company identification number
 * 14 digits, optional
 */
export const siretSchema = z
  .string()
  .regex(/^\d{14}$/, "Le SIRET doit contenir exactement 14 chiffres")
  .optional()
  .or(z.literal(""));

/**
 * Website URL validation - optional
 */
export const websiteSchema = z
  .string()
  .url("Format d'URL invalide")
  .optional()
  .or(z.literal(""));

/**
 * Téléphone du producteur, obligatoire : l'organisation l'appelle pour la
 * logistique des échantillons. Séparateurs usuels tolérés (espaces, points,
 * tirets) ; format français (0X XX XX XX XX) ou international (+33…).
 */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.\-()]/g, "");
}

/** Affichage : 0612345678 → 06 12 34 56 78 ; le reste est rendu tel quel. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = normalizePhone(value);
  return /^0\d{9}$/.test(digits) ? digits.replace(/(\d{2})(?=\d)/g, "$1 ") : value;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Le numéro de téléphone est requis")
  .refine((val) => /^(\+\d{8,15}|0\d{9})$/.test(normalizePhone(val)), {
    message: "Numéro invalide : 06 12 34 56 78 ou +33 6 12 34 56 78",
  });

/**
 * Producer registration schema - creates user + producer in one step
 */
export const producerRegisterSchema = z
  .object({
    email: z
      .string()
      .min(1, "L'email est requis")
      .email("Format d'email invalide"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe"),
    name: z.string().min(1, "Le nom est requis"),
    companyName: z
      .string()
      .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères")
      .optional(),
    brandName: z
      .string()
      .max(100, "Le nom de la marque ne peut pas dépasser 100 caractères")
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type ProducerRegisterInput = z.infer<typeof producerRegisterSchema>;

/**
 * Producer profile update schema
 */
export const producerProfileUpdateSchema = z.object({
  companyName: z
    .string()
    .min(1, "Le nom de l'entreprise est requis")
    .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),
  brandName: z
    .string()
    .min(1, "Le nom de la marque est requis")
    .max(100, "Le nom de la marque ne peut pas dépasser 100 caractères"),
  phone: phoneSchema,
  siret: siretSchema,
  website: websiteSchema,
});

export type ProducerProfileUpdateInput = z.infer<typeof producerProfileUpdateSchema>;

/**
 * Producer logo update schema
 * N'accepte qu'un fichier téléversé via /api/upload (chemin /uploads/...)
 * ou la chaîne vide.
 *
 * Les URL externes sont refusées : l'optimiseur d'images ne sert plus que nos
 * propres domaines (next.config.js), une image hébergée ailleurs renverrait
 * une 400 à l'affichage. Le chemin est aussi vérifié contre la traversée,
 * parce qu'il est résolu sur le disque à la génération des PDF.
 */
const UPLOAD_PATH_PATTERN = /^\/uploads\/[A-Za-z0-9._\/-]+$/;

const uploadedImageSchema = (label: string) =>
  z
    .string()
    .refine(
      (val) => val === "" || (UPLOAD_PATH_PATTERN.test(val) && !val.includes("..")),
      { message: `${label} doit être un fichier téléversé sur le site (chemin /uploads/...)` }
    );

export const producerLogoUpdateSchema = z.object({
  logo: uploadedImageSchema("Le logo").optional(),
});

/**
 * Visuels repris sur les réseaux sociaux de la cup (logo, photo du
 * producteur ou de son équipe). La chaîne vide retire le visuel.
 */
export const producerMediaUpdateSchema = z.object({
  field: z.enum(["logo", "teamPhoto"]),
  url: uploadedImageSchema("Le visuel"),
});

export type ProducerMediaUpdateInput = z.infer<typeof producerMediaUpdateSchema>;

/** Création du profil producteur (« Compléter mon profil »). */
export const producerCreateProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Le nom de l'entreprise est requis")
    .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),
  brandName: z
    .string()
    .trim()
    .min(1, "Le nom de la marque est requis")
    .max(100, "Le nom de la marque ne peut pas dépasser 100 caractères"),
  phone: phoneSchema,
});

export type ProducerCreateProfileInput = z.infer<typeof producerCreateProfileSchema>;

export type ProducerLogoUpdateInput = z.infer<typeof producerLogoUpdateSchema>;
