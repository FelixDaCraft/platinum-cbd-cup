import { test, expect } from "@playwright/test";

/**
 * Page d'accueil — parcours P0.
 *
 * Le titre attendu vient de src/lib/organization.ts (ORGANIZATION_NAME),
 * repris par layout.tsx : l'ancienne suite attendait /CupMetrics/, un
 * vestige du SaaS d'origine qui faisait échouer la spec dès la première
 * assertion.
 */
test.describe("Page d'accueil", () => {
  test("@P0 répond 200 et porte le titre Platinum CBD Cup", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Platinum CBD Cup/i);
  });

  test("@P0 affiche un titre principal unique", async ({ page }) => {
    await page.goto("/");
    const headings = page.locator("h1");
    // Un seul <h1> par page : c'est à la fois une règle d'accessibilité et
    // ce qui garantit que le hero a bien été rendu côté serveur.
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toBeVisible();
    await expect(headings.first()).not.toBeEmpty();
  });

  test("@P0 affiche la navigation principale du portail", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: /navigation principale/i });
    await expect(nav).toBeVisible();
    for (const href of ["/", "/cups", "/palmares", "/about"]) {
      await expect(nav.locator(`a[href="${href}"]`).first()).toBeAttached();
    }

    // NB : le shell public n'expose aujourd'hui aucun lien vers /login ni
    // /register — un visiteur ne peut se connecter qu'en tapant l'URL. Si
    // une entrée « Connexion » est ajoutée, l'assertion ci-dessus reste
    // valable et il faudra la couvrir ici.
  });

  test("@P1 reste utilisable en viewport mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await expect(page).toHaveTitle(/Platinum CBD Cup/i);
    await expect(page.locator("main")).toBeVisible();

    // Pas de débordement horizontal : le symptôme n°1 d'une mise en page
    // cassée sur téléphone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("@P2 affiche le pied de page et ses liens légaux", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="/mentions-legales"]')).toBeVisible();
  });
});
