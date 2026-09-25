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
 * Fabriques par rôle.
 *
 * Elles lisaient `userCounter` AVANT que `createTestUser` ne l'incrémente :
 * le premier organisateur sortait avec l'id `test_user_1` mais l'email
 * `organizer.0@example.com`, et après un `resetUserCounter()` les identifiants
 * d'un test repartaient décalés de ceux du précédent. Sur un jeu de données
 * censé être déterministe, un identifiant qui ne correspond pas à son email
 * rend illisible tout échec qu'on essaie de rattacher à un compte précis.
 * On construit donc l'utilisateur d'abord, puis on dérive les libellés du
 * compteur qu'il a réellement consommé.
 */
function createTestUserWithRole(
  role: string,
  prefix: string,
  overrides: Partial<TestUser>
): TestUser {
  const user = createTestUser();
  const index = user.id.replace("test_user_", "");
  return {
    ...user,
    name: `${role} ${index}`,
    email: `${prefix}.${index}@example.com`,
    ...overrides,
  };
}

/**
 * Create an organizer user
 */
export function createTestOrganizer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUserWithRole("Organizer", "organizer", overrides);
}

/**
 * Create a producer user
 */
export function createTestProducer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUserWithRole("Producer", "producer", overrides);
}

/**
 * Create a jury user
 */
export function createTestJury(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUserWithRole("Jury", "jury", overrides);
}
