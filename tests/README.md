# CupMetrics Tests

## Vue d'ensemble

Ce projet utilise deux frameworks de tests :

- **Vitest** - Tests unitaires et API (736 tests)
- **Playwright** - Tests E2E (20+ tests)

## Structure des Tests

```
tests/
├── e2e/                     # Tests E2E (Playwright)
│   ├── auth.spec.ts         # Tests d'authentification
│   ├── home.spec.ts         # Tests page d'accueil
│   ├── portal.spec.ts       # Tests portal public
│   └── accessibility.spec.ts # Tests accessibilité
└── support/
    ├── fixtures/            # Fixtures Playwright
    ├── factories/           # Factories de données
    └── helpers/             # Utilitaires

src/
├── lib/validations/*.test.ts    # Tests de validation
├── server/api/routers/*.test.ts # Tests API tRPC
└── server/services/*.test.ts    # Tests services
```

## Commandes

### Tests Unitaires (Vitest)

```bash
# Exécuter tous les tests unitaires
pnpm test

# Exécuter en mode watch
pnpm test:watch
```

### Tests E2E (Playwright)

```bash
# Exécuter tous les tests E2E
pnpm test:e2e

# Exécuter avec interface UI
pnpm test:e2e:ui

# Exécuter en mode visible (headed)
pnpm test:e2e:headed

# Exécuter uniquement les tests P0 (critiques)
pnpm test:e2e:p0

# Exécuter les tests P0 et P1
pnpm test:e2e:p1
```

### Tous les Tests

```bash
pnpm test:all
```

## Priorités des Tests

Les tests sont tagués par priorité :

- **[P0]** - Critiques : Doivent toujours passer (login, inscription, pages principales)
- **[P1]** - Haute : Fonctionnalités importantes (navigation, formulaires)
- **[P2]** - Moyenne : Fonctionnalités secondaires (pages moins utilisées)
- **[P3]** - Basse : Nice-to-have (edge cases rares)

## Factories

Les factories génèrent des données de test déterministes :

```typescript
import { createTestUser } from "../support/factories/user.factory";
import { createTestCup } from "../support/factories/cup.factory";

const user = createTestUser();
const cup = createTestCup({ type: "pro" });
```

## Bonnes Pratiques

1. **Structure Given-When-Then**
   ```typescript
   test("[P0] should login successfully", async ({ page }) => {
     // GIVEN: User is on login page
     await page.goto("/login");

     // WHEN: User enters valid credentials
     await page.fill('[data-testid="email"]', "user@example.com");

     // THEN: User is redirected to dashboard
     await expect(page).toHaveURL("/dashboard");
   });
   ```

2. **Sélecteurs stables** - Préférer `data-testid` aux sélecteurs CSS

3. **Pas de hard waits** - Utiliser `expect().toBeVisible()` au lieu de `waitForTimeout()`

4. **Tests atomiques** - Une assertion principale par test

5. **Auto-cleanup** - Les fixtures nettoient automatiquement les données
