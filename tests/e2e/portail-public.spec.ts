import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Portail public — lot « Portail public » de la campagne E2E.
 *
 * Périmètre : tout ce qui est consultable SANS session. Les 25 pages
 * publiques (accueil, palmarès et ses filtres, archives, éditions, page
 * d'édition, articles, sponsors, presse, contact, les trois pages légales,
 * le manifesto et le widget embarqué), plus les trois parcours anonymes :
 * mot de passe oublié, réinitialisation avec jeton invalide, inscription
 * à la newsletter.
 *
 * Aucune spec de ce fichier ne se connecte : `loginUser` de
 * tests/support/fixtures/auth.fixture.ts n'a rien à faire ici (voir le
 * compte rendu).
 *
 * Base partagée entre six agents : ce fichier ne crée que des lignes
 * `newsletter_subscribers` préfixées `e2e-portail-`, avec un suffixe
 * aléatoire, et ne supprime jamais rien. Aucune donnée d'un autre lot n'est
 * supposée : les tests qui ont besoin d'une édition classée la demandent à la
 * base (`editionsClassees`) au lieu de se fier à celle affichée par défaut.
 *
 * Exécution :
 *   E2E_BASE_URL=http://localhost:3001 pnpm exec playwright test \
 *     tests/e2e/portail-public.spec.ts --workers=2
 *
 * `--workers=2` n'est pas cosmétique : six navigateurs en parallèle sur le
 * même serveur `next dev` repoussent l'hydratation au-delà de la minute, et
 * les tests qui cliquent un filtre échouent alors sur le temps d'attente, pas
 * sur le comportement.
 */

// ---------------------------------------------------------------------------
// Accès base — lecture seule, pour VERIFIER un effet, jamais pour préparer
// un état. Le garde-fou ci-dessous refuse toute base autre que platinum_local.
// ---------------------------------------------------------------------------

function urlBase(): string {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;

  // Playwright est lancé depuis la racine du dépôt.
  const contenu = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const ligne = contenu
    .split("\n")
    .find((l) => l.trimStart().startsWith("DATABASE_URL="));
  if (!ligne) {
    throw new Error("DATABASE_URL introuvable (ni en environnement, ni dans .env.local)");
  }
  return ligne.slice(ligne.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/** Exécute un SELECT sur platinum_local. Refuse toute autre base. */
async function selectionner<T = Record<string, unknown>>(
  sql: string,
  valeurs: unknown[] = []
): Promise<T[]> {
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error("Seules les requêtes SELECT sont autorisées depuis les tests.");
  }
  const url = urlBase();
  const nomBase = new URL(url).pathname.replace(/^\//, "");
  if (nomBase !== "platinum_local") {
    throw new Error(
      `Base « ${nomBase} » refusée : les tests ne lisent que platinum_local.`
    );
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query(sql, valeurs);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------------

/**
 * Branche l'écoute des erreurs console AVANT toute navigation et renvoie
 * l'accumulateur. Une page « sans erreur » veut dire : aucun `console.error`
 * et aucune exception non rattrapée.
 */
function capterErreursConsole(page: Page): string[] {
  const erreurs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erreurs.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    erreurs.push(`exception: ${err.message}`);
  });
  return erreurs;
}

const suffixe = () => Math.random().toString(36).slice(2, 10);

/**
 * Éditions publiées qui ont réellement des produits notés, de la plus
 * fournie à la moins fournie.
 *
 * Aucun test ne doit dépendre de l'édition affichée par défaut : la base est
 * partagée, et une édition de test publiée par un autre lot peut passer en
 * tête du bandeau à tout moment. On vise donc toujours une édition nommée.
 */
async function editionsClassees() {
  return selectionner<{ id: string; name: string; annee: string; n: string }>(
    `select c.id,
            c.name,
            extract(year from coalesce(c.event_date, c.created_at))::int::text as annee,
            count(*)::text as n
       from cups c
       join registrations r on r.cup_id = c.id
       join products p on p.registration_id = r.id
        and coalesce(p.final_score_public, p.final_score_pro) is not null
        and p.excluded_from_results = false
      where c.results_published_at is not null
      group by c.id, c.name, annee
      order by count(*) desc, c.id`
  );
}

/**
 * Ouvre une page du palmarès et attend son contenu réel.
 *
 * `page.goto` rend la main dès le squelette servi par `palmares/loading.tsx` :
 * compter les puces de filtre à ce moment-là renvoie zéro et fait échouer le
 * test pour une raison qui n'a rien à voir avec ce qu'il prouve.
 */
async function ouvrirPalmares(page: Page, url = "/palmares") {
  await page.goto(url);
  await expect(page.locator(".palmares-edition-strip")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".ranking-row").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
}

/**
 * Suit un lien du portail : on lit le `href` réellement rendu, on vérifie
 * qu'il pointe là où on l'attend, puis on l'ouvre.
 *
 * Pourquoi pas `click()` : sur ce serveur `next dev` partagé entre six
 * agents, l'hydratation arrive parfois plus de 90 s après le premier rendu,
 * et un clic envoyé avant est perdu sans erreur — le test échouait alors sur
 * l'attente, jamais sur le comportement. Le contrat vérifié ici reste entier :
 * le lien existe dans la page, il porte la bonne cible, et cette cible
 * affiche bien ce qu'elle promet.
 */
async function suivreLien(
  page: Page,
  lien: ReturnType<Page["locator"]>,
  cibleAttendue: RegExp
): Promise<string> {
  await expect(lien).toHaveCount(1);
  const href = (await lien.getAttribute("href")) ?? "";
  expect(href, "cible du lien").toMatch(cibleAttendue);
  // Les liens du palmarès sont relatifs à la page courante (« ?edition=… »).
  await page.goto(new URL(href, page.url()).toString());
  return href;
}

/**
 * Adresse cliente simulée, unique par test.
 *
 * `newsletter.subscribe` est plafonné à cinq appels par minute et par
 * (IP, procédure) — clé lue dans `x-forwarded-for`. Sans en-tête dédié, les
 * tests de ce fichier partagent le seau du serveur de développement et le
 * deuxième passage consécutif tombe en 429, pour une raison qui n'a rien à
 * voir avec ce qu'ils prouvent. Chaque test se présente donc comme un client
 * distinct, dans la plage de documentation TEST-NET-3 (RFC 5737).
 */
const ipDeTest = () =>
  `203.0.113.${1 + Math.floor(Math.random() * 254)}`;

/** Appel direct d'une mutation tRPC publique (aucun formulaire ne l'expose). */
async function appelerTrpc(
  page: Page,
  chemin: string,
  entree: Record<string, unknown>,
  ip: string
): Promise<{ statut: number; corps: unknown }> {
  const reponse = await page.request.post(`/api/trpc/${chemin}`, {
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    data: { json: entree },
  });
  return { statut: reponse.status(), corps: await reponse.json() };
}

// ---------------------------------------------------------------------------
// 1. Les pages publiques : elles répondent, elles montrent du contenu, elles
//    ne jettent rien en console.
// ---------------------------------------------------------------------------

/**
 * `ancre` est un texte réellement rendu par la page — pas un simple <main>
 * visible, qui reste vrai sur une page vide ou en erreur.
 */
const PAGES_PUBLIQUES = [
  {
    chemin: "/",
    nom: "accueil",
    titre: /Platinum CBD Cup/,
    ancre: /panel indépendant/i,
  },
  {
    chemin: "/palmares",
    nom: "palmarès",
    titre: /Palmarès/,
    // Texte figé de l'en-tête : l'édition mise en avant par défaut dépend
    // des données, pas de la page.
    ancre: /Palmarès · Public ledger/,
  },
  {
    chemin: "/archives",
    nom: "archives",
    titre: /Archives/,
    ancre: /L'historique complet des éditions passées/,
  },
  {
    chemin: "/cups",
    nom: "éditions",
    titre: /éditions/i,
    ancre: /Toutes les éditions de la Platinum CBD Cup/,
  },
  {
    chemin: "/articles",
    nom: "articles",
    titre: /Articles/,
    ancre: /Interviews de jurés et de producteurs/,
  },
  {
    chemin: "/sponsors",
    nom: "sponsors",
    titre: /Sponsors/,
    ancre: /Les marques et institutions qui rendent possible/,
  },
  {
    chemin: "/press",
    nom: "presse",
    // Ancre volontairement prise dans le texte figé de la page : l'adresse
    // de contact presse vient de `press_settings`, que d'autres lots
    // modifient sur cette base partagée.
    titre: /Presse/,
    ancre: /dossiers de presse, kit média/,
  },
  {
    chemin: "/contact",
    nom: "contact",
    titre: /Contact/,
    ancre: /Nous lisons chaque message/,
  },
  {
    chemin: "/about",
    nom: "manifesto",
    titre: /Manifesto/,
    ancre: /Le code précède le nom/,
  },
  {
    chemin: "/mentions-legales",
    nom: "mentions légales",
    titre: /Mentions légales/,
    ancre: /Éditeur du site/,
  },
  {
    chemin: "/confidentialite",
    nom: "confidentialité",
    titre: /Confidentialité/,
    ancre: /Responsable du traitement/,
  },
  {
    chemin: "/reglement",
    nom: "règlement",
    titre: /Règlement/,
    ancre: /Objet et organisateur/,
  },
  {
    chemin: "/forgot-password",
    nom: "mot de passe oublié",
    titre: /Platinum CBD Cup/,
    ancre: /Mot de passe oublié/,
  },
  {
    chemin: "/reset-password",
    nom: "réinitialisation",
    titre: /Platinum CBD Cup/,
    ancre: /Lien invalide/,
  },
] as const;

test.describe("Portail public — accessibilité des pages sans session", () => {
  for (const p of PAGES_PUBLIQUES) {
    test(`@P0 ${p.nom} (${p.chemin}) répond 200, affiche son contenu et ne journalise aucune erreur`, async ({
      page,
    }) => {
      test.setTimeout(60_000); // première compilation Next en mode dev
      const erreurs = capterErreursConsole(page);

      const reponse = await page.goto(p.chemin);
      expect(reponse?.status(), `statut HTTP de ${p.chemin}`).toBe(200);
      await expect(page).toHaveTitle(p.titre, { timeout: 60_000 });
      await expect(page.getByText(p.ancre).first()).toBeVisible({ timeout: 60_000 });

      expect(erreurs, `erreurs console sur ${p.chemin}`).toEqual([]);
    });
  }

  test("@P1 aucune page publique ne redirige vers /login", async ({ page }) => {
    test.setTimeout(180_000);
    for (const p of PAGES_PUBLIQUES) {
      // `commit` suffit : une redirection vers /login serait déjà décidée
      // côté serveur, et attendre le rendu complet de 14 pages dépasse le
      // budget d'un seul test sur un serveur de développement partagé.
      await page.goto(p.chemin, { waitUntil: "commit" });
      expect(page.url(), `${p.chemin} ne doit pas exiger de session`).not.toContain(
        "/login"
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Palmarès : contenu réel, éditions 2023→2026, filtres édition et catégorie
// ---------------------------------------------------------------------------

test.describe("Palmarès", () => {
  test("@P0 le palmarès liste des produits classés issus de la base", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const editions = await editionsClassees();
    expect(editions.length, "éditions classées en base").toBeGreaterThan(0);
    const reference = editions[0]!;

    await ouvrirPalmares(page, `/palmares?edition=${reference.id}`);

    const nombre = await page.locator(".ranking-row").count();
    expect(nombre, "lignes de classement affichées").toBeGreaterThan(0);

    // Le « best in show » mis en avant doit être un produit réellement
    // enregistré sur l'édition affichée : c'est ce qui distingue un contenu
    // issu de la base d'un gabarit de démonstration.
    const heros = (
      await page.locator("[data-best-in-show] .display").first().innerText()
    )
      .replace(/\.$/, "")
      .trim();
    expect(heros.length, "nom du best in show").toBeGreaterThan(0);

    const correspondances = await selectionner<{ n: string }>(
      `select count(*)::text as n
         from products p
         join registrations r on r.id = p.registration_id
        where r.cup_id = $1 and p.name = $2`,
      [reference.id, heros]
    );
    expect(
      Number(correspondances[0]!.n),
      `« ${heros} » n'existe pas parmi les produits de l'édition affichée`
    ).toBeGreaterThan(0);
  });

  test("@P0 le palmarès propose les éditions 2023 à 2026, pas seulement 2026", async ({
    page,
  }) => {
    // Régression : un statut hérité masquait 60 produits médaillés et ne
    // laissait remonter que l'édition en cours.
    test.setTimeout(60_000);
    const editions = await editionsClassees();
    await ouvrirPalmares(page, `/palmares?edition=${editions[0]!.id}`);

    const bandeau = page.locator(".palmares-edition-strip");
    await expect(bandeau).toBeVisible();

    const libelles = (await bandeau.locator("a").allInnerTexts()).join(" | ");
    for (const annee of ["2023", "2024", "2025", "2026"]) {
      expect(libelles, `édition ${annee} absente du bandeau : « ${libelles} »`).toContain(
        annee
      );
    }

    // Contre-épreuve côté base : le bandeau doit exposer exactement les cups
    // dont les résultats sont publiés — ni moins (masquage), ni plus (fuite).
    const publiees = await selectionner<{ n: string }>(
      "select count(*)::text as n from cups where results_published_at is not null"
    );
    expect(await bandeau.locator("a").count()).toBe(Number(publiees[0]!.n));
  });

  test("@P0 chaque édition ayant des produits notés affiche son classement", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // On n'inspecte que les éditions dont la base dit qu'elles ont des
    // produits notés : une édition publiée à vide (fixture d'un autre lot)
    // n'a rien à afficher, et ce n'est pas un défaut.
    const editions = await editionsClassees();
    expect(editions.length, "éditions classées en base").toBeGreaterThanOrEqual(4);

    for (const edition of editions) {
      await page.goto(`/palmares?edition=${edition.id}`);
      // Le rendu est terminé dès que l'un des trois états de la page est là :
      // un palmarès, ou l'un des deux messages « pas de résultat ».
      await expect(
        page
          .getByText(/BEST IN SHOW|Pas encore de palmarès|Aucun palmarès publié/)
          .first()
      ).toBeVisible({ timeout: 60_000 });
      const lignes = await page.locator(".ranking-row").count();
      expect(
        lignes,
        `« ${edition.name} » a ${edition.n} produits notés en base mais n'affiche aucune ligne`
      ).toBeGreaterThan(0);
    }
  });

  test("@P1 le filtre par édition change l'édition mise en avant", async ({ page }) => {
    test.setTimeout(180_000);
    const editions = await editionsClassees();
    const depart = editions[0]!;
    const arrivee = editions.find((e) => e.annee !== depart.annee);
    expect(arrivee, "deux éditions d'années différentes sont nécessaires").toBeTruthy();

    await ouvrirPalmares(page, `/palmares?edition=${depart.id}`);
    await expect(page.getByText(`BEST IN SHOW · ${depart.annee}`)).toBeVisible();

    await suivreLien(
      page,
      page.locator(`.palmares-edition-strip a[href="?edition=${arrivee!.id}"]`),
      new RegExp(`^\\?edition=${arrivee!.id}$`)
    );

    await expect(page.getByText(`BEST IN SHOW · ${arrivee!.annee}`)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(`BEST IN SHOW · ${depart.annee}`)).toHaveCount(0);
  });

  test("@P1 le filtre par catégorie ne laisse que la catégorie choisie", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const editions = await editionsClassees();
    await ouvrirPalmares(page, `/palmares?edition=${editions[0]!.id}`);

    const puces = page.locator('.palmares-category-strip a[href*="cat="]');
    const nbPuces = await puces.count();
    expect(nbPuces, "puces de catégorie").toBeGreaterThan(1);

    const toutes = await page.locator(".ranking-row").count();

    // Une catégorie qui a des lignes : on prend la première puce et on
    // vérifie que le filtre RESTREINT réellement (sous-ensemble strict, pas
    // une page vide).
    const libelle = (await puces.first().innerText()).trim();
    await suivreLien(page, puces.first(), /cat=/);
    await expect(page.locator(".ranking-row").first()).toBeVisible({ timeout: 60_000 });

    const filtrees = await page.locator(".ranking-row").count();
    expect(filtrees, `catégorie « ${libelle} » vidée par le filtre`).toBeGreaterThan(0);
    expect(filtrees, `le filtre « ${libelle} » ne restreint rien`).toBeLessThan(toutes);

    // Une seule en-tête de catégorie doit subsister.
    const entetes = page.locator(".ranking-header");
    expect(await entetes.count()).toBe(1);

    // Contre-épreuve : « Toutes » restitue l'intégralité du classement.
    await suivreLien(
      page,
      page.locator('.palmares-category-strip a:not([href*="cat="])').first(),
      /^\?edition=[^&]+$/
    );
    await expect(page.locator(".ranking-row").first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator(".ranking-row").count()).toBe(toutes);
  });

  test("@P2 le palmarès n'a aucune erreur console, filtres compris", async ({ page }) => {
    test.setTimeout(180_000);
    const erreurs = capterErreursConsole(page);

    const editions = await editionsClassees();
    const autre = editions[1] ?? editions[0]!;
    await ouvrirPalmares(page, `/palmares?edition=${editions[0]!.id}`);
    await suivreLien(
      page,
      page.locator(`.palmares-edition-strip a[href="?edition=${autre.id}"]`),
      new RegExp(`^\\?edition=${autre.id}$`)
    );
    await expect(page.locator(".ranking-row").first()).toBeVisible({ timeout: 60_000 });
    await suivreLien(
      page,
      page.locator('.palmares-category-strip a[href*="cat="]').first(),
      /cat=/
    );
    await expect(page.locator(".ranking-header")).toHaveCount(1);

    expect(erreurs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Archives et éditions
// ---------------------------------------------------------------------------

test.describe("Archives et éditions", () => {
  test("@P1 les archives listent toutes les éditions publiées et renvoient vers leur palmarès", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/archives");
    await expect(
      page.getByText(/L'historique complet des éditions passées/)
    ).toBeVisible({ timeout: 60_000 });

    const liens = page.locator('main a[href^="/palmares?edition="]');
    const publiees = await selectionner<{ n: string }>(
      "select count(*)::text as n from cups where results_published_at is not null"
    );
    expect(await liens.count()).toBe(Number(publiees[0]!.n));

    // On suit le lien d'une édition dont la base dit qu'elle a des produits
    // notés : une édition publiée à vide n'aurait rien à afficher.
    const editions = await editionsClassees();
    await suivreLien(
      page,
      page.locator(`main a[href="/palmares?edition=${editions[0]!.id}"]`).first(),
      new RegExp(`^/palmares\\?edition=${editions[0]!.id}$`)
    );
    await expect(page.locator(".ranking-row").first()).toBeVisible({ timeout: 60_000 });
  });

  test("@P1 la liste des éditions affiche les vraies cups de la base", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/cups");

    const cups = await selectionner<{ id: string; name: string }>(
      "select id, name from cups where results_published_at is not null order by event_date desc limit 1"
    );
    const cup = cups[0]!;
    await expect(page.getByText(cup.name).first()).toBeVisible();
    await expect(page.locator(`main a[href^="/palmares?edition=${cup.id}"]`)).toHaveCount(
      1
    );
  });

  test("@P0 la page d'une édition affiche son nom, ses catégories et ses spécimens", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const erreurs = capterErreursConsole(page);

    const cups = await selectionner<{ id: string; name: string }>(
      "select id, name from cups where results_published_at is not null order by event_date desc limit 1"
    );
    const cup = cups[0]!;

    const reponse = await page.goto(`/cups/${cup.id}`);
    expect(reponse?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(cup.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.getByText("Spécimens inscrits").first()).toBeVisible();
    await expect(page.getByText("Catégories").first()).toBeVisible();

    // Le compteur de spécimens vient de la base : il doit correspondre.
    const produits = await selectionner<{ n: string }>(
      `select count(*)::text as n
         from products p
         join registrations r on r.id = p.registration_id
        where r.cup_id = $1`,
      [cup.id]
    );
    const attendu = Number(produits[0]!.n);
    expect(attendu, "l'édition de référence doit avoir des produits").toBeGreaterThan(0);
    await expect(
      page.getByText(String(attendu).padStart(3, "0"), { exact: false }).first()
    ).toBeVisible();

    expect(erreurs).toEqual([]);
  });

  test("@P1 une édition inexistante renvoie un 404 (et une édition réelle un 200)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Contre-épreuve d'abord : l'identifiant réel doit bien répondre 200,
    // sinon le 404 attendu ci-dessous ne prouverait rien.
    const cups = await selectionner<{ id: string }>(
      "select id from cups where results_published_at is not null limit 1"
    );
    const ok = await page.goto(`/cups/${cups[0]!.id}`);
    expect(ok?.status()).toBe(200);

    const ko = await page.goto(`/cups/E2E-edition-inexistante-${suffixe()}`);
    await expect(page.getByText("Page introuvable")).toBeVisible();
    expect(ko?.status(), "une ressource absente doit répondre 404, pas 200").toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 4. Articles et sponsors — listes et fiches
// ---------------------------------------------------------------------------

test.describe("Articles et sponsors", () => {
  test("@P1 la liste des articles reflète exactement les articles publiés en base", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/articles");

    const publies = await selectionner<{ n: string }>(
      "select count(*)::text as n from articles where status = 'published'"
    );
    const attendu = Number(publies[0]!.n);

    const cartes = page.locator('main a[href^="/articles/"]');
    expect(await cartes.count(), "cartes d'article affichées").toBe(attendu);

    if (attendu === 0) {
      // L'état vide est le rendu correct ici : la copie de production ne
      // contient aucun article. On vérifie le message réellement écrit dans
      // la page, pas une tournure inventée.
      await expect(page.getByText("Pas encore d'articles publiés")).toBeVisible();
    }
  });

  test("@P1 la liste des sponsors reflète exactement les sponsors en base", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/sponsors");

    const rows = await selectionner<{ n: string }>(
      "select count(*)::text as n from sponsors"
    );
    const attendu = Number(rows[0]!.n);

    const cartes = page.locator('main a[href^="/sponsors/"]');
    expect(await cartes.count(), "cartes de sponsor affichées").toBe(attendu);

    if (attendu === 0) {
      await expect(page.getByText("Pas encore de partenaires annoncés")).toBeVisible();
      // Même sans partenaire, l'appel à l'action doit rester ouvert.
      await expect(page.locator('main a[href="/contact"]')).toBeVisible();
    }
  });

  test("@P1 la presse reflète exactement les communiqués publiés en base", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/press");
    await expect(page.getByText(/dossiers de presse/)).toBeVisible({ timeout: 60_000 });

    const rows = await selectionner<{ n: string }>(
      "select count(*)::text as n from press_releases where status = 'published'"
    );
    const attendu = Number(rows[0]!.n);

    if (attendu === 0) {
      await expect(page.getByText("Aucun communiqué publié")).toBeVisible();
    } else {
      const titres = await selectionner<{ title: string }>(
        "select title from press_releases where status = 'published' limit 1"
      );
      await expect(page.getByText(titres[0]!.title).first()).toBeVisible();
    }
  });

  test("@P1 la page presse affiche toujours une adresse de contact presse", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/press");
    await expect(page.getByText(/dossiers de presse/)).toBeVisible({ timeout: 60_000 });

    const reglages = await selectionner<{ press_email: string | null }>(
      "select press_email from press_settings limit 1"
    );
    const configure = (reglages[0]?.press_email ?? "").trim();

    const affichee = (
      await page.locator(".kv").filter({ hasText: "Email" }).locator(".kv-v").innerText()
    ).trim();

    if (configure !== "") {
      // Une adresse configurée doit être celle qui s'affiche.
      expect(affichee).toBe(configure);
    } else {
      // Sans adresse configurée, le bloc « Press contact » doit retomber sur
      // l'adresse par défaut ; il ne doit jamais rester vide.
      expect(affichee, "bloc de contact presse vide").toMatch(/\S+@\S+/);
    }
  });

  test("@P2 un article inexistant renvoie un 404", async ({ page }) => {
    test.setTimeout(60_000);
    const reponse = await page.goto(`/articles/e2e-slug-inexistant-${suffixe()}`);
    await expect(page.getByText("Page introuvable")).toBeVisible();
    expect(reponse?.status(), "slug inconnu : 404 attendu").toBe(404);
  });

  test("@P2 un sponsor inexistant renvoie un 404", async ({ page }) => {
    test.setTimeout(60_000);
    const reponse = await page.goto(`/sponsors/e2e-sponsor-inexistant-${suffixe()}`);
    await expect(page.getByText("Page introuvable")).toBeVisible();
    expect(reponse?.status(), "identifiant inconnu : 404 attendu").toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 5. Widget embarqué
// ---------------------------------------------------------------------------

/** Producteur réel possédant au moins une distinction publiée. */
async function producteurAvecDistinctions() {
  const rows = await selectionner<{
    id: string;
    nom: string;
    distinctions: string;
  }>(
    `select pr.id,
            coalesce(pr.brand_name, pr.company_name) as nom,
            count(*)::text as distinctions
       from producers pr
       join registrations r on r.producer_id = pr.id and r.status = 'confirmed'
       join cups c on c.id = r.cup_id and c.results_published_at is not null
       join products p on p.registration_id = r.id
        and p.excluded_from_results = false
        and p.disqualified = false
        and (p.label_id is not null or p.category_rank_pro <= 3 or p.category_rank_public <= 3)
      group by pr.id, nom
      order by count(*) desc, pr.id
      limit 1`
  );
  return rows[0];
}

test.describe("Widget embarqué", () => {
  test("@P0 le widget affiche les distinctions réelles d'un producteur", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const erreurs = capterErreursConsole(page);

    const producteur = await producteurAvecDistinctions();
    expect(producteur, "aucun producteur distingué en base").toBeTruthy();

    const reponse = await page.goto(`/widget/producer/${producteur!.id}`);
    expect(reponse?.status()).toBe(200);

    // Le nom affiché est celui de la base, jamais une valeur écrite en dur ici.
    await expect(page.getByText(producteur!.nom, { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Distinctions").first()).toBeVisible();
    await expect(page.getByText("Platinum CBD Cup").first()).toBeVisible();

    // Contre-épreuve de l'état vide : un producteur distingué ne doit jamais
    // afficher le message « aucune distinction ».
    await expect(page.getByText("Aucune distinction publiée")).toHaveCount(0);

    expect(erreurs).toEqual([]);
  });

  test("@P1 le widget d'un producteur inconnu affiche « Producteur introuvable »", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const reponse = await page.goto(`/widget/producer/E2E-inconnu-${suffixe()}`);
    expect(reponse?.status()).toBe(200); // l'embed reste rendu, il ne casse pas le site hôte
    await expect(page.getByText("Producteur introuvable.")).toBeVisible();
  });

  test("@P2 le widget accepte le thème sombre sans perdre son contenu", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const producteur = await producteurAvecDistinctions();

    const fondDe = async (url: string) => {
      await page.goto(url);
      await expect(
        page.getByText(producteur!.nom, { exact: false }).first()
      ).toBeVisible();
      return page.evaluate(() => {
        // Le cadre de l'embed est le seul <div> à porter `minHeight: 100vh`
        // en style en ligne ; sa position dans <body> varie avec les
        // marqueurs de flux insérés par Next.
        const cadre = Array.from(document.querySelectorAll<HTMLElement>("div")).find(
          (el) => el.style.minHeight === "100vh"
        );
        return cadre ? getComputedStyle(cadre).backgroundColor : null;
      });
    };

    const clair = await fondDe(`/widget/producer/${producteur!.id}`);
    const sombre = await fondDe(`/widget/producer/${producteur!.id}?theme=dark`);

    expect(clair, "fond du thème clair").toBe("rgb(255, 255, 255)");
    expect(sombre, "fond du thème sombre").toBe("rgb(10, 10, 15)");
  });
});

// ---------------------------------------------------------------------------
// 6. Mot de passe oublié — pas d'énumération de comptes
// ---------------------------------------------------------------------------

const COMPTE_CONNU = "e2e-organisateur@platinum-cbd-cup.test";

/** Soumet le formulaire et renvoie la confirmation, adresse neutralisée. */
async function confirmationMotDePasseOublie(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.locator('input[id="email"]').fill(email);
  await page.getByRole("button", { name: /envoyer le lien/i }).click();

  const bloc = page.getByRole("status");
  await expect(bloc).toBeVisible({ timeout: 15_000 });
  const texte = await bloc.innerText();
  return texte.replace(email, "<ADRESSE>").replace(/\s+/g, " ").trim();
}

test.describe("Mot de passe oublié", () => {
  test("@P0 la confirmation est identique pour une adresse connue et une inconnue", async ({
    page,
  }) => {
    test.setTimeout(150_000);

    const inconnue = `e2e-portail-inconnu-${suffixe()}@platinum-cbd-cup.test`;

    const messageConnu = await confirmationMotDePasseOublie(page, COMPTE_CONNU);
    const messageInconnu = await confirmationMotDePasseOublie(page, inconnue);

    // Le message doit exister — sinon la comparaison de deux chaînes vides
    // passerait sans rien prouver.
    expect(messageConnu).toContain("Si un compte existe pour <ADRESSE>");
    expect(messageInconnu).toBe(messageConnu);
  });

  test("@P2 une adresse mal formée est refusée avant tout envoi", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/forgot-password");
    await page.locator('input[id="email"]').fill("pas-une-adresse");
    await page.getByRole("button", { name: /envoyer le lien/i }).click();

    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Réinitialisation avec jeton invalide
// ---------------------------------------------------------------------------

test.describe("Réinitialisation du mot de passe", () => {
  test("@P0 sans jeton, la page annonce un lien invalide et propose d'en redemander un", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/reset-password");
    await expect(
      page.getByRole("heading", { name: "Lien invalide" })
    ).toBeVisible();
    // `getByRole("alert")` seul attrape aussi l'annonceur de route de Next.
    await expect(
      page.getByRole("alert").filter({ hasText: "Les liens de réinitialisation" })
    ).toContainText("expirent au bout d'une heure");
    await expect(page.getByRole("link", { name: /demander un nouveau lien/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );

    // Contre-épreuve : avec un jeton dans l'URL, c'est bien le formulaire de
    // saisie qui s'affiche — l'écran « lien invalide » n'est donc pas
    // l'unique rendu possible de cette page.
    await page.goto(`/reset-password?token=E2E-jeton-${suffixe()}`);
    await expect(
      page.getByRole("heading", { name: "Nouveau mot de passe" })
    ).toBeVisible();
  });

  test("@P0 un jeton invalide est refusé au moment de la soumission", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto(`/reset-password?token=E2E-jeton-invalide-${suffixe()}`);

    const motDePasse = "E2e-Portail!2026";
    await page.locator('input[id="password"]').fill(motDePasse);
    await page.locator('input[id="confirmPassword"]').fill(motDePasse);
    await page.getByRole("button", { name: /réinitialiser|mettre à jour|valider/i }).click();

    await expect(
      page.getByText(/Ce lien a expiré ou a déjà été utilisé/i)
    ).toBeVisible({ timeout: 15_000 });

    // Aucune redirection vers /login : le mot de passe n'a pas été changé.
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test("@P1 le callback Better Auth en erreur affiche le même refus", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/reset-password?error=INVALID_TOKEN");
    await expect(page.getByRole("heading", { name: "Lien invalide" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Newsletter — endpoint public, aucun formulaire dans le portail
// ---------------------------------------------------------------------------

const REPONSE_NEWSLETTER =
  "Si cette adresse n'est pas déjà inscrite, un email de confirmation vient de lui être envoyé.";

test.describe("Inscription à la newsletter", () => {
  test("@P0 une inscription anonyme crée un abonné en attente de confirmation", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const email = `e2e-portail-news-${suffixe()}@platinum-cbd-cup.test`;

    const { statut, corps } = await appelerTrpc(
      page,
      "newsletter.subscribe",
      { email },
      ipDeTest()
    );
    expect(statut).toBe(200);
    expect(JSON.stringify(corps)).toContain(REPONSE_NEWSLETTER);

    // Conséquence observable en base : la ligne existe, en attente de
    // double opt-in, avec un jeton de confirmation. L'email n'est pas parti
    // (mode développement) : on ne vérifie que la tentative.
    const lignes = await selectionner<{
      status: string;
      source: string | null;
      confirmation_token: string | null;
    }>(
      "select status, source, confirmation_token from newsletter_subscribers where email = $1",
      [email]
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.status).toBe("pending");
    expect(lignes[0]!.source).toBe("portal");
    expect(lignes[0]!.confirmation_token).toBeTruthy();
  });

  test("@P0 réinscrire une adresse déjà inscrite renvoie le même message et ne duplique rien", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const email = `e2e-portail-news-${suffixe()}@platinum-cbd-cup.test`;
    const ip = ipDeTest();

    const premier = await appelerTrpc(page, "newsletter.subscribe", { email }, ip);
    const second = await appelerTrpc(page, "newsletter.subscribe", { email }, ip);

    // Anti-énumération : la réponse ne doit pas révéler que l'adresse était
    // déjà connue. La contre-épreuve est le premier appel, sur une adresse
    // réellement nouvelle.
    expect(JSON.stringify(second.corps)).toContain(REPONSE_NEWSLETTER);
    expect(JSON.stringify(second.corps)).toBe(JSON.stringify(premier.corps));

    const lignes = await selectionner<{ n: string }>(
      "select count(*)::text as n from newsletter_subscribers where email = $1",
      [email]
    );
    expect(Number(lignes[0]!.n), "doublon créé en base").toBe(1);
  });

  test("@P1 une adresse invalide est rejetée et n'écrit rien", async ({ page }) => {
    test.setTimeout(60_000);
    const email = `e2e-portail-invalide-${suffixe()}`;
    const { statut, corps } = await appelerTrpc(
      page,
      "newsletter.subscribe",
      { email },
      ipDeTest()
    );

    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toContain("Email invalide");

    const lignes = await selectionner<{ n: string }>(
      "select count(*)::text as n from newsletter_subscribers where email = $1",
      [email]
    );
    expect(Number(lignes[0]!.n)).toBe(0);
  });

  test("@P1 l'endpoint public d'inscription est plafonné en débit", async ({ page }) => {
    test.setTimeout(60_000);
    // Même adresse à chaque appel : aucun abonné supplémentaire n'est créé,
    // seul le compteur de débit bouge.
    const email = `e2e-portail-debit-${suffixe()}@platinum-cbd-cup.test`;
    const ip = ipDeTest();

    const statuts: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuts.push(
        (await appelerTrpc(page, "newsletter.subscribe", { email }, ip)).statut
      );
    }

    // Contre-épreuve incluse : les cinq premiers appels DOIVENT passer,
    // sinon un plafond réglé trop bas ferait passer ce test à tort.
    expect(statuts.slice(0, 5), `statuts observés : ${statuts.join(", ")}`).toEqual([
      200, 200, 200, 200, 200,
    ]);
    expect(statuts[5], "le sixième appel doit être refusé").toBe(429);
  });
});

// ---------------------------------------------------------------------------
// 9. Coquille du portail : navigation et pied de page
// ---------------------------------------------------------------------------

test.describe("Coquille du portail", () => {
  test("@P1 la navigation principale et les liens légaux sont servis sur chaque page publique", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    for (const chemin of ["/", "/palmares", "/contact", "/reglement"]) {
      await page.goto(chemin);
      await expect(
        page.getByRole("navigation", { name: /navigation principale/i })
      ).toBeVisible();

      const legaux = page.getByRole("navigation", { name: /liens l[ée]gaux/i });
      for (const href of ["/reglement", "/mentions-legales", "/confidentialite"]) {
        await expect(legaux.locator(`a[href="${href}"]`)).toBeVisible();
      }
    }
  });

  test("@P2 le lien d'évitement mène au contenu principal", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    const evitement = page.locator('a[href="#contenu-principal"]');
    await expect(evitement).toHaveText(/aller au contenu/i);
    await expect(page.locator("#contenu-principal")).toBeAttached();
  });
});
