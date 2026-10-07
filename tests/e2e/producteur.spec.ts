import {
  test,
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { loginUserWithTimeout } from "../support/fixtures/auth.fixture";

/**
 * Parcours producteur — Platinum CBD Cup.
 *
 * Ce que ces specs supposent de l'environnement :
 *  - l'application répond sur `E2E_BASE_URL` (base `platinum_local`) ;
 *  - les trois comptes de recette existent et sont vérifiés ;
 *  - le paiement Viva n'est PAS configuré : l'arrêt au règlement est le
 *    résultat attendu, pas un incident.
 *
 * Isolation : la base est partagée avec cinq autres campagnes. Aucune spec ne
 * lit ni ne modifie une donnée qu'elle n'a pas créée, à deux exceptions près,
 * toutes deux en LECTURE et par l'API de l'application (jamais par SQL) :
 *  - `cup.list` / `product.listByCupGroupedByCategory` côté organisateur, pour
 *    désigner un produit qui n'appartient pas au producteur de test — c'est la
 *    matière même du test d'isolation ;
 *  - les pages publiques.
 * Chaque édition créée ici porte un nom `E2E-PROD-<suffixe aléatoire>`.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const PRODUCTEUR = {
  email: "e2e-producteur@platinum-cbd-cup.test",
  password: "E2e-Platinum!2026",
};
const ORGANISATEUR = {
  email: "e2e-organisateur@platinum-cbd-cup.test",
  password: "E2e-Platinum!2026",
};

/** Prix d'inscription posé sur les éditions créées ici, en centimes. */
const PRIX_CENTIMES = 4200;

function suffixe(): string {
  return Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Appels tRPC bruts
// ---------------------------------------------------------------------------

/**
 * L'application parle tRPC avec le transformer SuperJSON : `{json: …}` pour la
 * valeur, `{meta: {values: {champ: ["Date"]}}}` pour les dates. On passe par
 * l'API plutôt que par l'interface pour POSER le décor (créer une édition,
 * lister des produits côté organisateur) ; tout ce que la spec PROUVE est
 * ensuite observé à l'écran ou sur une réponse HTTP.
 */
interface TrpcOutcome<T = unknown> {
  status: number;
  data?: T;
  code?: string;
  message?: string;
}

async function trpcMutate<T = unknown>(
  ctx: APIRequestContext,
  path: string,
  json: unknown,
  champsDate: string[] = []
): Promise<TrpcOutcome<T>> {
  const entree: Record<string, unknown> = { json };
  if (champsDate.length > 0) {
    entree.meta = {
      values: Object.fromEntries(champsDate.map((c) => [c, ["Date"]])),
    };
  }
  const reponse = await ctx.post(`/api/trpc/${path}?batch=1`, {
    headers: { "content-type": "application/json" },
    data: { "0": entree },
  });
  return lireEnveloppe<T>(reponse.status(), await reponse.text());
}

async function trpcQuery<T = unknown>(
  ctx: APIRequestContext,
  path: string,
  json: unknown
): Promise<TrpcOutcome<T>> {
  const input = encodeURIComponent(JSON.stringify({ "0": { json } }));
  const reponse = await ctx.get(`/api/trpc/${path}?batch=1&input=${input}`);
  return lireEnveloppe<T>(reponse.status(), await reponse.text());
}

function lireEnveloppe<T>(status: number, corps: string): TrpcOutcome<T> {
  let charge: unknown;
  try {
    charge = JSON.parse(corps);
  } catch {
    return { status, message: corps.slice(0, 200) };
  }
  const premier = Array.isArray(charge)
    ? (charge[0] as Record<string, any>)
    : (charge as Record<string, any>);
  if (premier?.error) {
    return {
      status,
      code: premier.error.json?.data?.code as string | undefined,
      message: premier.error.json?.message as string | undefined,
    };
  }
  return { status, data: premier?.result?.data?.json as T };
}

/**
 * Ouvre une session API.
 *
 * Deux tentatives : le serveur de développement est partagé par six campagnes
 * et coupe parfois la connexion (ECONNRESET) sous charge. Une coupure réseau
 * n'est pas un verdict sur l'application, et un test rouge pour cette raison
 * ferait perdre du temps à tout le monde.
 */
async function contexteConnecte(
  identifiants: { email: string; password: string }
): Promise<APIRequestContext> {
  const ctx = await apiRequest.newContext({ baseURL: BASE_URL });
  let dernierStatut = 0;
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const reponse = await ctx.post("/api/auth/sign-in/email", {
        data: identifiants,
        timeout: 60_000,
      });
      dernierStatut = reponse.status();
      if (dernierStatut === 200) return ctx;
    } catch (erreur) {
      if (essai === 2) throw erreur;
    }
  }
  expect(dernierStatut, `connexion API de ${identifiants.email}`).toBe(200);
  return ctx;
}

// ---------------------------------------------------------------------------
// Décor : une édition ouverte aux inscriptions, créée par l'organisateur
// ---------------------------------------------------------------------------

interface EditionOuverte {
  cupId: string;
  cupNom: string;
  categorieId: string;
  categorieNom: string;
  /** Inscription du producteur de test sur cette édition, avec un produit. */
  inscriptionId: string;
  produitId: string;
  produitNom: string;
}

let editionMemoisee: Promise<EditionOuverte> | null = null;

/** Une édition par worker Playwright, réutilisée par tous ses tests. */
function edition(): Promise<EditionOuverte> {
  editionMemoisee ??= creerEditionOuverte();
  return editionMemoisee;
}

async function creerEditionOuverte(): Promise<EditionOuverte> {
  const suf = suffixe();
  const organisateur = await contexteConnecte(ORGANISATEUR);

  const cupNom = `E2E-PROD-${suf}`;
  const cup = await trpcMutate<{ id: string }>(organisateur, "cup.create", {
    name: cupNom,
    ratingScale: "0-20",
  });
  expect(cup.data?.id, `création de l'édition ${cupNom}`).toBeTruthy();
  const cupId = cup.data!.id;

  const categorieNom = `E2E Categorie ${suf}`;
  const categorie = await trpcMutate<{ id: string }>(
    organisateur,
    "category.create",
    { cupId, name: categorieNom }
  );
  expect(categorie.data?.id, "création de la catégorie").toBeTruthy();
  const categorieId = categorie.data!.id;

  const critere = await trpcMutate(organisateur, "criteria.create", {
    categoryId: categorieId,
    name: "Arome",
    coefficient: 1,
  });
  expect(critere.code, "création du critère de notation").toBeUndefined();

  const tarif = await trpcMutate(organisateur, "pricing.updateCupPricing", {
    cupId,
    defaultPricePerProduct: PRIX_CENTIMES,
    currency: "EUR",
  });
  expect(tarif.code, "tarification de l'édition").toBeUndefined();

  // Fenêtre ouverte aujourd'hui, notation repoussée : `assertPaymentWindowOpen`
  // exige que la notation n'ait pas commencé pour laisser régler.
  const jours = (n: number) =>
    new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
  const dates = await trpcMutate(
    organisateur,
    "cup.updatePhaseDates",
    {
      cupId,
      registrationOpenAt: jours(-1),
      registrationCloseAt: jours(30),
      ratingStartAt: jours(31),
      ratingEndAt: jours(60),
    },
    ["registrationOpenAt", "registrationCloseAt", "ratingStartAt", "ratingEndAt"]
  );
  expect(dates.code, "dates de phase").toBeUndefined();

  const publication = await trpcMutate(organisateur, "cup.publish", { cupId });
  expect(publication.code, "publication de l'édition").toBeUndefined();

  // Inscription de service : les tests « facture », « synthèse PDF » et
  // « isolation » ont besoin d'une inscription réellement possédée par le
  // producteur de test. Le parcours d'inscription à l'écran, lui, est joué
  // séparément et ajoute son propre spécimen.
  const producteur = await contexteConnecte(PRODUCTEUR);
  const inscription = await trpcMutate<{ id: string }>(
    producteur,
    "registration.getOrCreate",
    { cupId }
  );
  expect(inscription.data?.id, "inscription du producteur").toBeTruthy();

  const produitNom = `E2E-Specimen-${suf}`;
  const produit = await trpcMutate<{ product: { id: string } }>(
    producteur,
    "registration.addProduct",
    {
      registrationId: inscription.data!.id,
      categoryId: categorieId,
      name: produitNom,
    }
  );
  expect(produit.data?.product?.id, "ajout du spécimen de service").toBeTruthy();

  await organisateur.dispose();
  await producteur.dispose();

  return {
    cupId,
    cupNom,
    categorieId,
    categorieNom,
    inscriptionId: inscription.data!.id,
    produitId: produit.data!.product.id,
    produitNom,
  };
}

// ---------------------------------------------------------------------------
// Fichiers de test
// ---------------------------------------------------------------------------

/** PNG 2×2 valide (signature + IHDR + IDAT + IEND). */
const PNG_VALIDE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==",
  "base64"
);
const PDF_VALIDE = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  "utf8"
);
/** Aucune signature reconnue : c'est le « mauvais format » du parcours. */
const FICHIER_MAUVAIS_FORMAT = Buffer.from(
  "ceci n'est pas une image, quel que soit le Content-Type annonce",
  "utf8"
);

/**
 * POST avec une seconde tentative sur coupure réseau.
 *
 * Le serveur de développement est partagé par six campagnes : il lui arrive de
 * fermer la connexion (`socket hang up`). Ce n'est pas un verdict sur la route
 * testée, et le statut lu à la tentative suivante reste un vrai résultat.
 */
async function posterAvecReprise(
  ctx: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext["post"]>[1]
) {
  try {
    return await ctx.post(url, { timeout: 60_000, ...options });
  } catch {
    return await ctx.post(url, { timeout: 60_000, ...options });
  }
}

function televersement(
  nom: string,
  mimeType: string,
  buffer: Buffer,
  dossier: string
) {
  return {
    file: { name: nom, mimeType, buffer },
    folder: dossier,
  };
}

// ---------------------------------------------------------------------------
// Aides d'interface
// ---------------------------------------------------------------------------

/**
 * Ouvre une session dans le navigateur sans rejouer le formulaire.
 *
 * `page.request` partage le pot à cookies du contexte : la session posée ici
 * vaut pour les navigations suivantes. On s'en sert partout où la connexion
 * n'est qu'un PRÉALABLE ; le parcours de connexion lui-même est prouvé par
 * `loginUser` (helper partagé) dans la spec dédiée. Sans cela, chaque test
 * repayait une compilation de la page /login par le serveur de développement
 * et se cassait sur le délai d'attente, pas sur son sujet.
 */
async function connexion(
  page: Page,
  identifiants: { email: string; password: string }
): Promise<void> {
  let dernierStatut = 0;
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const reponse = await page.request.post("/api/auth/sign-in/email", {
        data: identifiants,
        timeout: 60_000,
      });
      dernierStatut = reponse.status();
      if (dernierStatut === 200) return;
    } catch (erreur) {
      if (essai === 2) throw erreur;
    }
  }
  expect(dernierStatut, `connexion de ${identifiants.email}`).toBe(200);
}

/**
 * Ouvre l'assistant d'inscription à une édition et attend que l'inscription
 * soit réellement initialisée côté serveur.
 *
 * `registration.getOrCreate` part dans un effet au montage. Cliquer « Payer »
 * avant sa réponse fait afficher « Inscription non initialisée » : un échec de
 * synchronisation du test, pas du produit.
 */
async function ouvrirAssistantInscription(
  page: Page,
  cupId: string
): Promise<void> {
  const initialisation = page.waitForResponse(
    (r) => r.url().includes("registration.getOrCreate"),
    { timeout: 60_000 }
  );
  await page.goto(`/cups/${cupId}/register`);
  await initialisation;
}

/**
 * Carte « PAIEMENTS EN ATTENTE » d'une édition dans « Mes inscriptions ».
 *
 * Le paiement étant coupé, une inscription de test reste `pending_payment` :
 * elle n'apparaît donc JAMAIS dans « compétitions en cours » (réservée aux
 * inscriptions confirmées) et le détail des spécimens, lui, n'est rendu que
 * là. Cette carte-ci porte le nom de l'édition, le nombre de produits et le
 * total — de quoi constater que le spécimen a bien été enregistré.
 */
function carteEnAttente(page: Page, cupNom: string) {
  return page.locator(".n-card").filter({ hasText: cupNom }).first();
}

async function inscrireDepuisLePortail(
  page: Page,
  courriel: string
): Promise<void> {
  await page.goto("/register");
  await page.locator('input[id="email"]').fill(courriel);
  await page.locator('input[id="name"]').fill("E2E Nouveau Producteur");
  await page.locator('input[id="password"]').fill(PRODUCTEUR.password);
  await page.locator('input[id="confirmPassword"]').fill(PRODUCTEUR.password);
  await page.getByRole("button", { name: /créer mon compte/i }).click();
}

// ===========================================================================
// 1. Inscription au portail
// ===========================================================================

test.describe("Producteur · inscription au portail", () => {
  test.setTimeout(90_000);

  test("@P0 l'inscription au portail crée le compte et annonce l'envoi du lien de confirmation", async ({
    page,
  }) => {
    const courriel = `e2e-producteur-${suffixe()}@platinum-cbd-cup.test`;

    await inscrireDepuisLePortail(page, courriel);

    // L'email ne part pas en développement : la seule preuve recevable d'une
    // TENTATIVE d'envoi est le message rendu à l'écran. Il y en a deux, l'un
    // posé par /register, l'autre par /login à l'arrivée ; on les distingue
    // pour ne pas confondre « le compte est créé » et « un lien est parti ».
    await expect(
      page.locator("[data-sonner-toast]").filter({
        hasText: /inscription réussie/i,
      }),
      "message de la page d'inscription"
    ).toBeVisible({ timeout: 30_000 });

    // La page /login efface `registered=true` de l'URL après avoir affiché son
    // message : c'est ce message, pas le paramètre, qui prouve la redirection.
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(
      page.locator("[data-sonner-toast]").filter({
        hasText: /compte créé/i,
      }),
      "message d'accueil sur /login après inscription"
    ).toContainText(/vérifiez votre email/i, { timeout: 30_000 });
  });

  test("@P0 un compte fraîchement inscrit reste bloqué à la connexion tant que son email n'est pas confirmé", async ({
    page,
  }) => {
    const courriel = `e2e-producteur-${suffixe()}@platinum-cbd-cup.test`;
    await inscrireDepuisLePortail(page, courriel);
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    await page.locator('input[id="email"]').fill(courriel);
    await page.locator('input[id="password"]').fill(PRODUCTEUR.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Message positif : si la branche EMAIL_NOT_VERIFIED disparaissait, le
    // texte changerait et ce test tomberait.
    await expect(
      page.locator("[data-sonner-toast]").filter({
        hasText: /email n'est pas encore confirmé/i,
      })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("@P0 un producteur confirmé atteint son espace et n'y est jamais renvoyé vers /login", async ({
    page,
  }) => {
    // Contre-épreuve du test précédent : le même formulaire, avec un compte
    // vérifié, ouvre bien l'espace producteur. Et verrou anti-régression sur
    // la boucle /login ↔ /producer/dashboard : on y retourne deux fois de
    // suite, on doit y rester.
    //
    // Le vrai formulaire, via le helper partagé. `loginUserWithTimeout` est la
    // variante à délai explicite ajoutée dans auth.fixture.ts : sur ce serveur
    // de développement, la connexion met ~4 s et la navigation vers le tableau
    // de bord ~17 s de plus à la première compilation.
    await loginUserWithTimeout(page, PRODUCTEUR.email, PRODUCTEUR.password);
    await expect(page).toHaveURL(/\/producer\/dashboard/, { timeout: 30_000 });

    for (const chemin of ["/producer/dashboard", "/producer/profile", "/producer/dashboard"]) {
      const reponse = await page.goto(chemin);
      expect(reponse?.status(), `statut de ${chemin}`).toBe(200);
      await expect(page).toHaveURL(new RegExp(chemin.replace("/", "\\/")));
    }

    await expect(
      page.getByRole("heading", { name: /espace producteur|mon espace|E2E Test/i }).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});

// ===========================================================================
// 2. Inscription à une édition, jusqu'au règlement
// ===========================================================================

test.describe("Producteur · inscription à une édition", () => {
  // Le serveur de développement compile l'assistant, le portail et l'espace
  // producteur à la volée : ce parcours traverse les trois.
  test.setTimeout(240_000);

  test("@P0 le parcours d'inscription va jusqu'au règlement et s'y arrête proprement, le paiement n'étant pas configuré", async ({
    page,
  }) => {
    const ed = await edition();
    await connexion(page, PRODUCTEUR);

    await ouvrirAssistantInscription(page, ed.cupId);

    // Étape 1 — catégorie
    await page.getByRole("button", { name: ed.categorieNom }).click();
    await page.getByRole("button", { name: /continuer/i }).click();

    // Étape 2 — spécimen
    const nomSpecimen = `E2E-Ecran-${suffixe()}`;
    await page.getByLabel("Nom du spécimen *").fill(nomSpecimen);
    await page.getByLabel("Producteur / Lab *").fill("E2E Test");
    await page.locator('input[name="thc"]').fill("0.28");
    await page.locator('input[name="cbd"]').fill("12.4");
    await page.getByRole("button", { name: /continuer/i }).click();

    // Étape 3 — contact (lu sur le profil producteur, rien à saisir)
    await expect(page.getByText("Email du compte")).toBeVisible();
    await expect(page.getByText(PRODUCTEUR.email)).toBeVisible();
    await page.getByRole("button", { name: /continuer/i }).click();

    // Étape 4 — règlement
    await expect(page.getByRole("heading", { name: "Paiement" })).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Payer/ }).click();

    // Résultat ATTENDU : Viva n'est pas configuré, le parcours s'arrête ici en
    // le disant, sans quitter la page ni prétendre au succès.
    await expect(
      page.getByText(/session de paiement|paiement n'est pas disponible/i),
      "arrêt au règlement (Viva non configuré)"
    ).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`/cups/${ed.cupId}/register`));

    // Conséquence observable n°1, à l'écran : l'inscription figure bien parmi
    // les paiements en attente, avec le nombre de produits mis à jour. Un
    // parcours qui aurait « échoué » sans rien enregistrer n'afficherait rien.
    await page.goto("/producer/registrations");
    const carte = carteEnAttente(page, ed.cupNom);
    await expect(carte).toBeVisible({ timeout: 30_000 });
    await expect(carte).toContainText(/PRODUIT/);

    // Conséquence observable n°2, côté données : le spécimen saisi à l'écran
    // est attaché à l'inscription, avec le prix figé de la catégorie.
    const ctx = await contexteConnecte(PRODUCTEUR);
    const inscription = await trpcQuery<{
      products: { name: string; priceAtRegistration: number }[];
    }>(ctx, "registration.getById", { registrationId: ed.inscriptionId });
    await ctx.dispose();

    const enregistre = inscription.data?.products.find(
      (p) => p.name === nomSpecimen
    );
    expect(
      enregistre,
      `spécimen « ${nomSpecimen} » attaché à l'inscription`
    ).toBeTruthy();
    expect(enregistre!.priceAtRegistration).toBe(PRIX_CENTIMES);
  });

  test("@P0 un taux de THC supérieur à la limite européenne bloque le règlement, un taux conforme le laisse aller jusqu'au paiement", async ({
    page,
  }) => {
    const ed = await edition();
    await connexion(page, PRODUCTEUR);
    await ouvrirAssistantInscription(page, ed.cupId);

    await page.getByRole("button", { name: ed.categorieNom }).click();
    await page.getByRole("button", { name: /continuer/i }).click();

    await page.getByLabel("Nom du spécimen *").fill(`E2E-THC-${suffixe()}`);
    await page.getByLabel("Producteur / Lab *").fill("E2E Test");
    await page.locator('input[name="thc"]').fill("0.9");
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Payer/ }).click();

    // Refus explicite, chiffré : la tournure existe bien dans l'application.
    await expect(
      page.getByText(/dépasse la limite de 0\.3%/i)
    ).toBeVisible();

    // Contre-épreuve immédiate : le même parcours, ramené sous la limite,
    // franchit ce garde-fou et ne s'arrête que sur le paiement.
    await page.getByRole("button", { name: /précédent/i }).click();
    await page.getByRole("button", { name: /précédent/i }).click();
    await page.locator('input[name="thc"]').fill("0.25");
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /^Payer/ }).click();

    await expect(
      page.getByText(/session de paiement|paiement n'est pas disponible/i),
      "arrêt au règlement (Viva non configuré)"
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/dépasse la limite/i)).toHaveCount(0);
  });
});

// ===========================================================================
// 3. Téléversements
// ===========================================================================

test.describe("Producteur · téléversements", () => {
  test.setTimeout(120_000);

  test("@P0 un logo PNG est accepté et le fichier converti est réellement servi", async () => {
    const ctx = await contexteConnecte(PRODUCTEUR);

    const reponse = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-logo-${suffixe()}.png`,
        "image/png",
        PNG_VALIDE,
        "producer-logos"
      ),
    });
    expect(reponse.status()).toBe(200);
    const corps = (await reponse.json()) as { url: string; pngUrl: string };
    expect(corps.url).toMatch(/^\/uploads\/producer-logos\/.+\.webp$/);

    // Une URL rendue qui ne sert rien serait un succès de façade.
    const fichier = await ctx.get(corps.url);
    expect(fichier.status(), `lecture de ${corps.url}`).toBe(200);
    expect(fichier.headers()["content-type"]).toContain("image");

    await ctx.dispose();
  });

  test("@P0 dix-huit fichiers au mauvais format sont refusés sans consommer le quota : un bon fichier passe toujours après", async () => {
    // Quota d'un compte non organisateur : 15 fichiers par tranche de dix
    // minutes. Sans le remboursement des refus, le 16e essai partirait en 429
    // et un producteur maladroit se verrouillerait tout seul.
    const ctx = await contexteConnecte(PRODUCTEUR);

    for (let i = 1; i <= 18; i++) {
      const reponse = await posterAvecReprise(ctx, "/api/upload", {
        multipart: televersement(
          `e2e-mauvais-${i}.png`,
          "image/png",
          FICHIER_MAUVAIS_FORMAT,
          "producer-logos"
        ),
      });
      expect(reponse.status(), `refus n°${i}`).toBe(400);
      expect(await reponse.text(), `message du refus n°${i}`).toContain(
        "Type de fichier non autorisé"
      );
    }

    const bon = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-logo-apres-refus-${suffixe()}.png`,
        "image/png",
        PNG_VALIDE,
        "producer-logos"
      ),
    });
    expect(
      bon.status(),
      "un bon fichier après dix-huit refus (429 = quota non remboursé)"
    ).toBe(200);

    await ctx.dispose();
  });

  test("@P1 un PDF est reconnu mais refusé à la destination « logo », là où un PNG est accepté", async () => {
    const ctx = await contexteConnecte(PRODUCTEUR);

    const pdf = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-analyse-${suffixe()}.pdf`,
        "application/pdf",
        PDF_VALIDE,
        "producer-logos"
      ),
    });
    expect(pdf.status()).toBe(400);
    // Message DISTINCT de « Type de fichier non autorisé. Formats acceptés… » :
    // le PDF est bien identifié, c'est la destination qui le refuse.
    expect(await pdf.text()).toContain(
      "Type de fichier non autorisé pour cette destination"
    );

    const png = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-logo-${suffixe()}.png`,
        "image/png",
        PNG_VALIDE,
        "producer-logos"
      ),
    });
    expect(png.status(), "contre-épreuve : la même destination accepte un PNG").toBe(
      200
    );

    await ctx.dispose();
  });

  test("@P0 le dépôt d'une analyse de laboratoire est refusé au producteur et accepté à l'organisateur", async () => {
    const producteur = await contexteConnecte(PRODUCTEUR);
    const refus = await posterAvecReprise(producteur, "/api/upload/lab-analysis", {
      multipart: {
        file: {
          name: "e2e-analyse.pdf",
          mimeType: "application/pdf",
          buffer: PDF_VALIDE,
        },
        productId: (await edition()).produitId,
      },
    });
    expect(refus.status(), "producteur sur /api/upload/lab-analysis").toBe(403);
    await producteur.dispose();

    // Contre-épreuve : le même envoi, par l'organisateur, franchit la garde
    // d'autorisation — il échoue plus loin, sur le contenu du PDF, pas sur le
    // rôle. Un garde-fou qui refuserait tout le monde tomberait ici.
    const organisateur = await contexteConnecte(ORGANISATEUR);
    const passe = await posterAvecReprise(organisateur, "/api/upload/lab-analysis", {
      multipart: {
        file: {
          name: "e2e-analyse.pdf",
          mimeType: "application/pdf",
          buffer: PDF_VALIDE,
        },
        productId: (await edition()).produitId,
      },
    });
    expect(passe.status(), "organisateur sur /api/upload/lab-analysis").not.toBe(
      403
    );
    await organisateur.dispose();
  });

  test("@P0 un producteur ne peut pas écrire dans un dossier réservé à l'organisateur", async () => {
    const ctx = await contexteConnecte(PRODUCTEUR);

    const interdit = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-photo-${suffixe()}.png`,
        "image/png",
        PNG_VALIDE,
        "images"
      ),
    });
    expect(interdit.status(), "dossier « images » (organisateur)").toBe(403);

    const autorise = await posterAvecReprise(ctx, "/api/upload", {
      multipart: televersement(
        `e2e-photo-${suffixe()}.png`,
        "image/png",
        PNG_VALIDE,
        "producer-logos"
      ),
    });
    expect(
      autorise.status(),
      "contre-épreuve : dossier « producer-logos » (producteur)"
    ).toBe(200);

    await ctx.dispose();
  });
});

// ===========================================================================
// 4. Résultats, synthèse PDF, facture
// ===========================================================================

test.describe("Producteur · résultats et documents", () => {
  test.setTimeout(90_000);

  test("@P1 l'espace résultats tranche toujours entre « rien à afficher » et « chargement en échec »", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);
    const reponse = await page.goto("/producer/results");
    expect(reponse?.status()).toBe(200);

    // Le titre n'est rendu qu'une fois la requête retombée : sa présence dit
    // que la page n'est plus en [LOADING...].
    await expect(
      page.getByRole("heading", { name: /mes resultats/i })
    ).toBeVisible({ timeout: 30_000 });

    // Le compte e2e-producteur est partagé : il peut avoir des résultats ou
    // non selon ce que les autres campagnes ont publié. Ce qui doit tenir dans
    // les deux cas, c'est que la page NOMME son état — jamais une page muette,
    // jamais « vous n'avez rien » alors que la requête a échoué.
    const etatVide = page.getByText("AUCUN RESULTAT");
    const recapitulatif = page.getByText(/COMPETITIONS? · .* PRODUITS? · /);
    const etatErreur = page.getByText(/n'ont pas pu être chargés/i);

    await expect(etatErreur).toHaveCount(0);
    const declare =
      (await etatVide.count()) + (await recapitulatif.count());
    expect(
      declare,
      "l'espace résultats annonce soit l'état vide, soit le récapitulatif de ses compétitions"
    ).toBeGreaterThan(0);
  });

  test("@P1 la synthèse PDF est refusée tant que les résultats ne sont pas publiés, et l'inscription est bien reconnue comme la sienne", async () => {
    const ed = await edition();
    const ctx = await contexteConnecte(PRODUCTEUR);

    const sienne = await trpcMutate(ctx, "results.getMyPdf", {
      registrationId: ed.inscriptionId,
    });
    expect(sienne.code).toBe("PRECONDITION_FAILED");
    expect(sienne.message).toMatch(/resultats ne sont pas encore publies/i);

    // Contre-épreuve : une inscription qui n'est pas la sienne n'atteint même
    // pas cette règle métier — elle est introuvable pour lui.
    const etrangere = await trpcMutate(ctx, "results.getMyPdf", {
      registrationId: "e2e-inscription-inexistante",
    });
    expect(etrangere.code).toBe("NOT_FOUND");
    expect(etrangere.message).toMatch(/inscription non trouvee/i);

    await ctx.dispose();
  });

  test("@P0 la facture n'est délivrée qu'une fois l'inscription réglée, et jamais à un visiteur anonyme", async () => {
    const ed = await edition();
    const ctx = await contexteConnecte(PRODUCTEUR);

    const sienne = await ctx.get(`/api/invoices/${ed.inscriptionId}`);
    expect(sienne.status()).toBe(400);
    expect(await sienne.text()).toContain("La facture n'est pas disponible");

    const inconnue = await ctx.get("/api/invoices/e2e-inscription-inexistante");
    expect(inconnue.status()).toBe(404);
    await ctx.dispose();

    const anonyme = await apiRequest.newContext({ baseURL: BASE_URL });
    const refus = await anonyme.get(`/api/invoices/${ed.inscriptionId}`);
    expect(refus.status(), "facture demandée hors session").toBe(401);
    await anonyme.dispose();
  });
});

// ===========================================================================
// 5. Widget
// ===========================================================================

test.describe("Producteur · widget de distinctions", () => {
  test.setTimeout(90_000);

  test("@P0 le code d'intégration porte l'identifiant du producteur et la page du widget s'affiche hors session", async ({
    page,
    browser,
  }) => {
    await connexion(page, PRODUCTEUR);
    await page.goto("/producer/widget");

    const bloc = page.locator("pre code").first();
    await expect(bloc).toBeVisible({ timeout: 30_000 });
    const code = (await bloc.innerText()).trim();
    expect(code).toContain("<iframe");

    const trouve = /\/widget\/producer\/([A-Za-z0-9_-]+)/.exec(code);
    expect(trouve, "le code d'intégration cite l'URL du widget").not.toBeNull();
    const urlWidget = `/widget/producer/${trouve![1]}`;

    // Hors session : contexte navigateur neuf, aucun cookie hérité. Un widget
    // qui exigerait la session serait inutilisable sur le site d'un tiers.
    const contexteTiers = await browser.newContext();
    const pageTiers = await contexteTiers.newPage();
    const reponse = await pageTiers.goto(`${BASE_URL}${urlWidget}`);
    expect(reponse?.status(), "page publique du widget").toBe(200);
    await expect(pageTiers).toHaveURL(new RegExp(`${urlWidget}$`));
    await expect(
      pageTiers.getByText(/platinum cbd cup/i).first()
    ).toBeVisible();
    await expect(pageTiers.getByText(/producteur introuvable/i)).toHaveCount(0);
    await contexteTiers.close();
  });
});

// ===========================================================================
// 6. Suppression de compte (RGPD)
// ===========================================================================

test.describe("Producteur · suppression de compte (RGPD)", () => {
  test.setTimeout(90_000);

  test("@P0 un producteur peut demander la suppression de son compte depuis son espace", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);

    // Le droit à l'effacement (RGPD art. 17) doit s'exercer depuis l'espace de
    // l'intéressé. On cherche la commande sur les deux pages « compte » de
    // l'espace producteur. Assertion positive : la tournure existe bel et bien
    // dans l'application (cf. le test suivant, côté organisateur), ce n'est
    // donc pas un texte inventé qui ne pourrait pas être trouvé.
    const commandes = page.getByRole("button", {
      name: /supprimer mon compte/i,
    });

    // `count()` n'attend pas : la page profil rend un squelette tant que la
    // requête tRPC du profil n'a pas répondu, et compter tout de suite donnait
    // zéro même une fois le bloc RGPD monté. On attend donc la visibilité.
    await page.goto("/producer/profile");
    await expect(
      commandes.first(),
      "commande « Supprimer mon compte » dans l'espace producteur"
    ).toBeVisible({ timeout: 20000 });

    // L'export fait partie du même droit (RGPD art. 15 et 17) : sans lui, le
    // producteur ne peut pas récupérer ses données avant de les effacer.
    await expect(
      page.getByRole("button", { name: /exporter mes données/i })
    ).toBeVisible();
  });

  test("@P1 la commande de suppression de compte existe dans l'application, côté organisateur", async ({
    page,
  }) => {
    // Contre-épreuve du test précédent : la tournure cherchée est réelle et
    // rendue quelque part. Sans elle, l'assertion négative ne prouverait rien.
    await connexion(page, ORGANISATEUR);
    await page.goto("/dashboard/settings");
    await expect(
      page.getByRole("button", { name: /supprimer mon compte/i })
    ).toBeVisible();
  });

  test("@P1 un producteur n'atteint pas les réglages de compte de l'espace organisateur", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);
    await page.goto("/dashboard/settings");
    await expect(page).not.toHaveURL(/\/dashboard\/settings/);
    await expect(
      page.getByRole("button", { name: /supprimer mon compte/i })
    ).toHaveCount(0);
  });
});

// ===========================================================================
// 7. Isolation entre producteurs
// ===========================================================================

test.describe("Producteur · isolation", () => {
  test.setTimeout(240_000);

  let produitEtrangerMemoise: Promise<{
    id: string;
    nom: string;
    cupNom: string;
  }> | null = null;

  /** Une seule recherche par worker : le balayage coûte plusieurs requêtes. */
  function produitDUnAutreProducteur(monProducteurId: string) {
    produitEtrangerMemoise ??= chercherProduitDUnAutreProducteur(monProducteurId);
    return produitEtrangerMemoise;
  }

  /**
   * Désigne un produit qui n'appartient pas au producteur de test, en passant
   * par l'API organisateur (lecture seule). Aucune donnée n'est modifiée.
   */
  async function chercherProduitDUnAutreProducteur(
    monProducteurId: string
  ): Promise<{ id: string; nom: string; cupNom: string }> {
    const organisateur = await contexteConnecte(ORGANISATEUR);
    const editions = await trpcQuery<
      { id: string; resultsPublishedAt: string | null; name: string }[]
    >(organisateur, "cup.list", undefined);
    expect(editions.data, "liste des éditions côté organisateur").toBeTruthy();

    for (const ed of editions.data!) {
      if (!ed.resultsPublishedAt) continue;
      const contenu = await trpcQuery<{
        categories: {
          products: { id: string; name: string; producer: { id: string } }[];
        }[];
      }>(organisateur, "product.listByCupGroupedByCategory", { cupId: ed.id });
      for (const categorie of contenu.data?.categories ?? []) {
        for (const produit of categorie.products) {
          if (produit.producer?.id && produit.producer.id !== monProducteurId) {
            await organisateur.dispose();
            return { id: produit.id, nom: produit.name, cupNom: ed.name };
          }
        }
      }
    }
    await organisateur.dispose();
    throw new Error(
      "Aucun produit d'un autre producteur trouvé sur une édition publiée : le test d'isolation n'a rien à opposer."
    );
  }

  test("@P0 un producteur ne consulte ni les notes par critère ni les notes jurés d'un produit qui n'est pas le sien", async () => {
    const ed = await edition();
    const ctx = await contexteConnecte(PRODUCTEUR);

    const profil = await trpcQuery<{ id: string }>(
      ctx,
      "producer.getProfile",
      undefined
    );
    expect(profil.data?.id, "profil producteur de test").toBeTruthy();

    const autre = await produitDUnAutreProducteur(profil.data!.id);

    for (const procedure of [
      "producer.getMyProductCriteriaScores",
      "producer.getMyProductJuryScores",
    ]) {
      const refus = await trpcQuery(ctx, procedure, { productId: autre.id });
      expect(refus.code, `${procedure} sur le produit « ${autre.nom} »`).toBe(
        "FORBIDDEN"
      );
      expect(refus.message).toMatch(/ne vous appartient pas/i);
      expect(
        refus.data,
        `${procedure} ne doit rien renvoyer sur un produit étranger`
      ).toBeUndefined();
    }

    // Contre-épreuve : sur SON produit, le contrôle de propriété est franchi —
    // le refus suivant porte sur la publication des résultats, pas sur la
    // propriété. Un garde-fou qui refuserait tout le monde échouerait ici.
    for (const procedure of [
      "producer.getMyProductCriteriaScores",
      "producer.getMyProductJuryScores",
    ]) {
      const sien = await trpcQuery(ctx, procedure, { productId: ed.produitId });
      expect(sien.message, `${procedure} sur son propre produit`).toMatch(
        /résultats ne sont pas encore publiés/i
      );
      expect(sien.message).not.toMatch(/ne vous appartient pas/i);
    }

    await ctx.dispose();
  });

  test("@P0 l'espace inscriptions d'un producteur ne laisse paraître ni l'édition ni le spécimen d'un autre", async ({
    page,
  }) => {
    const ed = await edition();

    const ctx = await contexteConnecte(PRODUCTEUR);
    const profil = await trpcQuery<{ id: string }>(
      ctx,
      "producer.getProfile",
      undefined
    );
    await ctx.dispose();
    const autre = await produitDUnAutreProducteur(profil.data!.id);

    await connexion(page, PRODUCTEUR);
    await page.goto("/producer/registrations");

    // Assertion positive d'abord : la page rend bien SES inscriptions. Sans
    // elle, une page vide ou en erreur passerait les assertions négatives.
    await expect(carteEnAttente(page, ed.cupNom)).toBeVisible({
      timeout: 30_000,
    });

    // Les deux tournures cherchées ci-dessous ne sont pas inventées : elles
    // sortent de la base, par l'API organisateur, et sont rendues telles
    // quelles dans l'espace du producteur à qui elles appartiennent.
    await expect(
      page.getByText(autre.cupNom),
      `édition « ${autre.cupNom} », où ce producteur n'est pas inscrit`
    ).toHaveCount(0);
    await expect(
      page.getByText(autre.nom),
      `spécimen « ${autre.nom} », qui appartient à un autre producteur`
    ).toHaveCount(0);
  });
});
