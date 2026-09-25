/**
 * Numéro d'édition du concours — source unique pour le portail.
 *
 * La règle est celle déjà appliquée côté serveur sur la home
 * (`(portal)/page.tsx`) : l'édition 01 s'est tenue en 2023, le numéro suit
 * donc l'année civile. Les composants qui n'ont pas accès à la cup en base
 * (coquille, trophée) s'appuient sur l'année courante plutôt que sur une
 * valeur figée en dur — c'est ce qui avait fait diverger « ed. 04 » et
 * « EDITION 03 » d'un composant à l'autre.
 */

/** Année de la première édition. */
export const FIRST_EDITION_YEAR = 2023;

/** Numéro d'édition pour une année donnée (jamais inférieur à 1). */
export function editionNumberForYear(year: number): number {
  return Math.max(1, year - FIRST_EDITION_YEAR + 1);
}

/** Numéro d'édition sur deux chiffres, ex. "04". */
export function editionLabelForYear(year: number): string {
  return String(editionNumberForYear(year)).padStart(2, "0");
}

/** Année courante + numéro d'édition associé. */
export function currentEdition(): { year: number; label: string } {
  const year = new Date().getFullYear();
  return { year, label: editionLabelForYear(year) };
}
