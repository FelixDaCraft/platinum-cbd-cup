import {
  test,
  expect as expectDefaut,
  type Page,
  type BrowserContext,
} from "@playwright/test";

import { loginUser } from "../support/fixtures/auth.fixture";

/**
 * Parcours organisateur — contenus du portail public et compte.
 *
 * Les données créées sont préfixées `E2E-` et suffixées d'un aléatoire, puis
 * nettoyées quand elles polluent une page publique. Les réglages globaux
 * (interrupteurs de la page presse) sont remis dans leur état initial par le
 * test qui les a modifiés.
 */

const expect = expectDefaut.configure({ timeout: 45_000 });

const ORGANISATEUR = {
  email: "e2e-organisateur@platinum-cbd-cup.test",
  password: "E2e-Platinum!2026",
};

function uniq(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

const RUN = uniq();

/** Connexion via le helper partagé, tolérante à la compilation à la volée. */
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

/**
 * Ouvre une page publique en contournant tout cache (paramètre jetable) et
 * réessaie jusqu'à ce que la vérification passe : le portail peut servir un
 * rendu de quelques secondes de retard après une écriture.
 */
async function verifierPagePublique(
  page: Page,
  chemin: string,
  verification: () => Promise<void>
): Promise<void> {
  await expect(async () => {
    const separateur = chemin.includes("?") ? "&" : "?";
    await page.goto(`${chemin}${separateur}e2e=${Date.now()}`);
    await verification();
  }).toPass({ timeout: 120_000, intervals: [3_000] });
}

/** Saisit du texte dans l'éditeur TipTap (contenteditable `.ProseMirror`). */
async function ecrireDansEditeur(page: Page, texte: string): Promise<void> {
  const editeur = page.locator(".ProseMirror");
  await expect(editeur).toBeVisible();
  await editeur.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await editeur.pressSequentially(texte, { delay: 5 });
  await expect(editeur).toContainText(texte);
}

test.describe.configure({ mode: "serial", timeout: 300_000 });

test.describe("Organisateur — rédaction d'articles", () => {
  let contexte: BrowserContext;
  let page: Page;
  let articleUrl: string;

  const titre = `E2E-Article-${RUN}`;
  const titreModifie = `E2E-Article-${RUN} (revu)`;
  const corpsInitial = `Corps initial de larticle E2E ${RUN} en un seul paragraphe.`;
  const corpsModifie = `Corps revu de larticle E2E ${RUN}, toujours present apres relecture.`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("un article rédigé est créé avec son titre et son contenu", async () => {
    await page.goto("/dashboard/articles/new");
    await expect(page.getByRole("heading", { name: "Nouvel article" })).toBeVisible();

    await page.getByRole("textbox", { name: "Titre de l'article" }).fill(titre);
    await ecrireDansEditeur(page, corpsInitial);
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByText("Article créé !")).toBeVisible({ timeout: 60_000 });

    // `/dashboard/articles/new` répond au même motif que la page d'édition :
    // on attend explicitement l'écran d'édition avant de retenir son URL.
    await expect(page.getByRole("heading", { name: "Modifier l'article" })).toBeVisible({
      timeout: 60_000,
    });
    articleUrl = page.url();
    expect(articleUrl).not.toContain("/dashboard/articles/new");
    await expect(page.getByText("Brouillon")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toContainText(corpsInitial);
  });

  test("l'article publié devient lisible sur le portail public", async () => {
    await page.goto(articleUrl);
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Article publié !")).toBeVisible();
    await expect(page.getByText("Publié", { exact: true })).toBeVisible();

    const slug = titre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    await verifierPagePublique(page, `/articles/${slug}`, async () => {
      await expect(page.getByRole("heading", { name: titre })).toBeVisible({
        timeout: 3_000,
      });
      await expect(page.getByText(corpsInitial)).toBeVisible({ timeout: 3_000 });
    });
  });

  test("après modification et réouverture, le contenu de l'article n'est pas vidé", async () => {
    await page.goto(articleUrl);
    await expect(page.locator(".ProseMirror")).toContainText(corpsInitial);

    await page.getByRole("textbox", { name: "Titre de l'article" }).fill(titreModifie);
    await ecrireDansEditeur(page, corpsModifie);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Article mis à jour")).toBeVisible();

    // Le cœur du test : rouvrir la page. Un correctif remplaçait le contenu
    // par un document vide tout en affichant « Article mis à jour ».
    await page.goto(articleUrl);
    await expect(page.getByRole("heading", { name: "Modifier l'article" })).toBeVisible();

    const editeur = page.locator(".ProseMirror");
    await expect(editeur).toContainText(corpsModifie);
    await expect(editeur).not.toBeEmpty();
    await expect(
      page.getByRole("textbox", { name: "Titre de l'article" })
    ).toHaveValue(titreModifie);
  });

  test("l'article dépublié disparaît de la liste des publiés", async () => {
    await page.goto(articleUrl);
    await page.getByRole("button", { name: "Dépublier" }).click();
    await expect(page.getByText("Article dépublié")).toBeVisible();

    await page.goto("/dashboard/articles");
    await page.getByRole("tab", { name: /Publiés/ }).click();
    await expect(page.getByText(titreModifie)).toHaveCount(0);

    await page.getByRole("tab", { name: /Brouillons/ }).click();
    await expect(page.getByText(titreModifie)).toBeVisible();
  });
});

test.describe("Organisateur — sponsors, manifesto et presse", () => {
  let contexte: BrowserContext;
  let page: Page;

  const nomSponsor = `E2E-Sponsor-${RUN}`;
  const titreCommunique = `E2E-Communique-${RUN}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("un sponsor créé apparaît en back-office et sur la page publique", async () => {
    await page.goto("/dashboard/settings/sponsors");
    await expect(page.getByRole("heading", { name: "Sponsors" })).toBeVisible();

    await page.getByRole("button", { name: /Cr[ée]er un sponsor|Nouveau sponsor|Ajouter/ })
      .first()
      .click();

    const dialogue = page.getByRole("dialog");
    await dialogue.getByRole("textbox", { name: "Nom du sponsor *" }).fill(nomSponsor);
    await dialogue
      .getByRole("textbox", { name: "Description" })
      .fill(`Sponsor de test E2E ${RUN}.`);
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByRole("heading", { name: nomSponsor })).toBeVisible();

    await verifierPagePublique(page, "/sponsors", async () => {
      await expect(page.getByText(nomSponsor)).toBeVisible({ timeout: 3_000 });
    });
  });

  test("le sponsor supprimé disparaît de la page publique", async () => {
    await page.goto("/dashboard/settings/sponsors");
    const carte = page.locator(".n-card").filter({ hasText: nomSponsor }).first();
    await expect(carte).toBeVisible();
    await carte.getByRole("button").last().click();

    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.getByText("Supprimer ce sponsor ?")).toBeVisible();
    await confirmation.getByRole("button", { name: "Supprimer", exact: true }).click();
    // On attend la fermeture de la boîte de dialogue : tant qu'elle est
    // ouverte, Radix masque le reste de la page à l'arbre d'accessibilité et
    // une assertion « le sponsor a disparu » passerait pour la mauvaise raison.
    await expect(confirmation).toHaveCount(0);
    await expect(
      page.locator(".n-card").filter({ hasText: nomSponsor })
    ).toHaveCount(0);

    await verifierPagePublique(page, "/sponsors", async () => {
      await expect(page.getByText(nomSponsor)).toHaveCount(0, { timeout: 3_000 });
    });
  });

  test("le manifesto s'enregistre et confirme l'enregistrement", async () => {
    await page.goto("/dashboard/settings/portal/about");
    await expect(page.getByRole("heading", { name: "Manifesto" })).toBeVisible();

    // Aucune donnée n'est réécrite : on renvoie les valeurs déjà présentes.
    const mission = page.locator("#mission");
    await expect(mission).toBeVisible();
    const valeurInitiale = await mission.inputValue();
    await mission.fill(valeurInitiale);

    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Manifesto enregistré")).toBeVisible();

    await page.reload();
    await expect(page.locator("#mission")).toHaveValue(valeurInitiale);
  });

  test("les quatre interrupteurs d'affichage de la page presse sont enregistrables", async () => {
    await page.goto("/dashboard/settings/portal/press");
    await expect(page.getByRole("heading", { name: "Presse & Médias" })).toBeVisible();

    for (const libelle of [
      "AFFICHER LES COMMUNIQUÉS",
      "AFFICHER LA GALERIE",
      "AFFICHER LE MEDIA KIT",
      "AFFICHER LE CONTACT",
    ]) {
      await expect(page.getByText(libelle)).toBeVisible();
    }
    await expect(page.getByRole("switch")).toHaveCount(4);

    // Enregistrement à l'identique : ces réglages sont un enregistrement
    // unique partagé par les six agents, on ne change aucune valeur.
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Paramètres enregistrés")).toBeVisible();
  });

  test("un communiqué publié apparaît sur /press et en disparaît une fois dépublié", async () => {
    test.setTimeout(300_000);

    await page.goto("/dashboard/settings/portal/press");
    await expect(page.getByRole("heading", { name: "Presse & Médias" })).toBeVisible();

    // La section publique des communiqués doit être visible pour que le test
    // ait un sens ; l'interrupteur est à « affiché » par défaut.
    const interrupteurCommuniques = page.getByRole("switch").first();
    if ((await interrupteurCommuniques.getAttribute("data-state")) !== "checked") {
      await interrupteurCommuniques.click();
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(page.getByText("Paramètres enregistrés")).toBeVisible();
    }

    await page.getByRole("button", { name: "Nouveau communiqué" }).click();
    const dialogue = page.getByRole("dialog");
    await dialogue.getByRole("textbox").first().fill(titreCommunique);
    await dialogue.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Communiqué créé")).toBeVisible();

    const ligne = page
      .locator("div")
      .filter({ hasText: titreCommunique })
      .filter({ has: page.getByRole("button", { name: "Supprimer" }) })
      .last();

    // Brouillon : absent du portail.
    await verifierPagePublique(page, "/press", async () => {
      await expect(page.getByText(titreCommunique)).toHaveCount(0, { timeout: 3_000 });
    });

    // Publié : présent, sous le titre de section « Communiqués ».
    await page.goto("/dashboard/settings/portal/press");
    await ligne.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Communiqué publié")).toBeVisible();

    await verifierPagePublique(page, "/press", async () => {
      await expect(page.getByRole("heading", { name: "Communiqués" })).toBeVisible({
        timeout: 3_000,
      });
      await expect(page.getByText(titreCommunique)).toBeVisible({ timeout: 3_000 });
    });

    // Dépublié : de nouveau absent.
    await page.goto("/dashboard/settings/portal/press");
    await ligne.getByRole("button", { name: "Dépublier" }).click();
    await expect(page.getByText("Communiqué dépublié")).toBeVisible();

    await verifierPagePublique(page, "/press", async () => {
      await expect(page.getByText(titreCommunique)).toHaveCount(0, { timeout: 3_000 });
    });

    // Nettoyage de nos propres communiqués, y compris ceux qu'une exécution
    // précédente aurait laissés : ils polluent une page publique.
    await page.goto("/dashboard/settings/portal/press");
    // La liste doit être rendue avant de compter : sur « [LOADING...] », un
    // « il n'en reste aucun » serait vrai pour la mauvaise raison.
    await expect(page.getByText(titreCommunique)).toBeVisible();

    const titresE2E = page.getByText(/^E2E-Communique-/);
    let garde = 0;
    while ((await titresE2E.count()) > 0 && garde < 20) {
      const titre = (await titresE2E.first().innerText()).trim();
      const aSupprimer = page
        .locator("div")
        .filter({ hasText: titre })
        .filter({ has: page.getByRole("button", { name: "Supprimer" }) })
        .last();
      await aSupprimer.getByRole("button", { name: "Supprimer" }).click();
      await expect(page.getByText("Supprimer ce communiqué ?")).toBeVisible();
      await page.getByRole("button", { name: "Supprimer", exact: true }).click();
      await expect(page.getByText("Communiqué supprimé")).toBeVisible();
      await expect(page.getByText(titre, { exact: true })).toHaveCount(0);
      garde += 1;
    }
    await expect(titresE2E).toHaveCount(0);
  });
});

test.describe("Organisateur — messages de contact et newsletter", () => {
  let contexte: BrowserContext;
  let page: Page;

  const nomExpediteur = `E2E Contact ${RUN}`;
  const emailExpediteur = `e2e-contact-${RUN}@platinum-cbd-cup.test`;
  const corpsMessage = `Message de test E2E ${RUN} envoye depuis le formulaire public.`;
  const emailAbonne = `e2e-newsletter-${RUN}@platinum-cbd-cup.test`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("un message envoyé depuis le formulaire public atterrit dans la boîte de réception", async ({
    browser,
  }) => {
    // Le formulaire public est rempli hors session organisateur.
    const contextePublic = await browser.newContext();
    const pagePublique = await contextePublic.newPage();

    await pagePublique.goto("/contact");
    await pagePublique.locator('input[name="name"]').fill(nomExpediteur);
    await pagePublique.locator('input[name="email"]').fill(emailExpediteur);
    await pagePublique.locator('textarea[name="message"]').fill(corpsMessage);
    await pagePublique.getByText(/J'accepte que mes données soient traitées/).click();
    await pagePublique.getByRole("button", { name: /Envoyer/ }).click();

    await expect(pagePublique.getByText("Message envoyé")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      pagePublique.getByText("Merci. Nous revenons vers vous sous 48h ouvrées.")
    ).toBeVisible();
    await contextePublic.close();

    await page.goto("/dashboard/settings/portal/messages");
    await expect(page.getByRole("heading", { name: "Messages", level: 1 })).toBeVisible();

    // La boîte contient les messages réels de la copie de production :
    // on isole le nôtre par la recherche.
    await page.getByPlaceholder("Rechercher...").fill(nomExpediteur);
    await expect(page.getByText(nomExpediteur).first()).toBeVisible();

    await page.getByText(nomExpediteur).first().click();
    await expect(page.getByText(corpsMessage)).toBeVisible();
    await expect(page.getByText(emailExpediteur).first()).toBeVisible();
  });

  test("un abonné newsletter ajouté puis supprimé suit son cycle complet", async () => {
    await page.goto("/dashboard/settings/newsletter");
    await expect(page.getByRole("heading", { name: "Newsletter" })).toBeVisible();

    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    const dialogue = page.getByRole("dialog");
    await expect(dialogue.getByText("Ajouter un abonne")).toBeVisible();
    await dialogue.locator('input[id="email"]').fill(emailAbonne);
    await dialogue.locator('input[id="name"]').fill(`E2E Abonne ${RUN}`);
    await dialogue.getByRole("button", { name: "Ajouter", exact: true }).click();

    await expect(page.getByText("Abonne ajoute")).toBeVisible();

    // La liste est paginée : on isole l'abonné par la recherche.
    await page.getByPlaceholder("Rechercher...").fill(emailAbonne);
    await page.getByRole("button", { name: "Rechercher" }).click();

    const ligne = page.locator("table tbody tr").filter({ hasText: emailAbonne });
    await expect(ligne).toHaveCount(1);
    await expect(ligne.getByText("MANUEL")).toBeVisible();

    await ligne.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await expect(page.getByText("Supprimer cet abonne ?")).toBeVisible();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();

    await expect(page.getByText("Abonne supprime")).toBeVisible();
    await expect(page.getByText(emailAbonne)).toHaveCount(0);
  });
});

test.describe("Organisateur — changement de mot de passe", () => {
  let contexte: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    contexte = await browser.newContext();
    page = await contexte.newPage();
    await connecter(page, ORGANISATEUR.email, ORGANISATEUR.password);
  });

  test.afterAll(async () => {
    await contexte.close();
  });

  test("un mauvais mot de passe actuel affiche l'erreur SOUS le champ concerné", async () => {
    await page.goto("/dashboard/settings");
    await expect(page.locator("#currentPassword")).toBeVisible();

    await page.locator("#currentPassword").fill("CeNestPasLeBon!2026");
    await page.locator("#newPassword").fill("E2e-Nouveau-Motdepasse!2026");
    await page.locator("#confirmPassword").fill("E2e-Nouveau-Motdepasse!2026");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();

    // L'erreur est rattachée au champ : même identifiant que `aria-describedby`.
    const erreurChamp = page.locator("#current-password-error");
    await expect(erreurChamp).toHaveText("Mot de passe actuel incorrect");
    await expect(page.locator("#currentPassword")).toHaveAttribute(
      "aria-describedby",
      "current-password-error"
    );
    await expect(page.locator("#currentPassword")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    // Et le changement n'a pas eu lieu.
    await expect(
      page.getByText("Mot de passe mis à jour. Vos autres sessions ont été déconnectées.")
    ).toHaveCount(0);
  });

  test("avec le bon mot de passe actuel, l'erreur du champ ne s'affiche pas", async () => {
    // Contre-épreuve du test précédent : si « Mot de passe actuel incorrect »
    // s'affichait quoi qu'il arrive, l'assertion ci-dessus ne prouverait rien.
    // On fait échouer la SEULE confirmation, côté client : aucune requête de
    // changement n'est émise, le mot de passe du compte reste intact — ce qui
    // est vital, cinq autres agents s'en servent.
    await page.goto("/dashboard/settings");
    await expect(page.locator("#currentPassword")).toBeVisible();

    await page.locator("#currentPassword").fill(ORGANISATEUR.password);
    await page.locator("#newPassword").fill("E2e-Nouveau-Motdepasse!2026");
    await page.locator("#confirmPassword").fill("E2e-Autre-Motdepasse!2026");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();

    await expect(page.locator("#confirm-password-error")).toHaveText(
      "Les mots de passe ne correspondent pas"
    );
    await expect(page.locator("#current-password-error")).toHaveCount(0);
    await expect(page.getByText("Mot de passe actuel incorrect")).toHaveCount(0);
  });

  test("le mot de passe du compte organisateur est resté inchangé", async ({
    browser,
  }) => {
    // Garde-fou explicite : si un test précédent avait modifié le mot de passe,
    // les cinq autres agents tomberaient sans comprendre pourquoi.
    const autreContexte = await browser.newContext();
    const autrePage = await autreContexte.newPage();
    await connecter(autrePage, ORGANISATEUR.email, ORGANISATEUR.password);
    await expect(autrePage).toHaveURL(/\/dashboard/);
    await autreContexte.close();
  });
});
