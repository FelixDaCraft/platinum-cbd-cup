import { test, expect } from "@playwright/test";

/**
 * Pages publiques du portail.
 *
 * Remplace l'ancien portal.spec.ts, qui visait les routes /portal/* de
 * CupMetrics : le fork sert ces pages à la racine via le groupe (portal).
 * Chaque cas vérifie que la page répond bien en 200 et qu'elle ne renvoie
 * ni la page d'erreur Next, ni une redirection vers /login — c'est
 * exactement ce que l'ancienne suite croyait tester avec
 * `expect(page.locator("body")).toBeVisible()`, qui passe même sur un 404.
 */

/** Routes publiques réellement servies par src/app/(portal). */
const PUBLIC_ROUTES = [
  { path: "/", name: "accueil", tag: "@P0" },
  { path: "/cups", name: "concours", tag: "@P0" },
  { path: "/palmares", name: "palmarès", tag: "@P1" },
  { path: "/archives", name: "archives", tag: "@P2" },
  { path: "/articles", name: "actualités", tag: "@P2" },
  { path: "/press", name: "presse", tag: "@P2" },
  { path: "/sponsors", name: "partenaires", tag: "@P2" },
  { path: "/about", name: "à propos", tag: "@P2" },
  { path: "/contact", name: "contact", tag: "@P1" },
  { path: "/mentions-legales", name: "mentions légales", tag: "@P1" },
  { path: "/confidentialite", name: "confidentialité", tag: "@P1" },
  { path: "/reglement", name: "règlement", tag: "@P1" },
] as const;

test.describe("Pages publiques", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.tag} ${route.name} (${route.path}) répond 200 sans redirection vers /login`, async ({
      page,
    }) => {
      const response = await page.goto(route.path);

      // goto() renvoie la réponse du document principal : un 404/500 était
      // invisible pour l'ancienne suite, qui n'assertait que sur le <body>.
      expect(response?.status(), `statut HTTP de ${route.path}`).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${route.path}/?$`));
      await expect(page.locator("main")).toBeVisible();
    });
  }

  test("@P1 chaque page publique porte un titre propre à la page", async ({ page }) => {
    const titles = new Set<string>();

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route.path);
      const title = await page.title();
      expect(title, `titre de ${route.path}`).toContain("Platinum CBD Cup");
      titles.add(title);
    }

    // Si toutes les pages partagent le même titre, c'est que les metadata
    // par route ne sont pas appliquées (mauvais pour le SEO et l'historique
    // de navigation).
    expect(titles.size).toBeGreaterThan(1);
  });
});

test.describe("Navigation du portail", () => {
  test("@P0 la nav principale mène à la liste des concours", async ({ page }) => {
    await page.goto("/");

    // Les libellés de la nav sont numérotés (« 02 Cup ») : on cible le href,
    // qui est le contrat réel, pas le texte décoratif.
    const nav = page.getByRole("navigation", { name: /navigation principale/i });
    await nav.locator('a[href="/cups"]').first().click();

    await expect(page).toHaveURL(/\/cups$/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("@P1 le pied de page expose les mentions légales et la confidentialité", async ({
    page,
  }) => {
    await page.goto("/");
    const legalNav = page.getByRole("navigation", { name: /liens l[ée]gaux/i });
    await expect(legalNav).toBeVisible();

    for (const href of ["/reglement", "/mentions-legales", "/confidentialite"]) {
      await expect(legalNav.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });
});

test.describe("Routes supprimées du fork CupMetrics", () => {
  // Ces chemins existaient dans le SaaS multi-tenant. S'ils réapparaissent
  // en 200, c'est qu'un morceau de l'ancien portail a été réintroduit.
  for (const gone of ["/portal", "/portal/cups", "/organizer/signup"]) {
    test(`@P2 ${gone} renvoie 404`, async ({ page }) => {
      const response = await page.goto(gone);
      expect(response?.status()).toBe(404);
    });
  }
});
