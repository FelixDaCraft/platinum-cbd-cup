import { test, expect } from "@playwright/test";

import { loginUserWithTimeout } from "../support/fixtures/auth.fixture";

/**
 * Suivi d'expédition du colis d'échantillons.
 *
 * Ce que ces specs supposent de l'environnement : un producteur de recette
 * dont une inscription payée a ses produits encore « à envoyer » et aucune
 * expédition déclarée, un organisateur, et une cup publiée dont la date
 * limite de réception des échantillons est le 9 janvier 2027. Les comptes viennent de
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

    // Un numéro de suivi sans transporteur est refusé avant l'envoi.
    await colis.getByLabel("NUMÉRO DE SUIVI (FACULTATIF)").fill("6a 1234 5678");
    await colis.getByRole("button", { name: "ENREGISTRER" }).click();
    await expect(colis.getByRole("alert")).toHaveText(
      "Choisissez le transporteur : sans lui, le numéro de suivi ne peut pas être suivi."
    );
    await expect(colis.getByRole("button", { name: "ENREGISTRER" })).toBeDisabled();

    await colis.getByLabel("TRANSPORTEUR (FACULTATIF)").selectOption("colissimo");
    await expect(colis.getByRole("alert")).toHaveCount(0);
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

  test("@P1 la date limite de réception figure sur la page publique de l'édition", async ({ page }) => {
    test.skip(!CUP_ID, "Cup de recette non fournie");

    await page.goto(`/cups/${CUP_ID}`);
    const calendrier = page.getByRole("region", { name: /Calendrier de l'édition/ });
    await expect(calendrier).toContainText("Réception des échantillons");
    await expect(calendrier).toContainText("Au plus tard le 9 janvier 2027");

    await page.goto(`/en/cups/${CUP_ID}`);
    await expect(page.getByRole("region", { name: /edition calendar/ })).toContainText(
      "By 9 January 2027 at the latest"
    );
  });

  test("@P1 l'organisateur règle la date limite dans Phases & Dates", async ({ page }) => {
    test.skip(!ORGANISATEUR || !PASSWORD || !CUP_ID, "Compte organisateur de recette non fourni");

    await loginUserWithTimeout(page, ORGANISATEUR!, PASSWORD!);
    await page.goto(`/dashboard/cups/${CUP_ID}/config/phases`);

    await expect(page.getByText("Réception des échantillons", { exact: true })).toBeVisible();
    await expect(page.locator("#samplesDeadline")).toContainText("9 janvier 2027");
  });

  test("@P1 un seul colis pour deux inscriptions, puis détachement d'une seule", async ({ page, browser }) => {
    test.skip(!PRODUCTEUR || !PASSWORD || !ORGANISATEUR || !CUP_ID, "Comptes de recette non fournis");
    // Suppose un producteur avec deux inscriptions payées, rien d'expédié.

    await loginUserWithTimeout(page, PRODUCTEUR!, PASSWORD!);
    await page.goto("/producer/registrations");
    const colis = page.getByRole("region", { name: "COLIS D'ÉCHANTILLONS" });
    await expect(colis).toHaveCount(2);
    const [premier, second] = [colis.nth(0), colis.nth(1)];

    await premier.getByRole("button", { name: "J'AI EXPÉDIÉ MON COLIS" }).click();
    const aussi = premier.getByRole("group", { name: "CE COLIS CONTIENT AUSSI (FACULTATIF)" });
    const caseAutre = aussi.getByRole("checkbox");
    await expect(caseAutre).toHaveCount(1);
    await expect(caseAutre).not.toBeChecked();
    await caseAutre.check();
    await premier.getByLabel("TRANSPORTEUR (FACULTATIF)").selectOption("ups");
    await premier.getByRole("button", { name: "ENREGISTRER" }).click();

    for (const bloc of [premier, second]) {
      await expect(bloc.getByText(/^EXPÉDIÉ LE \d{2}\/\d{2}$/)).toBeVisible();
      await expect(bloc).toContainText("UPS");
      await expect(bloc).toContainText(/Même colis que l'inscription du \d{2}\/\d{2}/);
    }

    // Côté organisateur : la mention sur les deux lignes.
    const orga = await browser.newContext();
    const orgaPage = await orga.newPage();
    await loginUserWithTimeout(orgaPage, ORGANISATEUR!, PASSWORD!);
    await orgaPage.goto(`/dashboard/cups/${CUP_ID}/participants/registrations`);
    await expect(orgaPage.locator("tbody tr").filter({ hasText: /Même colis que l'inscription du/ })).toHaveCount(2);
    await orga.close();

    // Annuler une seule inscription la détache, l'autre reste expédiée.
    await second.getByRole("button", { name: "ANNULER LA DÉCLARATION" }).click();
    await second.getByRole("button", { name: "CONFIRMER L'ANNULATION" }).click();
    await expect(second.getByRole("button", { name: "J'AI EXPÉDIÉ MON COLIS" })).toBeVisible();
    await expect(premier).toContainText("UPS");
    await expect(premier).not.toContainText("Même colis");

    // Remise en état.
    await premier.getByRole("button", { name: "ANNULER LA DÉCLARATION" }).click();
    await premier.getByRole("button", { name: "CONFIRMER L'ANNULATION" }).click();
    await expect(premier.getByRole("button", { name: "J'AI EXPÉDIÉ MON COLIS" })).toBeVisible();
  });
});
