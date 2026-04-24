/**
 * Centralized error messages and TRPCError helpers
 * Eliminates 100+ hardcoded error messages across routers
 */

import { TRPCError } from "@trpc/server";

// ============================================
// ERROR MESSAGES - French localized
// ============================================

export const ERROR_MESSAGES = {
  // Authentication
  UNAUTHORIZED: "Vous devez être connecté",
  SESSION_EXPIRED: "Votre session a expiré",

  // Organization
  NO_ORGANIZATION: "Aucune organisation trouvée",
  NOT_ORG_MEMBER: "Vous n'êtes pas membre de cette organisation",
  OWNER_ONLY: "Seul le propriétaire peut effectuer cette action",

  // Cup
  CUP_NOT_FOUND: "Cup non trouvée",
  CUP_ACCESS_DENIED: "Accès non autorisé à cette cup",

  // Category
  CATEGORY_NOT_FOUND: "Catégorie non trouvée",

  // Product
  PRODUCT_NOT_FOUND: "Produit non trouvé",

  // Registration
  REGISTRATION_NOT_FOUND: "Inscription non trouvée",

  // Jury
  JURY_NOT_FOUND: "Jury non trouvé",
  JURY_ACCESS_DENIED: "Accès jury non autorisé",

  // Producer
  PRODUCER_NOT_FOUND: "Producteur non trouvé",

  // Subscription
  SUBSCRIPTION_REQUIRED: "Abonnement requis",
  SUBSCRIPTION_INACTIVE: "Abonnement inactif",

  // Generic
  NOT_FOUND: "Ressource non trouvée",
  FORBIDDEN: "Accès non autorisé",
  BAD_REQUEST: "Requête invalide",
  INTERNAL_ERROR: "Erreur interne du serveur",
} as const;

// ============================================
// ERROR THROWERS - Pre-configured TRPCErrors
// ============================================

export const Errors = {
  unauthorized: (message: string = ERROR_MESSAGES.UNAUTHORIZED): never => {
    throw new TRPCError({ code: "UNAUTHORIZED", message });
  },

  forbidden: (message: string = ERROR_MESSAGES.FORBIDDEN): never => {
    throw new TRPCError({ code: "FORBIDDEN", message });
  },

  notFound: (message: string = ERROR_MESSAGES.NOT_FOUND): never => {
    throw new TRPCError({ code: "NOT_FOUND", message });
  },

  badRequest: (message: string = ERROR_MESSAGES.BAD_REQUEST): never => {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  },

  internal: (message: string = ERROR_MESSAGES.INTERNAL_ERROR): never => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  },

  // Specific errors
  noSession: (): never => Errors.unauthorized(ERROR_MESSAGES.UNAUTHORIZED),
  noOrganization: (): never => Errors.notFound(ERROR_MESSAGES.NO_ORGANIZATION),
  ownerOnly: (action?: string): never =>
    Errors.forbidden(
      action ? `Seul le propriétaire peut ${action}` : ERROR_MESSAGES.OWNER_ONLY
    ),
  cupNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CUP_NOT_FOUND),
  categoryNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CATEGORY_NOT_FOUND),
  productNotFound: (): never => Errors.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND),
  registrationNotFound: (): never => Errors.notFound(ERROR_MESSAGES.REGISTRATION_NOT_FOUND),
  juryNotFound: (): never => Errors.notFound(ERROR_MESSAGES.JURY_NOT_FOUND),
  producerNotFound: (): never => Errors.notFound(ERROR_MESSAGES.PRODUCER_NOT_FOUND),
  subscriptionRequired: (): never => Errors.forbidden(ERROR_MESSAGES.SUBSCRIPTION_REQUIRED),
};
