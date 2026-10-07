/**
 * Accès aux colonnes de résultats d'un produit selon le panel de jury.
 *
 * Chaque produit porte deux jeux de colonnes (`*_pro`, `*_public`) : ces
 * helpers évitent de répéter le choix de colonne dans chaque requête et chaque
 * écran.
 */

import type { JuryPanel } from "~/server/db/schema/juries";
import { products } from "~/server/db/schema/products";

/** Colonnes Drizzle d'un panel, pour les `select` et les `where`. */
export function panelColumns(panel: JuryPanel) {
  return panel === "pro"
    ? {
        anonymousCode: products.anonymousCodePro,
        finalScore: products.finalScorePro,
        categoryRank: products.categoryRankPro,
      }
    : {
        anonymousCode: products.anonymousCodePublic,
        finalScore: products.finalScorePublic,
        categoryRank: products.categoryRankPublic,
      };
}

type PanelFields = {
  anonymousCodePro?: string | null;
  anonymousCodePublic?: string | null;
  finalScorePro?: string | null;
  finalScorePublic?: string | null;
  categoryRankPro?: number | null;
  categoryRankPublic?: number | null;
};

/** Code anonyme d'un produit dans un panel (celui que voit un juré de ce panel). */
export function codeFor(product: PanelFields, panel: JuryPanel): string | null {
  return (panel === "pro" ? product.anonymousCodePro : product.anonymousCodePublic) ?? null;
}

/** Score final d'un produit dans un panel, en nombre. */
export function scoreFor(product: PanelFields, panel: JuryPanel): number | null {
  const raw = panel === "pro" ? product.finalScorePro : product.finalScorePublic;
  return raw === null || raw === undefined ? null : parseFloat(raw);
}

/** Rang de catégorie d'un produit dans un panel. */
export function rankFor(product: PanelFields, panel: JuryPanel): number | null {
  return (panel === "pro" ? product.categoryRankPro : product.categoryRankPublic) ?? null;
}

/** Vrai si le produit a un résultat dans au moins un panel. */
export function hasAnyResult(product: PanelFields): boolean {
  return product.finalScorePro != null || product.finalScorePublic != null;
}

/** Vrai si le produit a été anonymisé (les deux codes sont tirés ensemble). */
export function isAnonymized(product: PanelFields): boolean {
  return product.anonymousCodePro != null || product.anonymousCodePublic != null;
}

export interface PanelResultView {
  finalScore: number;
  categoryRank: number | null;
}

/**
 * Résultats d'un produit, panel par panel, pour l'affichage : `null` pour un
 * panel où le produit n'a pas été noté (ancienne édition à un seul jury, ou
 * catégorie sans juré de ce panel).
 */
export function panelResults(
  product: PanelFields
): Record<"pro" | "public", PanelResultView | null> {
  const view = (panel: JuryPanel): PanelResultView | null => {
    const finalScore = scoreFor(product, panel);
    return finalScore === null ? null : { finalScore, categoryRank: rankFor(product, panel) };
  };
  return { pro: view("pro"), public: view("public") };
}
