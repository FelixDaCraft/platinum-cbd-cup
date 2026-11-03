import { test, expect } from "@playwright/test";

import { loginUserWithTimeout } from "../support/fixtures/auth.fixture";

/**
 * Suivi d'expédition du colis d'échantillons.
 *
 * Ce que ces specs supposent de l'environnement : un producteur de recette
 * dont une inscription payée a ses produits encore « à envoyer » et aucune
 * expédition déclarée, et un organisateur. Les comptes viennent de
 * l'environnement (`E2E_COLIS_*`) ; sans eux, les specs sont ignorées.
 *
 * Écriture : la spec producteur déclare puis annule l'expédition de SA
 * propre inscription, et la laisse dans l'état où elle l'a trouvée.
 */

const PASSWORD = process.env.E2E_COLIS_PASSWORD;
const PRODUCTEUR = process.env.E2E_COLIS_PRODUCER;
const ORGANISATEUR = process.env.E2E_COLIS_ORGANIZER;
const CUP_ID = process.env.E2E_COLIS_CUP_ID;

test.describe("Colis d'échantillons", () => {
  test("@P1 le producteur déclare puis annule l'expédition de son colis", async ({ page }) => {
    test.skip(!PRODUCTEUR || !PASSWORD, "Compte producteur de recette non fourni");

    await loginUserWithTimeout(page, PRODUCTEUR!, PASSWORD!);
    await page.goto("/producer/registrations");

    const colis = page.getByRole("region", { name: "COLIS D'ÉCHANTILLONS" }).first();
    await expect(colis).toContainText("9 janvier 2027");

    await colis.getByRole("button", { name: "J'AI EXPÉDIÉ MON COLIS" }).click();
    await colis.getByLabel("TRANSPORTEUR (FACULTATIF)").selectOption("colissimo");
    await colis.getByLabel("NUMÉRO DE SUIVI (FACULTATIF)").fill("6a 1234 5678");
    await colis.getByRole("button", { name: "ENREGISTRER" }).click();

    await expect(colis.getByText(/^EXPÉDIÉ LE \d{2}\/\d{2}$/)).toBeVisible();
    await expect(colis).toContainText("La Poste / Colissimo · 6A12345678");
    await expect(colis.getByRole("link", { name: "SUIVRE LE COLIS" })).toHaveAttribute(
      "href",
      /laposte\.fr.*code=6A12345678/
    );

    // Remise en état : annulation en deux temps.
    await colis.getByRole("button", { name: "ANNULER LA DÉCLARATION" }).click();
    await colis.getByRole("button", { name: "CONFIRMER L'ANNULATION" }).click();
    await expect(colis.getByRole("button", { name: "J'AI EXPÉDIÉ MON COLIS" })).toBeVisible();
  });

  test("@P1 l'organisateur voit la colonne Colis et filtre par état", async ({ page }) => {
    test.skip(!ORGANISATEUR || !PASSWORD || !CUP_ID, "Compte organisateur de recette non fourni");

    await loginUserWithTimeout(page, ORGANISATEUR!, PASSWORD!);
    await page.goto(`/dashboard/cups/${CUP_ID}/participants/registrations`);

    await expect(page.getByRole("columnheader", { name: "COLIS" })).toBeVisible();

    await page.getByRole("combobox", { name: "Colis" }).click();
    await page.getByRole("option", { name: "Expédié", exact: true }).click();

    // Chaque ligne restante porte la mention d'envoi.
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row).toContainText(/Expédié le \d{2}\/\d{2}/);
    }
  });
});
