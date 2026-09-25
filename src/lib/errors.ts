/**
 * Libellés d'erreur partagés et constructeurs de TRPCError.
 *
 * Les toasts du front affichent le `message` de la TRPCError tel quel : ce
 * fichier fixe l'orthographe des quelques libellés réutilisés à plus d'un
 * endroit (le dépôt a longtemps porté « Cup non trouvee » et « Cup non
 * trouvée » selon les routeurs, hérité d'un contournement d'encodage).
 *
 * Ce catalogue est volontairement réduit à ce qui a un appelant. Il avait été
 * gonflé à une cinquantaine de libellés et vingt-cinq constructeurs « au cas
 * où » : comme les trois cents `new TRPCError` écrits à la main n'ont pas été
 * migrés, ces entrées ne faisaient que créer une seconde source de vérité à
 * maintenir — un libellé corrigé ici ne changeait rien à l'écran, et les clés
 * mortes laissaient croire que le routeur correspondant passait par ici.
 * Ajoute une entrée quand un second appelant en a besoin, pas avant.
 */

import { TRPCError } from "@trpc/server";

// ============================================
// LIBELLÉS — français, accentués
// ============================================

export const ERROR_MESSAGES = {
  // Génériques, également servis de valeurs par défaut aux constructeurs
  // ci-dessous et repris tels quels par `src/server/api/trpc.ts`.
  UNAUTHORIZED: "Vous devez être connecté",
  FORBIDDEN: "Accès non autorisé",
  NOT_FOUND: "Ressource non trouvée",
  BAD_REQUEST: "Requête invalide",
  INTERNAL_ERROR: "Erreur interne du serveur",

  // Ressources dont le libellé est partagé entre les helpers de
  // `src/server/api/helpers/cup.ts` et les routeurs.
  CUP_NOT_FOUND: "Cup non trouvée",
  CATEGORY_NOT_FOUND: "Catégorie non trouvée",
  PRODUCT_NOT_FOUND: "Produit non trouvé",
  REGISTRATION_NOT_FOUND: "Inscription non trouvée",
} as const;

// ============================================
// CONSTRUCTEURS — TRPCError pré-configurées
// ============================================

/**
 * `never` en type de retour : l'appelant écrit `if (!cup) Errors.cupNotFound();`
 * et TypeScript rétrécit quand même le type après la ligne, sans `return`.
 */
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

  // Raccourcis des deux ressources dont le « non trouvée » revient dans
  // plusieurs routeurs (cup, category, pricing).
  cupNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CUP_NOT_FOUND),
  categoryNotFound: (): never => Errors.notFound(ERROR_MESSAGES.CATEGORY_NOT_FOUND),
};
