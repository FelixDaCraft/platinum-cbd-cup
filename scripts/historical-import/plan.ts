/**
 * Platinum CBD Cup — historical results import plan (editions 2023, 2024, 2025).
 *
 * Structure: each édition is split into TWO cups (PRO + Public), mirroring
 * the 2026 model already in DB. The Public cup keeps only the 1st place
 * (= "Prix du public") per category — older editions only published the
 * winner of the audience vote, not the full podium.
 *
 * REVIEW BEFORE IMPORTING. Each product line has a `producer` field with one of:
 *   - { action: "LINK", producerId: "<id>", sourceName: "<as cited>" }
 *     → reuse an existing producer record from the org
 *   - { action: "CREATE", companyName: "<name>" }
 *     → create a stub producer (auto-creates a placeholder user, no login).
 *       The runner dedupes by normalized companyName, so the same name in
 *       multiple cups reuses the same producer record.
 *   - { action: "SKIP", reason: "<why>" }
 *     → do NOT import this product
 *
 * Sources:
 *   2023 → https://panoramacbd.fr/platinum-cbd-cup/  (only PRO data)
 *   2024 → https://www.newsweed.fr/resultats-platinum-cup-2024/
 *   2025 → https://lecomptoirducbdbio.fr/blogs/le-mag/platinum-cbd-cup-2025-resultats
 *          https://amour-de-chanvre.fr/blogs/le-blog/platinum-cbd-cup-2025-tous-les-resultats-et-gagnants-du-concours
 */

export type ProducerMatch =
  | { action: "LINK"; producerId: string; sourceName: string }
  | { action: "CREATE"; companyName: string; brandName?: string }
  | { action: "SKIP"; reason: string };

export interface ProductImport {
  productName: string;
  /** Maps to one of the cup's `categories[].key`. */
  categoryKey: string;
  /** Podium rank (1, 2, 3). For Public cups, all winners are rank=1. */
  rank: 1 | 2 | 3;
  producer: ProducerMatch;
}

export type ResultsVisibility = "podium" | "labels" | "labels_and_podium" | "all";

export interface CupImport {
  year: number;
  /** Edition number (PRO + Public count as one edition). */
  editionNumber: number;
  /** Drives `cups.type` and the cup naming suffix. */
  juryKind: "pro" | "public";
  name: string;
  description?: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  ratingStartAt: string;
  ratingEndAt: string;
  resultsPublishedAt: string;
  eventDate: string;
  eventLocation: string;
  /** Drives the public /palmares display. "podium" hides label pills. */
  resultsVisibility: ResultsVisibility;
  /** `code` is a 3-letter short used in anonymous codes (e.g. "OUT-001"). */
  categories: { key: string; code: string; name: string }[];
  labels: {
    key: string;
    name: string;
    minScore: number;
    maxScore?: number;
    color: string;
  }[];
  products: ProductImport[];
}

// ─── Producer match shortcuts (12 confirmed matches in DB) ──────────────────
const P = {
  HAPPY_POUSSE: "fLF6us3oU8qvf_U_c-MFk",
  ARTIZANE: "rWHxq4bd5y5kmh0LmVt7z",
  BZHASH_MAKER: "VGGev_J209rFr61qM3e5C",
  CBD_EN_PROVENCE: "1TSVFNlPYea_mi6yNVxLa",
  CBUDDY: "KS7o1YnwalITWV6OPVnre",
  CHANVRE_PERIGORD: "YJ0A_zFWLd-Xbs4fFH7uc",
  CHARENT_HAZE: "gZc8rsT6GaQuMea-o2vnD",
  HERA_CBD: "2l-MrzqII0HvlRM0ZXRu0",
  LA_FERME_DU_RIAL: "0XVcx4QyyiOU2Lva_fayr",
  LA_FERME_EN_HERBE: "9bF9Jx0Os4ZWaIKd8xPJc",
  LA_FLEUR_VENDEENNE: "UPf3uAc70Hsoo-b1J9a7m",
  LE_SPLIFF_FRANCAIS: "XA1fp0n_mKreQbGCOXWe9",
} as const;

const link = (producerId: string, sourceName: string): ProducerMatch => ({
  action: "LINK",
  producerId,
  sourceName,
});

const create = (companyName: string): ProducerMatch => ({
  action: "CREATE",
  companyName,
});

// ─── Common labels (shared across cups) ──────────────────────────────────────
const STANDARD_LABELS: CupImport["labels"] = [
  { key: "PLATINUM", name: "PLATINUM", minScore: 18, color: "#d4af37" },
  { key: "GOLD", name: "GOLD", minScore: 17.5, maxScore: 17.99, color: "#b8860b" },
  { key: "SILVER", name: "SILVER", minScore: 17, maxScore: 17.49, color: "#9ca3af" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Edition 01 · 2023 — Jury PRO (only — no Public data found in source)
// ═══════════════════════════════════════════════════════════════════════════
const cup2023Pro: CupImport = {
  year: 2023,
  editionNumber: 1,
  juryKind: "pro",
  name: "PlatinumCBD CUP 2023 - Jury PRO",
  description: "1ère édition · Nantes · 6 catégories",
  registrationOpenAt: "2023-02-01T08:00:00Z",
  registrationCloseAt: "2023-04-15T22:00:00Z",
  ratingStartAt: "2023-04-20T08:00:00Z",
  ratingEndAt: "2023-05-19T22:00:00Z",
  resultsPublishedAt: "2023-05-20T17:00:00Z",
  eventDate: "2023-05-20T10:00:00Z",
  eventLocation: "Nantes, France",
  resultsVisibility: "podium",
  categories: [
    { key: "indoor", code: "IND", name: "Fleurs CBD Indoor" },
    { key: "outdoor", code: "OUT", name: "Fleurs CBD Outdoor" },
    { key: "greenhouse", code: "GRN", name: "Fleurs CBD Greenhouse" },
    { key: "cbg-outdoor", code: "CBG", name: "Fleurs CBG Outdoor" },
    { key: "hash", code: "HSH", name: "Hash / Résine" },
    { key: "edibles", code: "EDI", name: "Edibles" },
  ],
  labels: STANDARD_LABELS,
  products: [
    // Indoor
    { productName: "S56", categoryKey: "indoor", rank: 1, producer: create("Leaf District") },
    { productName: "Agrume Haze", categoryKey: "indoor", rank: 2, producer: create("Hakuna Sativa") },
    { productName: "Rez Kush", categoryKey: "indoor", rank: 3, producer: create("IznoFarm") },
    // Outdoor
    { productName: "Lemon Pie", categoryKey: "outdoor", rank: 1, producer: create("Les Botanistes") },
    { productName: "Berry x Cherry Berry", categoryKey: "outdoor", rank: 2, producer: create("Les Frères Canna") },
    { productName: "Shao K", categoryKey: "outdoor", rank: 3, producer: create("IznoFarm") },
    // Greenhouse
    { productName: "Banana Cake", categoryKey: "greenhouse", rank: 1, producer: create("Les Botanistes") },
    { productName: "Shao x Pink Panther", categoryKey: "greenhouse", rank: 2, producer: create("IznoFarm") },
    { productName: "Orange Buddha", categoryKey: "greenhouse", rank: 3, producer: create("UtoPlantes") },
    // CBG Outdoor
    { productName: "IznoKush CBG", categoryKey: "cbg-outdoor", rank: 1, producer: create("IznoFarm") },
    { productName: "Mad Dog", categoryKey: "cbg-outdoor", rank: 2, producer: link(P.LA_FERME_EN_HERBE, "La Ferme en Herbe") },
    { productName: "White CBG", categoryKey: "cbg-outdoor", rank: 3, producer: create("French Bio Farmers") },
    // Hash
    { productName: "Frutti", categoryKey: "hash", rank: 1, producer: link(P.LE_SPLIFF_FRANCAIS, "Le Spliff Français") },
    { productName: "Bubble Hash Cherry Berry", categoryKey: "hash", rank: 2, producer: create("Hemp of Champ") },
    { productName: "Ancestral Bud", categoryKey: "hash", rank: 3, producer: create("UtoPlantes") },
    // Edibles
    { productName: "Miel Infusé au Chanvre", categoryKey: "edibles", rank: 1, producer: link(P.CHARENT_HAZE, "Charent'Haze") },
    { productName: "Gummies Full-spectrum Passion", categoryKey: "edibles", rank: 2, producer: create("FrenchFarm.ac") },
    { productName: "Bonbons Miel et Chanvre", categoryKey: "edibles", rank: 3, producer: create("Cannapoitou") },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Edition 02 · 2024 — Jury PRO
// ═══════════════════════════════════════════════════════════════════════════
const cup2024Pro: CupImport = {
  year: 2024,
  editionNumber: 2,
  juryKind: "pro",
  name: "PlatinumCBD CUP 2024 - Jury PRO",
  description: "2e édition · Cann'Agri Expo · Nantes · 4 catégories",
  registrationOpenAt: "2024-01-15T08:00:00Z",
  registrationCloseAt: "2024-03-31T22:00:00Z",
  ratingStartAt: "2024-04-08T08:00:00Z",
  ratingEndAt: "2024-05-06T22:00:00Z",
  resultsPublishedAt: "2024-05-07T17:00:00Z",
  eventDate: "2024-05-07T10:00:00Z",
  eventLocation: "Cann'Agri Expo · Nantes, France",
  resultsVisibility: "podium",
  categories: [
    { key: "outdoor", code: "OUT", name: "Fleurs CBD Outdoor" },
    { key: "greenhouse", code: "GRN", name: "Fleurs CBD Greenhouse" },
    { key: "hash", code: "HSH", name: "Hash" },
    { key: "edibles", code: "EDI", name: "Edibles" },
  ],
  labels: STANDARD_LABELS,
  products: [
    // Outdoor
    { productName: "Legendary Platinum OG Diesel Edition", categoryKey: "outdoor", rank: 1, producer: create("Pinnacle Solutions") },
    { productName: "Cannapunch", categoryKey: "outdoor", rank: 2, producer: link(P.CBD_EN_PROVENCE, "CBD en Provence") },
    { productName: "Siesta", categoryKey: "outdoor", rank: 3, producer: create("Le Chanvre des Combrailles") },
    // Greenhouse
    { productName: "Purple Cake CBD", categoryKey: "greenhouse", rank: 1, producer: link(P.LA_FERME_EN_HERBE, "La Ferme en Herbe") },
    { productName: "TropiCake", categoryKey: "greenhouse", rank: 2, producer: create("UtoPlantes") },
    { productName: "Harlequin", categoryKey: "greenhouse", rank: 3, producer: link(P.CHANVRE_PERIGORD, "Chanvre Périgord") },
    // Hash
    { productName: "Sapphire Hash", categoryKey: "hash", rank: 1, producer: create("UtoPlantes") },
    { productName: "Pollen CBD", categoryKey: "hash", rank: 2, producer: link(P.CHARENT_HAZE, "Charent'Haze") },
    { productName: "BZ1", categoryKey: "hash", rank: 3, producer: link(P.BZHASH_MAKER, "BZHash Maker") },
    // Edibles
    { productName: "CannaRilax", categoryKey: "edibles", rank: 1, producer: create("UtoPlantes") },
    { productName: "Crousti-Chanvre", categoryKey: "edibles", rank: 2, producer: create("Le Chanvre du Griffoul") },
    { productName: "Miel et résine", categoryKey: "edibles", rank: 3, producer: create("Cannevyre") },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Edition 02 · 2024 — Jury Public (Prix du public — only 1st per category)
// ═══════════════════════════════════════════════════════════════════════════
const cup2024Public: CupImport = {
  year: 2024,
  editionNumber: 2,
  juryKind: "public",
  name: "PlatinumCBD CUP 2024 - Jury Public",
  description: "2e édition · Prix du public · 3 catégories",
  registrationOpenAt: "2024-01-15T08:00:00Z",
  registrationCloseAt: "2024-03-31T22:00:00Z",
  ratingStartAt: "2024-05-07T10:00:00Z",
  ratingEndAt: "2024-05-07T18:00:00Z",
  resultsPublishedAt: "2024-05-07T18:00:00Z",
  eventDate: "2024-05-07T10:00:00Z",
  eventLocation: "Cann'Agri Expo · Nantes, France",
  resultsVisibility: "podium",
  categories: [
    { key: "outdoor", code: "OUT", name: "Fleurs CBD Outdoor" },
    { key: "greenhouse", code: "GRN", name: "Fleurs CBD Greenhouse" },
    { key: "edibles", code: "EDI", name: "Edibles" },
  ],
  labels: STANDARD_LABELS,
  products: [
    { productName: "Pink Panther", categoryKey: "outdoor", rank: 1, producer: create("UtoPlantes") },
    { productName: "Moonlight", categoryKey: "greenhouse", rank: 1, producer: create("Au Coin du Parc") },
    { productName: "Miel et CBD", categoryKey: "edibles", rank: 1, producer: create("Cannevyre") },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Edition 03 · 2025 — Jury PRO
// ═══════════════════════════════════════════════════════════════════════════
const cup2025Pro: CupImport = {
  year: 2025,
  editionNumber: 3,
  juryKind: "pro",
  name: "PlatinumCBD CUP 2025 - Jury PRO",
  description: "3e édition · Cann'Agri Expo · Nantes · 1ère ouverture européenne · 43 producteurs · 75 produits",
  registrationOpenAt: "2024-12-01T08:00:00Z",
  registrationCloseAt: "2025-03-15T22:00:00Z",
  ratingStartAt: "2025-03-22T08:00:00Z",
  ratingEndAt: "2025-04-18T22:00:00Z",
  resultsPublishedAt: "2025-04-20T17:00:00Z",
  eventDate: "2025-04-20T10:00:00Z",
  eventLocation: "Cann'Agri Expo · Nantes, France",
  resultsVisibility: "podium",
  categories: [
    { key: "indoor-fr", code: "IFR", name: "Fleurs CBD Indoor (France)" },
    { key: "indoor-eu", code: "IEU", name: "Fleurs CBD Indoor (Europe)" },
    { key: "outdoor-eu", code: "OUT", name: "Fleurs CBD Outdoor (Europe)" },
    { key: "greenhouse-eu", code: "GRN", name: "Fleurs CBD Greenhouse (Europe)" },
    { key: "hash-dry", code: "HDR", name: "Hash Dry (Europe)" },
    { key: "hash-iol", code: "HIO", name: "Hash Ice-O-Lator" },
    { key: "edibles", code: "EDI", name: "Edibles" },
  ],
  labels: STANDARD_LABELS,
  products: [
    // Indoor France
    { productName: "Lemon Grace", categoryKey: "indoor-fr", rank: 1, producer: link(P.HAPPY_POUSSE, "Happy Pousse") },
    { productName: "Blue Meringue", categoryKey: "indoor-fr", rank: 2, producer: create("Les Botanistes") },
    { productName: "MB Gum", categoryKey: "indoor-fr", rank: 3, producer: link(P.LA_FLEUR_VENDEENNE, "La Fleur Vendéenne") },
    // Indoor Europe
    { productName: "Tangie Juice", categoryKey: "indoor-eu", rank: 1, producer: create("Chanvre DC") },
    { productName: "Fear of Fog", categoryKey: "indoor-eu", rank: 2, producer: create("Weneed") },
    { productName: "Master of Disaster", categoryKey: "indoor-eu", rank: 3, producer: create("CR Performance") },
    // Outdoor Europe
    { productName: "Lemon Grace (Outdoor)", categoryKey: "outdoor-eu", rank: 1, producer: link(P.HAPPY_POUSSE, "Happy Pousse") },
    { productName: "Island Kush", categoryKey: "outdoor-eu", rank: 2, producer: link(P.ARTIZANE, "Art'izane") },
    { productName: "Cheese Cake", categoryKey: "outdoor-eu", rank: 3, producer: create("L'Herbe Enchantée") },
    // Greenhouse Europe
    { productName: "Sapphire Kush", categoryKey: "greenhouse-eu", rank: 1, producer: create("Smellz") },
    { productName: "Afghan Berry", categoryKey: "greenhouse-eu", rank: 2, producer: link(P.HERA_CBD, "Hera CBD") },
    { productName: "Dark Saphir", categoryKey: "greenhouse-eu", rank: 3, producer: link(P.HAPPY_POUSSE, "Happy Pousse") },
    // Hash Dry
    { productName: "Blue Blood", categoryKey: "hash-dry", rank: 1, producer: link(P.LE_SPLIFF_FRANCAIS, "Le Spliff Français") },
    { productName: "DrySift OZK 120-70", categoryKey: "hash-dry", rank: 2, producer: create("Les Frères Canna") },
    { productName: "BZI Bananas", categoryKey: "hash-dry", rank: 3, producer: link(P.BZHASH_MAKER, "BZHash Maker") },
    // Hash Ice-O-Lator
    { productName: "WPFF Macaron Crush", categoryKey: "hash-iol", rank: 1, producer: create("Hashishin Art") },
    { productName: "Ice Moon", categoryKey: "hash-iol", rank: 2, producer: link(P.CHANVRE_PERIGORD, "Chanvre Périgord") },
    { productName: "Mr Ice", categoryKey: "hash-iol", rank: 3, producer: link(P.CBUDDY, "CBuddy") },
    // Edibles
    { productName: "Miel au CBD", categoryKey: "edibles", rank: 1, producer: create("Les Botanistes en Herbe") },
    { productName: "Chocolat Blanc", categoryKey: "edibles", rank: 2, producer: create("Cannevyre") },
    { productName: "Miel Charass", categoryKey: "edibles", rank: 3, producer: link(P.LA_FERME_DU_RIAL, "La Ferme du Rial") },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Edition 03 · 2025 — Jury Public (Prix du public — only 1st per category)
// ═══════════════════════════════════════════════════════════════════════════
const cup2025Public: CupImport = {
  year: 2025,
  editionNumber: 3,
  juryKind: "public",
  name: "PlatinumCBD CUP 2025 - Jury Public",
  description: "3e édition · Prix du public · 6 catégories",
  registrationOpenAt: "2024-12-01T08:00:00Z",
  registrationCloseAt: "2025-03-15T22:00:00Z",
  ratingStartAt: "2025-04-19T10:00:00Z",
  ratingEndAt: "2025-04-20T16:00:00Z",
  resultsPublishedAt: "2025-04-20T17:00:00Z",
  eventDate: "2025-04-20T10:00:00Z",
  eventLocation: "Cann'Agri Expo · Nantes, France",
  resultsVisibility: "podium",
  categories: [
    { key: "indoor-eu", code: "IEU", name: "Fleurs CBD Indoor (Europe)" },
    { key: "outdoor-eu", code: "OUT", name: "Fleurs CBD Outdoor (Europe)" },
    { key: "greenhouse-eu", code: "GRN", name: "Fleurs CBD Greenhouse (Europe)" },
    { key: "hash-dry", code: "HDR", name: "Hash Dry (Europe)" },
    { key: "hash-iol", code: "HIO", name: "Hash Ice-O-Lator" },
    { key: "edibles", code: "EDI", name: "Edibles" },
  ],
  labels: STANDARD_LABELS,
  products: [
    { productName: "Master of Disaster", categoryKey: "indoor-eu", rank: 1, producer: create("CR Performance") },
    { productName: "Alpenrose", categoryKey: "outdoor-eu", rank: 1, producer: create("Cannafleur") },
    { productName: "Sapphire Kush", categoryKey: "greenhouse-eu", rank: 1, producer: create("Smellz") },
    { productName: "LavenderZ 105μ", categoryKey: "hash-dry", rank: 1, producer: create("Hashishin Art") },
    { productName: "WPFF Macaron Crush", categoryKey: "hash-iol", rank: 1, producer: create("Hashishin Art") },
    { productName: "Miel au CBD", categoryKey: "edibles", rank: 1, producer: create("Les Botanistes en Herbe") },
  ],
};

export const HISTORICAL_IMPORT_PLAN: CupImport[] = [
  cup2023Pro,
  cup2024Pro,
  cup2024Public,
  cup2025Pro,
  cup2025Public,
];

// ─── Score synthesis (read by the import runner) ──────────────────────────
export const SYNTHETIC_SCORE_BY_RANK: Record<number, number> = {
  1: 18.5, // → PLATINUM
  2: 17.8, // → GOLD
  3: 17.2, // → SILVER
};
