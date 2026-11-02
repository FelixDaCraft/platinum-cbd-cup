/**
 * Commentaires du jury public tels qu'on les montre au producteur : nettoyés,
 * sans vide ni doublon, triés pour que l'ordre de dépôt ne se lise pas. Le
 * producteur ne doit pas pouvoir compter les jurés publics ni remonter à l'un
 * d'eux : ces commentaires s'affichent regroupés, sans numérotation ni total.
 */
export function publicCommentsForDisplay(
  comments: ReadonlyArray<string | null | undefined>
): string[] {
  const cleaned = comments
    .map((comment) => comment?.trim() ?? "")
    .filter((comment) => comment.length > 0);
  return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b, "fr"));
}
