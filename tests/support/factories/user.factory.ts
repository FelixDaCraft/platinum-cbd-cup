/**
 * User Factory
 * Generates test user data using deterministic patterns
 */

let userCounter = 0;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

/**
 * Create a test user with unique email
 * Uses counter for deterministic, non-random test data
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  userCounter++;
  return {
    id: `test_user_${userCounter}`,
    email: `test.user.${userCounter}@example.com`,
    password: "TestPassword123!",
    name: `Test User ${userCounter}`,
    ...overrides,
  };
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number): TestUser[] {
  return Array.from({ length: count }, () => createTestUser());
}

/**
 * Reset user counter (call in beforeEach for isolation)
 */
export function resetUserCounter(): void {
  userCounter = 0;
}

/**
 * Create an organizer user
 */
export function createTestOrganizer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    name: `Organizer ${userCounter}`,
    email: `organizer.${userCounter}@example.com`,
    ...overrides,
  });
}

/**
 * Create a producer user
 */
export function createTestProducer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    name: `Producer ${userCounter}`,
    email: `producer.${userCounter}@example.com`,
    ...overrides,
  });
}

/**
 * Create a jury user
 */
export function createTestJury(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    name: `Jury ${userCounter}`,
    email: `jury.${userCounter}@example.com`,
    ...overrides,
  });
}
