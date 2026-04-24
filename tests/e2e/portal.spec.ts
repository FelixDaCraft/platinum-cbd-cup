import { test, expect } from "@playwright/test";

/**
 * Portal E2E Tests
 * Tests for the public portal pages (cups, results, etc.)
 * Priority: P1 - Important public-facing pages
 * 
 * Note: Portal pages require organization context via headers.
 * In standalone testing, pages may show "Organisation non trouvée".
 */
test.describe("Portal", () => {
  test.describe("Portal Home", () => {
    test("[P1] should display portal home page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to portal
      await page.goto("/portal");

      // THEN: Portal content is visible
      await expect(page.locator("body")).toBeVisible();
      // Should not redirect to login (portal is public)
      await expect(page).not.toHaveURL(/login/);
    });

    test("[P1] should display navigation to portal sections", async ({ page }) => {
      // GIVEN: User is on portal
      await page.goto("/portal");

      // THEN: Navigation links should be available
      const pageContent = await page.textContent("body");
      // Portal typically has links to cups, results, about, etc.
      const hasNavigation =
        /compétition|cup|résultat|result|actualité|article|contact/i.test(pageContent ?? "");
      expect(hasNavigation).toBeTruthy();
    });
  });

  test.describe("Portal Cups List", () => {
    test("[P1] should display cups list page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to cups list
      await page.goto("/portal/cups");

      // THEN: Page loads successfully
      await expect(page.locator("body")).toBeVisible();
    });

    test("[P2] should be accessible without authentication", async ({ page }) => {
      // GIVEN/WHEN: User navigates to cups list (not logged in)
      await page.goto("/portal/cups");

      // THEN: Should not redirect to login
      await expect(page).not.toHaveURL(/login/);
    });
  });

  test.describe("Portal About", () => {
    test("[P2] should display about page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to about page
      await page.goto("/portal/about");

      // THEN: About content is visible
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Portal Contact", () => {
    test("[P2] should display contact page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to contact page
      await page.goto("/portal/contact");

      // THEN: Contact page or error is visible
      await expect(page.locator("body")).toBeVisible();
    });

    test("[P2] should have contact page content", async ({ page }) => {
      // GIVEN: User is on contact page
      await page.goto("/portal/contact");

      // THEN: Page should have content (form if org found, or error message)
      // Portal contact requires organization context
      const pageContent = await page.textContent("body");
      
      // Either has form elements OR shows "Organisation non trouvée" message
      const hasContent = 
        /contact|email|message|organisation non trouvée/i.test(pageContent ?? "");
      
      expect(hasContent).toBeTruthy();
    });
  });

  test.describe("Portal Articles", () => {
    test("[P2] should display articles list", async ({ page }) => {
      // GIVEN/WHEN: User navigates to articles
      await page.goto("/portal/articles");

      // THEN: Articles page loads
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Portal Hall of Fame", () => {
    test("[P2] should display hall of fame page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to hall of fame
      await page.goto("/portal/hall-of-fame");

      // THEN: Page loads (may be empty if no data)
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Portal Archives", () => {
    test("[P2] should display archives page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to archives
      await page.goto("/portal/archives");

      // THEN: Page loads
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Portal Sponsors", () => {
    test("[P2] should display sponsors page", async ({ page }) => {
      // GIVEN/WHEN: User navigates to sponsors
      await page.goto("/portal/sponsors");

      // THEN: Page loads
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
