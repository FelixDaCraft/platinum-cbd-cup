import { test as base, expect, type Page } from "@playwright/test";
import { createTestUser, createTestOrganizer, type TestUser } from "../factories/user.factory";

/**
 * Auth fixtures for Playwright tests
 * Provides authenticated user contexts
 */

export interface AuthFixtures {
  /**
   * Authenticated page with a logged-in user
   */
  authenticatedPage: Page;
  /**
   * The test user data
   */
  testUser: TestUser;
}

/**
 * Login helper - performs login via UI
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard or home
  await expect(page).toHaveURL(/\/(dashboard|cups)/);
}

/**
 * Register a new user via UI
 */
export async function registerUser(
  page: Page,
  email: string,
  password: string,
  confirmPassword?: string
): Promise<void> {
  await page.goto("/register");
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.fill('[data-testid="confirm-password-input"]', confirmPassword ?? password);
  await page.click('[data-testid="register-button"]');
}

/**
 * Logout helper
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click user menu and logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await expect(page).toHaveURL("/login");
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const user = createTestUser();
    await use(user);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Note: In a real implementation, you would:
    // 1. Create user via API or database seeding
    // 2. Login and store session
    // For now, we just pass the page for manual login in tests
    await use(page);
  },
});

export { expect } from "@playwright/test";
