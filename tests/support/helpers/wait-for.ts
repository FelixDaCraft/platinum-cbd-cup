/**
 * Wait-for helper utilities
 * Provides polling and retry patterns for E2E tests
 */

/**
 * Wait for a condition to be true
 * @param condition Function that returns a promise resolving to boolean
 * @param options Timeout and interval options
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Retry an operation until it succeeds or times out
 * @param operation Function to retry
 * @param options Retry options
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Operation failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

/**
 * Poll for a value until it matches expected
 * @param getValue Function to get current value
 * @param expected Expected value
 * @param options Timeout and interval
 */
export async function pollUntilEqual<T>(
  getValue: () => Promise<T>,
  expected: T,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const value = await getValue();
    if (value === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  const finalValue = await getValue();
  throw new Error(`Expected ${expected} but got ${finalValue} after ${timeout}ms`);
}
