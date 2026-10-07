/**
 * Affichage back-office des deux codes anonymes d'un produit (jury pro, jury
 * public). Les jurés ne voient jamais que le code de leur panel ;
 * l'organisation, elle, manipule les deux.
 */
export function formatPanelCodes(
  pro: string | null | undefined,
  publicCode: string | null | undefined
): string | null {
  if (!pro && !publicCode) return null;
  return `${pro ?? "—"} / ${publicCode ?? "—"}`;
}
