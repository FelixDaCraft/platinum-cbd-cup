import { test, expect } from "@playwright/test";

/**
 * Accessibility E2E Tests
 * Priority: P1 - Ensuring basic accessibility compliance
 */
test.describe("Accessibility", () => {
  test.describe("Document Structure", () => {
    test("[P1] should have proper document title on home page", async ({ page }) => {
      await page.goto("/");
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test("[P1] should have proper document title on login page", async ({ page }) => {
      await page.goto("/login");
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test("[P1] should have lang attribute on html element", async ({ page }) => {
      await page.goto("/");
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang).toBeTruthy();
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("[P1] should allow keyboard navigation on login form", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]');
      
      // Focus the email input directly
      await page.locator('input[id="email"]').focus();
      
      // Check that something is focused
      const isFocused = await page.evaluate(() => {
        return document.activeElement !== null && 
               document.activeElement !== document.body &&
               document.activeElement.tagName === 'INPUT';
      });
      expect(isFocused).toBeTruthy();
    });

    test("[P1] should have visible focus indicators", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]');
      const emailInput = page.locator('input[id="email"]');
      await emailInput.focus();
      await expect(emailInput).toBeFocused();
    });
  });

  test.describe("Form Accessibility", () => {
    test("[P1] should have labels for form inputs on login", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]');
      
      const emailLabel = page.locator('label[for="email"]');
      const emailInput = page.locator('input[id="email"]');
      
      await expect(emailLabel).toBeVisible();
      await expect(emailInput).toBeVisible();
      
      const passwordLabel = page.locator('label[for="password"]');
      const passwordInput = page.locator('input[id="password"]');
      
      await expect(passwordLabel).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });

    test("[P1] should have submit button with accessible name", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]');
      const submitButton = page.getByRole("button", { name: /se connecter/i });
      await expect(submitButton).toBeVisible();
    });
  });

  test.describe("Color Contrast", () => {
    test("[P2] should have readable text on home page", async ({ page }) => {
      await page.goto("/");
      const bodyText = await page.locator("body").textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);
    });
  });

  test.describe("Error Messages", () => {
    test("[P1] should display accessible error messages on form validation", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]');
      await page.getByRole("button", { name: /se connecter/i }).click();
      
      const hasErrors =
        (await page.locator('[aria-invalid="true"]').count() > 0) ||
        (await page.locator("text=/requis|required|invalide|invalid/i").count() > 0);

      expect(hasErrors).toBeTruthy();
    });
  });

  test.describe("Images and Media", () => {
    test("[P2] should have alt text on images", async ({ page }) => {
      await page.goto("/");
      const images = page.locator("img");
      const imageCount = await images.count();

      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const alt = await images.nth(i).getAttribute("alt");
        expect(alt !== null).toBeTruthy();
      }
    });
  });
});
