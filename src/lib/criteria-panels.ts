/**
 * Regroupement des critères de notation par jury.
 *
 * Le jury pro et le jury public notent sur des grilles différentes : tout
 * écran qui liste les critères d'une catégorie sans savoir de quel jury il
 * parle doit les présenter grille par grille.
 */

import { juryPanelEnum, type JuryPanel } from "~/lib/enums";

export interface PanelCriteriaGroup<T> {
  panel: JuryPanel;
  criteria: T[];
}

/**
 * Critères groupés par jury, pro puis public, l'ordre d'origine conservé dans
 * chaque groupe. Un jury sans critère n'a pas de groupe.
 */
export function groupCriteriaByPanel<T extends { panel: JuryPanel }>(
  criteria: readonly T[]
): PanelCriteriaGroup<T>[] {
  return juryPanelEnum
    .map((panel) => ({ panel, criteria: criteria.filter((c) => c.panel === panel) }))
    .filter((group) => group.criteria.length > 0);
}

/** Critères d'un seul jury. */
export function criteriaOfPanel<T extends { panel: JuryPanel }>(
  criteria: readonly T[],
  panel: JuryPanel
): T[] {
  return criteria.filter((c) => c.panel === panel);
}
