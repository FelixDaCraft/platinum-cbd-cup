import { z } from "zod";
import { passwordSchema } from "./auth";

/**
 * Schema for organizer signup form
 * Used for creating a new organizer account with subscription
 */
export const organizerSignupSchema = z
  .object({
    // Personal information
    name: z
      .string()
      .min(2, "Le nom doit contenir au moins 2 caractères")
      .max(100, "Le nom ne peut pas dépasser 100 caractères"),
    email: z
      .string()
      .min(1, "L'email est requis")
      .email("Format d'email invalide"),

    // Company information
    companyName: z
      .string()
      .min(2, "Le nom de l'entreprise doit contenir au moins 2 caractères")
      .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),

    // Password
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe"),

    // Plan selection
    plan: z.enum(["starter", "pro", "enterprise"], {
      required_error: "Veuillez sélectionner un plan",
      invalid_type_error: "Plan invalide",
    }),

    // Terms acceptance
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "Vous devez accepter les conditions d'utilisation",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type OrganizerSignupInput = z.infer<typeof organizerSignupSchema>;

/**
 * Schema for step 1: Personal & Company info
 */
export const organizerStep1Schema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  email: z
    .string()
    .min(1, "L'email est requis")
    .email("Format d'email invalide"),
  companyName: z
    .string()
    .min(2, "Le nom de l'entreprise doit contenir au moins 2 caractères")
    .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),
});

export type OrganizerStep1Input = z.infer<typeof organizerStep1Schema>;

/**
 * Schema for step 2: Password
 */
export const organizerStep2Schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type OrganizerStep2Input = z.infer<typeof organizerStep2Schema>;

/**
 * Schema for step 3: Plan selection
 */
export const organizerStep3Schema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"], {
    required_error: "Veuillez sélectionner un plan",
    invalid_type_error: "Plan invalide",
  }),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "Vous devez accepter les conditions d'utilisation",
  }),
});

export type OrganizerStep3Input = z.infer<typeof organizerStep3Schema>;

/**
 * Plan type for type safety
 */
export type SubscriptionPlan = "starter" | "pro" | "enterprise";
