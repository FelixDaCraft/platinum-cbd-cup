/**
 * Moyenne pondérée par coefficient, côté serveur.
 *
 * L'arithmétique (Σ note × coefficient / Σ coefficients) était recopiée à la
 * main dans chaque générateur de PDF, en plus de la référence partagée avec le
 * formulaire de notation. Une pondération recalculée à cinq endroits est une
 * règle métier que personne ne peut plus corriger d'un seul geste : le jour où
 * le concours changera sa façon de pondérer, une synthèse producteur et un
 * dossier juré continueraient d'imprimer l'ancienne. Le calcul n'existe donc
 * plus qu'une fois, dans `~/lib/validations/criteria`.
 *
 * Ce module n'ajoute que la politique d'absence propre aux PDF : un critère non
 * noté n'est pas un critère à zéro. `calculateWeightedScore` renvoie 0 quand il
 * n'y a rien à moyenner, ce qui convient à un formulaire mais afficherait
 * « 0/100 » au lieu de « — » sur la synthèse d'un produit pas encore noté.
 */

import { calculateWeightedScore } from "~/lib/validations/criteria";

export interface WeightedEntry {
  /** `null`/`undefined` = critère non noté : il sort de la moyenne. */
  score: number | null | undefined;
  coefficient: number;
}

/**
 * Renvoie la moyenne pondérée des entrées notées, ou `null` s'il n'y a rien à
 * moyenner (aucune note, ou somme des coefficients nulle).
 */
export function weightedAverageOrNull(entries: readonly WeightedEntry[]): number | null {
  const scored = entries.filter(
    (entry): entry is WeightedEntry & { score: number } =>
      entry.score !== null && entry.score !== undefined
  );

  if (scored.length === 0) {
    return null;
  }

  const coefficientSum = scored.reduce((sum, entry) => sum + entry.coefficient, 0);
  if (coefficientSum <= 0) {
    return null;
  }

  return calculateWeightedScore(
    scored.map((entry) => ({
      score: entry.score,
      criterionCoefficient: entry.coefficient,
    }))
  );
}
