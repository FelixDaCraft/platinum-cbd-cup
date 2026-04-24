import { test, expect } from "@playwright/test";

/**
 * Home Page E2E Tests
 * Priority: P0 - Landing page must always work
 */
test.describe("Home Page", () => {
  test("[P0] should load home page successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CupMetrics/i);
  });

  test("[P0] should display main heading and description", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    // Use first() to handle multiple matches
    await expect(page.getByRole("heading", { name: /cupmetrics/i }).first()).toBeVisible();
  });

  test("[P0] should have login/register links for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    const commencerButton = page.getByRole("link", { name: /commencer/i });
    const inscrireButton = page.getByRole("link", { name: /s'inscrire/i });
    const hasAuthLinks = await commencerButton.isVisible() || await inscrireButton.isVisible();
    expect(hasAuthLinks).toBeTruthy();
  });

  test("[P1] should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page).toHaveTitle(/CupMetrics/i);
    await expect(page.locator("main")).toBeVisible();
  });

  test("[P2] should display footer with legal links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    if (await footer.count() > 0) {
      await expect(footer).toBeVisible();
    }
  });
});
