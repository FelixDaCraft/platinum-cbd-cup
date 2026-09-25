import { test as base, expect, type Page } from "@playwright/test";
import { createTestUser, type TestUser } from "../factories/user.factory";

/**
 * Helpers d'authentification pour Playwright.
 *
 * Les sélecteurs `[data-testid="email-input"]` de la version précédente
 * n'existaient nulle part : `grep -rn data-testid src` ne renvoie rien. Ce
 * fichier cible désormais les identifiants réellement rendus par
 * src/app/(portal)/login et /register (`input[id="email"]`, etc.) et les
 * rôles ARIA, conformément aux recommandations Playwright.
 *
 * Il n'y a volontairement pas de fixture « authenticatedPage » : créer un
 * compte demande un accès base et un email vérifié. Tant que la CI n'a pas
 * de service Postgres, une telle fixture ne pourrait que mentir — l'ancienne
 * se contentait de renvoyer la page telle quelle.
 */

export interface AuthFixtures {
  /** Jeu de données utilisateur unique par test. */
  testUser: TestUser;
}

/** Connexion via l'interface. Échoue si la redirection n'a pas lieu. */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.locator('input[id="email"]').fill(email);
  await page.locator('input[id="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  // getRedirectPathForRole (login/page.tsx) : organisateur → /dashboard,
  // producteur → /producer/dashboard, juré → /jury/dashboard.
  await expect(page).toHaveURL(/\/(dashboard|producer\/dashboard|jury\/dashboard)/);
}

/**
 * Remplit et soumet le formulaire de connexion de la page COURANTE, sans
 * rien attendre de la destination.
 *
 * Complément de `loginUser` (ajout, pas remplacement) : un test de
 * redirection ouverte doit d'abord OUVRIR `/login?callbackUrl=…` avec sa
 * propre valeur, puis OBSERVER où la page atterrit — y compris hors du site.
 * `loginUser` fait les deux à sa façon : il impose `/login` sans paramètre et
 * exige une URL du site, ce qui ferait échouer le test au bon endroit mais
 * avec le mauvais message, et empêcherait toute assertion sur l'hôte réel.
 */
export async function submitLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.locator('input[id="email"]').fill(email);
  await page.locator('input[id="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
}

/**
 * Connexion via l'interface, avec un délai d'attente explicite sur la
 * redirection.
 *
 * Complément de `loginUser` (ajout, pas remplacement). Mesuré sur le serveur
 * de développement partagé : la requête `sign-in/email` met ~4 s et la
 * navigation vers `/producer/dashboard` ~17 s de plus quand Next compile la
 * page à la volée. `loginUser` s'en remet au délai par défaut d'`expect`
 * (5 s dans playwright.config.ts) : il échoue alors sur une compilation, pas
 * sur la connexion, et le rapport accuse l'application à tort.
 *
 * Même destination attendue que `loginUser` — organisateur → /dashboard,
 * producteur → /producer/dashboard, juré → /jury/dashboard — pour qu'une
 * régression de redirection tombe ici aussi.
 */
export async function loginUserWithTimeout(
  page: Page,
  email: string,
  password: string,
  timeoutMs = 60_000
): Promise<void> {
  await page.goto("/login");
  await submitLoginForm(page, email, password);
  await expect(page).toHaveURL(
    /\/(dashboard|producer\/dashboard|jury\/dashboard)/,
    { timeout: timeoutMs }
  );
}

/** Création de compte producteur via l'interface. */
export async function registerUser(
  page: Page,
  user: Pick<TestUser, "email" | "password" | "name">
): Promise<void> {
  await page.goto("/register");
  await page.locator('input[id="email"]').fill(user.email);
  await page.locator('input[id="name"]').fill(user.name);
  await page.locator('input[id="password"]').fill(user.password);
  await page.locator('input[id="confirmPassword"]').fill(user.password);
  await page.getByRole("button", { name: /créer mon compte/i }).click();
}

/**
 * Déconnexion : pas de bouton dans le shell public, on passe par l'espace
 * authentifié qui en expose un.
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.getByRole("button", { name: /déconnexion|se déconnecter/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use(createTestUser());
  },
});

export { expect } from "@playwright/test";
