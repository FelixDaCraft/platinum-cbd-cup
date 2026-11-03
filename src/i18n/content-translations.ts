/**
 * Traductions des contenus saisis en base pour l'édition 2027 : catégories
 * officielles, grilles de critères (jury pro et jury public) et labels.
 *
 * Module pur, sans accès à la base : scripts/import-translations.ts l'applique
 * aux lignes existantes. La correspondance se fait sur le libellé français
 * normalisé (casse, accents, espaces, préfixe « Label »), pas sur les
 * identifiants : le même script sert en local, en préproduction et en
 * production, où les identifiants diffèrent.
 *
 * Une traduction identique au français n'est pas stockée (« Dry Hash ») : le
 * repli sur la colonne française donne le même résultat. Les fonctions
 * renvoient alors `{}` (libellé reconnu, rien à stocker), et `null` pour un
 * libellé inconnu, qui reste en français.
 */
import { locales, type Locale, type Translations } from "./locales";

type Foreign = Exclude<Locale, "fr">;
type PerLocale = Record<Foreign, string>;

const FOREIGN = locales.filter((l): l is Foreign => l !== "fr");

/** Clé de comparaison : minuscules, sans accents ni ponctuation superflue. */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[\s.…]+/g, " ")
    .trim()
    .toLowerCase();
}

// ─── Catégories ────────────────────────────────────────────────────────────

/** « Fleurs » selon la langue ; Outdoor / Greenhouse / Indoor restent tels quels. */
const FLOWERS: PerLocale = {
  en: "Flowers",
  it: "Fiori",
  de: "Blüten",
  cs: "Květy",
  nl: "Toppen",
  es: "Flores",
};

function translateCategory(name: string, locale: Foreign): string | null {
  const trimmed = name.trim();
  const flowers = /^fleurs?\s+(.+)$/i.exec(trimmed);
  if (flowers?.[1]) {
    const kind = flowers[1];
    // L'anglais place le type avant le nom : « Outdoor Flowers ».
    return locale === "en" ? `${kind} ${FLOWERS.en}` : `${FLOWERS[locale]} ${kind}`;
  }
  // Dry Hash, Water Hash, Ice-O-Lator : termes du métier, partout identiques.
  if (/hash/i.test(trimmed)) return trimmed;
  return null;
}

// ─── Critères ──────────────────────────────────────────────────────────────

/** Familles de critères, écrites en capitales comme dans la grille française. */
const FAMILIES: Record<string, PerLocale> = {
  visuel: { en: "APPEARANCE", it: "ASPETTO", de: "OPTIK", cs: "VZHLED", nl: "UITERLIJK", es: "ASPECTO" },
  odeur: { en: "AROMA", it: "AROMA", de: "GERUCH", cs: "VŮNĚ", nl: "GEUR", es: "AROMA" },
  gout: { en: "TASTE", it: "GUSTO", de: "GESCHMACK", cs: "CHUŤ", nl: "SMAAK", es: "SABOR" },
};

const ASPECTS: Record<string, PerLocale> = {
  trim: { en: "trim", it: "rifinitura", de: "Trim", cs: "zastřižení", nl: "knipwerk", es: "manicura" },
  trichomes: { en: "trichomes", it: "tricomi", de: "Trichome", cs: "trichomy", nl: "trichomen", es: "tricomas" },
  general: { en: "overall", it: "generale", de: "Gesamteindruck", cs: "celkově", nl: "algemeen", es: "general" },
  puissance: { en: "intensity", it: "intensità", de: "Intensität", cs: "intenzita", nl: "intensiteit", es: "intensidad" },
  qualite: { en: "quality", it: "qualità", de: "Qualität", cs: "kvalita", nl: "kwaliteit", es: "calidad" },
  originalite: { en: "originality", it: "originalità", de: "Originalität", cs: "originalita", nl: "originaliteit", es: "originalidad" },
  fidelite: { en: "faithfulness", it: "fedeltà", de: "Übereinstimmung", cs: "věrnost", nl: "overeenkomst", es: "fidelidad" },
  persistance: { en: "persistence", it: "persistenza", de: "Nachhall", cs: "dozvuk", nl: "nasmaak", es: "persistencia" },
};

/** Descriptions des grilles 2027 (DEFAULT_CRITERIA), par texte français normalisé. */
const DESCRIPTIONS: Record<string, PerLocale> = {
  [normalizeLabel("Qualité de la manucure.")]: {
    en: "Quality of the trim.",
    it: "Qualità della rifinitura.",
    de: "Qualität des Trims.",
    cs: "Kvalita zastřižení.",
    nl: "Kwaliteit van het knipwerk.",
    es: "Calidad de la manicura.",
  },
  [normalizeLabel("Quantité et état des trichomes (abîmés, couleur…).")]: {
    en: "Amount and condition of the trichomes (damage, colour…).",
    it: "Quantità e stato dei tricomi (danneggiati, colore…).",
    de: "Menge und Zustand der Trichome (beschädigt, Farbe …).",
    cs: "Množství a stav trichomů (poškození, barva…).",
    nl: "Hoeveelheid en staat van de trichomen (beschadigd, kleur…).",
    es: "Cantidad y estado de los tricomas (dañados, color…).",
  },
  [normalizeLabel("Présence ou absence de corps étrangers, moisissures, insectes, graines…")]: {
    en: "Presence or absence of foreign matter, mould, insects, seeds…",
    it: "Presenza o assenza di corpi estranei, muffe, insetti, semi…",
    de: "Vorhandensein oder Fehlen von Fremdkörpern, Schimmel, Insekten, Samen …",
    cs: "Přítomnost či nepřítomnost cizích těles, plísní, hmyzu, semen…",
    nl: "Aan- of afwezigheid van vreemde deeltjes, schimmel, insecten, zaden…",
    es: "Presencia o ausencia de cuerpos extraños, moho, insectos, semillas…",
  },
  [normalizeLabel("Puissance de l'odeur.")]: {
    en: "Intensity of the aroma.",
    it: "Intensità dell'aroma.",
    de: "Intensität des Geruchs.",
    cs: "Intenzita vůně.",
    nl: "Intensiteit van de geur.",
    es: "Intensidad del aroma.",
  },
  [normalizeLabel("Odeur agréable, homogène…")]: {
    en: "Pleasant, consistent aroma…",
    it: "Aroma gradevole, omogeneo…",
    de: "Angenehmer, gleichmäßiger Geruch …",
    cs: "Příjemná, vyrovnaná vůně…",
    nl: "Aangename, evenwichtige geur…",
    es: "Aroma agradable, homogéneo…",
  },
  [normalizeLabel("Déjà senti une fleur similaire ou odeur totalement nouvelle.")]: {
    en: "A flower you have smelled before, or a completely new aroma.",
    it: "Un fiore già sentito o un aroma del tutto nuovo.",
    de: "Eine bereits bekannte Blüte oder ein völlig neuer Geruch.",
    cs: "Podobný květ už jste cítili, nebo zcela nová vůně.",
    nl: "Een top die je al eens hebt geroken, of een totaal nieuwe geur.",
    es: "Una flor ya olida antes o un aroma totalmente nuevo.",
  },
  [normalizeLabel("Goût agréable, homogène…")]: {
    en: "Pleasant, consistent taste…",
    it: "Gusto gradevole, omogeneo…",
    de: "Angenehmer, gleichmäßiger Geschmack …",
    cs: "Příjemná, vyrovnaná chuť…",
    nl: "Aangename, evenwichtige smaak…",
    es: "Sabor agradable, homogéneo…",
  },
  [normalizeLabel("Fidèle à l'odeur.")]: {
    en: "True to the aroma.",
    it: "Fedele all'aroma.",
    de: "Entspricht dem Geruch.",
    cs: "Odpovídá vůni.",
    nl: "Komt overeen met de geur.",
    es: "Fiel al aroma.",
  },
  [normalizeLabel("Reste en bouche.")]: {
    en: "Lingers on the palate.",
    it: "Resta in bocca.",
    de: "Bleibt am Gaumen.",
    cs: "Zůstává na patře.",
    nl: "Blijft hangen in de mond.",
    es: "Permanece en boca.",
  },
  [normalizeLabel("Présence ou absence de corps étrangers, moisissures… Résineuse ou non.")]: {
    en: "Presence or absence of foreign matter, mould… Resinous or not.",
    it: "Presenza o assenza di corpi estranei, muffe… Resinosa o no.",
    de: "Vorhandensein oder Fehlen von Fremdkörpern, Schimmel … Harzig oder nicht.",
    cs: "Přítomnost či nepřítomnost cizích těles, plísní… Pryskyřičná, nebo ne.",
    nl: "Aan- of afwezigheid van vreemde deeltjes, schimmel… Harsig of niet.",
    es: "Presencia o ausencia de cuerpos extraños, moho… Resinosa o no.",
  },
  [normalizeLabel("Déjà senti une fleur similaire ou odeur nouvelle.")]: {
    en: "A flower you have smelled before, or a new aroma.",
    it: "Un fiore già sentito o un aroma nuovo.",
    de: "Eine bereits bekannte Blüte oder ein neuer Geruch.",
    cs: "Podobný květ už jste cítili, nebo nová vůně.",
    nl: "Een top die je al eens hebt geroken, of een nieuwe geur.",
    es: "Una flor ya olida antes o un aroma nuevo.",
  },
  [normalizeLabel("Puissance du goût.")]: {
    en: "Intensity of the taste.",
    it: "Intensità del gusto.",
    de: "Intensität des Geschmacks.",
    cs: "Intenzita chuti.",
    nl: "Intensiteit van de smaak.",
    es: "Intensidad del sabor.",
  },
  [normalizeLabel("Déjà goûté une fleur similaire ou goût nouveau.")]: {
    en: "A flower you have tasted before, or a new taste.",
    it: "Un fiore già assaggiato o un gusto nuovo.",
    de: "Eine bereits probierte Blüte oder ein neuer Geschmack.",
    cs: "Podobný květ už jste ochutnali, nebo nová chuť.",
    nl: "Een top die je al eens hebt geproefd, of een nieuwe smaak.",
    es: "Una flor ya probada antes o un sabor nuevo.",
  },
};

/** « VISUEL trim », « 2.1 ODEUR » : famille, aspect facultatif, numéro conservé. */
function translateCriterionName(name: string, locale: Foreign): string | null {
  const m = /^(\d+(?:\.\d+)*\.?\s+)?(visuel|odeur|go[uû]t)\b\s*(.*)$/i.exec(name.trim());
  if (!m) return null;
  const [, number = "", familyRaw = "", rest = ""] = m;
  const family = FAMILIES[normalizeLabel(familyRaw)];
  if (!family) return null;
  if (rest === "") return `${number}${family[locale]}`;
  const aspect = ASPECTS[normalizeLabel(rest)];
  return aspect ? `${number}${family[locale]} ${aspect[locale]}` : null;
}

// ─── Labels ────────────────────────────────────────────────────────────────

const LABEL_WORDS: Record<string, PerLocale> = {
  or: { en: "Gold", it: "Oro", de: "Gold", cs: "Zlaté", nl: "Goud", es: "Oro" },
  argent: { en: "Silver", it: "Argento", de: "Silber", cs: "Stříbrné", nl: "Zilver", es: "Plata" },
  bronze: { en: "Bronze", it: "Bronzo", de: "Bronze", cs: "Bronzové", nl: "Brons", es: "Bronce" },
  platine: { en: "Platinum", it: "Platino", de: "Platin", cs: "Platinové", nl: "Platina", es: "Platino" },
  mention: { en: "Commendation", it: "Menzione", de: "Anerkennung", cs: "Uznání", nl: "Eervolle vermelding", es: "Mención" },
  medaille: { en: "Medal", it: "Medaglia", de: "Medaille", cs: "Medaile", nl: "Medaille", es: "Medalla" },
  excellence: { en: "Excellence", it: "Eccellenza", de: "Exzellenz", cs: "Excelence", nl: "Excellentie", es: "Excelencia" },
  "prix du public": { en: "Audience Award", it: "Premio del pubblico", de: "Publikumspreis", cs: "Cena publika", nl: "Publieksprijs", es: "Premio del público" },
};

/** Mot « label » de chaque langue (es : « sello », cs : « ocenění »). */
const LABEL_NOUN: PerLocale = { en: "Label", it: "Label", de: "Label", cs: "ocenění", nl: "Label", es: "Sello" };

function matchCase(source: string, target: string): string {
  return source === source.toUpperCase() && /[A-Z]/.test(source) ? target.toUpperCase() : target;
}

function translateLabelName(name: string, locale: Foreign): string | null {
  const trimmed = name.trim();
  const prefixed = /^label\s+(.+)$/i.exec(trimmed);
  const wordRaw = prefixed?.[1] ?? trimmed;
  const entry = LABEL_WORDS[normalizeLabel(wordRaw)];
  if (!entry) return null;
  const word = matchCase(wordRaw, entry[locale]);
  if (!prefixed) return word;
  const noun = LABEL_NOUN[locale];
  // Ordre naturel de chaque langue : « GOLD Label », « Label ORO », « ZLATÉ ocenění ».
  if (locale === "en") return `${word} ${noun}`;
  if (locale === "cs") return `${word} ${noun}`;
  return `${noun} ${word}`;
}

const SCORE: PerLocale = { en: "Score", it: "Punteggio", de: "Punktzahl", cs: "Skóre", nl: "Score", es: "Puntuación" };
const ABOVE: PerLocale = { en: "above", it: "superiore a", de: "über", cs: "nad", nl: "boven", es: "superior a" };
const BETWEEN: Record<Foreign, [string, string]> = {
  en: ["between", "and"],
  it: ["tra", "e"],
  de: ["zwischen", "und"],
  cs: ["mezi", "a"],
  nl: ["tussen", "en"],
  es: ["entre", "y"],
};

function translateCondition(condition: string, locale: Foreign): string | null {
  const c = condition.trim();
  const above = /^score\s+sup[ée]rieur\s+[àa]\s+(.+)$/i.exec(c);
  if (above?.[1]) return `${SCORE[locale]} ${ABOVE[locale]} ${above[1]}`;
  const between = /^score\s+entre\s+(.+?)\s+et\s+(.+)$/i.exec(c);
  if (between?.[1] && between[2]) {
    const [from, and] = BETWEEN[locale];
    return `${SCORE[locale]} ${from} ${between[1]} ${and} ${between[2]}`;
  }
  const symbolic = /^score\s*([≥≤=<>].*)$/i.exec(c);
  if (symbolic?.[1]) return `${SCORE[locale]} ${symbolic[1]}`;
  return null;
}

// ─── Assemblage ────────────────────────────────────────────────────────────

type Field = "name" | "description" | "condition";
type Translator = (value: string, locale: Foreign) => string | null;

function build(
  fields: Partial<Record<Field, { value: string | null | undefined; translate: Translator }>>
): Translations | null {
  const out: Translations = {};
  let recognized = false;
  for (const locale of FOREIGN) {
    for (const [field, spec] of Object.entries(fields) as [Field, { value: string | null | undefined; translate: Translator }][]) {
      if (!spec.value?.trim()) continue;
      const translated = spec.translate(spec.value, locale);
      if (!translated) continue;
      recognized = true;
      if (translated !== spec.value.trim()) (out[locale] ??= {})[field] = translated;
    }
  }
  return recognized ? out : null;
}

export function categoryTranslations(row: { name: string; description?: string | null }): Translations | null {
  return build({ name: { value: row.name, translate: translateCategory } });
}

export function criterionTranslations(row: { name: string; description?: string | null }): Translations | null {
  return build({
    name: { value: row.name, translate: translateCriterionName },
    description: {
      value: row.description,
      translate: (value, locale) => DESCRIPTIONS[normalizeLabel(value)]?.[locale] ?? null,
    },
  });
}

export function labelTranslations(row: { name: string; condition?: string | null }): Translations | null {
  return build({
    name: { value: row.name, translate: translateLabelName },
    condition: { value: row.condition, translate: translateCondition },
  });
}

/**
 * Fusion avec ce qui est déjà en base : une traduction saisie à la main (ou
 * importée plus tôt) n'est jamais écrasée, sauf `force`. Renvoie `null` si
 * rien ne change.
 */
export function mergeTranslations(
  existing: Translations | null | undefined,
  computed: Translations | null,
  force = false
): Translations | null {
  if (!computed) return null;
  const merged: Translations = structuredClone(existing ?? {});
  let changed = false;
  for (const [locale, fields] of Object.entries(computed) as [Foreign, Record<string, string>][]) {
    for (const [field, value] of Object.entries(fields)) {
      const current = merged[locale]?.[field as Field];
      if (!force && typeof current === "string" && current.trim() !== "") continue;
      if (current === value) continue;
      (merged[locale] ??= {})[field as Field] = value;
      changed = true;
    }
  }
  return changed ? merged : null;
}
