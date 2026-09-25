import { test, expect } from "@playwright/test";

/**
 * Parcours d'authentification publics.
 *
 * Le bloc « Organizer Signup » a disparu : /organizer/signup et les plans
 * d'abonnement starter/pro/enterprise appartenaient au SaaS CupMetrics et
 * n'existent plus dans ce fork (voir tests/e2e/public-pages.spec.ts, qui
 * vérifie que la route renvoie bien 404).
 *
 * Les libellés de boutons sont ceux réellement rendus : « Se connecter »
 * (login), « Créer mon compte » (register), « Envoyer le lien » (mot de
 * passe oublié) — l'ancienne suite attendait « S'inscrire », qui n'existe
 * nulle part.
 */
test.describe("Authentification", () => {
  test.setTimeout(60_000);

  test.describe("Connexion", () => {
    test("@P0 affiche le formulaire de connexion", async ({ page }) => {
      const response = await page.goto("/login");
      expect(response?.status()).toBe(200);

      await expect(page.locator('input[id="email"]')).toBeVisible();
      await expect(page.locator('input[id="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /se connecter/i })).toBeVisible();
    });

    test("@P0 refuse un envoi vide et signale les champs fautifs", async ({ page }) => {
      await page.goto("/login");
      await page.locator('input[id="email"]').waitFor();
      await page.getByRole("button", { name: /se connecter/i }).click();

      // L'erreur doit être rattachée au champ (aria-describedby / role), pas
      // seulement affichée quelque part dans la page : c'est ce qu'un lecteur
      // d'écran annonce.
      await expect(page.locator("#email-error")).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test("@P1 refuse une adresse email malformée", async ({ page }) => {
      await page.goto("/login");
      await page.locator('input[id="email"]').fill("invalid-email");
      await page.locator('input[id="password"]').fill("Password123!");
      await page.getByRole("button", { name: /se connecter/i }).click();

      await expect(page.locator("#email-error")).toBeVisible();
    });

    test("@P0 ne connecte pas un compte inexistant et ne révèle pas son existence", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator('input[id="email"]').fill("inconnu.e2e@example.com");
      await page.locator('input[id="password"]').fill("MotDePasseBidon123!");
      await page.getByRole("button", { name: /se connecter/i }).click();

      // Reste sur /login : aucune redirection vers un espace authentifié.
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("body")).not.toContainText(/compte introuvable|utilisateur inconnu/i);
    });

    test("@P1 renvoie vers la création de compte", async ({ page }) => {
      await page.goto("/login");
      const registerLink = page.getByRole("link", { name: /créer un compte/i });
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    });

    test("@P1 renvoie vers le mot de passe oublié", async ({ page }) => {
      await page.goto("/login");
      const forgotLink = page.getByRole("link", { name: /mot de passe oublié/i });
      await expect(forgotLink).toHaveAttribute("href", "/forgot-password");
    });
  });

  test.describe("Inscription", () => {
    test("@P0 affiche le formulaire d'inscription", async ({ page }) => {
      const response = await page.goto("/register");
      expect(response?.status()).toBe(200);

      await expect(page.locator('input[id="email"]')).toBeVisible();
      await expect(page.locator('input[id="name"]')).toBeVisible();
      await expect(page.locator('input[id="password"]')).toBeVisible();
      await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /créer mon compte/i })).toBeVisible();
    });

    test("@P0 refuse un envoi vide", async ({ page }) => {
      await page.goto("/register");
      await page.getByRole("button", { name: /créer mon compte/i }).click();

      await expect(page.locator("#email-error")).toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });

    test("@P1 affiche les critères de mot de passe non satisfaits", async ({ page }) => {
      await page.goto("/register");
      await page.locator('input[id="email"]').fill("test.e2e@example.com");
      await page.locator('input[id="password"]').fill("weak");

      await expect(page.locator("#password-criteria")).toBeVisible();
      await expect(page.locator("#password-criteria")).toContainText(
        /12 caractères|majuscule|chiffre|spécial/i
      );
    });

    test("@P1 refuse une confirmation de mot de passe différente", async ({ page }) => {
      await page.goto("/register");
      await page.locator('input[id="email"]').fill("test.e2e@example.com");
      await page.locator('input[id="name"]').fill("Test E2E");
      await page.locator('input[id="password"]').fill("ValidPass123!aa");
      await page.locator('input[id="confirmPassword"]').fill("DifferentPass123!aa");
      await page.getByRole("button", { name: /créer mon compte/i }).click();

      await expect(page.locator("#confirm-password-error")).toBeVisible();
    });

    test("@P1 renvoie vers la connexion", async ({ page }) => {
      await page.goto("/register");
      const loginLink = page.getByRole("link", { name: /se connecter/i });
      await expect(loginLink).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Inscription juré", () => {
    test("@P1 la page d'inscription juré est publique", async ({ page }) => {
      const response = await page.goto("/register/jury");
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/register\/jury/);
    });
  });

  test.describe("Mot de passe oublié", () => {
    test("@P1 affiche le formulaire de réinitialisation", async ({ page }) => {
      const response = await page.goto("/forgot-password");
      expect(response?.status()).toBe(200);

      await expect(page.locator('input[id="email"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /envoyer le lien/i })).toBeVisible();
    });

    test("@P1 refuse une adresse malformée", async ({ page }) => {
      await page.goto("/forgot-password");
      await page.locator('input[id="email"]').fill("invalid-email");
      await page.getByRole("button", { name: /envoyer le lien/i }).click();

      await expect(page.locator("#email-error")).toBeVisible();
    });

    test("@P2 renvoie vers la connexion", async ({ page }) => {
      await page.goto("/forgot-password");
      await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    });
  });

  test.describe("Protection des espaces authentifiés", () => {
    // Le middleware redirige vers /login avec un callbackUrl : c'est le seul
    // garde côté bord, il ne doit jamais laisser passer un anonyme.
    for (const path of ["/dashboard", "/producer/dashboard", "/jury/dashboard"]) {
      test(`@P0 ${path} redirige un visiteur anonyme vers /login`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/login/);
      });
    }
  });
});
