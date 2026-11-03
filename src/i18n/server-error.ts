"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "./locales";

/**
 * Messages d'erreur du serveur dans la langue de l'interface.
 *
 * Les routeurs tRPC rédigent leurs erreurs métier en français (près de
 * trois cents `TRPCError`, souvent sans accents). Côté visiteur, producteur
 * et juré, l'interface les traduit au moment de les afficher :
 * - un message répertorié ci-dessous est traduit (espace `serverErrors`) ;
 * - en français, un autre message métier lisible reste affiché tel quel ;
 * - dans une autre langue, il est remplacé par la phrase générique de son
 *   code d'erreur, plutôt que de laisser passer du français ;
 * - une panne interne ou une erreur de validation n'est jamais affichée.
 */

interface ClientError {
  message?: string;
  data?: { code?: string; zodError?: unknown } | null;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Minuscules, sans accents ni espaces superflus : « Cup non trouvée » = « Cup non trouvee ». */
function normalize(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const EXACT: Record<string, string> = Object.fromEntries(
  (
    [
      ["Vous devez être connecté", "unauthorized"],
      ["Accès non autorisé", "forbidden"],
      ["Ressource non trouvée", "notFound"],
      ["Requête invalide", "badRequest"],
      ["Cup non trouvée", "cupNotFound"],
      ["Catégorie non trouvée", "categoryNotFound"],
      ["Produit non trouvé", "productNotFound"],
      ["Inscription non trouvée", "registrationNotFound"],
      ["Producteur non trouvé", "producerNotFound"],
      ["Profil producteur non trouvé", "producerNotFound"],
      ["Utilisateur non trouvé", "userNotFound"],
      ["Jury non trouvé", "juryNotFound"],
      ["Les résultats ne sont pas encore publiés", "resultsNotPublished"],
      ["Les résultats ne sont disponibles qu'une fois publiés", "resultsNotPublished"],
      ["Les résultats sont en cours de traitement", "resultsProcessing"],
      ["Ce produit n'a pas encore de résultats", "noResultsYet"],
      ["Aucun produit avec résultats", "noResultsYet"],
      ["Ce produit ne vous appartient pas", "notYourProduct"],
      ["Cette inscription ne vous appartient pas", "notYourRegistration"],
      ["Vous n'êtes pas autorisé à modifier ce produit", "notYourProduct"],
      ["Accès non autorisé à ce produit", "forbidden"],
      ["Vous devez ajouter au moins un produit", "atLeastOneProduct"],
      ["Cette inscription ne peut plus être modifiée", "registrationLocked"],
      ["Cette inscription a déjà été payée ou annulée", "registrationSettled"],
      ["Cette inscription a déjà été confirmée ou annulée", "registrationSettled"],
      ["Cette inscription nécessite un paiement", "paymentRequired"],
      ["Les inscriptions ne sont pas ouvertes pour cette cup", "registrationClosed"],
      ["Inscription en cours de création, rechargez la page.", "registrationPending"],
      ["Impossible de vérifier le paiement auprès de Viva.", "paymentCheckFailed"],
      ["Paiement non rattaché à une inscription.", "paymentCheckFailed"],
      ["Certaines catégories sont invalides", "invalidCategories"],
      ["Cette catégorie n'appartient pas à cette cup", "invalidCategories"],
      ["Des produits de cette inscription ont déjà été notés : elle ne peut plus être supprimée.", "registrationRated"],
      ["Un profil producteur existe déjà", "producerExists"],
      ["Vous devez avoir un profil producteur", "producerRequired"],
      ["Code non trouvé", "codeInvalid"],
      ["Aucun code trouvé", "codeInvalid"],
      ["Code d'invitation invalide", "codeInvalid"],
      ["Ce code a déjà été utilisé", "codeUsed"],
      ["Ce code d'invitation a déjà été utilisé", "codeUsed"],
      ["Ce code a expiré", "codeExpired"],
      ["Ce code d'invitation a expiré", "codeExpired"],
      ["Ce code a été révoqué", "codeRevoked"],
      ["Ce code d'invitation a été révoqué", "codeRevoked"],
      ["Vous n'êtes pas jury pour cette cup", "notJuror"],
      ["Vous n'êtes pas assigné à cette catégorie", "notAssigned"],
      ["Ce produit n'appartient pas à cette cup", "productNotFound"],
      ["Vous ne pouvez pas noter vos propres produits", "ownProduct"],
      ["Vous devez d'abord confirmer la réception de vos échantillons", "confirmSamples"],
      ["Vous avez déjà soumis une notation pour ce produit", "alreadyRated"],
      ["Un critère ne peut être noté qu'une fois", "criterionTwice"],
      ["Certains critères ne sont pas valides pour cette catégorie", "invalidCriteria"],
      ["Les notations sont verrouillées. Les résultats sont définitifs.", "ratingsLocked"],
      ["La phase de notation est terminée. La date limite est passée.", "ratingClosed"],
      ["La cup n'est pas en phase de notation", "ratingNotOpen"],
      ["Aucun produit à noter dans les catégories assignées", "nothingToRate"],
      ["Invitation non trouvée", "invitationInvalid"],
      ["Invitation non trouvée ou expirée", "invitationInvalid"],
      ["Cette invitation a déjà été traitée", "invitationUsed"],
      ["Cette invitation a expiré", "invitationExpired"],
      ["L'email ne correspond pas à l'invitation", "invitationEmail"],
      ["Token invalide ou introuvable", "tokenInvalid"],
      ["Ce token a expiré", "tokenExpired"],
      ["Ce token a déjà été utilisé par quelqu'un d'autre", "tokenUsed"],
      ["Vous avez déjà utilisé ce token", "tokenAlreadyYours"],
      ["Un compte existe déjà avec cet email. Veuillez vous connecter.", "accountExists"],
      ["Une demande de suppression est déjà en cours", "deletionPending"],
    ] as const
  ).map(([fr, key]) => [normalize(fr), key])
);

/** Messages paramétrés : les captures deviennent des variables ICU. */
const PATTERNS: { re: RegExp; key: string; names: string[] }[] = [
  {
    re: /^vous ne pouvez inscrire que (\d+) produit\(s\) dans la categorie « (.+) », et vous en avez deja (\d+)\.$/,
    key: "quotaPerProducerHeld",
    names: ["max", "category", "held"],
  },
  {
    re: /^vous ne pouvez inscrire que (\d+) produit\(s\) dans la categorie « (.+) »\.$/,
    key: "quotaPerProducer",
    names: ["max", "category"],
  },
  { re: /^la categorie « (.+) » est complete\.$/, key: "quotaFull", names: ["category"] },
  {
    re: /^il ne reste que (\d+) place\(s\) dans la categorie « (.+) »\.$/,
    key: "quotaRemaining",
    names: ["remaining", "category"],
  },
  { re: /^scores manquants pour (\d+) critere\(s\)$/, key: "missingScores", names: ["count"] },
  { re: /^score doit etre entre (\S+) et (\S+)$/, key: "scoreRange", names: ["min", "max"] },
];

const GENERIC: Record<string, string> = {
  UNAUTHORIZED: "codes.UNAUTHORIZED",
  FORBIDDEN: "codes.FORBIDDEN",
  NOT_FOUND: "codes.NOT_FOUND",
  CONFLICT: "codes.CONFLICT",
  TIMEOUT: "codes.TIMEOUT",
  TOO_MANY_REQUESTS: "codes.TOO_MANY_REQUESTS",
  BAD_REQUEST: "codes.BAD_REQUEST",
  PARSE_ERROR: "codes.BAD_REQUEST",
  INTERNAL_SERVER_ERROR: "codes.INTERNAL_SERVER_ERROR",
};

const TECHNICAL = [
  /^string must contain/i,
  /^number must be/i,
  /^expected .+ received/i,
  /^invalid (input|type|enum|literal|date|url|email)/i,
  /^required$/i,
  /^array must contain/i,
  /\bat path\b/i,
  /^[A-Z_]+$/,
  /^failed to fetch$/i,
];

/** Clé et variables d'un message serveur répertorié, sinon null. */
export function matchServerMessage(
  message: string
): { key: string; values: Record<string, string | number> } | null {
  const n = normalize(message);
  const exact = EXACT[n];
  if (exact) return { key: exact, values: {} };
  for (const { re, key, names } of PATTERNS) {
    const m = re.exec(n);
    if (!m) continue;
    // Les captures textuelles sont relues dans le message d'origine, pour
    // garder accents et majuscules (« Fleurs Indoor », pas « fleurs indoor »).
    const values: Record<string, string | number> = {};
    names.forEach((name, i) => {
      const raw = m[i + 1] ?? "";
      values[name] = /^\d+$/.test(raw) ? Number(raw) : (extractOriginal(message, raw) ?? raw);
    });
    return { key, values };
  }
  return null;
}

/** Retrouve dans le message d'origine le fragment capturé sur sa forme normalisée. */
function extractOriginal(message: string, normalizedFragment: string | undefined): string | null {
  if (!normalizedFragment) return null;
  const plain = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const start = plain.indexOf(normalizedFragment);
  if (start < 0) return null;
  // La décomposition NFD ne change pas le nombre de lettres de base : on
  // recompose le message caractère par caractère pour garder les accents.
  const chars = [...message];
  let count = 0;
  let from = -1;
  let to = -1;
  for (let i = 0; i < chars.length; i++) {
    if (count === start && from < 0) from = i;
    count += chars[i]!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").length;
    if (count >= start + normalizedFragment.length && to < 0) {
      to = i + 1;
      break;
    }
  }
  return from >= 0 && to > from ? chars.slice(from, to).join("") : null;
}

export function translateServerError(
  error: unknown,
  opts: { t: Translate; locale: Locale; fallback?: string }
): string {
  const err = (error ?? {}) as ClientError;
  const code = err.data?.code ?? "";
  const message = typeof err.message === "string" ? err.message.trim() : "";
  const generic = () => (GENERIC[code] ? opts.t(GENERIC[code]) : (opts.fallback ?? opts.t("codes.UNKNOWN")));

  if (code === "INTERNAL_SERVER_ERROR" || code === "PARSE_ERROR") return generic();
  if (err.data?.zodError) return opts.t("codes.BAD_REQUEST");
  if (!message || TECHNICAL.some((re) => re.test(message))) return generic();

  const match = matchServerMessage(message);
  if (match) {
    return Object.keys(match.values).length > 0 ? opts.t(match.key, match.values) : opts.t(match.key);
  }
  return opts.locale === "fr" ? message : generic();
}

/** Hook : `const serverError = useServerError(); toast.error(serverError(err))`. */
export function useServerError() {
  const t = useTranslations("serverErrors");
  const locale = useLocale() as Locale;
  return useCallback(
    (error: unknown, fallback?: string) => translateServerError(error, { t, locale, fallback }),
    [t, locale]
  );
}
