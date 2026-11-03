import { describe, expect, it } from "vitest";
import { DEFAULT_CRITERIA } from "~/lib/validations/criteria";
import {
  categoryTranslations,
  criterionTranslations,
  labelTranslations,
  mergeTranslations,
} from "./content-translations";

const FOREIGN = ["en", "it", "de", "cs", "nl", "es"] as const;

describe("categoryTranslations", () => {
  it("traduit « Fleurs » et garde le type de culture", () => {
    const t = categoryTranslations({ name: "Fleurs Indoor" });
    expect(t?.en?.name).toBe("Indoor Flowers");
    expect(t?.it?.name).toBe("Fiori Indoor");
    expect(t?.de?.name).toBe("Blüten Indoor");
    expect(t?.cs?.name).toBe("Květy Indoor");
    expect(t?.nl?.name).toBe("Toppen Indoor");
    expect(t?.es?.name).toBe("Flores Indoor");
  });

  it("accepte les variantes de casse des éditions passées", () => {
    expect(categoryTranslations({ name: "Fleurs OUTDOOR" })?.en?.name).toBe("OUTDOOR Flowers");
  });

  it("reconnaît les hash, identiques dans toutes les langues, sans rien stocker", () => {
    expect(categoryTranslations({ name: "Dry Hash" })).toEqual({});
    expect(categoryTranslations({ name: "Water Hash" })).toEqual({});
    expect(mergeTranslations({}, categoryTranslations({ name: "Dry Hash" }))).toBeNull();
  });

  it("laisse une catégorie inconnue au français", () => {
    expect(categoryTranslations({ name: "Pré-rouleés" })).toBeNull();
  });
});

describe("criterionTranslations", () => {
  it("traduit nom et description de chaque critère des grilles 2027, dans chaque langue", () => {
    for (const grid of Object.values(DEFAULT_CRITERIA)) {
      for (const criterion of grid) {
        const t = criterionTranslations(criterion);
        for (const locale of FOREIGN) {
          expect(t?.[locale]?.name, `${criterion.name} (${locale})`).toBeTruthy();
          expect(t?.[locale]?.description, `${criterion.description} (${locale})`).toBeTruthy();
        }
      }
    }
  });

  it("compose famille et aspect, en capitales comme la grille française", () => {
    const t = criterionTranslations({ name: "GOÛT persistance", description: "Reste en bouche." });
    expect(t?.en?.name).toBe("TASTE persistence");
    expect(t?.de?.name).toBe("GESCHMACK Nachhall");
    expect(t?.en?.description).toBe("Lingers on the palate.");
  });

  it("garde la numérotation des anciennes grilles et tolère l'absence d'accent", () => {
    expect(criterionTranslations({ name: "3.1 GOUT" })?.es?.name).toBe("3.1 SABOR");
    expect(criterionTranslations({ name: "1. VISUEL" })?.en?.name).toBe("1. APPEARANCE");
  });

  it("ignore une description non répertoriée sans perdre le nom", () => {
    const t = criterionTranslations({ name: "ODEUR qualité", description: "Texte libre de l'organisateur" });
    expect(t?.it?.name).toBe("AROMA qualità");
    expect(t?.it?.description).toBeUndefined();
  });
});

describe("labelTranslations", () => {
  it("traduit les labels 2027 dans l'ordre naturel de chaque langue", () => {
    const t = labelTranslations({ name: "Label OR", condition: "Score supérieur à 17/20" });
    expect(t?.en?.name).toBe("GOLD Label");
    expect(t?.it?.name).toBe("Label ORO");
    expect(t?.cs?.name).toBe("ZLATÉ ocenění");
    expect(t?.es?.name).toBe("Sello ORO");
    expect(t?.en?.condition).toBe("Score above 17/20");
    expect(t?.de?.condition).toBe("Punktzahl über 17/20");
  });

  it("traduit les fourchettes de score", () => {
    const t = labelTranslations({ name: "Label Argent", condition: "Score entre 15 et 17" });
    expect(t?.en?.name).toBe("Silver Label");
    expect(t?.nl?.condition).toBe("Score tussen 15 en 17");
    expect(t?.es?.condition).toBe("Puntuación entre 15 y 17");
  });

  it("couvre les labels par défaut (Mention, Médaille, Excellence)", () => {
    const t = labelTranslations({ name: "Médaille", condition: "Score ≥ 14/20" });
    expect(t?.en?.name).toBe("Medal");
    expect(t?.it?.condition).toBe("Punteggio ≥ 14/20");
  });
});

describe("mergeTranslations", () => {
  const computed = { en: { name: "Indoor Flowers" }, de: { name: "Blüten Indoor" } };

  it("complète sans écraser une traduction déjà saisie", () => {
    const merged = mergeTranslations({ en: { name: "Indoor flowers (hand-trimmed)" } }, computed);
    expect(merged).toEqual({
      en: { name: "Indoor flowers (hand-trimmed)" },
      de: { name: "Blüten Indoor" },
    });
  });

  it("renvoie null quand tout est déjà en place (relance du script)", () => {
    expect(mergeTranslations(computed, computed)).toBeNull();
  });

  it("écrase avec force", () => {
    const merged = mergeTranslations({ en: { name: "Old" } }, computed, true);
    expect(merged?.en?.name).toBe("Indoor Flowers");
  });

  it("ne touche pas la valeur d'origine", () => {
    const existing = { en: { name: "Old" } };
    mergeTranslations(existing, computed, true);
    expect(existing.en.name).toBe("Old");
  });
});
