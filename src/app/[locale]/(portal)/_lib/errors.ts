/**
 * Traduction des erreurs serveur en message affichable.
 *
 * Les pages affichaient `error.message` tel quel. Or ce champ contient trois
 * choses très différentes : un message métier écrit en français par nos
 * routeurs (« Ce code a déjà été utilisé »), un message zod en anglais
 * (« String must contain at least 8 character(s) »), ou la trace d'une panne
 * interne. Les deux derniers n'ont rien à faire sous les yeux d'un producteur,
 * et le troisième renseigne un attaquant.
 *
 * La règle : on garde le message métier, on remplace le reste par une phrase
 * générique choisie sur le code d'erreur.
 */

/** Forme minimale d'une erreur tRPC côté client, sans dépendre de ses types. */
interface ClientError {
  message?: string;
  data?: {
    code?: string;
    zodError?: unknown;
  } | null;
}

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  FORBIDDEN: "Vous n'avez pas les droits nécessaires pour cette action.",
  NOT_FOUND: "Élément introuvable — le lien est peut-être périmé.",
  CONFLICT: "Cette action a déjà été effectuée.",
  TIMEOUT: "Le serveur met trop de temps à répondre. Réessayez dans un instant.",
  TOO_MANY_REQUESTS: "Trop de tentatives. Réessayez dans quelques minutes.",
  BAD_REQUEST: "Les informations envoyées sont incomplètes ou invalides.",
  PARSE_ERROR: "Les informations envoyées sont incomplètes ou invalides.",
  INTERNAL_SERVER_ERROR:
    "Service momentanément indisponible. Réessayez dans quelques minutes.",
};

/**
 * Signatures des messages de validation zod et des erreurs techniques, qui
 * arrivent en anglais quel que soit le code renvoyé.
 */
const TECHNICAL_PATTERNS = [
  /^string must contain/i,
  /^number must be/i,
  /^expected .+ received/i,
  /^invalid (input|type|enum|literal|date|url|email)/i,
  /^required$/i,
  /^array must contain/i,
  /\bat path\b/i,
  /^[A-Z_]+$/, // codes bruts remontés tels quels (ex. « INVALID_TOKEN »)
];

function looksTechnical(message: string): boolean {
  return TECHNICAL_PATTERNS.some((re) => re.test(message.trim()));
}

/**
 * @param fallback message à utiliser si l'erreur ne porte aucune information
 *   exploitable — formulé pour le contexte de l'appel.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  const err = (error ?? {}) as ClientError;
  const code = err.data?.code ?? "";
  const message = typeof err.message === "string" ? err.message.trim() : "";

  // Une panne interne ne doit jamais s'afficher : son message décrit
  // l'implémentation (requête SQL, nom de colonne, pile d'appels).
  if (code === "INTERNAL_SERVER_ERROR" || code === "PARSE_ERROR") {
    return CODE_MESSAGES[code]!;
  }

  // Échec de validation : le détail zod est en anglais et vise le développeur.
  if (err.data?.zodError) {
    return CODE_MESSAGES.BAD_REQUEST!;
  }

  if (message && !looksTechnical(message)) return message;

  return CODE_MESSAGES[code] ?? fallback;
}
