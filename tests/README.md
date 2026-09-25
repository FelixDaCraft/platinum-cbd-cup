# Tests — Platinum CBD Cup

Deux suites, deux rôles distincts :

| Suite | Outil | Ce qu'elle couvre | Base de données |
|---|---|---|---|
| Unitaire / intégration | Vitest | schémas Zod, services, routeurs tRPC | aucune (`~/server/db` est mocké) |
| Bout en bout | Playwright | parcours publics rendus par un serveur réel | base peuplée, lecture seule |

Les chiffres de couverture ne sont volontairement pas recopiés ici : ils
dérivent à chaque commit. `pnpm test` affiche le compte réel.

## Où vivent les tests

```
src/
├── lib/validations/*.test.ts        # schémas Zod (auth, publish)
├── server/services/**/*.test.ts     # services (facture, anonymisation, emails…)
├── app/api/**/*.test.ts             # handlers de route (webhook Viva, upload)
└── server/api/routers/**/*.test.ts  # routeurs tRPC

tests/
├── e2e/
│   ├── home.spec.ts           # page d'accueil
│   ├── public-pages.spec.ts   # routes publiques du groupe (portal)
│   ├── auth.spec.ts           # login / register / mot de passe oublié / gardes
│   └── accessibility.spec.ts  # structure du document, labels, alternatives
└── support/
    ├── fixtures/auth.fixture.ts   # helpers loginUser / registerUser / logoutUser
    ├── factories/                 # jeux de données déterministes
    └── helpers/wait-for.ts        # polling / retry
```

Vitest ne ramasse que `src/**/*.test.ts` (`vitest.config.ts`) : un test placé
sous `tests/` avec l'extension `.test.ts` ne serait jamais exécuté. Playwright
ne lit que `tests/e2e` (`playwright.config.ts`).

## Commandes

```bash
pnpm test          # Vitest, une passe
pnpm test:watch    # Vitest en mode watch
pnpm test:e2e      # Playwright, tous les tests
pnpm test:e2e:ui   # Playwright, interface interactive
pnpm test:e2e:p0   # uniquement les cas critiques (--grep '@P0')
pnpm test:e2e:p1   # critiques + hauts (--grep '@P0|@P1')
pnpm test:all      # Vitest puis Playwright
```

Premier lancement Playwright sur un poste neuf :

```bash
pnpm exec playwright install --with-deps chromium
```

Par défaut Playwright démarre `pnpm dev` et attaque `http://localhost:3000`.
Pour viser une instance déjà lancée (conteneur, préprod), poser `E2E_BASE_URL` :
aucun serveur n'est alors démarré.

```bash
E2E_BASE_URL=http://127.0.0.1:3017 pnpm test:e2e
```

## Priorités

Le tag fait partie du **titre** du test, au format `@P0` — c'est ce que
`--grep` filtre. L'ancienne convention `[P0]` ne correspondait à rien : les
scripts `test:e2e:p0`/`p1` ne sélectionnaient aucun test et sortaient en
succès.

- `@P0` — le lancement est bloqué si ça casse : accueil, liste des concours,
  formulaire de connexion, redirection des espaces authentifiés.
- `@P1` — fonctionnel important : validation des formulaires, pages légales,
  accessibilité des champs.
- `@P2` — secondaire : pages de contenu, pied de page, routes supprimées du
  fork qui doivent rester en 404.

## Conventions

**Sélecteurs.** Il n'y a *aucun* `data-testid` dans `src/` et ce n'est pas un
oubli : on cible par rôle ARIA (`getByRole`), par label, ou par l'`id` que le
formulaire rend réellement (`input[id="email"]`). Un test qui passe parce
qu'il vise un attribut ajouté pour lui ne dit rien de ce que l'utilisateur
perçoit.

**Assertions qui peuvent échouer.** `expect(await page.title()).toBeTruthy()`
ou `expect(page.locator("body")).toBeVisible()` passent sur un 404 comme sur
la bonne page. On vérifie le statut HTTP (`response?.status()`), l'URL finale
et un repère structurel (`main`, `h1`).

**Pas d'écriture depuis les E2E.** Les specs supposent une base peuplée et ne
créent, ne modifient ni ne suppriment aucune donnée. Il n'existe
volontairement pas de fixture « page authentifiée » : il faudrait un accès
base et un email vérifié. `auth.fixture.ts` fournit les helpers de parcours,
pas de la donnée persistée.

**Pas d'attente fixe.** `expect(...).toBeVisible()` plutôt que
`waitForTimeout`. `tests/support/helpers/wait-for.ts` couvre les cas de
polling hors navigateur.

**Factories typées depuis le schéma.** `cup.factory.ts` importe `CupType`,
`RatingScale` et `Currency` de `~/server/db/schema/cups` : une évolution du
schéma casse le typecheck des tests au lieu de les laisser mentir.

## Tests de routeur tRPC

Un routeur se teste par `createCaller`, pas en recopiant sa règle métier dans
l'assertion. Le motif utilisé dans `src/server/api/routers/**/*.test.ts` :

```typescript
vi.mock("~/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("~/server/db", () => ({ db: /* … query builders mockés … */ }));

const { categoryRouter } = await import("../category");
const caller = categoryRouter.createCaller({ headers: new Headers(), db } as never);

await expect(caller.create({ /* … */ })).rejects.toThrow(TRPCError);
```

`vi.mock` est remonté au-dessus des imports par Vitest : les valeurs de retour
doivent passer par `vi.hoisted` ou être posées dans un `beforeEach`, jamais
capturées dans une variable de module.

**Chaque routeur commence par son garde de rôle.** Avant toute assertion
métier, on vérifie que l'anonyme reçoit `UNAUTHORIZED` et qu'un producteur ou
un juré reçoit `FORBIDDEN` sur *chacune* des procédures réservées — puis que
rien n'a été écrit (`inserted`/`updates`/`deleted` vides). Un garde posé sur
huit procédures sur neuf ne se voit pas autrement.

**Procédures limitées en débit.** Les seaux de `makeRateLimitMiddleware` sont
des `Map` de module, partagées par tous les tests du processus. Un test qui
exerce la limite doit donc :

1. poser un en-tête `cf-connecting-ip` dans le contexte du caller — sans IP,
   le middleware laisse passer (voir le commentaire de `clientKey`) ;
2. utiliser une IP qui n'appartient qu'à lui, sinon les appels d'un autre test
   consomment son quota et le résultat dépend de l'ordre d'exécution.

Le motif est en place dans `newsletter.test.ts` et `contact-messages.test.ts`
(`nextIp()` pour les tests ordinaires, une IP littérale pour celui qui pousse
jusqu'au `TOO_MANY_REQUESTS`).

Ce qu'il ne faut pas réintroduire : les blocs « Business Logic » et
« Multi-tenancy Validation » de l'ancienne suite CupMetrics comparaient deux
littéraux définis dans le test lui-même (`expect("org-1").toBe("org-1")`) et
n'importaient jamais le routeur. Le modèle multi-tenant n'existe plus dans ce
fork : aucun test ne doit parler d'`organizationId`.

## Intégration continue

Le workflow de déploiement enchaîne `pnpm typecheck` puis `pnpm test`
(Vitest). **Playwright n'y est pas lancé** : un job E2E demande un service
Postgres, une base peuplée et `playwright install`. Tant que ce job n'existe
pas, les specs E2E sont un outil de vérification manuelle avant lancement — à
passer soi-même sur la préprod via `E2E_BASE_URL`.
