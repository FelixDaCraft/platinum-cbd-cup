/**
 * Échappement des valeurs interpolées dans le HTML des emails.
 *
 * Les templates sont assemblés par concaténation de chaînes : sans
 * échappement, un nom de produit, de cup ou un message libre saisi par un
 * tiers casserait le rendu et pourrait glisser un lien dans un email
 * officiel signé par notre domaine.
 */

/**
 * Échappe les cinq caractères significatifs du HTML.
 *
 * `&` est remplacé en premier, sinon les entités produites par les
 * remplacements suivants seraient elles-mêmes ré-échappées.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Filtre une URL avant de la poser dans un `href`.
 *
 * Seuls `http` et `https` sont acceptés : un `javascript:` ou un `data:`
 * interpolé dans un bouton d'email transformerait une relance légitime en
 * vecteur d'hameçonnage. Une URL refusée renvoie `#`, un lien inerte.
 */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "#";
    }
    return escapeHtml(parsed.toString());
  } catch {
    return "#";
  }
}
