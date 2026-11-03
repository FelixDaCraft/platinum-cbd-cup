import { test, expect, type Page } from "@playwright/test";

/**
 * Site multilingue : parcours principal en anglais et en allemand.
 *
 * Lecture seule, comme le reste de la suite : aucune inscription n'est
 * créée. On vérifie la détection de langue, le sélecteur de l'en-tête et le
 * cookie qui mémorise le choix, les URL par langue (le français sans
 * préfixe), les balises `lang` / `hreflang`, le règlement traduit avec sa
 * mention « la version française fait foi », l'accès aux espaces protégés
 * dans la bonne langue et le sitemap.
 */

const LANGS = [
  {
    locale: "en",
    name: "English",
    browserLocale: "en-GB",
    rulesTitle: "Rules",
    frenchPrevails: "the French version of the rules is the only legally binding version",
  },
  {
    locale: "de",
    name: "Deutsch",
    // « Autrichien » : un visiteur d'Autriche reçoit la version allemande.
    browserLocale: "de-AT",
    rulesTitle: "Reglement",
    frenchPrevails: "Rechtsverbindlich ist allein die französische Fassung",
  },
] as const;

async function htmlLang(page: Page): Promise<string | null> {
  return page.locator("html").getAttribute("lang");
}

for (const lang of LANGS) {
  test.describe(`Site en ${lang.name}`, () => {
    test(`@P0 détection Accept-Language : / mène à /${lang.locale}`, async ({ browser }) => {
      // `locale` règle l'en-tête Accept-Language envoyé par Chromium (un
      // en-tête ajouté à la main serait remplacé par celui du navigateur).
      const context = await browser.newContext({ locale: lang.browserLocale });
      const page = await context.newPage();
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/${lang.locale}/?$`));
      expect(await htmlLang(page)).toBe(lang.locale);
      await context.close();
    });

    test(`@P0 accueil /${lang.locale} : lang, canonique et hreflang des sept langues`, async ({ page }) => {
      const response = await page.goto(`/${lang.locale}`);
      expect(response?.status()).toBe(200);
      expect(await htmlLang(page)).toBe(lang.locale);

      // Next 15 diffuse les métadonnées en streaming : pour un navigateur
      // ordinaire, elles peuvent arriver hors du <head>.
      const hreflangs = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) => links.map((l) => l.getAttribute("hreflang")));
      for (const code of ["fr", "en", "it", "de", "cs", "nl", "es", "x-default"]) {
        expect(hreflangs, `hreflang ${code}`).toContain(code);
      }
      const canonical = await page.locator('link[rel="canonical"]').first().getAttribute("href");
      expect(canonical).toMatch(new RegExp(`/${lang.locale}/?$`));
    });

    test(`@P0 le sélecteur de l'en-tête passe en ${lang.name} et mémorise le choix`, async ({ browser }) => {
      // Navigateur francophone : la page de départ est la version française.
      const context = await browser.newContext({ locale: "fr-FR" });
      const page = await context.newPage();
      await page.goto("/cups");
      expect(await htmlLang(page)).toBe("fr");

      const toggle = page.locator(".st-lang-toggle:visible").first();
      await toggle.click();
      await page.locator(`.st-lang-menu:visible a[lang="${lang.locale}"]`).first().click();

      await expect(page).toHaveURL(new RegExp(`/${lang.locale}/cups/?$`));
      expect(await htmlLang(page)).toBe(lang.locale);
      const cookie = (await context.cookies()).find((c) => c.name === "NEXT_LOCALE");
      expect(cookie?.value).toBe(lang.locale);

      // Le choix tient : une URL sans préfixe ramène à la langue choisie.
      await page.goto("/palmares");
      await expect(page).toHaveURL(new RegExp(`/${lang.locale}/palmares/?$`));
      await context.close();
    });

    test(`@P1 règlement traduit, avec la mention que le français fait foi`, async ({ page }) => {
      const response = await page.goto(`/${lang.locale}/reglement`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toContainText(lang.rulesTitle);
      await expect(page.getByText(lang.frenchPrevails)).toBeVisible();
    });

    test(`@P1 espace producteur sans session : connexion en ${lang.name}`, async ({ page }) => {
      await page.goto(`/${lang.locale}/producer/registrations`);
      await expect(page).toHaveURL(new RegExp(`/${lang.locale}/login`));
      expect(await htmlLang(page)).toBe(lang.locale);
    });

    test(`@P1 widget /${lang.locale}/widget intégrable chez un tiers`, async ({ request }) => {
      const response = await request.get(`/${lang.locale}/widget/producer/inexistant`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["x-frame-options"]).toBeUndefined();
      expect(headers["content-security-policy"] ?? "").toContain("frame-ancestors *");
    });
  });
}

test.describe("URL et sitemap", () => {
  test("@P0 /fr/… redirige vers l'URL sans préfixe (aucune URL existante cassée)", async ({ page }) => {
    await page.goto("/fr/cups");
    await expect(page).toHaveURL(/\/cups\/?$/);
    expect(new URL(page.url()).pathname.startsWith("/fr")).toBe(false);
  });

  test("@P1 le sitemap liste chaque page dans chaque langue", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    for (const locale of ["en", "it", "de", "cs", "nl", "es"]) {
      expect(xml, `entrées /${locale}`).toMatch(new RegExp(`<loc>[^<]*/${locale}/reglement</loc>`));
    }
    expect(xml).toMatch(/<loc>[^<]*\/reglement<\/loc>/);
  });
});
