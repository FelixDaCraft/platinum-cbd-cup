/**
 * Exécution par lots des envois de masse.
 *
 * Les envois groupés (68 producteurs, 70 jurés) enchaînaient rendu PDF puis
 * appel Resend strictement en séquence dans une seule requête HTTP : une à
 * trois minutes, alors que le proxy coupe à 100 s. L'UI affichait une erreur
 * pendant que les envois continuaient, et l'organisateur relançait.
 */

/**
 * Plafond de parallélisme des envois.
 *
 * Trois : le rendu PDF occupe une à deux secondes par message, ce qui laisse
 * la cadence d'appels Resend sous sa limite par défaut (2 requêtes/seconde)
 * tout en divisant le temps total par trois.
 */
export const EMAIL_SEND_CONCURRENCY = 3;

/**
 * Applique `worker` à chaque entrée avec un parallélisme borné, en
 * préservant l'ordre des résultats.
 *
 * `worker` ne doit pas rejeter : un rejet interrompt tout le lot. Les envois
 * d'email renvoient déjà leurs erreurs sous forme de résultat.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function runner(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]!, index);
    }
  }

  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => runner()
  );
  await Promise.all(runners);

  return results;
}
