import {
  test,
  expect as expectDefaut,
  type Page,
  type BrowserContext,
} from "@playwright/test";

import { loginUser } from "../support/fixtures/auth.fixture";

/**
 * Le serveur de développement compile les routes à la demande : les 5 s du
 * réglage global suffisent rarement au premier affichage d'un écran du
 * tableau de bord, qui reste sur « [LOADING...] ». On relève le délai
 * d'attente pour ce fichier uniquement, sans toucher `playwright.config.ts`
 * qui est partagé.
 */
const expect = expectDefaut.configure({ timeout: 45_000 });

/**
 * Parcours organisateur — cycle de vie d'une édition.
 *
 * Toutes les données créées ici sont préfixées `E2E-` et suffixées d'un
 * aléatoire : la base est partagée avec cinq autres agents et la copie de
 * production contient de vrais comptes. Aucune donnée préexistante n'est
 * modifiée ni supprimée.
 */

const ORGANISATEUR = {
  email: "e2e-organisateur@platinum-cbd-cup.test",
  password: "E2e-Platinum!2026",
};

const JURE = {
  email: "e2e-jure@platinum-cbd-cup.test",
  password: "E2e-Platinum!2026",
};

/** Suffixe unique par exécution : les specs restent vertes si on les rejoue. */
function uniq(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

const RUN = uniq();

/**
 * Connexion via le helper partagé, avec une tolérance sur la première visite :
 * le serveur de développement compile la route à la volée et la redirection
 * peut dépasser le délai d'attente par défaut de `loginUser`.
 */
async function connecter(page: Page, email: string, password: string): Promise<void> {
  await expect(async () => {
    try {
      await loginUser(page, email, password);
    } catch {
      // Deux cas sous forte charge : la redirection arrive après le délai par
      // défaut du helper partagé, ou la navigation elle-même échoue
      // (chrome-error://). Le premier se rattrape en attendant plus longtemps,
      // le second en rejouant la connexion.
      await expect(page).toHaveURL(
        /\/(dashboard|producer\/dashboard|jury\/dashboard)/,
        { timeout: 30_000 }
      );
    }
  }).toPass({ timeout: 180_000, intervals: [5_000] });
}

/** Crée une édition et renvoie son identifiant (lu dans l'URL de redirection). */
async function creerEdition(page: Page, nom: string): Promise<string> {
  await page.goto("/dashboard/cups");
  await page.getByRole("button", { name: "+ NOUVELLE CUP" }).click();

  const dialogue = page.getByRole("dialog");
  await expect(dialogue.getByText("CRÉER UNE NOUVELLE CUP")).toBeVisible();
  await dialogue.locator('input[id="name"]').fill(nom);
  await dialogue.getByRole("button", { name: "Créer la cup" }).click();

  await expect(page.getByText("Cup créée avec succès")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(/\/dashboard\/cups\/[^/]+$/, { timeout: 90_000 });
  const cupId = new URL(page.url()).pathname.split("/").pop()!;
  expect(cupId.length).toBeGreaterThan(0);
  return cupId;
}

/**
 * Appel tRPC direct, avec les cookies de session de la page.
 * SuperJSON est le transformer côté serveur : l'entrée et la sortie sont
 * enveloppées dans `{ json: ... }`.
 */
async function trpcMutation(
  page: Page,
  procedure: string,
  input: unknown
): Promise<{ status: number; body: string }> {
  const reponse = await page.request.post(`/api/trpc/${procedure}`, {
    data: { json: input },
    headers: { "content-type": "application/json" },
    failOnStatusCode: false,
  });
  return { status: reponse.status(), body: await reponse.text() };
}

async function trpcQuery(
  page: Page,
  procedure: string,
  input: unknown
): Promise<{ status: number; body: string }> {
  const encode = encodeURIComponent(JSON.stringify({ json: input }));
  const reponse = await page.request.get(`/api/trpc/${procedure}?input=${encode}`, {
    failOnStatusCode: false,
  });
  return { status: reponse.status(), body: await reponse.text() };
}

test.describe.configure({ mode: "serial", timeout: 300_000 });

test.describe("Organisateur — configuration et publication d'une édition", () => {
  let contexte: BrowserContext;
  let page: Page;
  let cupId: string;
  const nomEdition = `E2E-EDITION-${RUN}`;
  const nomCategorie = `E2E-Cat-${RUN}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
    cupId = await creerEdition(page, nomEdition);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("l'édition fraîchement créée est en brouillon et porte son nom", async () => {
    await page.goto(`/dashboard/cups/${cupId}`);
    await expect(page.getByRole("heading", { name: nomEdition })).toBeVisible();
    await expect(page.getByText("BROUILLON").first()).toBeVisible();
  });

  test("la publication est refusée tant qu'aucune catégorie n'est configurée", async () => {
    await page.goto(`/dashboard/cups/${cupId}`);

    // Alerte de configuration : le motif du refus est écrit à l'écran.
    await expect(page.getByText("Catégories manquantes")).toBeVisible();
    await expect(
      page.getByText("Ajoutez au moins une catégorie pour pouvoir publier la cup.")
    ).toBeVisible();

    // Et le bouton reste inactif.
    const publier = page.getByRole("button", { name: "Publier" });
    await expect(publier).toBeDisabled();

    // Contre-épreuve côté serveur : la procédure refuse aussi l'appel direct.
    const refus = await trpcMutation(page, "cup.publish", { cupId });
    expect(refus.status).toBeGreaterThanOrEqual(400);
    expect(refus.body).toContain("Au moins une catégorie est requise");
  });

  test("une catégorie créée apparaît dans la liste et dans le compteur", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/categories`);
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();

    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="name"]').fill(nomCategorie);
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByText("Catégorie créée")).toBeVisible();
    await expect(page.getByRole("heading", { name: nomCategorie })).toBeVisible();
    await expect(page.getByLabel(`Configurer ${nomCategorie}`)).toBeVisible();
  });

  test("les critères par défaut et un critère à coefficient 3 sont enregistrés", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/categories`);
    await page.getByLabel(`Configurer ${nomCategorie}`).click();
    await expect(page).toHaveURL(/\/criteria$/);

    await page.getByRole("button", { name: "Initialiser les critères par défaut" }).click();
    await expect(page.getByText("4 critères par défaut créés")).toBeVisible();

    // Les coefficients par défaut sont bien rendus (Arôme = ×2).
    await expect(page.getByText("Arôme", { exact: true })).toBeVisible();
    await expect(page.getByText("×2").first()).toBeVisible();

    // Critère personnalisé avec coefficient 3.
    const nomCritere = `E2E-Critere-${RUN}`;
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="name"]').fill(nomCritere);
    await dialogue.locator('input[id="coefficient"]').fill("3");
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByText("Critère créé")).toBeVisible();
    await expect(page.getByText(nomCritere, { exact: true })).toBeVisible();
    await expect(page.getByText("5 critères")).toBeVisible();
    await expect(page.getByText("×3").first()).toBeVisible();
  });

  test("les labels par défaut sont créés avec leurs plages de score", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/labels`);
    await page.getByRole("button", { name: "Initialiser les labels par défaut" }).click();

    await expect(page.getByText("Labels par défaut créés")).toBeVisible();
    await expect(page.getByText("3 Labels")).toBeVisible();
    await expect(page.getByText("Mention", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Médaille", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Excellence", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Score ≥ 17/20").first()).toBeVisible();
  });

  test("les dates de phases enregistrées sont relues après rechargement", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/phases`);
    await expect(page.getByRole("heading", { name: "Phases & Dates" })).toBeVisible();
    await expect(page.getByText("Configuration des dates")).toBeVisible();
    await expect(page.locator("#registrationOpenAt")).toContainText("Choisir une date");

    // Ouverture des inscriptions : on choisit le 15 du mois affiché.
    await page.locator("#registrationOpenAt").click();
    const calendrier = page.locator('[data-slot="popover-content"]');
    await calendrier.getByText("15", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#registrationOpenAt")).not.toContainText(
      "Choisir une date"
    );

    await page.getByRole("button", { name: "Enregistrer les dates" }).click();
    await expect(page.getByText("Dates des phases mises à jour")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Date configurée")).toBeVisible();
    await expect(page.locator("#registrationOpenAt")).not.toContainText(
      "Choisir une date"
    );
    await expect(page.locator("#registrationCloseAt")).toContainText(
      "Choisir une date"
    );
  });

  test("le tarif enregistré est relu dans les statistiques de la page", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/pricing`);
    await page.locator('input[id="priceInput"]').fill("42,00");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

    await expect(page.getByText("Tarification mise à jour")).toBeVisible();
    await page.reload();
    await expect(page.getByText("42,00 €").first()).toBeVisible();
    await expect(page.locator('input[id="priceInput"]')).toHaveValue("42,00");
  });

  test("la publication est acceptée une fois la configuration complète", async () => {
    await page.goto(`/dashboard/cups/${cupId}`);

    // L'alerte de refus a disparu, remplacée par le feu vert.
    await expect(page.getByText("Prêt à publier")).toBeVisible();
    await expect(page.getByText("Catégories manquantes")).toHaveCount(0);

    // Le tarif est non nul et le prestataire de paiement est coupé :
    // l'avertissement est le comportement attendu, pas un blocage.
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Publier avec avertissements ?")).toBeVisible();
    await expect(
      page.getByText(
        "Aucun processeur de paiement configuré. Les paiements ne fonctionneront pas."
      )
    ).toBeVisible();
    await page.getByRole("button", { name: "Publier quand même" }).click();

    await expect(page.getByText("Cup publiée avec succès")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dépublier" })).toBeVisible();
    await expect(page.getByText("PUBLIÉE").first()).toBeVisible();
  });
});

test.describe("Organisateur — imports CSV", () => {
  let contexte: BrowserContext;
  let page: Page;
  let cupId: string;
  const nomEdition = `E2E-IMPORT-${RUN}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
    cupId = await creerEdition(page, nomEdition);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("un CSV producteurs à moitié invalide rend ses erreurs ligne par ligne", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/import`);
    await expect(page.getByRole("heading", { name: "Importer des données" })).toBeVisible();

    const csv = [
      "nom,email,entreprise",
      `E2E Producteur Un ${RUN},e2e-prod-un-${RUN}@platinum-cbd-cup.test,E2E Ferme Un`,
      `E2E Producteur Deux ${RUN},e2e-prod-deux-${RUN}@platinum-cbd-cup.test,E2E Ferme Deux`,
      `,e2e-prod-sansnom-${RUN}@platinum-cbd-cup.test,E2E Sans Nom`,
      `E2E Producteur Trois ${RUN},pas-une-adresse,E2E Ferme Trois`,
      `E2E Producteur Quatre ${RUN},e2e-prod-un-${RUN}@platinum-cbd-cup.test,E2E Ferme Quatre`,
    ].join("\n");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: `e2e-producteurs-${RUN}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await expect(page.getByText("Prévisualisation (5 lignes)")).toBeVisible();
    await expect(page.getByText("2 valides")).toBeVisible();
    await expect(page.getByText("3 erreurs")).toBeVisible();

    // Chaque ligne fautive porte SON motif, pas un message global.
    await expect(page.getByTitle("Nom requis")).toBeVisible();
    await expect(page.getByTitle("Email invalide")).toBeVisible();
    await expect(page.getByTitle("Email duplique dans le fichier")).toBeVisible();

    // Les bonnes lignes passent, et elles seules.
    await page.getByRole("button", { name: "Importer 2 producteur(s)" }).click();
    await expect(page.getByText("2 producteur(s) importé(s) avec succès")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Import terminé")).toBeVisible();
  });

  test("un CSV jurés importé laisse une invitation tracée par juré", async () => {
    await page.goto(`/dashboard/cups/${cupId}/config/import`);
    await page.getByRole("tab", { name: "Jurys" }).click();
    await expect(page.getByText("Import Jurys")).toBeVisible();

    const emailJureA = `e2e-jure-a-${RUN}@platinum-cbd-cup.test`;
    const emailJureB = `e2e-jure-b-${RUN}@platinum-cbd-cup.test`;
    const csv = [
      "nom,email,specialite",
      `E2E Jure A ${RUN},${emailJureA},Fleurs`,
      `E2E Jure B ${RUN},${emailJureB},Resines`,
      `E2E Jure Casse ${RUN},pas-une-adresse,Fleurs`,
    ].join("\n");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: `e2e-jures-${RUN}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await expect(page.getByText("Prévisualisation (3 lignes)")).toBeVisible();
    await expect(page.getByText("2 valides")).toBeVisible();
    await expect(page.getByTitle("Email invalide")).toBeVisible();

    await page.getByRole("button", { name: "Importer et inviter 2 juré(s)" }).click();
    await expect(page.getByText("Import terminé")).toBeVisible({ timeout: 30_000 });

    // L'envoi ne part pas en développement : ce qui doit être vérifié, c'est la
    // trace de l'invitation, pas sa réception.
    await page.goto(`/dashboard/cups/${cupId}/scoring/juries`);
    await page.getByRole("tab", { name: "Invitations" }).click();
    await expect(page.getByText(emailJureA)).toBeVisible();
    await expect(page.getByText(emailJureB)).toBeVisible();
    await expect(page.getByText("EN ATTENTE").first()).toBeVisible();
  });
});

test.describe("Organisateur — codes jurés, jetons publics et assignations", () => {
  let contexte: BrowserContext;
  let page: Page;
  let cupId: string;
  let categorieId: string;
  const nomEdition = `E2E-JURYS-${RUN}`;
  const nomCategorie = `E2E-CatJury-${RUN}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
    cupId = await creerEdition(page, nomEdition);

    // Une catégorie est indispensable aux codes comme aux jetons.
    await page.goto(`/dashboard/cups/${cupId}/config/categories`);
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="name"]').fill(nomCategorie);
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByRole("heading", { name: nomCategorie })).toBeVisible();

    const categories = await trpcQuery(page, "category.list", { cupId });
    const parsed = JSON.parse(categories.body) as {
      result: { data: { json: { id: string; name: string }[] } };
    };
    categorieId = parsed.result.data.json.find((c) => c.name === nomCategorie)!.id;
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("les codes d'invitation générés sont listés puis révocables", async () => {
    await page.goto(`/dashboard/cups/${cupId}/scoring/invitation-codes`);
    await page.getByRole("button", { name: "Generer des codes" }).click();

    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="count"]').fill("3");
    await dialogue.getByText(nomCategorie).click();
    await dialogue.getByRole("button", { name: /Generer 3 codes/ }).click();

    await expect(page.getByText("3 codes generes")).toBeVisible({ timeout: 20_000 });

    const lignes = page.locator("table tbody tr");
    await expect(lignes).toHaveCount(3);
    await expect(page.getByText("EN ATTENTE").first()).toBeVisible();

    // Révocation du premier code : son statut doit basculer à l'écran.
    const premierCode = (await lignes.first().locator("code").innerText()).trim();
    await lignes.first().getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Revoquer" }).click();
    await page.getByRole("button", { name: "Revoquer" }).click();

    await expect(page.getByText("Code revoque")).toBeVisible();
    const ligneRevoquee = page.locator("table tbody tr").filter({ hasText: premierCode });
    await expect(ligneRevoquee.getByText("REVOQUE")).toBeVisible();

    // Contre-épreuve : les deux autres codes restent bien en attente.
    await expect(page.locator("table tbody").getByText("EN ATTENTE")).toHaveCount(2);
  });

  test("les jetons publics générés sont listés avec leur catégorie", async () => {
    await page.goto(`/dashboard/cups/${cupId}/scoring/public-tokens`);
    await page.getByRole("button", { name: "Générer des jetons" }).click();

    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="quantity"]').fill("2");
    await dialogue.getByRole("combobox").click();
    await page.getByRole("option", { name: nomCategorie }).click();
    await dialogue.getByRole("button", { name: /Générer 2 jetons/ }).click();

    await expect(page.getByText("2 jetons générés")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table tbody tr")).toHaveCount(2);
    await expect(page.getByText(nomCategorie).first()).toBeVisible();
  });

  test("l'assignation en masse accepte un identifiant en double sans erreur brute", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // 1. Un code d'invitation, activé par le juré de test : c'est le seul
    //    chemin qui produit un jury actif rattaché à cette édition.
    await page.goto(`/dashboard/cups/${cupId}/scoring/invitation-codes`);
    await page.getByRole("button", { name: "Generer des codes" }).click();
    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="count"]').fill("1");
    await dialogue.getByText(nomCategorie).click();
    await dialogue.getByRole("button", { name: /Generer 1 code/ }).click();
    await expect(page.getByText("1 code genere")).toBeVisible({ timeout: 20_000 });

    const codeAActiver = (
      await page
        .locator("table tbody tr")
        .filter({ hasText: "EN ATTENTE" })
        .first()
        .locator("code")
        .innerText()
    ).trim();

    const contexteJure = await browser.newContext();
    const pageJure = await contexteJure.newPage();
    await connecter(pageJure, JURE.email, JURE.password);
    await pageJure.goto(`/activate?code=${codeAActiver}`);
    await pageJure
      .getByRole("button", { name: "Activer ce code et devenir jury" })
      .click();
    await expect(pageJure).toHaveURL(new RegExp(`/jury/cups/${cupId}`), {
      timeout: 30_000,
    });
    await contexteJure.close();

    // 2. Le jury actif apparaît côté organisateur.
    await page.goto(`/dashboard/cups/${cupId}/scoring/juries`);
    await expect(page.getByText(JURE.email)).toBeVisible({ timeout: 20_000 });

    const juries = await trpcQuery(page, "jury.listJuries", {
      cupId,
      includeInactive: true,
    });
    const listeJuries = (
      JSON.parse(juries.body) as {
        result: { data: { json: { id: string; isActive: boolean }[] } };
      }
    ).result.data.json;
    const cupJuryId = listeJuries.find((j) => j.isActive)!.id;

    // 3. Assignation en masse normale, par l'interface.
    await page.locator("table tbody tr").first().getByRole("checkbox").click();
    await page.getByRole("button", { name: "Assigner des categories" }).click();
    const dialogueAssign = page.getByRole("dialog");
    await dialogueAssign.getByText(nomCategorie).click();
    await dialogueAssign.getByRole("button", { name: "Assigner", exact: true }).click();
    await expect(page.getByText(/assignation.* creee/i)).toBeVisible({
      timeout: 20_000,
    });

    // 4. Rejeu avec le MÊME identifiant deux fois : la procédure est appelable
    //    directement, et le doublon produisait une violation de contrainte.
    const doublon = await trpcMutation(page, "jury.bulkAssignCategories", {
      cupId,
      cupJuryIds: [cupJuryId, cupJuryId],
      categoryIds: [categorieId],
    });
    expect(doublon.status).toBe(200);
    expect(doublon.body).not.toContain("jury_category_assignment_unique");
    expect(doublon.body).toContain("assignmentsCreated");

    // Contre-épreuve : un identifiant réellement étranger reste refusé.
    const etranger = await trpcMutation(page, "jury.bulkAssignCategories", {
      cupId,
      cupJuryIds: [cupJuryId, "identifiant-inexistant-e2e"],
      categoryIds: [categorieId],
    });
    expect(etranger.status).toBeGreaterThanOrEqual(400);
    expect(etranger.body).toContain("Certains jurys ne sont pas valides pour cette cup");
  });
});

test.describe("Organisateur — suivi, calcul et publication des résultats", () => {
  let contexte: BrowserContext;
  let page: Page;
  let cupId: string;
  const nomEdition = `E2E-RESULTATS-${RUN}`;
  const nomCategorie = `E2E-CatRes-${RUN}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
    cupId = await creerEdition(page, nomEdition);

    await page.goto(`/dashboard/cups/${cupId}/config/categories`);
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    const dialogue = page.getByRole("dialog");
    await dialogue.locator('input[id="name"]').fill(nomCategorie);
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByRole("heading", { name: nomCategorie })).toBeVisible();

    await page.getByLabel(`Configurer ${nomCategorie}`).click();
    await page.getByRole("button", { name: "Initialiser les critères par défaut" }).click();
    await expect(page.getByText("4 critères par défaut créés")).toBeVisible();
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("les écrans de suivi et de résultats détaillés répondent", async () => {
    await page.goto(`/dashboard/cups/${cupId}/results/live`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto(`/dashboard/cups/${cupId}/results/details`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("la publication des résultats est refusée avant la clôture de la notation", async () => {
    await page.goto(`/dashboard/cups/${cupId}/results/publication`);
    await expect(page.getByText("[NOTATION NON CLÔTURÉE]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier les résultats" })).toBeDisabled();

    const refus = await trpcMutation(page, "cup.publishResults", {
      cupId,
      visibility: "labels_and_podium",
    });
    expect(refus.status).toBeGreaterThanOrEqual(400);
    expect(refus.body).toContain(
      "La notation doit être clôturée avant de publier les résultats"
    );
  });

  test("l'édition traverse ses phases jusqu'à « Terminée »", async () => {
    await page.goto(`/dashboard/cups/${cupId}`);

    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Cup publiée avec succès")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Clôturer les inscriptions" }).click();
    await page.getByRole("button", { name: "Clôturer", exact: true }).click();
    await expect(page.getByText("Inscriptions clôturées")).toBeVisible();

    await page.getByRole("button", { name: "Démarrer la notation" }).click();
    await page.getByRole("button", { name: "Démarrer", exact: true }).click();
    await expect(page.getByText("Phase de notation démarrée")).toBeVisible();

    await page.getByRole("button", { name: "Clôturer la notation" }).click();
    await page.getByRole("button", { name: "Clôturer", exact: true }).click();
    await expect(
      page.getByText("Notation clôturée - Compétition terminée")
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText("TERMINÉE").first()).toBeVisible();
  });

  test("la publication des résultats lance le calcul et expose l'édition au public", async () => {
    test.setTimeout(150_000);

    await page.goto(`/dashboard/cups/${cupId}/results/publication`);
    await expect(page.getByText("[NOTATION NON CLÔTURÉE]")).toHaveCount(0);
    await expect(page.getByText("Les résultats ne sont pas publiés")).toBeVisible();

    await page.getByRole("button", { name: "Publier les résultats" }).click();
    await page.getByRole("button", { name: "Publier", exact: true }).click();

    await expect(page.getByText("Résultats publiés")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Les résultats sont publiés")).toBeVisible();
    await expect(page.getByText("PUBLIÉS").first()).toBeVisible();

    // Côté public : l'édition rejoint la bande des éditions du palmarès.
    // La liste est mémoïsée une minute (PORTAL_REVALIDATE), d'où le rechargement.
    await expect(async () => {
      await page.goto("/palmares");
      await expect(page.getByRole("link", { name: nomEdition })).toBeVisible({
        timeout: 5_000,
      });
    }).toPass({ timeout: 100_000, intervals: [5_000] });

    await page.goto(`/palmares?edition=${cupId}`);
    await expect(page.getByText("Aucun résultat publié pour cette édition.")).toBeVisible();
  });
});
