import type {
  Currency,
  CupType,
  RatingScale,
} from "~/server/db/schema/cups";

/**
 * Fabrique de concours pour les tests.
 *
 * Les types viennent du schéma Drizzle : la version précédente déclarait
 * `ratingScale: "1-10" | "1-20"`, des valeurs qui n'existent pas
 * (ratingScaleEnum = "0-5" | "0-10" | "0-20" | "0-100") — un test bâti sur
 * cette fabrique n'aurait jamais reflété la réalité de la base. En
 * important les types, toute évolution du schéma casse le typecheck ici.
 */

let cupCounter = 0;

export interface TestCup {
  id: string;
  name: string;
  description: string;
  type: CupType;
  ratingScale: RatingScale;
  currency: Currency;
  /** Prix par produit, en centimes (comme en base). */
  defaultPricePerProduct: number;
}

/** Concours public, valeurs par défaut du schéma. */
export function createTestCup(overrides: Partial<TestCup> = {}): TestCup {
  cupCounter++;
  return {
    id: `test_cup_${cupCounter}`,
    name: `Test Cup ${cupCounter}`,
    description: `Description for test cup ${cupCounter}`,
    type: "public",
    ratingScale: "0-20",
    currency: "EUR",
    defaultPricePerProduct: 2500, // 25,00 € en centimes
    ...overrides,
  };
}

/** Concours professionnel. */
export function createTestProCup(overrides: Partial<TestCup> = {}): TestCup {
  return createTestCup({
    type: "pro",
    defaultPricePerProduct: 5000,
    ...overrides,
  });
}

/** Remet le compteur à zéro (à appeler en beforeEach pour l'isolation). */
export function resetCupCounter(): void {
  cupCounter = 0;
}
