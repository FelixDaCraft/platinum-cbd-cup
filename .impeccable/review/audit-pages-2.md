# Audit technique — passe 2 : `/about`, `/reglement`, `/cups/[cupId]`

- **Date :** 16 octobre 2026
- **Branche :** `feat/design-public` (état du disque au moment de l'audit : 18 fichiers modifiés, dont les correctifs en cours de la passe 1)
- **Périmètre :** les trois routes inaccessibles en passe 1 : `/about`, `/reglement`, `/cups/GMDGknBu4e_IEq7FmKp8Z` (édition 2027).
- **Méthode :** lecture seule, aucun fichier de code modifié. Lecture du code, puis rendu réel dans Chrome (Playwright, `google-chrome-stable`) à **1440, 1280 et 390 px**. Captures après défilement complet ; mesures de styles calculés ; arbre d'accessibilité ; parcours clavier (30 tabulations par page) ; saut d'ancre du sommaire ; JavaScript désactivé ; `prefers-reduced-motion` ; impression et export PDF ; CLS et LCP.
- **Légende :** ✅ **Vérifié** dans le navigateur ou mesuré · 🔎 **Lu dans le code** · ❓ **Supposé**.
- **Hors sujet ici :** les constats de la passe 1, en cours de correction, ne sont repris que s'ils restent cassés sur ces trois pages (voir § « État des correctifs de la passe 1 »).

Les trois routes répondent en HTTP 200, en 0,2–0,3 s, sans erreur ni avertissement dans la console, à toutes les largeurs.

---

## Score de santé (trois pages)

| # | Dimension | Score | Constat principal |
|---|-----------|-------|-------------------|
| 1 | Accessibilité | 3 | Critères de notation à l'interligne 1,0 ; sinon structure, clavier et contrastes corrects |
| 2 | Performance | 4 | CLS 0,000 sur `/about` et `/cups/[id]` ; aucune charge lourde (pas d'emblème sur ces pages) |
| 3 | Thème / tokens | 2 | `/reglement` et une partie de `/about` gardent les tokens « Grand Cru » (`--fg-2` gris, `--bg-2`, `--line` or 18 %) |
| 4 | Responsive | 3 | Aucun débordement ; grille des jurys de `/about` à moitié vide en bureau |
| 5 | Cohérence d'implémentation | 2 | `/reglement` n'a pas été passée en « street » ; photos d'équipe arrondies et non bichromes |
| **Total** | | **14/20** | **Bon : quelques points faibles à reprendre** |

### Verdict de cohérence : **réussi pour `/cups/[id]`, partiel pour `/about`, échoué pour `/reglement`**

- **`/cups/[id]`** reprend fidèlement le système : `PageHead`, étiquette de statut, calendrier, catégories en tableau d'affiche, deux jurys avec échantillon.
- **`/about`** ouvre bien sur `PageHead`, mais son corps garde des briques de l'ancien thème : intertitres figés à 28 px, tuiles en gris `--fg-2`, photos arrondies.
- **`/reglement`** n'a pas été touché par le redesign (`git diff HEAD` : aucun changement). Il hérite seulement des règles globales `.shell` (titres Unbounded, prose crème). Le sommaire et les séparateurs restent ceux de `responsive/editorial-legal.ts` : boîte `--bg-2`, filets or à 18 %, titre « Sommaire » en Hanken 16 px. Or c'est la page vers laquelle pointe chaque bouton « Lire le règlement » du parcours d'inscription.

---

## Résumé

- **Score : 14/20 (bon)**
- **Constats : 0 P0 · 0 P1 · 6 P2 · 7 P3**
- **À traiter d'abord :**
  1. **P2** `/cups/[id]` : le chapô est vide, car la description de l'édition est une chaîne vide et `??` ne la remplace pas.
  2. **P2** `/cups/[id]` : les critères de notation sont serrés à l'interligne 1,0 et affichés en vrac (« 1.1 VISUEL trim · 1.2 … »), difficiles à lire, surtout sur mobile.
  3. **P2** `/reglement` n'est pas dans la direction « street » (sommaire, séparateurs, absence de `PageHead`).
  4. **P2** `/about` : en bureau, la grille des deux jurys laisse la moitié ou les deux tiers de la largeur vides.
  5. **P2** `/cups/[id]` sans JavaScript : seul le squelette de chargement s'affiche (préexistant, lié à `loading.tsx`).
- **Point d'environnement à noter :** à 1280 px, l'en-tête de `/reglement` passe encore sur deux lignes, mais c'est le serveur de dev qui sert pour cette route une **feuille de style périmée** (voir E-1). Ce n'est pas un défaut du code.

---

## Constats détaillés

### P2 — Mineur

#### [P2-1] `/cups/[id]` : chapô vide ✅
- **Emplacement :** `src/app/(portal)/cups/[cupId]/page.tsx:105` (`edition.description ?? \`Catégories, tarifs…\``), donnée issue de `src/app/(portal)/_lib/edition.ts:125` (`cup.publicPageDescription ?? cup.description`).
- **Scénario vérifié :** à 1440, 1280 et 390 px, le HTML contient `<p class="st-head-lede"></p>` et l'arbre d'accessibilité un `paragraph` vide entre l'étiquette de statut et les boutons. La description en base est une chaîne vide (`""`) ou ne contient que des espaces : `??` ne se déclenche que sur `null`/`undefined`, donc le texte de repli n'apparaît jamais.
- **Impact :** la page de l'édition, celle où le producteur décide de s'inscrire, n'a aucune phrase d'introduction sous le titre. Le paragraphe vide laisse aussi un trou (`gap: 28px` compté deux fois).
- **Correctif :** dans `edition.ts:125`, normaliser : `description: cup.publicPageDescription?.trim() || cup.description?.trim() || null` ; puis dans la page, `edition.description || …`. Ou plus simple : ne rendre le `<p>` que si le texte n'est pas vide.
- **Commande :** `/impeccable harden`

#### [P2-2] `/cups/[id]` : critères de notation illisibles (interligne 1,0, liste en vrac) ✅
- **Emplacement :** `src/components/portal/platinum/street-styles.ts:336` (`.st-cat-criteria`, sans `line-height`) imbriqué dans `.st-cat-name` (`:335`, `line-height: 1`) ; rendu dans `src/app/(portal)/_components/edition-blocks.tsx` (`CategoryPrices`, `showCriteria`).
- **Mesures :** `font-size: 15px`, **`line-height: 15px`** (hérité), couleur crème 56 % (5,7:1, contraste correct). À 390 px, chaque catégorie empile 10 à 12 lignes collées : les jambages de « VISUEL / ODEUR / GOUT » touchent la ligne suivante (`cups390.png`). À 1440 px, les retours à la ligne coupent « 3.1 / GOUT qualité ».
- **Contenu :** les critères sont des codes internes concaténés (`Jury pro : 1.1 VISUEL trim · 1.2 VISUEL trichome · … · 3.3 GOUT persistance`), avec une casse incohérente (« VISUEL », « GOUT » sans accent, « fidele » sans accent pour Fleurs Outdoor) qui vient de la base. Lecteurs d'écran : chaque élément de la liste devient une seule phrase de ~60 mots (arbre d'accessibilité).
- **Impact :** c'est le seul endroit public où le producteur découvre sur quoi il sera noté, ce qui touche directement le principe 1 de PRODUCT.md.
- **Correctif :**
  - Tout de suite : `.st-cat-criteria{ line-height: 1.5; max-width: 72ch; }`.
  - Ensuite : grouper par axe (Visuel · Odeur · Goût) dans une petite liste de définitions (`dl`), une ligne par jury, sans les numéros internes (« 1.1 »). Sur mobile, replier les critères dans un `<details>` pour ne pas allonger chaque ligne de tarif de 200 px.
  - Côté données : normaliser la casse et les accents des libellés de critères dans le back-office.
- **Commande :** `/impeccable clarify` (contenu), puis `/impeccable layout`

#### [P2-3] `/reglement` pas passé dans la direction « street » ✅
- **Emplacement :** `src/app/(portal)/reglement/page.tsx:54-75` (en-tête `pg-head` + `h1.display`, sans `PageHead`) ; styles `src/components/portal/platinum/responsive/editorial-legal.ts:18-46` (`.legal-toc` : `border-radius: 12px`, `background: var(--bg-2)`, `border: 1px solid var(--line)` ; `.legal-section` : `border-top: 1px solid var(--line)` ; `.legal-toc-list a` : `color: var(--fg-2)`).
- **Scénario vérifié :**
  - Pas de barre d'édition ni de titre liquéfié : un `h1` Unbounded de 96 px (89 px à 1280, 40 px à 390).
  - Sommaire dans une boîte `#15130f` (`--bg-2`, absent du DESIGN.md) cernée d'or à 18 %. Le `border-radius: 12px` est bien écrasé par `.shell [class]`, donc les angles sont droits.
  - Titre « Sommaire » en Hanken Grotesk 700 16 px au lieu du libellé Unbounded 11–12 px en capitales.
  - Liens du sommaire en gris `rgba(242,242,242,.62)` (`--fg-2`).
  - Articles séparés par des filets or à 18 % au lieu des filets crème de 2 px.
  - Largeurs incohérentes : sommaire 860 px, prose 705 px, filets à la largeur de la prose (`reg1440.png`).
- **Écart au DESIGN.md :** « Do : ouvrir les pages éditoriales du portail par `PageHead` » ; « aucun gris » ; « structurer par filets crème de 2 px ».
- **Correctif :** `PageHead` avec `edition="Conditions de participation"` (ou « 5e édition ✦ 2027 »), `title="Règlement"` et le chapô en `lede`. Dans `street-styles.ts`, surcharger sous `.shell` : `.legal-toc` sans fond, bordure haute et basse crème 2 px, titre en libellé Unbounded ; liens en `--st-ink-2`, survol `--st-gold-hi` ; `.legal-section + .legal-section{ border-top: 2px solid var(--st-rule) }`. `legal-page.tsx` (mentions légales, confidentialité) partage ces classes et en profitera.
- **Commande :** `/impeccable polish` (ou `/impeccable typeset` pour l'en-tête)

#### [P2-4] `/about` : grille des deux jurys à moitié vide en bureau ✅
- **Emplacement :** `src/app/(portal)/about/page.tsx:55` (`.pg-grid.pal-about-juries`) ; règle de base `platinum-styles.ts:768` (`repeat(auto-fill, minmax(300px, 1fr))`) ; la règle `repeat(2, …)` de `responsive/palmares-editions.ts:53` n'existe que dans une media query.
- **Mesures :** à 1440 px, **4 colonnes de 315 px pour 2 tuiles** : la moitié droite est vide et chaque paragraphe ne fait que ~31 caractères par ligne. À 1280 px, 3 colonnes de 379 px pour 2 tuiles. À 390 px, une colonne, correct.
- **Impact :** le bloc qui explique le cœur du concours (deux jurys) paraît inachevé et se lit comme une colonne de journal étroite. Ce sont aussi des « cartes égales encadrées », que la thèse du surface brief refuse.
- **Correctif :** `.shell .pal-about-juries{ grid-template-columns: repeat(2, minmax(0, 1fr)); }` hors media query. Mieux : réutiliser `JuriesExplainer` (déjà utilisé sur l'accueil et sur `/cups/[id]`), ce qui supprime aussi le contenu dupliqué et sa formulation différente (« box d'échantillons » ici, « coffret » ailleurs).
- **Commande :** `/impeccable layout`

#### [P2-5] `/cups/[id]` sans JavaScript : seul le squelette s'affiche ✅ (préexistant)
- **Emplacement :** `src/app/(portal)/cups/[cupId]/loading.tsx` (créé au commit `fc6c0d6`, avant le redesign).
- **Scénario vérifié :** JavaScript désactivé : `main` ne contient que « Chargement de la page… » (22 caractères). Le contenu réel arrive en streaming après `</main>`, dans un bloc caché que seul le script de Next sait remettre en place. `/about` et `/reglement` (sans `loading.tsx`) s'affichent entièrement sans JS (1 307 et 9 508 caractères).
- **Impact :** si le JavaScript échoue (bloqueur, réseau coupé en cours de chargement, vieux navigateur), la page de l'édition reste vide. Les métadonnées et Open Graph ne sont pas touchées (elles sont dans `<head>`). ❓ Google exécute le JS, donc l'indexation n'est probablement pas affectée.
- **Correctif :** supprimer `loading.tsx` sur cette route (la donnée est déjà en cache via `unstable_cache`, ~0,25 s), ou n'envelopper dans un `<Suspense>` que la partie lente (places restantes) au lieu de la page entière.
- **Commande :** `/impeccable harden`

#### [P2-6] `/about` : photos d'équipe arrondies et non bichromes ✅
- **Emplacement :** `src/app/(portal)/about/page.tsx:115-121` (`style={{ … borderRadius: 10 }}`).
- **Scénario vérifié :** `border-top-left-radius: 10px` sur les deux portraits (le style inline l'emporte sur `.shell img{border-radius:0}`) ; `filter: none`, donc les photos restent en noir et blanc d'origine, sans la bichromie nuit → or.
- **Écart au DESIGN.md :** « zéro coin arrondi, sauf pastilles et avatars » (ce sont des portraits 4:5, pas des avatars) ; « les photos réelles passent en bichromie `#st-duotone` ».
- **Correctif :** retirer `borderRadius` du style inline ; ajouter `filter: url(#st-duotone)` (le filtre est déjà posé par `StreetDefs` dans la coquille), par exemple avec une classe `.st-photo`.
- **Commande :** `/impeccable polish`

### P3 — Finition

1. **Intertitres de `/about` figés à 28 px** ✅ : `about/page.tsx:52, 66, 94` (`style={{ margin: 0, fontSize: 28 }}`). Ils écrasent l'échelle fluide `.shell .pg-section h2` (26–44 px) et le titre de section du DESIGN.md (34–76 px). Côte à côte, `/cups/[id]` affiche ses `h2` à 76 px et `/about` à 28 px. Retirer le style inline et utiliser `.st-h2`. → `/impeccable typeset`
2. **Gris `--fg-2` dans le texte des tuiles de `/about`** ✅ : `rgba(242,242,242,.62)` (`platinum-styles.ts:31, 773`) sur `.pg-tile p` et le texte de l'équipe. Le contraste passe (≈ 7,6:1) mais c'est une teinte hors palette (« aucun gris »). Surcharger `.shell .pg-tile p{ color: var(--st-ink-2); }`. → `/impeccable polish`
3. **Double `page-enter` sur `/reglement`** 🔎✅ : `reglement/page.tsx:54` ajoute `page-enter` alors que `<main>` l'a déjà (`platinum-shell.tsx`). Deux fondus de 0,4 s s'empilent (vérifié : 2 animations `fadeIn` en cours). Même chose dans `legal-page.tsx:99`. Retirer la classe des pages. → `/impeccable polish`
4. **Listes tapées à la main dans le règlement** ✅ : le contenu TipTap simule des listes avec « - » et « ● » en début de paragraphe (article 3) : les lecteurs d'écran n'annoncent pas de liste, et l'alignement est irrégulier sur mobile (`reg390.png`). À corriger dans le back-office (vraies listes TipTap) ; possibilité de signaler ce cas dans l'éditeur. → `/impeccable clarify`
5. **Long règlement sur mobile sans retour au sommaire** ✅ : 11 043 px de haut à 390 px, et le sommaire n'est qu'en tête de page. Ajouter un lien « Sommaire ↑ » discret en fin d'article, ou un sommaire repliable collant. Le saut d'ancre, lui, fonctionne : `scroll-margin-top: 96px`, cible à 96 px du haut sous un en-tête de 76 px. → `/impeccable adapt`
6. **Titre du document `/cups/[id]`** ✅ : « PlatinumCBD CUP 2027 | Platinum CBD Cup » : le nom de la cup en base (sans espace, en capitales) répète la marque. Utiliser `Édition ${year}` comme titre de page, ou corriger le nom dans le back-office. → `/impeccable clarify`
7. **Fautes dans les fiches de l'équipe (données)** ✅ : « Co-fouder », « passionnée » (pour un homme), « chasseur de profile », rôle en anglais (« President / Founder ») sur une page en français. À corriger dans le back-office (Contenu › À propos). → `/impeccable clarify`

---

## Environnement

#### [E-1] `/reglement` servi avec une version périmée de `platinumCSS` ✅
- À 1280 px, l'en-tête de `/reglement` mesure **128 px** (deux lignes, CLS 0,052), alors qu'il en mesure 76 sur `/about`, `/cups/[id]` et `/` à la même largeur.
- Cause vérifiée : le HTML de `/reglement` ne contient pas la nouvelle règle `@media (min-width: 881px) and (max-width: 1400px)` de `street-styles.ts:178` (0 occurrence, contre 2 sur les autres routes). « Presse » reste donc affiché. Les deux pages servent pourtant le même balisage (`<a data-hide-below="1024" href="/press">`).
- Lecture : Turbopack n'a pas recompilé le module de cette route après la modification de `street-styles.ts`. **Ce n'est pas un défaut de code.** Les autres mesures de `/reglement` portent sur des styles inchangés par vos correctifs (prose, sommaire, `editorial-legal.ts`), donc elles restent valables.
- À faire : redémarrer `next dev` (ou toucher `reglement/page.tsx`) avant de valider l'en-tête sur cette page.

---

## État des correctifs de la passe 1 sur ces trois pages

| Constat passe 1 | État observé ici |
|---|---|
| P1-2 En-tête sur deux lignes à 1280 px | ✅ Corrigé sur `/about` et `/cups/[id]` (76 px à 1280 px, « Presse » masqué). `/reglement` : voir E-1. |
| P2-1 Contenu masqué à l'impression | ✅ Corrigé : `@media print` présent (`street-styles.ts:573`). Après passage en mode impression, 0 élément masqué ; le PDF de `/cups/[id]` contient bien les 5 lignes de catégories. Une lecture immédiate donne encore 2 et 10 éléments à `opacity: 0`, simple reste de la transition de 0,8 s en cours. ❓ Sans effet sur un vrai PDF. |
| P3-3 « 5e édition2027 » | ✅ Corrigé : l'arbre d'accessibilité lit « 5e édition · 2027 ». |
| P3-6 Survol plein or sur des lignes non cliquables | ✅ Corrigé : le survol des catégories ne change plus que la couleur du nom (`street-styles.ts:334`). |
| P3-1 Focus sur un élément encore invisible | ✅ Non reproduit sur ces pages : les 30 tabulations atterrissent toutes sur des éléments à `opacity: 1` avec un contour de 2 px. |

Aucun constat de la passe 1 n'est encore cassé sur ces trois pages.

---

## Ce qui a été vérifié (axes de la passe 1)

### Accessibilité ✅
- **Structure :** une seule `h1` par page ; hiérarchie h1 → h2 → h3 sans saut. `/reglement` : 13 `h2` d'articles, sommaire en `nav aria-label="Sommaire"` avec liste ordonnée. `/about` : sections `aria-labelledby` ; portraits avec `alt` = nom.
- **Texte liquéfié :** « Le concours » et « Édition 2027 » sont lus en clair.
- **Clavier :** lien d'évitement en premier ; ordre logique ; contour or clair de 2 px partout ; aucun piège ni élément focalisé invisible.
- **Contrastes :** toutes les couleurs de texte relevées passent l'AA. Crème 17:1, crème 74 % 9,4:1, crème 56 % 5,7:1, or 9,4:1, gris `--fg-2` ≈ 7,6:1, nuit sur or 9,4:1, libellés nuit 72 % sur crème 7,5:1.
- **Cibles :** à 390 px, seuls des liens dans le texte font moins de 44 px (exemptés). Les liens du sommaire font 20 px de haut en bureau mais sont espacés de 31 px, ce qui respecte l'exception d'espacement de WCAG 2.5.8.
- **Mouvement réduit :** aucun `.rv` armé ; le seul `fadeIn` restant est ramené à 0,001 s.

### Performance ✅ (serveur de dev, chiffres indicatifs)
| Page | LCP 1440 | LCP 390 | CLS 1440 / 1280 / 390 |
|---|---|---|---|
| `/about` | 1,1 s (`h1` liquéfié) | 0,7 s (chapô) | 0,000 / 0,000 / 0,000 |
| `/reglement` | 0,76 s (`h1`) | 0,64 s (chapô) | 0,004 / 0,052 (E-1) / 0,000 |
| `/cups/[id]` | 1,6 s (`h1` liquéfié, premier passage) / 0,76 s à 1280 | 0,72 s | 0,000 / 0,000 / 0,000 |

Pas d'emblème WebGL ni de grosse image sur ces pages ; les portraits de `/about` sont en `loading="lazy"` avec des dimensions réservées. Les portraits sont servis à 1024×1024 et 640×640 pour un affichage d'environ 210×262 px : un `srcset` ou un redimensionnement côté serveur économiserait quelques centaines de Ko 🔎 (non mesuré en poids).

### Responsive ✅
- `scrollWidth = clientWidth` aux trois largeurs sur les trois pages : aucun défilement horizontal, aucun élément hors écran.
- Les titres liquéfiés tiennent : « Le concours » 151/134/44 px, « Édition 2027 » 151/134/50 px.
- Problèmes relevés : P2-2 (critères sur mobile) et P2-4 (grille de `/about`).

### Robustesse ✅
- **Sans JS :** `/about` et `/reglement` sont complets ; `/cups/[id]` ne l'est pas (P2-5, préexistant).
- **États vides :** `/about` masque la section équipe s'il n'y a pas de membres 🔎 ; `/reglement` masque le sommaire sous deux intertitres 🔎 ; `/cups/[id]` renvoie un 404 pour une cup inexistante 🔎 et masque le bouton palmarès tant que les résultats ne sont pas publiés ✅. Le cas « description vide » est mal géré (P2-1).

---

## Points positifs

- `/cups/[id]` est la page la plus aboutie de cette passe : elle réutilise exactement les blocs de l'accueil (calendrier, catégories, jurys, échantillon), tient de 390 à 1440 px sans débordement et a un CLS nul.
- Le saut vers un article du règlement tombe pile sous l'en-tête collant (`scroll-margin-top`).
- Les trois pages sont rapides, sans erreur console et lisibles au clavier.
- Les correctifs de la passe 1 déjà en place (en-tête, impression, séparateur lu par les lecteurs d'écran, survol des catégories) fonctionnent sur ces pages.

---

## Actions recommandées

1. **[P2] `/impeccable harden`** : description vide (P2-1), `loading.tsx` de `/cups/[id]` (P2-5).
2. **[P2] `/impeccable clarify`**, puis **`/impeccable layout`** : critères de notation, avec l'interligne 1,5 tout de suite (P2-2) ; grille des jurys de `/about`, ou remplacement par `JuriesExplainer` (P2-4).
3. **[P2] `/impeccable polish`** : passage de `/reglement` (et de `legal-page.tsx`) en « street » (P2-3) ; photos de l'équipe (P2-6) ; gris `--fg-2` (P3-2) ; double `page-enter` (P3-3).
4. **[P3] `/impeccable typeset`** : intertitres de `/about` (P3-1).
5. **[P3] `/impeccable clarify`** : titre du document de `/cups/[id]` (P3-6) ; données du back-office (listes du règlement P3-4, fiches de l'équipe P3-7).
6. **[P3] `/impeccable adapt`** : retour au sommaire du règlement sur mobile (P3-5).
7. **Environnement :** redémarrer `next dev`, puis revérifier l'en-tête de `/reglement` à 1280 px (E-1).
8. **`/impeccable polish`** en dernier passage.

## Non couvert

- Vrais lecteurs d'écran (seul l'arbre d'accessibilité de Chrome a été lu), vrais appareils, build de production.
- `/mentions-legales` et `/confidentialite` : non réaudités ici, mais ils partagent `legal-page.tsx` et `editorial-legal.ts`, donc P2-3 et P3-3 s'y appliquent probablement ❓.
- Artefacts : `/tmp/claude-1000/…/scratchpad/p2/` (`out.json`, `full-*.png`, `top-*.png`, `aria-*.txt`, PDF d'impression).
