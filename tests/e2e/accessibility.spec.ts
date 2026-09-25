import { test, expect, type Page } from "@playwright/test";

/**
 * Accessibilité — vérifications structurelles sans dépendance externe.
 *
 * Ces tests ne remplacent pas un scan axe-core (@axe-core/playwright n'est
 * pas dans package.json, hors périmètre de ce lot) : ils couvrent ce qui se
 * vérifie sans bibliothèque et qui casse le plus souvent — hiérarchie de
 * titres, libellés de champs, alternatives textuelles, focus visible.
 *
 * Les assertions « toBeTruthy() sur une chaîne non vide » de l'ancienne
 * suite passaient sur n'importe quelle page, y compris un 404 : elles sont
 * remplacées par des contrôles qui peuvent réellement échouer.
 */

const PAGES = ["/", "/cups", "/about", "/contact", "/login"] as const;

/** Niveau de chaque titre de la page, dans l'ordre du document. */
async function headingLevels(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((el) =>
      Number(el.tagName.slice(1))
    )
  );
}

test.describe("Accessibilité — structure du document", () => {
  for (const path of PAGES) {
    test(`@P1 ${path} : lang, titre et <h1> unique`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator("html")).toHaveAttribute("lang", /^fr/i);

      const title = await page.title();
      expect(title, `titre de ${path}`).toContain("Platinum CBD Cup");

      await expect(page.locator("h1"), `nombre de <h1> sur ${path}`).toHaveCount(1);
    });

    test(`@P2 ${path} : la hiérarchie de titres ne saute pas de niveau`, async ({ page }) => {
      await page.goto(path);
      const levels = await headingLevels(page);

      for (let i = 1; i < levels.length; i++) {
        const previous = levels[i - 1]!;
        const current = levels[i]!;
        // Descendre de plus d'un niveau d'un coup (h2 → h4) casse la
        // navigation par titres des lecteurs d'écran.
        expect(
          current - previous,
          `saut de h${previous} à h${current} sur ${path}`
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test("@P1 chaque page publique expose un repère <main>", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("main"), `<main> sur ${path}`).toBeVisible();
    }
  });
});

test.describe("Accessibilité — formulaires", () => {
  test("@P1 les champs de connexion ont un label associé", async ({ page }) => {
    await page.goto("/login");

    for (const id of ["email", "password"]) {
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      await expect(page.locator(`input[id="${id}"]`)).toBeVisible();
    }
  });

  test("@P1 les champs d'inscription ont tous un label associé", async ({ page }) => {
    await page.goto("/register");

    for (const id of ["email", "name", "password", "confirmPassword"]) {
      await expect(page.locator(`label[for="${id}"]`), `label de #${id}`).toBeVisible();
    }
  });

  test("@P1 le bouton de soumission porte un nom accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /se connecter/i })).toBeVisible();
  });

  test("@P1 le focus clavier atteint le formulaire et reste visible", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator('input[id="email"]');
    await email.focus();
    await expect(email).toBeFocused();

    // Tab depuis l'email doit rester dans le formulaire, pas repartir dans
    // la page : un piège de focus ou un tabindex négatif se voit ici.
    //
    // L'assertion précédente se contentait du nom de balise de l'élément
    // focalisé (INPUT, BUTTON ou A) : sur ce gabarit, n'importe quel lien de
    // la navigation ou du pied de page l'aurait satisfaite, donc un tabindex
    // qui éjecte le focus hors du formulaire passait inaperçu — exactement ce
    // que le test prétend détecter. On vérifie maintenant l'appartenance au
    // <form> qui contient le champ email.
    await page.keyboard.press("Tab");
    const stillInsideForm = await page.evaluate(() => {
      const form = document.querySelector('input[id="email"]')?.closest("form");
      const active = document.activeElement;
      return Boolean(form && active && form.contains(active));
    });
    expect(stillInsideForm, "le focus doit rester dans le formulaire de connexion").toBe(
      true
    );
  });

  test("@P1 une erreur de validation est rattachée au champ fautif", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Le message doit exister ET le champ doit être marqué invalide : un
    // message affiché sans aria-invalid n'est pas annoncé à la saisie.
    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator('input[id="email"]')).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("Accessibilité — images", () => {
  test("@P1 toutes les images de l'accueil ont un attribut alt", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();

    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((img) => img.getAttribute("alt") === null)
        .map((img) => img.getAttribute("src") ?? "(sans src)")
    );

    expect(missing, "images sans attribut alt").toEqual([]);
  });
});
