/**
 * Static lookup of aroma descriptors for each terpene an SFP GC-FID
 * certificate typically reports. Keyed by the abbreviation found in the
 * PDF (matching the CompoundRow.abbreviation field).
 *
 * Keep the descriptor lists short (1-4 keywords) so they fit next to the
 * terpene rows in both the upload preview dialog and the synthesis PDF
 * bar chart. Descriptors are in French — they're shown to the producer.
 *
 * Sources: consensus profiles from published cannabis terpene literature
 * (Russo 2011, Sommano et al. 2020, Leafly/Weedmaps aromatic references).
 */

export const TERPENE_AROMAS: Record<string, readonly string[]> = {
  // Monoterpenes
  MYRC: ["terreux", "musqué", "mangue"],
  LIMON: ["agrumes", "citron"],
  BOCIM: ["fruité", "herbacé", "sucré"],
  APINE: ["pin", "résine", "romarin"],
  BPINE: ["pin", "résine"],
  LINAL: ["floral", "lavande"],
  TERPI: ["frais", "herbacé", "agrumes", "floral"],
  PHELA: ["menthe", "poivré", "agrumes"],
  DCARE: ["sucré", "citron", "résineux"], // 3-Carene
  ATERPI: ["herbacé", "citron", "agrumes"], // alpha-Terpinene
  CAMP: ["camphre", "terreux"],
  FENCH: ["terreux", "café", "camphre"],
  BORN: ["camphre", "menthe"],
  ATERP: ["floral", "pin", "lilas"], // alpha-Terpineol

  // Sesquiterpenes
  BCARY: ["poivré", "épicé", "boisé"],
  HUMU: ["houblon", "terreux", "boisé"],
  CAROO: ["épicé", "bois humide"], // Caryophyllene oxide
  LEVO: ["floral", "camomille", "miel"], // alpha-Bisabolol
  TBFARN: ["pomme verte", "fruité doux"], // trans-beta-Farnesene
  TNER: ["pomme", "boisé", "floral"], // trans-Nerolidol
  GUAOL: ["pin", "boisé", "rose"],
  GUAAC: ["boisé", "floral doux"], // Guaiol acetate
  FARN2: ["pomme", "floral doux"], // Farnesol isomer 2
};

/**
 * Return the aroma descriptors for a given terpene abbreviation, or an
 * empty array when we don't have a match. Safe to call on unknown inputs.
 */
export function getTerpeneAroma(abbreviation: string): readonly string[] {
  return TERPENE_AROMAS[abbreviation] ?? [];
}

/**
 * Join a terpene's aroma descriptors into a single compact string for
 * display in tight layouts (PDF bar chart rows, small table cells).
 */
export function formatTerpeneAroma(
  abbreviation: string,
  separator = " · ",
): string {
  return getTerpeneAroma(abbreviation).join(separator);
}
