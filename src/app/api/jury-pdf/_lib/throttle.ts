/**
 * Garde-fous partagés par les trois routes /api/jury-pdf/*.
 *
 * Le rendu @react-pdf est bloquant pour l'event loop (0,5 à 3 s pour un
 * document multi-pages). Sur un process Node unique, quelques dizaines de
 * jurés qui téléchargent leur synthèse après la cérémonie sérialisent tout
 * le site — tRPC et portail public compris. Deux protections :
 *
 *  1. un quota par utilisateur (même compromis mémoire que /api/invoices :
 *     une seule instance aujourd'hui, à passer sur Redis si l'app scale) ;
 *  2. un plafond global de rendus simultanés, qui borne le temps CPU
 *     monopolisé quoi qu'il arrive.
 */

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkJuryPdfRateLimit(userId: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();

  // Éviction bon marché pour que la map ne grossisse pas indéfiniment.
  if (rateLimitMap.size > 500) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const current = rateLimitMap.get(userId);

  if (!current || now > current.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return { allowed: true };
}

/** Rendus simultanés autorisés sur l'ensemble des routes jury-pdf. */
const MAX_CONCURRENT_RENDERS = 2;

let inFlight = 0;

/** Levée quand le plafond de rendus simultanés est atteint. */
export class PdfBusyError extends Error {
  constructor() {
    super("PDF renderer busy");
    this.name = "PdfBusyError";
  }
}

/**
 * Exécute `render` en occupant un des créneaux de rendu, ou lève
 * `PdfBusyError` si tous sont pris (le client réessaie au lieu d'allonger
 * la file d'attente sur l'event loop).
 */
export async function withRenderSlot<T>(render: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_RENDERS) {
    throw new PdfBusyError();
  }
  inFlight += 1;
  try {
    return await render();
  } finally {
    inFlight -= 1;
  }
}
