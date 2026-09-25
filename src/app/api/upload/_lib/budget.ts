/**
 * Budget d'upload par utilisateur, partagé par toutes les routes qui
 * écrivent dans `public/uploads`.
 *
 * Le volume `./uploads` est un répertoire de l'hôte : sans plafond, un compte
 * producteur (l'inscription est publique) ou un organisateur dont la session
 * a fuité remplit le disque en quelques minutes et fait tomber Postgres avec
 * l'application. Le compteur est commun aux quatre routes pour qu'on ne
 * puisse pas additionner quatre quotas en alternant les endpoints.
 *
 * En mémoire, même compromis que le limiteur des factures : un seul process
 * Node aujourd'hui, à passer sur Redis si l'application est répartie.
 */

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const RATE_LIMITS = {
  organizer: { files: 60, bytes: 300 * 1024 * 1024 },
  other: { files: 15, bytes: 30 * 1024 * 1024 },
} as const;

const uploadBudget = new Map<
  string,
  { files: number; bytes: number; resetAt: number }
>();

export type BudgetVerdict = { allowed: boolean; retryAfter?: number };

/**
 * Décompte un fichier de `size` octets du budget de l'utilisateur.
 * Rien n'est décompté quand le quota est dépassé : l'appelant doit répondre
 * 429 sans écrire sur le disque.
 */
export function consumeUploadBudget(
  userId: string,
  isOrganizer: boolean,
  size: number
): BudgetVerdict {
  const now = Date.now();

  // Éviction bon marché pour que la map ne grossisse pas indéfiniment.
  if (uploadBudget.size > 500) {
    for (const [key, entry] of uploadBudget) {
      if (now > entry.resetAt) uploadBudget.delete(key);
    }
  }

  const limits = isOrganizer ? RATE_LIMITS.organizer : RATE_LIMITS.other;
  const current = uploadBudget.get(userId);

  if (!current || now > current.resetAt) {
    uploadBudget.set(userId, {
      files: 1,
      bytes: size,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (current.files >= limits.files || current.bytes + size > limits.bytes) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.files += 1;
  current.bytes += size;
  return { allowed: true };
}

/**
 * Rend au budget ce qu'un fichier refusé a consommé.
 *
 * Le décompte a lieu avant la lecture du corps, donc avant qu'on sache si le
 * contenu est du type annoncé : sans remboursement, quinze essais au mauvais
 * format verrouillaient un producteur dix minutes derrière un 429 alors
 * qu'aucun octet n'avait été écrit.
 */
export function refundUploadBudget(userId: string, size: number): void {
  const current = uploadBudget.get(userId);
  if (!current || Date.now() > current.resetAt) return;
  current.files = Math.max(0, current.files - 1);
  current.bytes = Math.max(0, current.bytes - size);
}

/**
 * Coût forfaitaire d'un favicon généré.
 *
 * La route partait de la taille du logo SOURCE — déjà facturée lors de son
 * téléversement — alors qu'elle n'écrit qu'un PNG de quelques kilo-octets :
 * un logo de 8 Mo amputait le quota de 8 Mo pour une vignette 32×32. Le
 * plafond en nombre de fichiers suffit à borner la boucle.
 */
export const COUT_FAVICON_OCTETS = 64 * 1024;
