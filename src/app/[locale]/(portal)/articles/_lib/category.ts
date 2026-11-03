/**
 * Rubrique d'un article dans la langue du lecteur. Les rubriques sont saisies
 * librement au back-office, souvent en capitales (« RÉSULTATS ») : les plus
 * courantes ont une traduction (`articles.categories.*`), les autres
 * s'affichent telles quelles, en casse normale.
 */
const KNOWN: Record<string, string> = {
  RESULTATS: "results",
  RESULTAT: "results",
  RESULTS: "results",
  EVENEMENT: "event",
  EVENT: "event",
  INTERVIEW: "interview",
  ENTRETIEN: "interview",
  ACTUALITE: "news",
  ACTUALITES: "news",
  NEWS: "news",
  PARTENAIRE: "partner",
  PARTENAIRES: "partner",
  SPONSOR: "partner",
  CONSEILS: "tips",
  TIPS: "tips",
  GUIDE: "tips",
  COULISSES: "behindTheScenes",
};

export function articleCategoryKey(category: string): string | null {
  const normalized = category
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return KNOWN[normalized] ?? null;
}

export function articleCategoryLabel(
  category: string,
  t: (key: string) => string
): string {
  const key = articleCategoryKey(category);
  if (key) return t(`categories.${key}`);
  if (category !== category.toUpperCase()) return category;
  const lower = category.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}
