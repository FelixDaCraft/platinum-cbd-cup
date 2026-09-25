import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { submitLoginForm } from "../support/fixtures/auth.fixture";

/**
 * Non-régressions ciblées — Platinum CBD Cup.
 *
 * Un test par défaut corrigé cette semaine. Chaque titre cite le symptôme
 * qu'on refuse de revoir, jamais le nom du correctif.
 *
 * Toutes les données créées ici portent le préfixe `E2E-` et un suffixe
 * aléatoire, et sont supprimées à la fin du test qui les a créées : la base
 * `platinum_local` est partagée avec cinq autres campagnes.
 */

// ---------------------------------------------------------------------------
// Comptes de test (les seuls autorisés sur cette base)
// ---------------------------------------------------------------------------

const MOT_DE_PASSE = "E2e-Platinum!2026";
const ORGANISATEUR = "e2e-organisateur@platinum-cbd-cup.test";
const PRODUCTEUR = "e2e-producteur@platinum-cbd-cup.test";

const suffixe = () => Math.random().toString(36).slice(2, 10);

/**
 * `next dev` compile chaque route au premier appel, et six campagnes
 * partagent ce serveur : les 30 s par défaut sont régulièrement dépassées
 * pour des raisons qui n'ont rien à voir avec ce qu'on teste.
 */
test.describe.configure({ timeout: 120_000 });

/**
 * Connexion par le formulaire réel, sans plafond de 5 s.
 *
 * `loginUser` (fixture partagée) fait la même chose mais conclut par un
 * `expect(page).toHaveURL(...)` soumis au délai d'assertion par défaut : le
 * premier rendu de /dashboard par le serveur de développement le dépasse une
 * fois sur deux. On réutilise donc `submitLoginForm` de la même fixture et on
 * attend explicitement.
 */
async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await submitLoginForm(page, email, MOT_DE_PASSE);
  await page.waitForURL(/\/(dashboard|producer\/dashboard|jury\/dashboard)/, {
    timeout: 90_000,
  });
}

// ---------------------------------------------------------------------------
// Lecture seule de la base — uniquement pour VÉRIFIER un effet
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

function urlBase(): string {
  const contenu = readFileSync(
    path.resolve(process.cwd(), ".env.local"),
    "utf8"
  );
  const trouve = /^DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m.exec(contenu);
  if (!trouve) throw new Error("DATABASE_URL absent de .env.local");
  const url = trouve[1]!;
  // Garde-fou : la production s'appelle `platinum_cbd_cup`. Aucune requête,
  // même en lecture, ne doit partir ailleurs que sur la copie locale.
  if (!/\/platinum_local(\?|$)/.test(url)) {
    throw new Error(
      `Base inattendue dans DATABASE_URL — ces tests n'interrogent que platinum_local`
    );
  }
  return url;
}

/** SELECT sur la copie locale. Aucune écriture ne passe par ici. */
async function lireEnBase<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error("Seuls les SELECT sont autorisés depuis les tests");
  }
  pool ??= new Pool({ connectionString: urlBase(), max: 2 });
  const resultat = await pool.query(sql, params as never[]);
  return resultat.rows as T[];
}

test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

// ---------------------------------------------------------------------------
// Appels tRPC (mêmes cookies que la page qui les émet)
// ---------------------------------------------------------------------------

async function trpcMutation<T>(
  request: APIRequestContext,
  chemin: string,
  input: unknown
): Promise<T> {
  const reponse = await request.post(`/api/trpc/${chemin}`, {
    data: { json: input },
    headers: { "content-type": "application/json" },
  });
  const corps = (await reponse.json()) as {
    result?: { data?: { json?: T } };
    error?: { json?: { message?: string } };
  };
  if (corps.error) {
    throw new Error(
      `${chemin} a échoué (${reponse.status()}) : ${corps.error.json?.message ?? "sans message"}`
    );
  }
  return corps.result!.data!.json as T;
}

async function trpcQuery<T>(
  request: APIRequestContext,
  chemin: string
): Promise<T> {
  const reponse = await request.get(`/api/trpc/${chemin}`);
  const corps = (await reponse.json()) as {
    result?: { data?: { json?: T } };
    error?: { json?: { message?: string } };
  };
  if (corps.error) {
    throw new Error(
      `${chemin} a échoué (${reponse.status()}) : ${corps.error.json?.message ?? "sans message"}`
    );
  }
  return corps.result!.data!.json as T;
}

// ===========================================================================
// 1. Redirection ouverte depuis /login?callbackUrl=
// ===========================================================================

/**
 * Toute requête sortant de localhost est interceptée et servie localement.
 *
 * Sans cela, une redirection ouverte se solderait par un
 * `net::ERR_NAME_NOT_RESOLVED` : un échec réseau, difficile à distinguer
 * d'une panne de l'environnement. Ici, evil.com « répond », et le test lit
 * franchement l'hôte sur lequel la page a atterri.
 */
async function pieger_les_hotes_externes(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html><body><h1>HOTE-EXTERNE-ATTEINT</h1></body></html>",
      })
  );
}

const CALLBACKS_HOSTILES: { nom: string; valeur: string }[] = [
  { nom: "//evil.com (protocole relatif)", valeur: "//evil.com" },
  { nom: "/\\evil.com (antislash)", valeur: "/\\evil.com" },
  {
    // Les navigateurs suppriment TAB/LF/CR avant de résoudre une URL :
    // `/<TAB>/evil.com` redevient `//evil.com`.
    nom: "%2F%09%2Fevil.com (tabulation encodée)",
    valeur: "%2F%09%2Fevil.com",
  },
  { nom: "%252F%252Fevil.com (double encodage)", valeur: "%252F%252Fevil.com" },
  { nom: "https://evil.com (URL absolue)", valeur: "https://evil.com" },
];

test.describe("Connexion : callbackUrl ne doit pas sortir du site", () => {
  for (const cas of CALLBACKS_HOSTILES) {
    test(`@P0 après connexion, callbackUrl=${cas.nom} n'emmène pas hors de localhost`, async ({
      page,
      baseURL,
    }) => {
      test.slow(); // compilation à la volée du serveur de dev

      await pieger_les_hotes_externes(page);

      // La valeur est déjà sous sa forme « telle que dans l'URL » pour les cas
      // encodés ; les autres sont encodés ici. On construit la query à la main
      // pour qu'aucune couche ne ré-encode `%09` ou `%252F`.
      const brut = cas.valeur.includes("%")
        ? cas.valeur
        : encodeURIComponent(cas.valeur);
      await page.goto(`/login?callbackUrl=${brut}`);

      await submitLoginForm(page, PRODUCTEUR, MOT_DE_PASSE);

      // On attend l'une OU l'autre issue, pour ne pas confondre « redirection
      // ouverte » et « page lente ». Le prédicat ne doit surtout pas se
      // satisfaire de l'URL de départ, qui contient elle aussi « evil.com ».
      await page.waitForURL(
        (url) =>
          url.hostname !== new URL(baseURL!).hostname ||
          url.pathname.startsWith("/producer"),
        { timeout: 90_000 }
      );

      const atterrissage = new URL(page.url());
      expect(
        atterrissage.hostname,
        `callbackUrl=${cas.valeur} a fait atterrir la connexion sur ${page.url()}`
      ).toBe(new URL(baseURL!).hostname);
      await expect(page).toHaveURL(/\/producer\/dashboard/, { timeout: 30_000 });
      await expect(
        page.getByRole("heading", { name: /HOTE-EXTERNE-ATTEINT/ })
      ).toHaveCount(0);
    });
  }

  test("@P0 contre-épreuve : callbackUrl=/producer/dashboard mène bien au tableau de bord producteur", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/login?callbackUrl=%2Fproducer%2Fdashboard");
    await submitLoginForm(page, PRODUCTEUR, MOT_DE_PASSE);
    await page.waitForURL(/\/producer\/dashboard/, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/producer\/dashboard/);
  });

  test("@P0 contre-épreuve : callbackUrl=/producer/results mène ailleurs que la destination par défaut du rôle", async ({
    page,
  }) => {
    test.slow();
    // `/producer/dashboard` est DÉJÀ la destination par défaut d'un
    // producteur : ce cas seul ne distinguerait pas « callbackUrl honoré » de
    // « callbackUrl ignoré ». On vise donc une page que le rôle n'aurait
    // jamais choisie tout seul.
    await page.goto("/login?callbackUrl=%2Fproducer%2Fresults");
    await submitLoginForm(page, PRODUCTEUR, MOT_DE_PASSE);
    await page.waitForURL(/\/producer\//, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/producer\/results/, { timeout: 30_000 });
  });
});

// ===========================================================================
// 2. Énumération des adresses via la newsletter
// ===========================================================================

interface AbonneNewsletter {
  id: string;
  email: string;
  status: string;
  confirmationToken: string | null;
  unsubscribeToken: string | null;
}

test.describe("Newsletter : la réponse ne doit pas révéler l'état d'une adresse", () => {
  test("@P0 le message d'inscription est identique pour une adresse inconnue, en attente, active et désabonnée", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);

    const marque = `e2e-${suffixe()}`;
    const adresse = (etat: string) =>
      `${marque}-${etat}@platinum-cbd-cup.test`;

    const inconnue = adresse("inconnue");
    const attente = adresse("attente");
    const active = adresse("active");
    const desabonnee = adresse("desabonnee");

    const idsACreer: string[] = [];

    /**
     * `newsletter.subscribe` est plafonné à 5 appels par minute et par IP
     * (strictRateLimitedPublicProcedure) : c'est voulu, et ce test en consomme
     * exactement 4. Rejoué dans la foulée, il retomberait sur le plafond — on
     * attend la fenêtre suivante plutôt que de le déclarer rouge pour une
     * protection qui fait son travail.
     */
    const souscrire = async (email: string): Promise<string> => {
      for (let essai = 0; essai < 12; essai++) {
        try {
          const r = await trpcMutation<{ message: string }>(
            request,
            "newsletter.subscribe",
            { email, name: `E2E-${marque}` }
          );
          return r.message;
        } catch (erreur) {
          if (!/\(429\)/.test(String(erreur))) throw erreur;
          await new Promise((r) => setTimeout(r, 10_000));
        }
      }
      throw new Error(
        `newsletter.subscribe est resté en 429 pendant 2 minutes pour ${email}`
      );
    };

    try {
      // ── Mise en place par les routes organisateur (hors plafond public) ─
      // Les trois états de départ sont posés avec `newsletter.add`, qui rend
      // la ligne créée — jetons compris. Rien n'est écrit en base à la main.
      await seConnecter(page, ORGANISATEUR);

      const ajouter = (email: string, dejaConfirme: boolean) =>
        trpcMutation<AbonneNewsletter>(page.request, "newsletter.add", {
          email,
          name: `E2E-${marque}`,
          skipConfirmation: dejaConfirme,
        });

      const ligneAttente = await ajouter(attente, false);
      const ligneActive = await ajouter(active, true);
      const ligneDesabonnee = await ajouter(desabonnee, false);
      idsACreer.push(ligneAttente.id, ligneActive.id, ligneDesabonnee.id);

      await trpcMutation(request, "newsletter.unsubscribe", {
        token: ligneDesabonnee.unsubscribeToken,
      });

      // ── On prouve que les quatre états sont bien DISTINCTS en base ──────
      const etats = await lireEnBase<{ email: string; status: string }>(
        `select email, status from newsletter_subscribers where email = any($1)`,
        [[inconnue, attente, active, desabonnee]]
      );
      const parEmail = new Map(etats.map((l) => [l.email, l.status]));
      expect(parEmail.get(inconnue), "l'adresse inconnue ne doit pas encore exister").toBeUndefined();
      expect(parEmail.get(attente)).toBe("pending");
      expect(parEmail.get(active)).toBe("active");
      expect(parEmail.get(desabonnee)).toBe("unsubscribed");

      // ── Le test proprement dit : quatre appels, un seul message ─────────
      const messageInconnue = await souscrire(inconnue);
      const messageAttente = await souscrire(attente);
      const messageActive = await souscrire(active);
      const messageDesabonnee = await souscrire(desabonnee);

      // Comparaison de chaînes entre elles : `not.toContain("déjà inscrit")`
      // passerait aussi bien si le serveur inventait une autre formulation.
      expect(messageAttente, "adresse en attente vs adresse inconnue").toBe(
        messageInconnue
      );
      expect(messageActive, "adresse active vs adresse inconnue").toBe(
        messageInconnue
      );
      expect(messageDesabonnee, "adresse désabonnée vs adresse inconnue").toBe(
        messageInconnue
      );

      // Contre-épreuve du protocole : le message existe vraiment et n'est pas
      // la chaîne vide (quatre chaînes vides seraient « identiques » aussi).
      expect(messageInconnue.length).toBeGreaterThan(20);

      // L'envoi n'est que TENTÉ (pas d'email en développement) : ce qu'on
      // vérifie, c'est la ligne posée en base pour l'adresse inconnue, en
      // attente de confirmation.
      const apres = await lireEnBase<{ id: string; status: string }>(
        `select id, status from newsletter_subscribers where email = $1`,
        [inconnue]
      );
      expect(apres.map((l) => l.status)).toEqual(["pending"]);
      idsACreer.push(apres[0]!.id);
    } finally {
      // Nettoyage : uniquement les lignes créées par ce test.
      for (const id of idsACreer) {
        await trpcMutation(page.request, "newsletter.delete", { id }).catch(
          () => undefined
        );
      }
    }
  });
});

// ===========================================================================
// 3. Image de partage (og:image)
// ===========================================================================

test.describe("Partage social : og:image présente sur les pages vitrines", () => {
  for (const chemin of ["/cups", "/palmares"]) {
    test(`@P1 ${chemin} porte une balise og:image non vide`, async ({ page }) => {
      await page.goto(chemin);
      const balise = page.locator('meta[property="og:image"]');
      await expect(balise, `og:image manquante sur ${chemin}`).toHaveCount(1);
      const contenu = await balise.getAttribute("content");
      expect(contenu ?? "").toMatch(/^https?:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i);
    });
  }
});

// ===========================================================================
// 4. PWA : balises « capable » en double
// ===========================================================================

test.describe("PWA : pas de balise « web-app-capable » en double", () => {
  for (const chemin of ["/", "/cups"]) {
    test(`@P1 ${chemin} ne déclare qu'une seule balise mobile-web-app-capable et une seule apple-…`, async ({
      page,
    }) => {
      await page.goto(chemin);
      // Comptage sur le DOM, pas sur le HTML brut : la charge utile RSC
      // répète ces noms en clair et fausserait un simple `grep`.
      await expect(
        page.locator('meta[name="mobile-web-app-capable"]'),
        "mobile-web-app-capable"
      ).toHaveCount(1);
      await expect(
        page.locator('meta[name="apple-mobile-web-app-capable"]'),
        "apple-mobile-web-app-capable"
      ).toHaveCount(1);
      await expect(
        page.locator('meta[name="mobile-web-app-capable"]')
      ).toHaveAttribute("content", "yes");
      await expect(
        page.locator('meta[name="apple-mobile-web-app-capable"]')
      ).toHaveAttribute("content", "yes");
    });
  }
});

// ===========================================================================
// 5. Nonce CSP sur le script d'initialisation du thème
// ===========================================================================

/**
 * Signature du script injecté par next-themes : une IIFE fléchée qui lit le
 * thème en `localStorage` et pose la classe sur `documentElement`. Les noms
 * de ses paramètres changent avec le niveau de minification (`((a,b,c…` en
 * production, `((e, i, s…` avec le serveur de développement) : on l'identifie
 * donc par ce qu'il FAIT, pas par ses initiales.
 */
const SIGNATURE_SCRIPT_THEME = [
  "localStorage.getItem",
  "classList",
  "prefers-color-scheme",
];

test.describe("CSP : le script de thème doit porter le nonce", () => {
  test("@P0 le script inline d'initialisation du thème n'est plus servi sans nonce", async ({
    request,
  }) => {
    // Lecture du HTML servi : après insertion, le navigateur masque la valeur
    // de l'attribut `nonce` (getAttribute renvoie ""), donc le DOM ne peut pas
    // répondre à la question posée.
    const reponse = await request.get("/");
    expect(reponse.status()).toBe(200);
    const html = await reponse.text();

    const scripts = [
      ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g),
    ].map((m) => ({ attributs: m[1]!, corps: m[2]! }));

    const scriptsTheme = scripts.filter((s) =>
      SIGNATURE_SCRIPT_THEME.every((marqueur) => s.corps.includes(marqueur))
    );

    // Contre-épreuve : si la signature ne reconnaissait plus rien, l'assertion
    // suivante serait vide de sens.
    expect(
      scriptsTheme.length,
      "script d'initialisation du thème introuvable dans le HTML servi"
    ).toBe(1);

    const nonce = /\bnonce="([^"]*)"/.exec(scriptsTheme[0]!.attributs)?.[1];
    expect(
      nonce,
      "le script de thème est servi sans attribut nonce"
    ).toBeTruthy();
    expect(nonce!.length).toBeGreaterThanOrEqual(16);

    // Le nonce doit être celui de la réponse, pas une valeur figée.
    const entete =
      reponse.headers()["content-security-policy-report-only"] ??
      reponse.headers()["content-security-policy"] ??
      "";
    expect(entete, "aucun en-tête CSP sur la réponse").toContain(`'nonce-${nonce}'`);
  });
});

// ===========================================================================
// 6. Page presse : les trois interrupteurs masquent réellement leur section
// ===========================================================================

interface ParametresPresse {
  showPressReleases: boolean | null;
  showGallery: boolean | null;
  showContact: boolean | null;
  showMediaKit: boolean | null;
}

/** Ligne « libellé + interrupteur » du formulaire de réglages presse. */
const interrupteur = (page: Page, libelle: string) =>
  page.locator(`div:has(> label:text-is("${libelle}"))`).getByRole("switch");

/**
 * L'éditeur recopie les réglages reçus du serveur dans son état local via un
 * `useEffect` : tout clic donné AVANT l'arrivée de la requête est écrasé, et
 * l'enregistrement repart alors avec les anciennes valeurs. Le bouton
 * « Enregistrer » est désactivé tant que la requête n'a pas répondu — c'est
 * le signal d'attente le plus fidèle.
 */
async function attendreLEditeurPresse(page: Page) {
  await expect(
    page.getByRole("button", { name: "Enregistrer" }),
    "l'éditeur des réglages presse n'a pas fini de charger"
  ).toBeEnabled({ timeout: 30_000 });
}

async function basculer(page: Page, libelle: string, vers: boolean) {
  const cible = interrupteur(page, libelle);
  await expect(cible, `interrupteur « ${libelle} » introuvable`).toHaveCount(1);
  const etat = await cible.getAttribute("data-state");
  if ((etat === "checked") !== vers) await cible.click();
  await expect(cible).toHaveAttribute("data-state", vers ? "checked" : "unchecked");
}

async function enregistrerLesReglages(page: Page) {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres enregistrés")).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Relit les réglages tels que le serveur les a enregistrés. Sans ce contrôle,
 * un test rouge ne dirait pas si c'est l'éditeur qui n'a rien écrit ou la
 * page publique qui ignore le drapeau.
 */
async function verifierLesReglagesEnregistres(
  page: Page,
  attendu: { communiques: boolean; galerie: boolean; contact: boolean }
) {
  const enregistres = await trpcQuery<ParametresPresse | null>(
    page.request,
    "press.getSettings"
  );
  expect(
    {
      communiques: enregistres?.showPressReleases,
      galerie: enregistres?.showGallery,
      contact: enregistres?.showContact,
    },
    "l'éditeur du tableau de bord n'a pas enregistré ce qui a été basculé"
  ).toEqual(attendu);
}

test.describe("Page presse : les interrupteurs masquent réellement leur section", () => {
  test("@P1 couper « communiqués », « galerie » et « contact » retire les trois sections de /press", async ({
    page,
  }) => {
    // Le test le plus long du lot : connexion organisateur, deux passages par
    // l'éditeur du tableau de bord et trois rendus de /press, sur un serveur
    // de développement qui compile chaque route au premier appel.
    test.setTimeout(300_000);

    await seConnecter(page, ORGANISATEUR);

    // État d'origine, à restaurer quoi qu'il arrive.
    const origine = await trpcQuery<ParametresPresse | null>(
      page.request,
      "press.getSettings"
    );

    // La galerie ne s'affiche que s'il y a au moins une image : sans elle,
    // l'interrupteur « galerie » n'aurait aucune conséquence observable et le
    // test conclurait à tort qu'il fonctionne.
    const titreImage = `E2E-galerie-${suffixe()}`;
    const image = await trpcMutation<{ id: string }>(
      page.request,
      "press.addImage",
      {
        title: titreImage,
        imageUrl: `https://exemple.invalid/${titreImage}.png`,
        alt: titreImage,
      }
    );

    const titreCommuniques = page.getByRole("heading", {
      name: "Communiqués",
      exact: true,
    });
    const titreGalerie = page.getByRole("heading", {
      name: "Galerie",
      exact: true,
    });
    const blocContact = page.getByText("Press contact", { exact: true });

    try {
      // ── Référence : les trois sections sont là ─────────────────────────
      await page.goto("/press");
      await expect(titreCommuniques).toBeVisible();
      await expect(titreGalerie).toBeVisible();
      await expect(page.getByText(`[ ${titreImage} ]`)).toBeVisible();
      await expect(blocContact).toBeVisible();

      // ── On coupe les trois ─────────────────────────────────────────────
      await page.goto("/dashboard/settings/portal/press");
      await attendreLEditeurPresse(page);
      await basculer(page, "AFFICHER LES COMMUNIQUÉS", false);
      await basculer(page, "AFFICHER LA GALERIE", false);
      await basculer(page, "AFFICHER LE CONTACT", false);
      await enregistrerLesReglages(page);
      await verifierLesReglagesEnregistres(page, {
        communiques: false,
        galerie: false,
        contact: false,
      });

      await page.goto("/press");
      await expect(
        titreCommuniques,
        "la section Communiqués reste affichée alors que son interrupteur est coupé"
      ).toHaveCount(0);
      await expect(
        titreGalerie,
        "la section Galerie reste affichée alors que son interrupteur est coupé"
      ).toHaveCount(0);
      await expect(
        blocContact,
        "le bloc Press contact reste affiché alors que son interrupteur est coupé"
      ).toHaveCount(0);
      // La page elle-même répond toujours : on a masqué des sections, pas
      // cassé la route.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // ── Contre-épreuve : on rallume, tout revient ──────────────────────
      await page.goto("/dashboard/settings/portal/press");
      await attendreLEditeurPresse(page);
      await basculer(page, "AFFICHER LES COMMUNIQUÉS", true);
      await basculer(page, "AFFICHER LA GALERIE", true);
      await basculer(page, "AFFICHER LE CONTACT", true);
      await enregistrerLesReglages(page);
      await verifierLesReglagesEnregistres(page, {
        communiques: true,
        galerie: true,
        contact: true,
      });

      await page.goto("/press");
      await expect(titreCommuniques).toBeVisible();
      await expect(titreGalerie).toBeVisible();
      await expect(blocContact).toBeVisible();
    } finally {
      // Remise en état : image supprimée (c'est nous qui l'avons créée) et
      // réglages remis à leur valeur de départ. Avant ce test, la table
      // `press_settings` pouvait être vide — l'état d'origine visible était
      // alors « tout affiché », ce que restaure le repli `?? true`.
      await trpcMutation(page.request, "press.deleteImage", {
        id: image.id,
      }).catch(() => undefined);
      await trpcMutation(page.request, "press.updateSettings", {
        showPressReleases: origine?.showPressReleases ?? true,
        showGallery: origine?.showGallery ?? true,
        showContact: origine?.showContact ?? true,
        showMediaKit: origine?.showMediaKit ?? true,
      }).catch(() => undefined);
    }
  });
});

// ===========================================================================
// 7. Accueil : aucun contenu inventé
// ===========================================================================

test.describe("Accueil : tout ce qui s'affiche vient de la base", () => {
  test("@P0 les catégories affichées sur l'accueil existent toutes en base", async ({
    page,
  }) => {
    await page.goto("/");

    const section = page
      .locator("section")
      .filter({ has: page.locator("h2.section-title", { hasText: "Catégories" }) });
    await expect(
      section,
      "section « Catégories » absente de l'accueil"
    ).toHaveCount(1);

    const cartes = section.locator(".card");
    const nombre = await cartes.count();
    expect(nombre, "aucune carte de catégorie affichée").toBeGreaterThan(0);

    // Le compteur du titre doit correspondre au nombre réel de cartes.
    const titre = (await section.locator("h2.section-title").innerText()).trim();
    expect(titre).toBe(`Catégories · ${String(nombre).padStart(2, "0")}`);

    const enBase = await lireEnBase<{ name: string }>(
      `select distinct name from categories`
    );
    const nomsConnus = new Set(enBase.map((l) => l.name));
    expect(nomsConnus.size, "aucune catégorie en base").toBeGreaterThan(0);

    for (const texte of await cartes.allInnerTexts()) {
      // Forme d'une carte : code sur deux lettres, nom, puis effectif.
      const lignes = texte
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const nom = lignes[1];
      expect(nom, `carte de catégorie illisible : ${JSON.stringify(texte)}`).toBeTruthy();
      expect(
        nomsConnus.has(nom!),
        `la catégorie « ${nom} » affichée sur l'accueil n'existe dans aucune ligne de la table categories`
      ).toBe(true);
    }
  });

  test("@P0 les codes produits du bandeau existent tous en base", async ({
    page,
  }) => {
    await page.goto("/");

    const bandeau = page.locator('.ticker-group[aria-hidden="false"] > span');
    const items = await bandeau.allInnerTexts();
    expect(items.length, "bandeau de scores absent de l'accueil").toBeGreaterThan(0);

    const codes = new Set(
      (
        await lireEnBase<{ anonymous_code: string }>(
          `select distinct anonymous_code from products where anonymous_code is not null`
        )
      ).map((l) => l.anonymous_code)
    );
    const categories = new Set(
      (
        await lireEnBase<{ name: string }>(`select distinct upper(name) as name from categories`)
      ).map((l) => l.name)
    );

    for (const item of items) {
      // Format produit par getTickerItems : `CODE · CATÉGORIE · 12.3`
      const morceaux = item.split("·").map((p) => p.trim());
      expect(morceaux.length, `entrée de bandeau inattendue : ${item}`).toBe(3);
      const [code, categorie, note] = morceaux as [string, string, string];
      expect(
        codes.has(code),
        `le code « ${code} » affiché sur l'accueil ne correspond à aucun produit en base`
      ).toBe(true);
      expect(
        categories.has(categorie),
        `la catégorie « ${categorie} » affichée sur l'accueil n'existe pas en base`
      ).toBe(true);
      expect(note, `note illisible dans « ${item} »`).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  test("@P0 l'accueil n'affiche plus les catégories ni les codes de démonstration", async ({
    page,
  }) => {
    await page.goto("/");
    const texteAccueil = (await page.locator("body").innerText()).normalize("NFC");

    // Contre-épreuve : la même lecture retrouve bien un libellé réellement
    // présent. Sans elle, les absences ci-dessous passeraient même si
    // `innerText` renvoyait la chaîne vide.
    expect(texteAccueil).toContain("Ce qui se passe ici");

    for (const invente of [
      "Flower · Indoor",
      "Hashish",
      "CF23",
      "EPA87",
      "HAS14",
    ]) {
      expect(
        texteAccueil.includes(invente),
        `l'accueil affiche « ${invente} », qui ne vient d'aucune ligne de la base`
      ).toBe(false);
    }
  });

  test("@P1 contre-épreuve : « CF23 » reste bien présent là où il est un exemple assumé", async ({
    page,
  }) => {
    // Sans ce test, l'absence de « CF23 » sur l'accueil ne prouverait rien :
    // une chaîne qui n'existe nulle part est absente partout. Elle figure
    // toujours, explicitement comme exemple, dans le règlement d'une édition.
    await page.goto("/cups");
    const premier = page.locator('a[href^="/cups/"]').first();
    await expect(premier, "aucune édition listée sur /cups").toBeVisible();
    const href = await premier.getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto(`${href}?tab=rules`);
    await expect(page.getByText(/ex: CF23/)).toBeVisible();
  });
});
