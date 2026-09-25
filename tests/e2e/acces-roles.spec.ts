import fs from "node:fs";
import path from "node:path";

import {
  test,
  expect,
  request as requeteApi,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Page,
} from "@playwright/test";

import { loginUser } from "../support/fixtures/auth.fixture";

/**
 * Matrice de contrôle d'accès — espaces authentifiés.
 *
 * La liste des routes n'est PAS recopiée : elle est déduite de l'arborescence
 * `src/app/**\/page.tsx` au chargement du module. Une route ajoutée demain
 * produit d'elle-même ses cas de test.
 *
 * Les segments dynamiques sont remplacés par des identifiants RÉELS lus dans
 * `platinum_local` (SELECT seulement). Quand aucun enregistrement n'existe
 * (les articles, aujourd'hui), la route est marquée `identifiantFictif` : le
 * volet « refus » reste intégralement vérifié — les gardes sont dans les
 * layouts, avant toute lecture de l'entité — et le volet « accès » se limite
 * à « pas d'erreur serveur, pas de sortie de l'espace ».
 *
 * Chaque refus est vérifié SUR LE CONTENU autant que sur l'URL : le corps de
 * la réponse ne doit porter ni la navigation de l'espace refusé ni le moindre
 * contenu de page. Ces assertions négatives ne sont pas creuses : les mêmes
 * marqueurs sont exigés, présents, par les contre-épreuves d'acceptation du
 * même fichier.
 */

/** Racine du dépôt : le premier parent qui porte `src/app`. */
function trouverRacine(): string {
  let repertoire = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(repertoire, "src", "app"))) return repertoire;
    const parent = path.dirname(repertoire);
    if (parent === repertoire) break;
    repertoire = parent;
  }
  throw new Error(`racine du dépôt introuvable depuis ${process.cwd()}`);
}

const RACINE = trouverRacine();
const REPERTOIRE_APP = path.join(RACINE, "src", "app");
const URL_BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const MOT_DE_PASSE = "E2e-Platinum!2026";

type Profil = "anonyme" | "organisateur" | "jure" | "producteur";

const COMPTES: Record<Exclude<Profil, "anonyme">, string> = {
  organisateur: "e2e-organisateur@platinum-cbd-cup.test",
  jure: "e2e-jure@platinum-cbd-cup.test",
  producteur: "e2e-producteur@platinum-cbd-cup.test",
};

interface Espace {
  cle: "dashboard" | "jury" | "producteur";
  prefixe: string;
  /** Suffixe du <title> posé par le layout protégé de l'espace. */
  titre: string;
  /** aria-label de la navigation propre à l'espace. */
  nav: string;
  /** Rôles que le layout de l'espace laisse entrer. */
  rolesAcceptes: Role[];
}

/** Rôles au sens de `getUserPortalAccess`, nommés en français. */
type Role = "organisateur" | "producteur" | "jure";

const ESPACES: Espace[] = [
  {
    cle: "dashboard",
    prefixe: "/dashboard",
    titre: "Organisateur",
    nav: "Navigation organisateur",
    rolesAcceptes: ["organisateur"],
  },
  {
    cle: "jury",
    prefixe: "/jury",
    titre: "Jury",
    nav: "Navigation jury",
    rolesAcceptes: ["jure", "organisateur"],
  },
  {
    cle: "producteur",
    prefixe: "/producer",
    titre: "Producteur",
    nav: "Navigation producteur",
    rolesAcceptes: ["producteur", "organisateur"],
  },
];

/**
 * `/jury/public/[token]` est l'exception publique déclarée par le middleware
 * (PROTECTED_PUBLIC_EXCEPTIONS). Elle est sortie de la matrice et vérifiée à
 * part — c'est elle qui prouve que « protégé » n'est pas vrai partout par
 * construction.
 */
const EXCEPTIONS_PUBLIQUES = ["/jury/public"];

const CODES_REDIRECTION = [301, 302, 303, 307, 308];

const LIBELLES: Record<Profil, string> = {
  anonyme: "anonyme",
  organisateur: "organisateur",
  jure: "juré",
  producteur: "producteur",
};

function enumerer(profils: readonly Profil[]): string {
  return profils.map((p) => LIBELLES[p]).join(" et ");
}

/* ------------------------------------------------------------------ */
/* Découverte des routes depuis l'arborescence                         */
/* ------------------------------------------------------------------ */

function listerPages(repertoire: string, trouvees: string[] = []): string[] {
  for (const entree of fs.readdirSync(repertoire, { withFileTypes: true })) {
    const complet = path.join(repertoire, entree.name);
    if (entree.isDirectory()) {
      listerPages(complet, trouvees);
    } else if (entree.name === "page.tsx" || entree.name === "page.jsx") {
      trouvees.push(complet);
    }
  }
  return trouvees;
}

/** `src/app/(dashboard)/dashboard/cups/[cupId]/page.tsx` → `/dashboard/cups/[cupId]` */
function cheminUrl(fichier: string): string {
  const relatif = path
    .relative(REPERTOIRE_APP, fichier)
    .replace(/\\/g, "/")
    .replace(/\/page\.(tsx|jsx)$/, "");
  const segments = relatif
    .split("/")
    .filter((s) => s.length > 0 && !/^\(.*\)$/.test(s));
  return "/" + segments.join("/");
}

function sousPrefixe(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

interface RouteDecouverte {
  gabarit: string;
  espace: Espace;
  parametres: string[];
}

const ROUTES: RouteDecouverte[] = (() => {
  const brutes = [...new Set(listerPages(REPERTOIRE_APP).map(cheminUrl))].sort();
  const retenues: RouteDecouverte[] = [];
  for (const gabarit of brutes) {
    if (EXCEPTIONS_PUBLIQUES.some((p) => sousPrefixe(gabarit, p))) continue;
    const espace = ESPACES.find((e) => sousPrefixe(gabarit, e.prefixe));
    if (!espace) continue;
    retenues.push({
      gabarit,
      espace,
      parametres: [...gabarit.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!),
    });
  }
  return retenues;
})();

/* ------------------------------------------------------------------ */
/* Identifiants réels, lus en base (SELECT uniquement)                 */
/* ------------------------------------------------------------------ */

interface EtatBase {
  identifiants: Record<string, string>;
  /** Rôles réellement détenus par chaque compte de test. */
  rolesDesComptes: Record<string, string[]>;
  nomBase: string | null;
  erreur: string | null;
}

function urlBaseLocale(): string | null {
  const fichier = path.join(RACINE, ".env.local");
  if (!fs.existsSync(fichier)) return null;
  for (const ligne of fs.readFileSync(fichier, "utf8").split("\n")) {
    const m = /^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/.exec(ligne);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function lireLaBase(): Promise<EtatBase> {
  const etat: EtatBase = {
    identifiants: {},
    rolesDesComptes: {},
    nomBase: null,
    erreur: null,
  };
  const url = urlBaseLocale();
  if (!url) {
    etat.erreur = ".env.local ne déclare pas DATABASE_URL";
    return etat;
  }
  const nom = new URL(url).pathname.replace(/^\//, "");
  etat.nomBase = nom;
  // Garde-fou : on ne lit JAMAIS la base de production.
  if (nom !== "platinum_local") {
    etat.erreur = `base inattendue « ${nom} » — lecture refusée`;
    return etat;
  }

  const { Client } = (await import("pg")) as typeof import("pg");
  const client = new Client({ connectionString: url });
  try {
    await client.connect();

    const triplet = await client.query<{
      cup_id: string;
      category_id: string;
      product_id: string;
    }>(
      // Les cups préfixées E2E- appartiennent aux autres campagnes en cours et
      // peuvent disparaître pendant le run : on prend la plus ancienne cup du
      // jeu restauré, stable d'une exécution à l'autre.
      `select c.id as cup_id, cat.id as category_id, p.id as product_id
         from products p
         join categories cat on cat.id = p.category_id
         join cups c on c.id = cat.cup_id
        where c.name not like 'E2E-%'
        order by c.created_at, cat.id, p.id
        limit 1`
    );
    if (triplet.rows[0]) {
      etat.identifiants.cupId = triplet.rows[0].cup_id;
      etat.identifiants.categoryId = triplet.rows[0].category_id;
      etat.identifiants.productId = triplet.rows[0].product_id;
    }

    const article = await client.query<{ id: string }>(
      `select id from articles order by id limit 1`
    );
    if (article.rows[0]) etat.identifiants.articleId = article.rows[0].id;

    const emails = Object.values(COMPTES);
    const roles = await client.query<{ email: string; role: string }>(
      `select u.email,
              case when u.is_admin or u.role = 'organizer' then 'organisateur' end as role
         from users u where u.email = any($1::text[])
       union all
       select u.email, 'producteur' from users u
         join producers pr on pr.user_id = u.id where u.email = any($1::text[])
       union all
       select u.email, 'jure' from users u
         join jury_profiles jp on jp.user_id = u.id where u.email = any($1::text[])`,
      [emails]
    );
    for (const email of emails) etat.rolesDesComptes[email] = [];
    for (const l of roles.rows) {
      if (l.role) etat.rolesDesComptes[l.email]?.push(l.role);
    }
  } catch (e) {
    etat.erreur = e instanceof Error ? e.message : String(e);
  } finally {
    await client.end().catch(() => undefined);
  }
  return etat;
}

/* ------------------------------------------------------------------ */
/* Rôles réellement détenus — lus AVANT la collecte des tests          */
/* ------------------------------------------------------------------ */

/**
 * La base est partagée entre plusieurs campagnes qui tournent en même temps :
 * une spec voisine qui active un code jury donne un profil juré au compte
 * qu'elle utilise. On ne répare pas l'environnement (ce serait écrire dans la
 * base d'autrui) — on lit les rôles effectivement détenus et on en DÉDUIT la
 * matrice attendue. Le contrat d'origine (un compte = un rôle) reste vérifié
 * par un test dédié, qui vire au rouge si la dérive a eu lieu.
 *
 * `await` de premier niveau : la découverte doit être faite au chargement du
 * module, avant que Playwright ne fige la liste des tests.
 */
const base: EtatBase = await lireLaBase();

/** Ce que les trois comptes de test sont censés détenir, et rien d'autre. */
const ROLES_ATTENDUS: Record<Exclude<Profil, "anonyme">, Role[]> = {
  organisateur: ["organisateur"],
  jure: ["jure"],
  producteur: ["producteur"],
};

function rolesDe(profil: Exclude<Profil, "anonyme">): Role[] {
  const lus = base.rolesDesComptes[COMPTES[profil]];
  // Base injoignable : on retombe sur le contrat déclaré plutôt que de
  // fabriquer une matrice vide qui passerait sans rien prouver.
  return (lus && lus.length > 0 ? lus : ROLES_ATTENDUS[profil]) as Role[];
}

function autorisesDe(espace: Espace): Exclude<Profil, "anonyme">[] {
  return (["organisateur", "jure", "producteur"] as const).filter((profil) =>
    rolesDe(profil).some((r) => espace.rolesAcceptes.includes(r))
  );
}

function refusesDe(espace: Espace): Exclude<Profil, "anonyme">[] {
  const autorises = autorisesDe(espace);
  return (["organisateur", "jure", "producteur"] as const).filter(
    (profil) => !autorises.includes(profil)
  );
}

/* ------------------------------------------------------------------ */
/* Contextes authentifiés                                              */
/* ------------------------------------------------------------------ */

const contextes: Partial<Record<Profil, APIRequestContext>> = {};
const etatsSession: Partial<Record<Exclude<Profil, "anonyme">, unknown>> = {};

async function ouvrirSession(
  navigateur: Browser,
  profil: Exclude<Profil, "anonyme">
) {
  const contexte = await navigateur.newContext({ baseURL: URL_BASE });
  const page = await contexte.newPage();
  // Le helper partagé assertionne la redirection avec le délai d'attente par
  // défaut (5 s). En mode développement, Next compile la page d'arrivée à la
  // volée et dépasse ce délai au premier passage. On lui laisse la saisie —
  // ce sont les vrais sélecteurs du formulaire — puis on réassertionne
  // nous-mêmes, plus patiemment, sans toucher au fichier partagé.
  await loginUser(page, COMPTES[profil], MOT_DE_PASSE).catch(() => undefined);
  await expect(
    page,
    `connexion de ${LIBELLES[profil]} (${COMPTES[profil]})`
  ).toHaveURL(/\/(dashboard|producer\/dashboard|jury\/dashboard)/, {
    timeout: 120_000,
  });
  const etat = await contexte.storageState();
  await contexte.close();
  etatsSession[profil] = etat;
  contextes[profil] = await requeteApi.newContext({
    baseURL: URL_BASE,
    storageState: etat,
  });
}

// Serveur de développement : la première visite d'une route la compile. Les
// délais par défaut (30 s) ne tiennent pas sur une cinquantaine de routes
// froides, et un test rouge pour cause de compilation ne prouverait rien.
test.beforeEach(() => {
  test.setTimeout(120_000);
});

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  contextes.anonyme = await requeteApi.newContext({ baseURL: URL_BASE });
  for (const profil of ["organisateur", "jure", "producteur"] as const) {
    await ouvrirSession(browser, profil);
  }
});

test.afterAll(async () => {
  for (const c of Object.values(contextes)) await c?.dispose();
});

/* ------------------------------------------------------------------ */
/* Outils d'assertion                                                  */
/* ------------------------------------------------------------------ */

function cheminConcret(route: RouteDecouverte): {
  chemin: string;
  fictif: boolean;
} {
  let fictif = false;
  let chemin = route.gabarit;
  for (const parametre of route.parametres) {
    const reel = base.identifiants[parametre];
    if (reel) {
      chemin = chemin.replace(`[${parametre}]`, reel);
    } else {
      fictif = true;
      chemin = chemin.replace(`[${parametre}]`, `E2E-inexistant-${parametre}`);
    }
  }
  return { chemin, fictif };
}

async function appeler(profil: Profil, chemin: string): Promise<APIResponse> {
  const contexte = contextes[profil];
  if (!contexte) throw new Error(`contexte manquant pour ${profil}`);
  // Le serveur de développement est partagé avec d'autres campagnes : il lui
  // arrive de couper une connexion en pleine recompilation (« aborted »). Une
  // coupure de transport n'est pas un résultat de contrôle d'accès — on la
  // rejoue une fois. Un vrai refus, lui, revient identique.
  try {
    return await contexte.get(chemin, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
  } catch (premiereErreur) {
    if (!/aborted|socket hang up|ECONNRESET/i.test(String(premiereErreur))) {
      throw premiereErreur;
    }
    return contexte.get(chemin, { maxRedirects: 0, failOnStatusCode: false });
  }
}

function titreDuDocument(html: string): string | null {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
}

function destination(reponse: APIResponse): string {
  const brut = reponse.headers()["location"] ?? "";
  return new URL(brut, URL_BASE).pathname;
}

/**
 * Un refus ne doit RIEN rendre : ni la navigation d'un espace authentifié, ni
 * la moindre coquille de page.
 *
 * `<main` est le marqueur retenu : il est présent dans CHAQUE réponse servie
 * — le volet « accès » de chaque route l'exige explicitement — et absent de
 * chaque refus. Chercher son absence n'est donc pas une tournure creuse.
 *
 * Réserve documentée : la redirection émise par un layout serveur (rôle
 * refusé) est un 307 dont le corps est la coquille d'erreur de Next — un
 * `<html id="__next_error__">` sans contenu, qui ne porte que les balises
 * `<meta>`/`<title>` statiques du layout. Le navigateur suit la redirection et
 * ne la peint jamais ; on ne l'assimile pas à une fuite, mais on exige qu'elle
 * reste vide de toute structure.
 */
function aucuneFuiteDansLeCorps(corps: string, contexte: string) {
  for (const espace of ESPACES) {
    expect
      .soft(corps, `${contexte} : la nav « ${espace.nav} » a fuité`)
      .not.toContain(espace.nav);
  }
  expect
    .soft(
      /<main[\s>]/i.test(corps),
      `${contexte} : un contenu de page a été rendu avant la redirection`
    )
    .toBe(false);
}

/* ------------------------------------------------------------------ */
/* 0. Préconditions — sans elles la matrice ne prouverait rien         */
/* ------------------------------------------------------------------ */

test("la base lue est platinum_local et chaque compte de test ne détient toujours qu'un seul rôle", async () => {
  expect(base.erreur, `lecture de la base impossible : ${base.erreur}`).toBeNull();
  expect(base.nomBase).toBe("platinum_local");
  // Si ce test est rouge, la matrice ci-dessous s'est adaptée aux rôles
  // réellement détenus : elle reste juste, mais elle couvre moins.
  expect(
    {
      organisateur: [...rolesDe("organisateur")].sort(),
      jure: [...rolesDe("jure")].sort(),
      producteur: [...rolesDe("producteur")].sort(),
    },
    "un compte de test a acquis un rôle supplémentaire (profil créé par une autre campagne sur la base partagée)"
  ).toEqual({
    organisateur: ["organisateur"],
    jure: ["jure"],
    producteur: ["producteur"],
  });
});

test("chaque espace garde au moins un profil refusé : un garde-fou qui laisserait tout passer serait détecté", async () => {
  for (const espace of ESPACES) {
    expect(
      refusesDe(espace),
      `${espace.prefixe} : plus aucun compte de test ne se voit refuser l'entrée, le refus n'est plus éprouvé`
    ).not.toEqual([]);
  }
});

test("l'arborescence expose bien les trois espaces authentifiés avec leurs routes", async () => {
  const parEspace = (cle: Espace["cle"]) =>
    ROUTES.filter((r) => r.espace.cle === cle).length;
  expect(parEspace("dashboard")).toBeGreaterThanOrEqual(30);
  expect(parEspace("jury")).toBeGreaterThanOrEqual(10);
  expect(parEspace("producteur")).toBeGreaterThanOrEqual(7);
  // Les faux positifs de préfixe doivent rester dehors.
  expect(ROUTES.map((r) => r.gabarit)).not.toContain("/jury-invite/[token]");
  expect(ROUTES.map((r) => r.gabarit)).not.toContain("/jury/public/[token]");
});

/* ------------------------------------------------------------------ */
/* 1. La matrice, route par route                                      */
/* ------------------------------------------------------------------ */

for (const route of ROUTES) {
  const { espace } = route;
  const refuses = refusesDe(espace);
  const autorises = autorisesDe(espace);

  test(`${route.gabarit} — anonyme renvoyé vers /login${
    refuses.length
      ? `, ${enumerer(refuses)} ${refuses.length > 1 ? "refusés" : "refusé"} sans fuite de contenu`
      : ""
  }, ${enumerer(autorises)} ${autorises.length > 1 ? "servis" : "servi"}`, async () => {
    const { chemin, fictif } = cheminConcret(route);

    /* --- anonyme : redirection vers /login en conservant la cible --- */
    const anonyme = await appeler("anonyme", chemin);
    expect
      .soft(
        CODES_REDIRECTION,
        `anonyme sur ${chemin} : ${anonyme.status()} au lieu d'une redirection`
      )
      .toContain(anonyme.status());
    if (CODES_REDIRECTION.includes(anonyme.status())) {
      const cible = new URL(anonyme.headers()["location"] ?? "", URL_BASE);
      expect.soft(cible.pathname).toBe("/login");
      expect
        .soft(
          cible.searchParams.get("callbackUrl"),
          "la cible demandée doit être conservée pour l'après-connexion"
        )
        .toBe(chemin);
    }
    aucuneFuiteDansLeCorps(await anonyme.text(), `anonyme sur ${chemin}`);

    /* --- rôles refusés : redirection hors de l'espace, corps vide --- */
    for (const profil of refuses) {
      const reponse = await appeler(profil, chemin);
      const etiquette = `${LIBELLES[profil]} sur ${chemin}`;

      expect
        .soft(reponse.status(), `${etiquette} : erreur serveur`)
        .toBeLessThan(500);
      expect
        .soft(
          CODES_REDIRECTION,
          `${etiquette} : ${reponse.status()} au lieu d'une redirection ou d'une page d'erreur explicite`
        )
        .toContain(reponse.status());

      if (CODES_REDIRECTION.includes(reponse.status())) {
        const vers = destination(reponse);
        expect
          .soft(
            sousPrefixe(vers, espace.prefixe),
            `${etiquette} : renvoyé vers ${vers}, toujours dans l'espace interdit`
          )
          .toBe(false);
        // Les layouts documentent l'invariant : jamais /login pour un compte
        // authentifié, sous peine de boucle (login redirige selon le rôle).
        expect
          .soft(vers, `${etiquette} : renvoyé vers /login — boucle de connexion`)
          .not.toBe("/login");
      }

      aucuneFuiteDansLeCorps(await reponse.text(), etiquette);
    }

    /* --- rôles autorisés : la page de l'espace, vraiment servie --- */
    for (const profil of autorises) {
      const reponse = await appeler(profil, chemin);
      const etiquette = `${LIBELLES[profil]} sur ${chemin}`;

      expect
        .soft(reponse.status(), `${etiquette} : erreur serveur`)
        .toBeLessThan(500);

      if (CODES_REDIRECTION.includes(reponse.status())) {
        // Redirection interne tolérée (ex. /jury/profile → /jury/profile/edit).
        expect
          .soft(
            sousPrefixe(destination(reponse), espace.prefixe),
            `${etiquette} : éjecté vers ${destination(reponse)}`
          )
          .toBe(true);
        continue;
      }

      expect.soft(reponse.status(), etiquette).toBe(200);
      const corps = await reponse.text();
      const titre = titreDuDocument(corps);
      expect
        .soft(titre, `${etiquette} : aucun <title>, page blanche probable`)
        .not.toBeNull();
      if (fictif) {
        // Identifiant inventé : on n'exige que l'absence de sortie d'espace.
        continue;
      }
      expect
        .soft(titre ?? "", `${etiquette} : ce n'est pas une page de l'espace`)
        .toContain(espace.titre);
      expect
        .soft(
          /<main[\s>]/i.test(corps),
          `${etiquette} : aucun contenu principal, page blanche`
        )
        .toBe(true);
      for (const autre of ESPACES.filter((e) => e.cle !== espace.cle)) {
        expect
          .soft(corps, `${etiquette} : la nav « ${autre.nav} » a fuité`)
          .not.toContain(autre.nav);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2. Contre-épreuve : l'exception publique n'est PAS protégée         */
/* ------------------------------------------------------------------ */

test("/jury/public/[token] reste public : un anonyme y accède au lieu d'être renvoyé vers /login", async () => {
  const reponse = await appeler(
    "anonyme",
    `/jury/public/E2E-token-${Date.now().toString(36)}`
  );
  expect(reponse.status()).toBe(200);
  expect(titreDuDocument(await reponse.text()) ?? "").toContain("Jury");
});

/* ------------------------------------------------------------------ */
/* 3. Vérification en navigateur : pas d'affichage fugace              */
/* ------------------------------------------------------------------ */

async function chaineDeDocuments(page: Page, chemin: string) {
  const reponse = await page.goto(chemin, { waitUntil: "domcontentloaded" });
  const etapes: { chemin: string; code: number }[] = [];
  let requete = reponse?.request() ?? null;
  while (requete) {
    const r = await requete.response();
    etapes.unshift({
      chemin: new URL(requete.url()).pathname,
      code: r?.status() ?? 0,
    });
    requete = requete.redirectedFrom();
  }
  return etapes;
}

async function pageDe(
  navigateur: Browser,
  profil: Exclude<Profil, "anonyme">
) {
  const contexte = await navigateur.newContext({
    baseURL: URL_BASE,
    storageState: etatsSession[profil] as never,
  });
  return { contexte, page: await contexte.newPage() };
}

for (const espace of ESPACES) {
  const refuses = refusesDe(espace);
  const vitrine = `${espace.prefixe}${
    espace.cle === "dashboard" ? "" : "/dashboard"
  }`;

  for (const profil of refuses) {
    test(`navigateur — ${LIBELLES[profil]} sur ${vitrine} : aucun document de l'espace n'est servi en 200 et la nav « ${espace.nav} » n'apparaît jamais`, async ({
      browser,
    }) => {
      const { contexte, page } = await pageDe(browser, profil);
      try {
        const etapes = await chaineDeDocuments(page, vitrine);
        const fuites = etapes.filter(
          (e) => sousPrefixe(e.chemin, espace.prefixe) && e.code === 200
        );
        expect(
          fuites,
          `documents servis en 200 sous ${espace.prefixe} : ${JSON.stringify(
            etapes
          )}`
        ).toEqual([]);

        await page.waitForLoadState("networkidle");
        expect(new URL(page.url()).pathname).not.toBe(vitrine);
        await expect(
          page.locator(`nav[aria-label="${espace.nav}"]`)
        ).toHaveCount(0, { timeout: 15_000 });
        await expect(page).not.toHaveTitle(new RegExp(espace.titre), {
          timeout: 15_000,
        });
      } finally {
        await contexte.close();
      }
    });
  }

  for (const profil of autorisesDe(espace)) {
    test(`navigateur — ${LIBELLES[profil]} sur ${vitrine} : la page s'affiche avec la nav « ${espace.nav} »`, async ({
      browser,
    }) => {
      const { contexte, page } = await pageDe(browser, profil);
      try {
        await page.goto(vitrine);
        await expect(page).toHaveURL(new RegExp(`${vitrine}$`), {
          timeout: 60_000,
        });
        await expect(
          page.locator(`nav[aria-label="${espace.nav}"]`).first()
        ).toBeVisible({ timeout: 60_000 });
        await expect(page).toHaveTitle(new RegExp(espace.titre), {
          timeout: 15_000,
        });
      } finally {
        await contexte.close();
      }
    });
  }

  test(`navigateur — anonyme sur ${vitrine} : formulaire de connexion affiché, cible mémorisée`, async ({
    page,
  }) => {
    await page.goto(vitrine);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?callbackUrl=${encodeURIComponent(vitrine)}`, "i"),
      { timeout: 60_000 }
    );
    await expect(page.locator('input[id="email"]')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator(`nav[aria-label="${espace.nav}"]`)).toHaveCount(0);
  });
}

/* ------------------------------------------------------------------ */
/* 4. Le cas à part : /producer/complete-profile                       */
/* ------------------------------------------------------------------ */

test.describe("/producer/complete-profile", () => {
  test("un juré n'y a pas accès et est renvoyé vers son propre espace", async () => {
    const reponse = await appeler("jure", "/producer/complete-profile");
    expect(CODES_REDIRECTION).toContain(reponse.status());
    expect(destination(reponse)).toBe("/jury");
    aucuneFuiteDansLeCorps(await reponse.text(), "juré sur complete-profile");
  });

  test("un anonyme y est renvoyé vers /login comme sur le reste de l'espace producteur", async () => {
    const reponse = await appeler("anonyme", "/producer/complete-profile");
    expect(CODES_REDIRECTION).toContain(reponse.status());
    const cible = new URL(reponse.headers()["location"] ?? "", URL_BASE);
    expect(cible.pathname).toBe("/login");
    expect(cible.searchParams.get("callbackUrl")).toBe(
      "/producer/complete-profile"
    );
  });

  test("la garde serveur laisse bien passer un producteur : la page est servie en 200", async () => {
    const reponse = await appeler("producteur", "/producer/complete-profile");
    expect(reponse.status()).toBe(200);
    expect(titreDuDocument(await reponse.text()) ?? "").toContain("Producteur");
  });

  test("un producteur qui ouvre la page en arrivant d'ailleurs y reste et voit le formulaire", async ({
    browser,
  }) => {
    // Le layout producteur (src/app/producer/layout.tsx) envoie ICI tout
    // producteur sans profil. La page doit donc rester utilisable pour qui
    // l'ouvre directement — nouvel appareil, stockage vidé, lien reçu par
    // courriel.
    //
    // Observé : la page est bien servie en 200 (cf. test précédent), puis
    // l'effet de `src/app/producer/complete-profile/page.tsx` ne trouve pas la
    // clé `producer_pending_profile` dans localStorage, affiche « Aucun profil
    // en attente » et fait `router.push("/")`. Le formulaire n'est jamais
    // atteignable autrement qu'en enchaînant sur l'inscription dans le même
    // navigateur.
    const { contexte, page } = await pageDe(browser, "producteur");
    try {
      await page.goto("/producer/complete-profile");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/producer\/complete-profile$/, {
        timeout: 15_000,
      });
      await expect(page.locator('input[id="companyName"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator('input[id="brandName"]')).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await contexte.close();
    }
  });
});
