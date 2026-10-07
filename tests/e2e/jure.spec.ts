import {
  test,
  expect as expectParDefaut,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from "@playwright/test";

import { loginUser } from "../support/fixtures/auth.fixture";

/**
 * Le serveur de développement compile chaque route à sa première visite et
 * les mutations tRPC de ce parcours écrivent plusieurs tables : les 5 s par
 * défaut expirent avant la réponse, sans que rien soit cassé.
 */
const expect = expectParDefaut.configure({ timeout: 30_000 });

/**
 * Parcours juré — activation, conflit d'intérêts, notation, résultats, profil.
 *
 * Chaque bloc fabrique SES éditions (préfixe `E2E-JURE-` + suffixe aléatoire)
 * via l'API tRPC avec les comptes de test, puis exerce le parcours juré dans
 * le navigateur. Aucune donnée préexistante n'est lue ni modifiée : la base
 * est partagée avec cinq autres campagnes, et deux exécutions successives de
 * ce fichier doivent rester vertes.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const MOT_DE_PASSE = "E2e-Platinum!2026";
const ORGANISATEUR = "e2e-organisateur@platinum-cbd-cup.test";
const JURE = "e2e-jure@platinum-cbd-cup.test";
const PRODUCTEUR = "e2e-producteur@platinum-cbd-cup.test";

/** Message du garde-fou `assertProducerMayJudge` (src/server/api/helpers/jury.ts). */
const REFUS_CONFLIT =
  /le jury public est réservé aux consommateurs/i;

function suffixe(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

/**
 * Connexion par l'interface, via le helper partagé.
 *
 * `loginUser` n'attend la redirection que 5 s (timeout par défaut de son
 * `expect`). Sur le serveur de développement, la première compilation de
 * l'espace d'arrivée dépasse régulièrement ce délai : on rejoue alors la même
 * attente, plus longue. Une connexion réellement refusée échoue quand même.
 */
async function connexion(page: Page, email: string): Promise<void> {
  try {
    await loginUser(page, email, MOT_DE_PASSE);
  } catch {
    await expect(page).toHaveURL(
      /\/(dashboard|producer\/dashboard|jury\/dashboard)/
    );
  }
}

// ───────────────────────── Accès tRPC (montage des données) ─────────────────

interface ReponseTrpc<T> {
  statut: number;
  donnees: T | null;
  message: string;
  code: string;
}

type CorpsTrpc = {
  result?: { data?: { json?: unknown } };
  error?: { json?: { message?: string; data?: { code?: string } } };
};

function lire<T>(statut: number, corps: CorpsTrpc | null): ReponseTrpc<T> {
  return {
    statut,
    donnees: (corps?.result?.data?.json ?? null) as T | null,
    message: corps?.error?.json?.message ?? "",
    code: corps?.error?.json?.data?.code ?? "",
  };
}

async function mutation<T>(
  ctx: APIRequestContext,
  chemin: string,
  entree: Record<string, unknown>,
  datesIso: string[] = []
): Promise<ReponseTrpc<T>> {
  const meta =
    datesIso.length > 0
      ? {
          values: Object.fromEntries(datesIso.map((cle) => [cle, ["Date"]])),
        }
      : undefined;

  const reponse = await ctx.post(`/api/trpc/${chemin}`, {
    data: meta ? { json: entree, meta } : { json: entree },
  });
  const corps = (await reponse.json().catch(() => null)) as CorpsTrpc | null;
  return lire<T>(reponse.status(), corps);
}

async function requete<T>(
  ctx: APIRequestContext,
  chemin: string,
  entree?: Record<string, unknown>
): Promise<ReponseTrpc<T>> {
  const suffixeUrl = entree
    ? `?input=${encodeURIComponent(JSON.stringify({ json: entree }))}`
    : "";
  const reponse = await ctx.get(`/api/trpc/${chemin}${suffixeUrl}`);
  const corps = (await reponse.json().catch(() => null)) as CorpsTrpc | null;
  return lire<T>(reponse.status(), corps);
}

/** Échoue bruyamment si une étape de montage n'a pas abouti. */
function exige<T>(reponse: ReponseTrpc<T>, etape: string): T {
  if (reponse.statut !== 200 || reponse.donnees === null) {
    throw new Error(
      `Montage impossible (${etape}) : HTTP ${reponse.statut} ${reponse.code} ${reponse.message}`
    );
  }
  return reponse.donnees;
}

async function ouvrirContexte(
  playwright: PlaywrightWorkerArgs["playwright"],
  email: string
): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { origin: BASE },
  });
  const reponse = await ctx.post("/api/auth/sign-in/email", {
    data: { email, password: MOT_DE_PASSE },
  });
  if (!reponse.ok()) {
    throw new Error(
      `Connexion API impossible pour ${email} : HTTP ${reponse.status()}`
    );
  }
  return ctx;
}

// ───────────────────────── Fabriques de données ─────────────────────────────

interface Edition {
  cupId: string;
  categoryId: string;
  nom: string;
  categorieNom: string;
}

/**
 * Crée une édition publiée, dotée d'une catégorie et de ses critères, avec une
 * fenêtre d'inscription ouverte et une notation qui démarre dans deux heures.
 */
async function creerEdition(
  org: APIRequestContext,
  etiquette: string
): Promise<Edition> {
  const nom = `E2E-JURE-${etiquette}`;
  const categorieNom = `E2E-CAT-${etiquette}`;

  const cup = exige(
    await mutation<{ id: string }>(org, "cup.create", {
      name: nom,
      ratingScale: "0-20",
    }),
    "cup.create"
  );

  const categorie = exige(
    await mutation<{ id: string }>(org, "category.create", {
      cupId: cup.id,
      name: categorieNom,
    }),
    "category.create"
  );

  exige(
    await mutation(org, "criteria.initializeDefaultCriteria", {
      categoryId: categorie.id,
    }),
    "criteria.initializeDefaultCriteria"
  );

  const maintenant = Date.now();
  exige(
    await mutation(
      org,
      "cup.updatePhaseDates",
      {
        cupId: cup.id,
        registrationOpenAt: new Date(maintenant - 86_400_000).toISOString(),
        registrationCloseAt: new Date(maintenant + 3_600_000).toISOString(),
        ratingStartAt: new Date(maintenant + 7_200_000).toISOString(),
        ratingEndAt: new Date(maintenant + 30 * 86_400_000).toISOString(),
      },
      [
        "registrationOpenAt",
        "registrationCloseAt",
        "ratingStartAt",
        "ratingEndAt",
      ]
    ),
    "cup.updatePhaseDates"
  );

  exige(await mutation(org, "cup.publish", { cupId: cup.id }), "cup.publish");

  return { cupId: cup.id, categoryId: categorie.id, nom, categorieNom };
}

interface ProduitInscrit {
  productId: string;
  /** Code du jury public : celui des jurés entrés par code ou jeton QR. */
  code: string;
  /** Code du jury pro : celui des jurés invités nominativement. */
  codePro: string;
}

/**
 * Inscrit le producteur de test à l'édition et y dépose des produits.
 * L'inscription est gratuite : le règlement en ligne est désactivé, la
 * confirmation gratuite est le seul chemin qui anonymise les produits.
 */
async function inscrireProducteur(
  prod: APIRequestContext,
  edition: Edition,
  nomsProduits: string[]
): Promise<ProduitInscrit[]> {
  const inscription = exige(
    await mutation<{ id: string }>(prod, "registration.getOrCreate", {
      cupId: edition.cupId,
    }),
    "registration.getOrCreate"
  );

  for (const nom of nomsProduits) {
    exige(
      await mutation(prod, "registration.addProduct", {
        registrationId: inscription.id,
        categoryId: edition.categoryId,
        name: nom,
      }),
      "registration.addProduct"
    );
  }

  const confirmation = exige(
    await mutation<{
      anonymizedProducts: Array<{
        productId: string;
        codes: { pro: string; public: string };
      }>;
    }>(prod, "registration.confirmFreeRegistration", {
      registrationId: inscription.id,
    }),
    "registration.confirmFreeRegistration"
  );

  return confirmation.anonymizedProducts.map((p) => ({
    productId: p.productId,
    code: p.codes.public,
    codePro: p.codes.pro,
  }));
}

async function ouvrirLaNotation(org: APIRequestContext, cupId: string) {
  exige(
    await mutation(org, "cup.closeRegistrations", { cupId }),
    "cup.closeRegistrations"
  );
  exige(await mutation(org, "cup.startRating", { cupId }), "cup.startRating");
}

async function genererCode(
  org: APIRequestContext,
  edition: Edition
): Promise<string> {
  const lot = exige(
    await mutation<{ codes: string[] }>(org, "juryCodes.generate", {
      cupId: edition.cupId,
      categoryIds: [edition.categoryId],
      count: 1,
    }),
    "juryCodes.generate"
  );
  return lot.codes[0]!;
}

async function genererJeton(
  org: APIRequestContext,
  edition: Edition
): Promise<string> {
  const lot = exige(
    await mutation<{ tokens: Array<{ token: string }> }>(
      org,
      "jury.generatePublicJuryTokens",
      {
        cupId: edition.cupId,
        categoryId: edition.categoryId,
        quantity: 1,
      }
    ),
    "jury.generatePublicJuryTokens"
  );
  return lot.tokens[0]!.token;
}

interface InvitationEnvoyee {
  token: string;
  sentAt: string | null;
}

async function inviterNominativement(
  org: APIRequestContext,
  cupId: string,
  email: string
): Promise<InvitationEnvoyee> {
  exige(
    await mutation(org, "jury.invite", {
      cupId,
      email,
      firstName: "E2E",
      lastName: "Invite",
    }),
    "jury.invite"
  );

  const invitations = exige(
    await requete<Array<{ email: string; token: string; sentAt: string | null }>>(
      org,
      "jury.listInvitations",
      { cupId, status: "all" }
    ),
    "jury.listInvitations"
  );

  const invitation = invitations.find(
    (i) => i.email.toLowerCase() === email.toLowerCase()
  );
  if (!invitation) throw new Error("Invitation introuvable après envoi");
  return { token: invitation.token, sentAt: invitation.sentAt };
}

/** Le compte est-il juré de cette édition ? Réponse lue côté serveur. */
async function estJure(
  ctx: APIRequestContext,
  cupId: string
): Promise<boolean> {
  const reponse = await requete(ctx, "jury.getMyJuryCup", { cupId });
  return reponse.statut === 200;
}

/**
 * Tout le fichier sur un seul worker, dans l'ordre.
 *
 * `fullyParallel` lancerait ces neuf parcours de notation en même temps sur le
 * même serveur de développement, déjà partagé par cinq autres campagnes : une
 * écriture de note y dépasse alors les deux minutes et le test échoue sur la
 * lenteur, pas sur l'application.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, infos) => {
  // Serveur de développement partagé par six campagnes simultanées : la
  // première visite d'une route la compile, et une même requête peut passer
  // de quelques centaines de millisecondes à plusieurs dizaines de secondes
  // selon la charge. Les 30 s par défaut ne mesurent alors plus rien d'utile.
  infos.setTimeout(300_000);
});

// ═══════════════════════ 1. Activation du compte juré ═══════════════════════

test.describe("Activation du compte juré @P0", () => {
  test.describe.configure({ mode: "serial" });

  let org: APIRequestContext;
  let editionCode: Edition;
  let editionJeton: Edition;
  let code: string;
  let jeton: string;

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(600_000);
    org = await ouvrirContexte(playwright, ORGANISATEUR);
    const sfx = suffixe();
    editionCode = await creerEdition(org, `ACT-CODE-${sfx}`);
    editionJeton = await creerEdition(org, `ACT-QR-${sfx}`);
    code = await genererCode(org, editionCode);
    jeton = await genererJeton(org, editionJeton);
  });

  test.afterAll(async () => {
    await org?.dispose();
  });

  test("un code d'invitation donne accès à l'édition et ne peut plus servir ensuite", async ({
    page,
  }) => {
    await connexion(page, JURE);

    await page.goto(`/activate?code=${code}`);
    await expect(page.getByText(editionCode.nom).first()).toBeVisible();

    await page
      .getByRole("button", { name: /Activer ce code et devenir jury/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/jury/cups/${editionCode.cupId}$`)
    );
    // Conséquence en base : le juré est rattaché à l'édition et à sa catégorie.
    await expect(
      page.getByRole("heading", { name: /Confirmation de réception/i })
    ).toBeVisible();
    await expect(page.getByText(editionCode.categorieNom)).toBeVisible();

    // Le code est consommé : la page d'activation le refuse désormais.
    await page.goto(`/activate?code=${code}`);
    await expect(page.getByText(/Code déjà utilisé/i)).toBeVisible();
  });

  test("un jeton public (QR) donne accès à l'édition", async ({ page }) => {
    await connexion(page, JURE);

    await page.goto(`/jury/public/${jeton}`);
    await expect(page.getByText(editionJeton.nom).first()).toBeVisible();

    await page
      .getByRole("button", { name: /Utiliser ce token et devenir jury/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/jury/cups/${editionJeton.cupId}$`)
    );
    // Un jeton public vaut réception des échantillons : pas d'écran de
    // confirmation, le juré arrive directement sur ses catégories.
    await expect(page.getByText("ÉCHANTILLONS REÇUS")).toBeVisible();
    await expect(page.getByText(editionJeton.categorieNom)).toBeVisible();
  });
});

// ═══════════════════════ 2. Conflit d'intérêts ══════════════════════════════

test.describe("Conflit d'intérêts producteur / juré @P0", () => {
  test.describe.configure({ mode: "serial" });

  // Une édition réunit un jury pro et un jury public. La porte d'entrée fixe
  // le panel : invitation nominative -> pro, code ou jeton QR -> public. Seul
  // le jury public est fermé au producteur qui concourt.

  let org: APIRequestContext;
  let prod: APIRequestContext;

  /** Édition où le producteur concourt. */
  let avecConcurrent: Edition;
  let codePublic: string;
  let jetonPublic: string;
  let invitationPro: InvitationEnvoyee;

  /** Édition où le producteur ne concourt pas : le jury public lui est ouvert. */
  let sansInscription: Edition;
  let codeSansInscription: string;

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(600_000);
    org = await ouvrirContexte(playwright, ORGANISATEUR);
    prod = await ouvrirContexte(playwright, PRODUCTEUR);
    const sfx = suffixe();

    avecConcurrent = await creerEdition(org, `CONF-${sfx}`);
    await inscrireProducteur(prod, avecConcurrent, [`E2E-PRODUIT-CONF-${sfx}`]);
    codePublic = await genererCode(org, avecConcurrent);
    jetonPublic = await genererJeton(org, avecConcurrent);
    invitationPro = await inviterNominativement(org, avecConcurrent.cupId, PRODUCTEUR);

    sansInscription = await creerEdition(org, `CONF-LIBRE-${sfx}`);
    codeSansInscription = await genererCode(org, sansInscription);
  });

  test.afterAll(async () => {
    await org?.dispose();
    await prod?.dispose();
  });

  test("jury public : le code d'invitation est refusé au producteur qui concourt", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);

    await page.goto(`/activate?code=${codePublic}`);
    await page
      .getByRole("button", { name: /Activer ce code et devenir jury/i })
      .click();

    await expect(page.getByText(REFUS_CONFLIT)).toBeVisible();
    await expect(page).toHaveURL(/\/activate/);
    expect(await estJure(prod, avecConcurrent.cupId)).toBe(false);
  });

  test("jury public : le jeton public (QR) est refusé au producteur qui concourt", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);

    await page.goto(`/jury/public/${jetonPublic}`);
    await page
      .getByRole("button", { name: /Utiliser ce token et devenir jury/i })
      .click();

    await expect(page.getByText(REFUS_CONFLIT)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/jury/public/${jetonPublic}`));
    expect(await estJure(prod, avecConcurrent.cupId)).toBe(false);
  });

  test("jury pro : l'invitation nominative est acceptée du producteur qui concourt", async ({
    page,
  }) => {
    // L'envoi n'aboutit pas en développement : on vérifie qu'il a été tenté.
    expect(invitationPro.sentAt).not.toBeNull();

    await connexion(page, PRODUCTEUR);

    await page.goto(`/jury-invite/${invitationPro.token}`);
    await page.getByRole("button", { name: /Accepter l'invitation/i }).click();

    await expect(page).toHaveURL(/\/jury\/dashboard/);
    expect(await estJure(prod, avecConcurrent.cupId)).toBe(true);
  });

  test("jury public : un compte producteur qui ne concourt pas devient juré par code", async ({
    page,
  }) => {
    await connexion(page, PRODUCTEUR);

    await page.goto(`/activate?code=${codeSansInscription}`);
    await page
      .getByRole("button", { name: /Activer ce code et devenir jury/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/jury/cups/${sansInscription.cupId}$`)
    );
    expect(await estJure(prod, sansInscription.cupId)).toBe(true);
  });
});

// ═══════════════════════ 3. Notation ════════════════════════════════════════

test.describe("Notation d'une édition @P0", () => {
  test.describe.configure({ mode: "serial" });

  let org: APIRequestContext;
  let prod: APIRequestContext;
  let jure: APIRequestContext;

  let edition: Edition;
  let produits: ProduitInscrit[];
  const NOTE_JURE = 12;
  const NOTE_ORGANISATEUR = 4;
  let commentaireJure: string;
  let commentaireOrganisateur: string;

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(600_000);
    org = await ouvrirContexte(playwright, ORGANISATEUR);
    prod = await ouvrirContexte(playwright, PRODUCTEUR);
    jure = await ouvrirContexte(playwright, JURE);

    const sfx = suffixe();
    commentaireJure = `E2E-NOTE-JURE-${sfx}`;
    commentaireOrganisateur = `E2E-NOTE-ORGA-${sfx}`;

    edition = await creerEdition(org, `NOTE-${sfx}`);
    produits = await inscrireProducteur(prod, edition, [
      `E2E-PRODUIT-A-${sfx}`,
      `E2E-PRODUIT-B-${sfx}`,
      `E2E-PRODUIT-C-${sfx}`,
      `E2E-PRODUIT-D-${sfx}`,
    ]);

    // Le juré rejoint l'édition par un code (parcours couvert par ailleurs).
    const code = await genererCode(org, edition);
    exige(await mutation(jure, "juryCodes.activate", { code }), "activation juré");

    // Second juré, pour l'épreuve d'isolation : l'organisateur, invité
    // nominativement puis assigné à la catégorie.
    const invitation = await inviterNominativement(
      org,
      edition.cupId,
      ORGANISATEUR
    );
    exige(
      await mutation(org, "jury.acceptInvitation", { token: invitation.token }),
      "acceptInvitation organisateur"
    );
    const jures = exige(
      await requete<Array<{ id: string; user: { email: string } }>>(
        org,
        "jury.listJuries",
        { cupId: edition.cupId }
      ),
      "jury.listJuries"
    );
    const juryOrganisateur = jures.find(
      (j) => j.user.email.toLowerCase() === ORGANISATEUR
    );
    if (!juryOrganisateur) throw new Error("Organisateur absent du jury");
    exige(
      await mutation(org, "jury.assignCategories", {
        cupJuryId: juryOrganisateur.id,
        categoryIds: [edition.categoryId],
      }),
      "jury.assignCategories"
    );

    await ouvrirLaNotation(org, edition.cupId);

    exige(
      await mutation(org, "jury.confirmSamplesReceived", {
        cupId: edition.cupId,
      }),
      "confirmSamplesReceived organisateur"
    );
  });

  test.afterAll(async () => {
    await org?.dispose();
    await prod?.dispose();
    await jure?.dispose();
  });

  /** Sélectionne la même note pour chacun des critères affichés. */
  async function noterTousLesCriteres(page: Page, note: number) {
    const groupes = page.getByRole("group");
    // `count()` n'attend rien : sans cette attente, la grille de notation pas
    // encore rendue se lit comme « aucun critère ».
    await expect(groupes.first()).toBeVisible();
    const nombre = await groupes.count();
    expect(nombre).toBeGreaterThan(0);
    for (let i = 0; i < nombre; i++) {
      await groupes
        .nth(i)
        .getByRole("button", { name: new RegExp(`: ${note} sur 20$`) })
        .click();
    }
  }

  /**
   * Chaque note modifiée programme un enregistrement automatique 300 ms plus
   * tard. On le laisse partir et revenir avant de valider : sans cette attente,
   * les deux requêtes se croisent (voir le test dédié plus bas).
   */
  async function attendreFinAutoSave(page: Page) {
    await page.waitForTimeout(1_500);
    await expect(page.getByText("[SAVING...]")).toHaveCount(0);
  }

  /**
   * Modale de fin de notation (brouillon ou validation). L'écriture d'une note
   * traverse plusieurs tables ; sur le serveur partagé, la réponse dépasse
   * régulièrement la demi-minute.
   */
  async function attendreModaleDeFin(page: Page) {
    await expect(
      page.getByRole("button", { name: /RETOUR À LA CATÉGORIE/i })
    ).toBeVisible({ timeout: 150_000 });
  }

  test("le juré confirme la réception de ses échantillons et voit les produits à noter", async ({
    page,
  }) => {
    await connexion(page, JURE);
    await page.goto(`/jury/cups/${edition.cupId}`);

    await expect(
      page.getByRole("heading", { name: /Confirmation de réception/i })
    ).toBeVisible();
    await expect(page.getByText("4 PRODUITS À NOTER")).toBeVisible();

    await page
      .getByRole("button", { name: /Je confirme avoir reçu mes échantillons/i })
      .click();

    await expect(page.getByText("ÉCHANTILLONS REÇUS")).toBeVisible();
    await expect(page.getByText(edition.categorieNom)).toBeVisible();

    await page.goto(`/jury/cups/${edition.cupId}/category/${edition.categoryId}`);
    for (const produit of produits) {
      await expect(page.getByText(produit.code, { exact: true })).toBeVisible();
    }
  });

  test("une note enregistrée en brouillon est retrouvée à la reprise", async ({
    page,
  }) => {
    const produit = produits[0]!;
    await connexion(page, JURE);

    await page.goto(`/jury/cups/${edition.cupId}/category/${edition.categoryId}`);
    await page.getByText(produit.code, { exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/jury/rate/${edition.cupId}/product/${produit.productId}$`)
    );

    // Un seul critère noté : le brouillon doit être partiel et repris tel quel.
    const premierCritere = page.getByRole("group").first();
    await premierCritere
      .getByRole("button", { name: new RegExp(`: ${NOTE_JURE} sur 20$`) })
      .click();

    await page
      .getByRole("button", { name: /SAUVEGARDER LE BROUILLON/i })
      .click();
    await attendreModaleDeFin(page);

    await page.goto(`/jury/cups/${edition.cupId}/category/${edition.categoryId}`);
    await expect(page.getByText("BROUILLON")).toBeVisible();

    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);
    await expect(
      page
        .getByRole("group")
        .first()
        .getByRole("button", { name: new RegExp(`: ${NOTE_JURE} sur 20$`) })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("une notation soumise est verrouillée et ne peut plus être renvoyée", async ({
    page,
  }) => {
    const produit = produits[0]!;
    await connexion(page, JURE);
    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);

    await noterTousLesCriteres(page, NOTE_JURE);
    await attendreFinAutoSave(page);
    await page.getByRole("button", { name: /^VALIDER LA NOTATION$/i }).click();
    await attendreModaleDeFin(page);

    await page.goto(`/jury/cups/${edition.cupId}/category/${edition.categoryId}`);
    await expect(page.getByText("NOTE SOUMISE")).toBeVisible();

    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);
    await expect(
      page.getByText(/\[SUBMITTED\] — Les modifications ne sont plus possibles/i)
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^VALIDER LA NOTATION$/i })
    ).toHaveCount(0);

    // Contre-épreuve serveur : le renvoi direct est refusé, pas seulement masqué.
    const criteres = exige(
      await requete<{ criteria: Array<{ id: string }> }>(
        jure,
        "jury.getProductForRating",
        { cupId: edition.cupId, productId: produit.productId }
      ),
      "getProductForRating"
    );
    const renvoi = await mutation(jure, "jury.submitRating", {
      cupId: edition.cupId,
      productId: produit.productId,
      scores: criteres.criteria.map((c) => ({ criterionId: c.id, score: 20 })),
      submit: true,
    });
    expect(renvoi.statut).toBe(409);
    expect(renvoi.message).toMatch(/deja soumis une notation/i);
  });

  test("un juré ne voit que sa propre note sur un produit noté par deux jurés", async ({
    page,
  }) => {
    const produit = produits[1]!;

    // L'autre juré (l'organisateur, invité sur cette édition) note le produit.
    const criteres = exige(
      await requete<{ criteria: Array<{ id: string }> }>(
        org,
        "jury.getProductForRating",
        { cupId: edition.cupId, productId: produit.productId }
      ),
      "getProductForRating organisateur"
    );
    exige(
      await mutation(org, "jury.submitRating", {
        cupId: edition.cupId,
        productId: produit.productId,
        scores: criteres.criteria.map((c) => ({
          criterionId: c.id,
          score: NOTE_ORGANISATEUR,
        })),
        comment: commentaireOrganisateur,
        submit: true,
      }),
      "submitRating organisateur"
    );

    await connexion(page, JURE);
    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);

    await noterTousLesCriteres(page, NOTE_JURE);
    await page.locator("#rating-comment").fill(commentaireJure);
    await attendreFinAutoSave(page);
    await page.getByRole("button", { name: /^VALIDER LA NOTATION$/i }).click();
    await attendreModaleDeFin(page);

    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);

    // Sa note à lui, pas celle de l'autre juré.
    const premierCritere = page.getByRole("group").first();
    await expect(
      premierCritere.getByRole("button", {
        name: new RegExp(`: ${NOTE_JURE} sur 20$`),
      })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      premierCritere.getByRole("button", {
        name: new RegExp(`: ${NOTE_ORGANISATEUR} sur 20$`),
      })
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#rating-comment")).toHaveValue(commentaireJure);
    await expect(page.getByText(commentaireOrganisateur)).toHaveCount(0);

    // Contre-épreuve : ce commentaire existe bien, l'autre juré le retrouve.
    const noteOrganisateur = exige(
      await requete<{ comment: string | null }>(org, "jury.getMyRating", {
        cupId: edition.cupId,
        productId: produit.productId,
      }),
      "getMyRating organisateur"
    );
    expect(noteOrganisateur.comment).toBe(commentaireOrganisateur);

    const noteJure = exige(
      await requete<{ comment: string | null }>(jure, "jury.getMyRating", {
        cupId: edition.cupId,
        productId: produit.productId,
      }),
      "getMyRating juré"
    );
    expect(noteJure.comment).toBe(commentaireJure);
  });

  test("les notations soumises apparaissent dans les notations passées du juré", async ({
    page,
  }) => {
    await connexion(page, JURE);
    await page.goto("/jury/ratings");

    const carteEdition = page
      .locator(".n-card")
      .filter({ hasText: edition.nom });
    await expect(carteEdition).toBeVisible();
    await expect(carteEdition.getByText("2 NOTES")).toBeVisible();
    await expect(carteEdition.getByText(edition.categorieNom)).toBeVisible();
  });

  test("une validation lente n'est pas défaite par l'enregistrement automatique parti avant elle", async ({
    page,
  }) => {
    const produit = produits[2]!;
    await connexion(page, JURE);

    // La page programme un enregistrement automatique 300 ms après la dernière
    // note. On retarde ici la seule requête de VALIDATION : l'enregistrement
    // automatique atteint donc le serveur en premier, la validation ensuite.
    // C'est l'ordre favorable — le test dédié qui suit couvre l'autre.
    let validationRetardee = false;
    await page.route("**/api/trpc/jury.submitRating*", async (route) => {
      const corps = route.request().postDataJSON() as {
        json?: { submit?: boolean };
      } | null;
      if (corps?.json?.submit === true && !validationRetardee) {
        validationRetardee = true;
        await new Promise((resoudre) => setTimeout(resoudre, 3_000));
      }
      await route.continue();
    });

    await page.goto(`/jury/rate/${edition.cupId}/product/${produit.productId}`);
    await noterTousLesCriteres(page, NOTE_JURE);
    await page.getByRole("button", { name: /^VALIDER LA NOTATION$/i }).click();

    // La page annonce au juré que sa notation est enregistrée.
    await attendreModaleDeFin(page);
    await expect(page.getByText("[SUBMITTED]").first()).toBeVisible();

    // Ce que dit le serveur une fois les deux requêtes retombées.
    await page.waitForTimeout(2_000);
    const note = exige(
      await requete<{ submittedAt: string | null }>(jure, "jury.getMyRating", {
        cupId: edition.cupId,
        productId: produit.productId,
      }),
      "getMyRating après validation"
    );
    expect(note.submittedAt).not.toBeNull();
  });

  test("après verrouillage par l'organisateur, plus aucune note ne peut être enregistrée", async ({
    page,
  }) => {
    const produitNonNote = produits[2]!;

    exige(
      await mutation(org, "jury.lockRatings", {
        cupId: edition.cupId,
        confirm: true,
      }),
      "jury.lockRatings"
    );

    await connexion(page, JURE);
    await page.goto(
      `/jury/rate/${edition.cupId}/product/${produitNonNote.productId}`
    );
    await expect(page.getByText(/Les notations sont verrouillees/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^VALIDER LA NOTATION$/i })
    ).toHaveCount(0);

    const tentative = await mutation(jure, "jury.submitRating", {
      cupId: edition.cupId,
      productId: produitNonNote.productId,
      scores: [{ criterionId: "peu-importe", score: 10 }],
      submit: false,
    });
    expect(tentative.statut).toBe(412);
  });

  test("les résultats publiés sont consultables par le juré", async ({
    page,
  }) => {
    exige(
      await mutation(org, "cup.publishResults", {
        cupId: edition.cupId,
        visibility: "all",
      }),
      "cup.publishResults"
    );

    await connexion(page, JURE);
    await page.goto("/jury/results");
    await expect(page.getByText(edition.nom).first()).toBeVisible();

    await page.goto(`/jury/results/${edition.cupId}`);
    await expect(page.getByText(edition.nom).first()).toBeVisible();
    await expect(page.getByText(produits[0]!.code).first()).toBeVisible();
  });
});

// ═══════════════════════ 4. Profil du juré ══════════════════════════════════

test.describe("Profil du juré @P1", () => {
  /**
   * Les bascules n'ont pas de nom accessible : leur libellé est un `span`
   * voisin. On les vise donc par ce libellé plutôt que par un index.
   */
  const SELECTEUR_BASCULE_PALMARES =
    'span:text-is("APPARAITRE SUR RESULTATS PUBLICS") + button[role="switch"]';

  test("le juré modifie son nom affiché et bascule son affichage au palmarès public", async ({
    page,
  }) => {
    const alias = `E2E-ALIAS-${suffixe()}`;

    await connexion(page, JURE);
    await page.goto("/jury/profile/edit");

    const champAlias = page.locator("#edit-displayname");
    await expect(champAlias).toBeVisible();
    const aliasInitial = await champAlias.inputValue();

    const bascule = page.locator(SELECTEUR_BASCULE_PALMARES);
    await expect(bascule).toBeVisible();
    const etatInitial = await bascule.getAttribute("aria-checked");
    const etatAttendu = etatInitial === "true" ? "false" : "true";

    await champAlias.fill(alias);
    await bascule.click();
    await page.getByRole("button", { name: /ENREGISTRER TOUT/i }).click();
    await expect(page.getByText("[SAUVEGARDE]")).toBeVisible();

    // Conséquence persistée : rechargement complet de la page d'édition.
    await page.goto("/jury/profile/edit");
    await expect(page.locator("#edit-displayname")).toHaveValue(alias);
    await expect(page.locator(SELECTEUR_BASCULE_PALMARES)).toHaveAttribute(
      "aria-checked",
      etatAttendu
    );

    // Le compte est partagé avec les autres campagnes : on le rend tel quel.
    await page.locator("#edit-displayname").fill(aliasInitial);
    await page.locator(SELECTEUR_BASCULE_PALMARES).click();
    await page.getByRole("button", { name: /ENREGISTRER TOUT/i }).click();
    await expect(page.getByText("[SAUVEGARDE]")).toBeVisible();
    await page.goto("/jury/profile/edit");
    await expect(page.locator(SELECTEUR_BASCULE_PALMARES)).toHaveAttribute(
      "aria-checked",
      etatInitial ?? "false"
    );
  });
});

// ═══════ 5. Écriture concurrente d'une notation (validation + auto-save) ════

/**
 * La page de notation envoie DEUX requêtes `jury.submitRating` pour la même
 * note : l'enregistrement automatique (`submit: false`), programmé 300 ms après
 * la dernière note cliquée, et la validation (`submit: true`) déclenchée par le
 * bouton. Un juré qui valide dans la foulée de sa dernière note les fait partir
 * ensemble. Le bloc ci-dessous reproduit ce départ simultané depuis la page
 * elle-même — donc sur deux connexions du navigateur, comme en vrai.
 */
test.describe("Écriture concurrente d'une notation @P0", () => {
  test.describe.configure({ mode: "serial" });

  let org: APIRequestContext;
  let prod: APIRequestContext;
  let jure: APIRequestContext;
  let edition: Edition;
  let produits: ProduitInscrit[];

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(600_000);
    org = await ouvrirContexte(playwright, ORGANISATEUR);
    prod = await ouvrirContexte(playwright, PRODUCTEUR);
    jure = await ouvrirContexte(playwright, JURE);

    const sfx = suffixe();
    edition = await creerEdition(org, `CONC-${sfx}`);
    produits = await inscrireProducteur(prod, edition, [
      `E2E-PRODUIT-CONC-1-${sfx}`,
      `E2E-PRODUIT-CONC-2-${sfx}`,
      `E2E-PRODUIT-CONC-3-${sfx}`,
    ]);

    const code = await genererCode(org, edition);
    exige(await mutation(jure, "juryCodes.activate", { code }), "activation juré");
    await ouvrirLaNotation(org, edition.cupId);
    exige(
      await mutation(jure, "jury.confirmSamplesReceived", {
        cupId: edition.cupId,
      }),
      "confirmSamplesReceived juré"
    );
  });

  test.afterAll(async () => {
    await org?.dispose();
    await prod?.dispose();
    await jure?.dispose();
  });

  test("valider une notation au moment où l'enregistrement automatique part n'échoue pas et laisse la note soumise", async ({
    page,
  }) => {
    await connexion(page, JURE);

    for (const produit of produits) {
      const criteres = exige(
        await requete<{ criteria: Array<{ id: string }> }>(
          jure,
          "jury.getProductForRating",
          { cupId: edition.cupId, productId: produit.productId }
        ),
        "getProductForRating"
      );
      const notes = criteres.criteria.map((c) => ({
        criterionId: c.id,
        score: 12,
      }));

      // Les deux requêtes partent de la page, dans le même tick.
      const reponses = await page.evaluate(
        async ({ cupId, productId, notes }) => {
          const envoyer = async (submit: boolean) => {
            const reponse = await fetch("/api/trpc/jury.submitRating", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                json: { cupId, productId, scores: notes, submit },
              }),
            });
            return { statut: reponse.status, corps: await reponse.text() };
          };
          return Promise.all([envoyer(true), envoyer(false)]);
        },
        {
          cupId: edition.cupId,
          productId: produit.productId,
          notes,
        }
      );

      const [validation, enregistrementAuto] = reponses;
      const detail = `validation ${validation!.statut} ${validation!.corps.slice(0, 200)} / auto ${enregistrementAuto!.statut} ${enregistrementAuto!.corps.slice(0, 200)}`;

      // Un refus métier (409) serait une réponse acceptable ; une panne interne
      // non — le juré reçoit alors le texte d'une contrainte SQL.
      expect([validation!.statut, enregistrementAuto!.statut], detail).not.toContain(
        500
      );

      // Et surtout : la notation validée doit rester soumise.
      const note = exige(
        await requete<{ submittedAt: string | null }>(jure, "jury.getMyRating", {
          cupId: edition.cupId,
          productId: produit.productId,
        }),
        "getMyRating après validation concurrente"
      );
      expect(note.submittedAt, detail).not.toBeNull();
    }
  });
});
