import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.setTimeout(60000);

  test.describe("Login Flow", () => {
    test("[P0] should display login page with required elements", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]', { timeout: 30000 });
      await expect(page.locator('input[id="email"]')).toBeVisible();
      await expect(page.locator('input[id="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /se connecter/i })).toBeVisible();
    });

    test("[P0] should show validation error for empty form submission", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]', { timeout: 30000 });
      await page.getByRole("button", { name: /se connecter/i }).click();
      await expect(page.locator("text=/requis|required|invalide/i").first()).toBeVisible();
    });

    test("[P1] should show error for invalid email format", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]', { timeout: 30000 });
      await page.locator('input[id="email"]').fill("invalid-email");
      await page.locator('input[id="password"]').fill("Password123!");
      await page.getByRole("button", { name: /se connecter/i }).click();
      await expect(page.locator("text=/email invalide|invalid email|email.*valide/i").first()).toBeVisible();
    });

    test("[P1] should have link to register page", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]', { timeout: 30000 });
      const registerLink = page.getByRole("link", { name: /créer un compte/i });
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL(/register/, { timeout: 10000 });
    });

    test("[P1] should have link to forgot password", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[id="email"]', { timeout: 30000 });
      const forgotLink = page.getByRole("link", { name: /mot de passe oublié/i });
      await expect(forgotLink).toBeVisible();
    });
  });

  test.describe("Registration Flow", () => {
    test("[P0] should display registration page with required elements", async ({ page }) => {
      await page.goto("/register");
      await expect(page.locator('input[id="email"]')).toBeVisible();
      await expect(page.locator('input[id="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /s.inscrire/i })).toBeVisible();
    });

    test("[P0] should show validation error for empty form submission", async ({ page }) => {
      await page.goto("/register");
      await page.getByRole("button", { name: /s.inscrire/i }).click();
      await expect(page.locator("text=/requis|required|invalide/i").first()).toBeVisible();
    });

    test("[P1] should validate password requirements", async ({ page }) => {
      await page.goto("/register");
      await page.locator('input[id="email"]').fill("test@example.com");
      await page.locator('input[id="password"]').fill("weak");
      await expect(page.locator("text=/12 caractères|caractère spécial|majuscule|chiffre/i").first()).toBeVisible();
    });

    test("[P1] should validate password confirmation match", async ({ page }) => {
      await page.goto("/register");
      await page.locator('input[id="email"]').fill("test@example.com");
      await page.locator('input[id="password"]').fill("ValidPass123!");
      await page.locator('input[id="confirmPassword"]').fill("DifferentPass123!");
      await page.getByRole("button", { name: /s.inscrire/i }).click();
      await expect(page.locator("text=/ne correspondent pas|do not match|identiques/i")).toBeVisible();
    });

    test("[P1] should have link back to login", async ({ page }) => {
      await page.goto("/register");
      const loginLink = page.getByRole("link", { name: /se connecter/i });
      await expect(loginLink).toBeVisible();
      const href = await loginLink.getAttribute("href");
      expect(href).toContain("login");
    });
  });

  test.describe("Forgot Password Flow", () => {
    test("[P1] should display forgot password page", async ({ page }) => {
      await page.goto("/forgot-password");
      await expect(page.locator('input[id="email"], input[type="email"]').first()).toBeVisible();
      await expect(page.getByRole("button", { name: /envoyer|réinitialiser|reset|send/i })).toBeVisible();
    });

    test("[P1] should validate email format", async ({ page }) => {
      await page.goto("/forgot-password");
      await page.locator('input[id="email"], input[type="email"]').first().fill("invalid-email");
      await page.getByRole("button", { name: /envoyer|réinitialiser|reset|send/i }).click();
      await expect(page.locator("text=/email invalide|invalid email|email.*valide/i")).toBeVisible();
    });

    test("[P2] should have link back to login", async ({ page }) => {
      await page.goto("/forgot-password");
      const loginLink = page.getByRole("link", { name: /connexion|login|retour|se connecter/i });
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe("Organizer Signup Flow", () => {
    test("[P0] should display organizer signup page", async ({ page }) => {
      await page.goto("/organizer/signup");
      await expect(page.locator('[data-slot="card-title"]').first()).toBeVisible();
    });

    test("[P1] should show subscription plan options", async ({ page }) => {
      await page.goto("/organizer/signup");
      const pageContent = await page.textContent("body");
      const hasPlans = /starter|pro|enterprise|gratuit|free/i.test(pageContent || "");
      expect(hasPlans).toBeTruthy();
    });
  });
});
