/**
 * Cup Factory
 * Generates test cup data for E2E tests
 */

let cupCounter = 0;

export interface TestCup {
  id: string;
  name: string;
  description: string;
  type: "public" | "pro";
  ratingScale: "1-10" | "1-20";
  currency: "EUR" | "USD" | "CHF";
  defaultPricePerProduct: number;
}

/**
 * Create a test cup
 */
export function createTestCup(overrides: Partial<TestCup> = {}): TestCup {
  cupCounter++;
  return {
    id: `test_cup_${cupCounter}`,
    name: `Test Cup ${cupCounter}`,
    description: `Description for test cup ${cupCounter}`,
    type: "public",
    ratingScale: "1-10",
    currency: "EUR",
    defaultPricePerProduct: 2500, // 25.00 EUR in cents
    ...overrides,
  };
}

/**
 * Create a pro cup
 */
export function createTestProCup(overrides: Partial<TestCup> = {}): TestCup {
  return createTestCup({
    type: "pro",
    defaultPricePerProduct: 5000,
    ...overrides,
  });
}

/**
 * Reset cup counter
 */
export function resetCupCounter(): void {
  cupCounter = 0;
}
