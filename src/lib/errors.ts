/**
 * Messages d'erreur centralisés et constructeurs de TRPCError.
 *
 * Point unique pour les libellés renvoyés à l'utilisateur : les toasts du
 * front affichent le `message` de la TRPCError tel quel. Le dépôt contient
 * encore des centaines de `new TRPCError({ message: "…" })` écrits à la main,
 * dont le même libellé en deux orthographes (« Cup non trouvee » / « Cup non
 * trouvée ») hérité d'un contournement d'encodage. Toute nouvelle erreur doit
 * passer par `Errors.*` ou par `ERROR_MESSAGES`, et les anciennes migrer au fil
 * des retouches.
 */

import { TRPCError } from "@trpc/server";

// ============================================
// LIBELLÉS — français, accentués
// ============================================

export const ERROR_MESSAGES = {
  // Authentification
  UNAUTHORIZED: "Vous devez être connecté",
  SESSION_EXPIRED: "Votre session a expiré",

  // Compte
  USER_NOT_FOUND: "Utilisateur non trouvé",
  ACCOUNT_ALREADY_EXISTS:
    "Un compte existe déjà avec cet email. Veuillez vous connecter.",
  TOO_MANY_REQUESTS: "Trop de requêtes, réessayez dans une minute",

  // Cup
  CUP_NOT_FOUND: "Cup non trouvée",
  CUP_ACCESS_DENIED: "Accès non autorisé à cette cup",

  // Catégorie / critère
  CATEGORY_NOT_FOUND: "Catégorie non trouvée",
  CATEGORY_WRONG_CUP: "Cette catégorie n'appartient pas à cette cup",
  CATEGORIES_INVALID_FOR_CUP: "Certaines catégories ne sont pas valides pour cette cup",
  CRITERION_NOT_FOUND: "Critère non trouvé",
  CRITERIA_WRONG_CATEGORY: "Certains critères n'appartiennent pas à cette catégorie",

  // Produit
  PRODUCT_NOT_FOUND: "Produit non trouvé",
  PRODUCT_NOT_OWNED: "Ce produit ne vous appartient pas",
  PRODUCT_WRONG_CUP: "Ce produit n'appartient pas à cette cup",
  PRODUCT_NO_RESULTS: "Ce produit n'a pas encore de résultats",

  // Inscription
  REGISTRATION_NOT_FOUND: "Inscription non trouvée",
  REGISTRATION_NOT_OWNED: "Cette inscription ne vous appartient pas",
  REGISTRATION_LOCKED: "Cette inscription ne peut plus être modifiée",
  REGISTRATION_ALREADY_SETTLED: "Cette inscription a déjà été confirmée ou annulée",
  REGISTRATION_NEEDS_PRODUCT: "Vous devez ajouter au moins un produit",
  SAMPLES_RECEPTION_REQUIRED:
    "Vous devez d'abord confirmer la réception de vos échantillons",

  // Jury
  JURY_NOT_FOUND: "Jury non trouvé",
  JURY_NOT_FOUND_FOR_CUP: "Jury non trouvé pour cette cup",
  JURIES_INVALID_FOR_CUP: "Certains jurys ne sont pas valides pour cette cup",
  JURY_ACCESS_DENIED: "Accès jury non autorisé",
  NOT_JURY_FOR_CUP: "Vous n'êtes pas jury pour cette cup",
  NOT_ASSIGNED_TO_CATEGORY: "Vous n'êtes pas assigné à cette catégorie",
  CANNOT_RATE_OWN_PRODUCT: "Vous ne pouvez pas noter vos propres produits",
  RATING_ALREADY_SUBMITTED: "Vous avez déjà soumis une notation pour ce produit",
  RATINGS_LOCKED: "Les notations sont verrouillées. Les résultats sont définitifs.",

  // Invitation jury
  INVITATION_NOT_FOUND: "Invitation non trouvée",
  INVITATION_NOT_FOUND_OR_EXPIRED: "Invitation non trouvée ou expirée",
  INVITATION_EXPIRED: "Cette invitation a expiré",
  INVITATION_ALREADY_HANDLED: "Cette invitation a déjà été traitée",
  INVITATION_EMAIL_MISMATCH: "L'email ne correspond pas à l'invitation",
  INVITATION_CODE_INVALID: "Code d'invitation invalide",
  INVITATION_CODE_EXPIRED: "Ce code d'invitation a expiré",
  INVITATION_CODE_REVOKED: "Ce code d'invitation a été révoqué",
  INVITATION_CODE_ALREADY_USED: "Ce code d'invitation a déjà été utilisé",

  // Jeton d'activation jury
  TOKEN_NOT_FOUND: "Token invalide ou introuvable",
  TOKEN_EXPIRED: "Ce token a expiré",
  TOKEN_ALREADY_USED: "Ce token a déjà été utilisé par quelqu'un d'autre",

  // Producteur
  PRODUCER_NOT_FOUND: "Producteur non trouvé",
  PRODUCER_PROFILE_REQUIRED: "Vous devez avoir un profil producteur",
  PRODUCER_PROFILE_EXISTS: "Un profil producteur existe déjà",

  // Résultats
  RESULTS_NOT_PUBLISHED: "Les résultats ne sont pas encore publiés",
  RESULTS_CUP_NOT_COMPLETED:
    "Les résultats ne sont disponibles qu'une fois la cup terminée",

  // Contenus éditoriaux du portail
  ARTICLE_NOT_FOUND: "Article non trouvé",
  PRESS_RELEASE_NOT_FOUND: "Communiqué non trouvé",
  SPONSOR_NOT_FOUND: "Sponsor non trouvé",
  CUP_SPONSOR_LINK_NOT_FOUND: "Association sponsor-cup non trouvée",
  SPONSOR_ALREADY_LINKED: "Ce sponsor est déjà associé à cette cup",
  EDITION_NOT_FOUND: "Édition non trouvée",
  IMAGE_NOT_FOUND: "Image non trouvée",
  CONTACT_MESSAGE_NOT_FOUND: "Message non trouvé",
  SUBSCRIBER_NOT_FOUND: "Abonné non trouvé",

  // Fichiers
  PDF_PATH_NOT_ALLOWED: "Chemin de PDF non autorisé",

  // Générique
  NOT_FOUND: "Ressource non trouvée",
  FORBIDDEN: "Accès non autorisé",
  BAD_REQUEST: "Requête invalide",
  INTERNAL_ERROR: "Erreur interne du serveur",
} as const;

// ============================================
// CONSTRUCTEURS — TRPCError pré-configurées
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

  tooManyRequests: (message: string = ERROR_MESSAGES.TOO_MANY_REQUESTS): never => {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
  },

  // Erreurs nommées
  noSession: (): never => Errors.unauthorized(ERROR_MESSAGES.UNAUTHORIZED),
  userNotFound: (): never => Errors.notFound(ERROR_MESSAGES.USER_NOT_FOUND),
  cupNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CUP_NOT_FOUND),
  categoryNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CATEGORY_NOT_FOUND),
  criterionNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CRITERION_NOT_FOUND),
  productNotFound: (): never => Errors.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND),
  registrationNotFound: (): never => Errors.notFound(ERROR_MESSAGES.REGISTRATION_NOT_FOUND),
  juryNotFound: (): never => Errors.notFound(ERROR_MESSAGES.JURY_NOT_FOUND),
  producerNotFound: (): never => Errors.notFound(ERROR_MESSAGES.PRODUCER_NOT_FOUND),
  invitationNotFound: (): never => Errors.notFound(ERROR_MESSAGES.INVITATION_NOT_FOUND),
  tokenNotFound: (): never => Errors.notFound(ERROR_MESSAGES.TOKEN_NOT_FOUND),
  sponsorNotFound: (): never => Errors.notFound(ERROR_MESSAGES.SPONSOR_NOT_FOUND),
  cupSponsorLinkNotFound: (): never =>
    Errors.notFound(ERROR_MESSAGES.CUP_SPONSOR_LINK_NOT_FOUND),
  articleNotFound: (): never => Errors.notFound(ERROR_MESSAGES.ARTICLE_NOT_FOUND),
  pressReleaseNotFound: (): never => Errors.notFound(ERROR_MESSAGES.PRESS_RELEASE_NOT_FOUND),
  editionNotFound: (): never => Errors.notFound(ERROR_MESSAGES.EDITION_NOT_FOUND),
  imageNotFound: (): never => Errors.notFound(ERROR_MESSAGES.IMAGE_NOT_FOUND),
  contactMessageNotFound: (): never =>
    Errors.notFound(ERROR_MESSAGES.CONTACT_MESSAGE_NOT_FOUND),
  subscriberNotFound: (): never => Errors.notFound(ERROR_MESSAGES.SUBSCRIBER_NOT_FOUND),
};
