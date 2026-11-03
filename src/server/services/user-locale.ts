import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import type { Locale } from "~/i18n/locales";

/**
 * Mémorise sur le compte la langue dans laquelle l'utilisateur consulte son
 * espace (producteur ou juré) : c'est celle des e-mails envoyés plus tard
 * hors requête (résultats, rappels de notation). Une écriture seulement
 * quand la langue change, pas à chaque page vue.
 */
export async function syncUserLocale(
  userId: string,
  stored: string | null | undefined,
  locale: Locale
): Promise<void> {
  if (stored === locale) return;
  try {
    await db.update(users).set({ locale }).where(eq(users.id, userId));
  } catch (error) {
    // Jamais bloquant : au pire, les e-mails partent dans l'ancienne langue.
    console.error("[i18n] Langue du compte non enregistrée", error);
  }
}
