# Audit technique — portail public « street » 2027

- **Date :** 16 octobre 2026
- **Branche :** `feat/design-public` (modifications non commitées : 14 fichiers suivis + `street/`, `street-styles.ts`)
- **Méthode :** lecture seule, aucun fichier de code modifié. Lecture du code ; rendu réel sur `http://localhost:3018` avec Chrome 141 (chrome-devtools MCP, puis Playwright piloté par `google-chrome-stable`) à **1440, 1280 et 390 px**, plus 1024 et 1180 px (tablette tactile) pour les cas limites ; 20 routes × 3 largeurs balayées automatiquement ; arbre d'accessibilité, parcours clavier, `prefers-reduced-motion`, rendu sans JavaScript, mode impression, toucher synthétisé (CDP), métriques CLS/LCP, coût CPU. Détecteur Impeccable lancé sur le périmètre.
- **Légende :** ✅ **Vérifié** = observé dans le navigateur ou mesuré. 🔎 **Lu dans le code** = certain d'après le code, non reproduit. ❓ **Supposé** = inférence à confirmer.

---

## Score de santé

| # | Dimension | Score | Constat principal |
|---|-----------|-------|-------------------|
| 1 | Accessibilité | 3 | Ruban défilant sans moyen de pause au clavier ou au toucher (WCAG 2.2.2) ; bordures de champs à 2,2:1 |
| 2 | Performance | 2 | L'emblème WebGL dessine en continu, même hors écran, à 1500×1500 px sur écran Retina |
| 3 | Thème / tokens | 3 | Tokens bien posés ; `#0c0b09` écrit en dur 24 fois ; lueurs dorées contraires au DESIGN.md |
| 4 | Responsive | 2 | Titre « Palmarès 2026 » de l'accueil rendu à 0 px à toutes les largeurs ; en-tête sur deux lignes entre 881 et ~1340 px |
| 5 | Cohérence d'implémentation | 3 | Système cohérent et propre au produit ; quelques écarts au DESIGN.md |
| **Total** | | **13/20** | **Acceptable : du travail ciblé est nécessaire avant la mise en ligne** |

### Verdict de cohérence : **réussi**

L'implémentation exprime un vrai système propre au produit : tokens `--st-*` limités à `.shell`, composants dédiés (`LiquidText`, `Tape`, `EditionBar`, `PageHead`, `ScrollReveal`), un seul vocabulaire (filets, or en aplat, angles droits) appliqué sur toutes les pages publiques. Rien de générique ni d'interchangeable. Sur les 75 alertes du détecteur, 72 sont des tailles « hors échelle typographique » : le front-matter de DESIGN.md ne déclare que 5 tailles alors que le texte du document en décrit une douzaine (11–13 px pour les libellés, etc.). C'est un **écart de documentation, pas de code** (voir P3-9). Les points qui font perdre des points sont des défauts précis, pas une dérive du système.

---

## Résumé

- **Score : 13/20 (acceptable)**
- **Constats : 0 P0 · 4 P1 · 8 P2 · 10 P3**
- **À corriger d'abord :**
  1. **P1** Le titre « Palmarès 2026 » de l'accueil est invisible (0 px) et le chapô s'affiche un mot par ligne, à toutes les largeurs.
  2. **P1** L'en-tête passe sur deux lignes (128 px, collant) entre 881 et ~1340 px, donc sur la plupart des portables (1280, 1366).
  3. **P1** Sur une tablette tactile en paysage (≥ 881 px), glisser le doigt sur l'emblème 3D ne fait pas défiler la page (56 % de la largeur).
  4. **P1** Le ruban or défile sans fin, et on ne peut le mettre en pause qu'au survol de la souris (WCAG 2.2.2, niveau A).
- **Suite :** `/impeccable harden` (titre à 0 px, révélations, rendu sans JS ou à l'impression), `/impeccable adapt` (en-tête, tablette, podium mobile), `/impeccable optimize` (emblème, police), puis `/impeccable polish`.

---

## Constats détaillés

### P1 — Majeur

#### [P1-1] Titre « Palmarès 2026 » de l'accueil rendu à 0 px ✅
- **Emplacement :** `src/app/(portal)/page.tsx:356-365` (`.st-sec-head.is-split > .st-podium-head`) ; cause dans `src/components/portal/platinum/street-styles.ts:82-83` et `:247`.
- **Catégorie :** Responsive / Robustesse
- **Scénario vérifié :** à 1440, 1280 et 390 px, `h2.st-h2-liquid` mesure `font-size: 0px`, largeur 0. Le chapô « Fleurs OUTDOOR · Jury public » s'affiche un mot par ligne (capture `podium-1440.png`). Le titre reste dans l'arbre d'accessibilité, mais aucun voyant ne le voit.
- **Cause :** `.st-podium-head` reçoit `container-type: inline-size`, ce qui empêche sa largeur de dépendre de son contenu. Or c'est un élément flex de `.st-sec-head.is-split` (`flex-direction: row`), dont la largeur vient justement du contenu : elle tombe à 0, donc `100cqw = 0`, et `.st-fit` calcule `font-size: min(--fs, 0)` = 0.
- **Impact :** la section « preuve » du produit (PRODUCT.md, principe 2) perd son titre sur la page la plus vue.
- **Correctif :** donner une largeur à l'élément du conteneur, par exemple `.st-podium-head{ flex: 1 1 520px; min-width: 0; }`, ou retirer `.st-podium-head` de la liste `container-type` et poser le conteneur sur `.st-podium-sec`. Garde-fou général : n'utiliser `container-type` que sur des blocs dont la largeur vient du parent (bloc ou élément de grille).
- **Commande :** `/impeccable harden`

#### [P1-2] En-tête sur deux lignes entre 881 et ~1340 px ✅
- **Emplacement :** `street-styles.ts:147-163` (en-tête Unbounded, 12 px, interlettrage 0,12 em, `gap 28px`) face aux règles héritées `responsive/shell-home.ts:86-89` (`data-hide-below` 1024/960, calibrées pour l'ancienne police).
- **Catégorie :** Responsive
- **Scénario vérifié :** balayage des largeurs de 1440 à 900 px par pas de 20 px : l'en-tête mesure 76 px jusqu'à 1340 px, puis **128 px dès 1320 px** et jusqu'à 900 px. « Se connecter » et le bouton passent sur une seconde ligne (captures `hero1280.png`, `hero1024.png`). Mesure faite avec le bouton court « Voir le palmarès » : avec « Inscrire mes produits » (édition ouverte), le seuil monte vers ~1380 px ❓. L'en-tête est collant (`platinum-styles.ts:112`) : sur un écran 1280×720, il occupe 18 % de la hauteur en permanence.
- **Effet secondaire mesuré :** à 1280 px, CLS = **0,052**, entièrement dû au saut de `.topbar-right` (y 15 → 84 px) quand Unbounded remplace la police de repli (voir P2-5). À 1440 px : 0,003.
- **Correctif :** recaler les seuils `data-hide-below` sur la nouvelle typographie (masquer « Presse » sous ~1360 px et « Le concours » sous ~1180 px), ou réduire l'interlettrage et le `gap` de la navigation sous 1360 px. Interdire le retour à la ligne (`flex-wrap: nowrap`) et basculer vers la barre basse plus tôt si nécessaire.
- **Commande :** `/impeccable adapt`

#### [P1-3] Emblème 3D : glisser au doigt sur une tablette paysage ne fait pas défiler la page ✅
- **Emplacement :** `src/components/portal/platinum/geometric-emblem.tsx:118-140` (`touchAction: "none"`, `OrbitControls`) monté par `src/app/(portal)/_components/desktop-emblem.tsx:8` dès `min-width: 881px`, donc aussi sur iPad en paysage et sur les portables tactiles.
- **Catégorie :** Responsive / Gestes
- **Scénario vérifié :** Playwright + Chrome, fenêtre 1180×820 avec toucher activé, glissement vertical synthétisé par CDP (`Input.dispatchTouchEvent`) : sur le texte (x = 200), la page défile de 385 px ; **sur l'emblème (x = 900), elle reste à 0**. Le canvas de 750 px couvre 56 % de la largeur de l'écran. Non testé sur un vrai iPad ni dans Safari.
- **Impact :** sur tablette, un visiteur qui pose le pouce à droite du hero se retrouve à faire tourner le logo au lieu de descendre vers les catégories et les tarifs.
- **Correctif :** choisir le montage selon le type de pointeur et pas seulement la largeur : `(min-width: 881px) and (hover: hover) and (pointer: fine)`. En dessous, afficher le logo fixe, ou l'emblème sans `OrbitControls` (`interactive={false}`, le canvas a alors `pointer-events: none`).
- **Commande :** `/impeccable adapt`

#### [P1-4] Ruban défilant : impossible à mettre en pause au clavier ou au toucher ✅ (comportement) / 🔎 (norme)
- **Emplacement :** `street-styles.ts:130-131` (`animation: st-tape 38s linear infinite`, pause uniquement sur `:hover`), `src/components/portal/street/street.tsx:338-357`.
- **Catégorie :** Accessibilité
- **Norme :** WCAG 2.2.2 « Mettre en pause, arrêter, masquer » (niveau A) : un contenu qui bouge plus de 5 s à côté d'autres contenus doit pouvoir être arrêté.
- **Scénario :** au clavier ou sur mobile, rien n'arrête le défilement. `prefers-reduced-motion` l'arrête bien (vérifié : `animation-name: none`), mais cela ne remplace pas un moyen de pause.
- **Correctif (au choix) :** un petit bouton pause/lecture dans le ruban (`aria-pressed`) ; ou arrêter après 2 ou 3 tours (`animation-iteration-count: 3`) ; ou mettre en pause sur `:focus-within` et quand le ruban sort de l'écran (IntersectionObserver).
- **Commande :** `/impeccable animate`

### P2 — Mineur

#### [P2-1] À l'impression et en capture pleine page, tout le contenu sous la ligne de flottaison disparaît ✅
- **Emplacement :** `src/components/portal/street/scroll-reveal.tsx:237-254`, `street-styles.ts:522-541` (aucune règle `@media print`).
- **Scénario vérifié :** accueil à 390 px chargé puis passé en `media: print` : **28 éléments** restent à `opacity: 0` ou coupés par un `clip-path`. La capture pleine page sans défilement (`home390-strip.png`) montre une page presque vide sous le hero : catégories, jurys, podium et profils sont absents.
- **Impact :** un producteur qui imprime ou exporte en PDF la page Participer ou le palmarès obtient des pages blanches. Même chose pour les outils de capture et d'aperçu.
- **Correctif :** `@media print{ .rv{ opacity:1 !important; transform:none !important; clip-path:none !important; } }`, ajouté au bloc `prefers-reduced-motion` existant.
- **Commande :** `/impeccable harden`

#### [P2-2] Révélations imbriquées : des lignes restent cachées après un défilement rapide ✅
- **Emplacement :** `scroll-reveal.tsx:198-203` : `.st-steps ol` (`rv-wipe`) contient `.st-step` (`rv-row`) ; `.st-juries-grid` (`rv-wipe`) contient `.st-sample` (`rv-slap`).
- **Scénario vérifié :** à 1024 et 1280 px, après un défilement complet par pas de 400 px et un retour en haut, il reste respectivement **4 et 5 éléments `.rv`** non révélés (étapes 2 et 3 du calendrier invisibles sur `hero1024.png`). À 390 px (une seule colonne), il n'en reste aucun.
- **Cause :** tant que le parent est coupé par `clip-path: inset(0 calc(100% - 1px) 0 0)`, les enfants situés à droite de ce liseré d'1 px ne sont jamais « vus » par l'IntersectionObserver, qui tient compte des coupes des ancêtres. Ils ne se révèlent que si l'on repasse dessus.
- **Correctif :** ne pas armer un enfant dont un ancêtre est déjà armé (`el.parentElement.closest('.rv')`), ou révéler les enfants dans le callback du parent.
- **Commande :** `/impeccable harden`

#### [P2-3] Note du podium cassée sur deux lignes sur mobile (« 16,0 / 5 ») ✅
- **Emplacement :** `street-styles.ts:346` (`overflow-wrap: anywhere` sur `.st-podium li`) + `:421-422` (case de 96 px, `padding: 14%`, 26 px).
- **Scénario vérifié :** à 390 px, accueil et palmarès : « 16,71 » s'affiche « 16, / 71 », « 16,05 » s'affiche « 16,0 / 5 », « 15,58 » s'affiche « 15,5 / 8 » (`scr-390-_-strip.png`, `pal390.png`). Lecture fausse d'une note, alors que c'est la donnée centrale du palmarès.
- **Correctif :** `.st-podium-logo.is-score b{ white-space: nowrap; overflow-wrap: normal; font-size: 22px; }` et `padding: 8%` sous 880 px.
- **Commande :** `/impeccable adapt`

#### [P2-4] L'emblème WebGL dessine en continu, même hors écran ✅ (fait) / ❓ (ampleur sur un vrai GPU)
- **Emplacement :** `geometric-emblem.tsx:118` (`<Canvas>` sans `dpr` ni `frameloop`) ; `desktop-emblem.tsx`.
- **Mesures :** temps CPU du thread principal (CDP `Performance.getMetrics`, sur 3 s) : ~1,02 s/s avec l'emblème visible, **~1,05 s/s une fois défilé hors écran**, donc la boucle ne s'arrête jamais. En DPR 2, le canvas fait **1500×1500 px** (2,25 Mpx redessinés à chaque image). Chrome headless rend le WebGL en logiciel (SwiftShader) : la valeur absolue exagère le coût réel, mais l'absence de pause, elle, est certaine. Avec mouvement réduit, la rotation s'arrête mais le rendu continue (`frameloop` par défaut à `"always"`) 🔎.
- **Impact :** batterie et ventilateurs sur portable, saccades possibles au défilement sur les machines modestes.
- **Correctif :** `dpr={[1, 1.5]}` ; mettre en pause hors écran (IntersectionObserver qui bascule `frameloop` entre `"always"` et `"never"`, ou `frameloop="demand"` avec `invalidate()` dans la boucle de rotation) ; `frameloop="demand"` quand `prefers-reduced-motion`.
- **Commande :** `/impeccable optimize`

#### [P2-5] Unbounded n'est pas préchargée : changement de police visible et décalage de l'en-tête ✅
- **Emplacement :** `street-styles.ts:15-21` (`@font-face` dans le `<style>` inline, `font-display: swap`) ; `src/app/layout.tsx:293-303` ne précharge que Louize.
- **Scénario vérifié :** à 1280 px, le seul décalage de mise en page (0,052) est le saut de l'en-tête au moment du changement de police (voir P1-2). Le titre principal (élément LCP) s'affiche d'abord en Hanken Grotesk 900 puis en Unbounded.
- **Correctif :** `<link rel="preload" as="font" type="font/woff2" href="/fonts/Unbounded-VF.woff2" crossorigin>` à côté de celui de Louize (le fichier fait 50 Ko). Option : un `@font-face` de repli avec `size-adjust` pour limiter l'écart de largeur.
- **Commande :** `/impeccable optimize`

#### [P2-6] Champs de formulaire : bordure à 2,24:1 et fond quasi identique à la page ✅ (calcul)
- **Emplacement :** `street-styles.ts:106` (`border: 1px solid rgba(243,238,227,.28)`, fond `#13110d`).
- **Mesures :** bordure ≈ **2,24:1** sur `#0c0b09` ; fond du champ / fond de page ≈ **1,04:1**.
- **Norme :** WCAG 1.4.11 « Contraste du contenu non textuel » (AA) : la limite d'un champ doit atteindre 3:1.
- **Impact :** sur les pages Connexion, Créer un compte, Contact et l'inscription des produits, les champs se distinguent mal, surtout sur un écran peu lumineux.
- **Correctif :** bordure à `rgba(243,238,227,.42)` au minimum (≈ 3,6:1) ; le survol à `.5` existe déjà.
- **Commande :** `/impeccable polish`

#### [P2-7] Texte d'exemple des champs à 4,04:1 ✅ (calcul)
- **Emplacement :** `street-styles.ts:113` (`::placeholder` à `rgba(243,238,227,.45)`).
- **Norme :** WCAG 1.4.3 (AA) quand ce texte porte une information (format attendu, exemple).
- **Correctif :** `.56` (5,7:1, déjà le token `--st-ink-3`).
- **Commande :** `/impeccable polish`

#### [P2-8] Pages en erreur pendant l'audit : non auditées ✅ (erreur) / ❓ (cause)
- **Routes :** `/about` et `/reglement` (HTTP 500), `/cups/[cupId]` (HTTP 200 mais remplacée par l'écran d'erreur du portail).
- **Constat :** les trois échouent **systématiquement** en ~10 s avec `Error: Connection terminated due to connection timeout` (pg). Huit connexions vers `127.0.0.1:5433` sont restées en `CLOSE-WAIT`. Les pages qui passent par `unstable_cache` (accueil, palmarès) répondent. Le layout du portail se replie alors sur `liveStatus = "idle"`, d'où le bouton « Voir le palmarès » dans l'en-tête alors que les inscriptions sont ouvertes.
- **Lecture :** cela ressemble à un pool de connexions bloqué dans le serveur de développement, pas à un défaut du redesign (le diff de ces pages ne touche pas aux requêtes). **À confirmer** en redémarrant le serveur de dev ; il faudra alors auditer ces trois pages, qui portent le parcours d'inscription.
- **Commande :** relancer `/impeccable audit` sur ces routes après redémarrage.

### P3 — Finition

1. **Focus sur un élément encore invisible** ✅ : au clavier, « Inscrire mes produits » (bas des catégories) et « Le classement complet » reçoivent le focus à `opacity: 0` ; le contour n'apparaît qu'après le délai de révélation (0,35 s + 0,8 s). `scroll-reveal.tsx` : ajouter un écouteur `focusin` qui révèle immédiatement. → `/impeccable harden`
2. **Ruban lu deux fois par les lecteurs d'écran** ✅ : arbre d'accessibilité = `note "Inscriptions ouvertes…, 5 catégories…"` **suivi du même texte**. `street.tsx:340-350` : retirer `aria-label` ou passer la première copie en `aria-hidden`. → `/impeccable harden`
3. **« 5e édition2027 »** ✅ : l'étoile étant `aria-hidden`, les lecteurs d'écran collent les deux mots (`page.tsx:266-270`, `:479-483`). Ajouter un séparateur `<span className="sr-only"> · </span>`. → `/impeccable clarify`
4. **Étoile orpheline en début de ligne dans la liste dorée** ✅ : à 1440 et 390 px, « ✦ DRY HASH » et « ✦ FLEURS GREENHOUSE » commencent une ligne par une étoile (`street.tsx:315-326`). Mettre l'étoile en `::after` de l'élément précédent, ou utiliser `gap` sans séparateur au retour à la ligne. → `/impeccable polish`
5. **Lueurs dorées contraires au DESIGN.md** ✅ : halo `radial-gradient(var(--accent-glow))` flouté derrière l'emblème (`geometric-emblem.tsx:86-98`) et `drop-shadow(… rgba(212,175,55,.25))` sur le logo mobile (`street-styles.ts:280`). Le DESIGN.md dit « pas de lueur dorée ». À 1024 px, le halo passe derrière le titre. Retirer ces lueurs, ou amender le DESIGN.md. → `/impeccable polish`
6. **Survol plein or sur des lignes non cliquables** 🔎 : `.st-cats-list li:hover` (`street-styles.ts:302-306`) remplit toute la ligne comme un lien, sans rien derrière. Effet trompeur : soit relier la ligne à l'inscription dans cette catégorie, soit garder ce remplissage pour `.st-route` et `.pal-other`, qui sont de vrais liens. → `/impeccable polish`
7. **Textes très petits** ✅ : libellés de la barre basse mobile à 9,5 px (`:220`), « sur 20 » du podium mobile à 8,5 px (`:423`), libellés de l'échantillon à 9,5 px (`:339`). Le contraste passe, la lisibilité moins. Minimum conseillé : 11 px. → `/impeccable typeset`
8. **`#0c0b09` en dur 24 fois** 🔎 dans `street-styles.ts`, alors que `--bg` / `--st-*` existent ; les nuances crème sont aussi écrites en dur (`.28`, `.32`, `.4`, `.45`, `.5`, `.04`) en plus des 4 tokens. Ajouter `--st-night` et 2 ou 3 tokens d'alpha. → `/impeccable polish`
9. **Front-matter de DESIGN.md incomplet** ✅ (détecteur) : 72 alertes « taille hors échelle » parce que le front-matter ne déclare que display/headline/title/body/label/brand, alors que le texte décrit des libellés de 11 à 13 px, une prose à 18 px, etc. Ajouter ces tailles au front-matter (`label-sm`, `prose`, `meta`…). Le détecteur signale aussi le rebond `cubic-bezier(.34,1.56,.64,1)` de `rv-slap` (`:532`, voulu : effet « sticker », à documenter) et deux faux positifs : le `border-radius: 8px` de `page-skeleton.tsx:16` est déjà écrasé par `.shell [class]{border-radius:0}`, et le `#ffffff` de `cups/[cupId]/register/page.tsx:809` est un fond de logo (son `borderRadius` en style inline, lui, l'emporte sur la règle d'angles droits). → `/impeccable document`
10. **`.sr-only` global non préfixé** 🔎 : `street-styles.ts:258` est la seule règle de classe hors `.shell`/`.st-`/`.rv`. Elle est identique à l'utilitaire Tailwind, donc **aucun effet aujourd'hui**. Mais comme elle n'est pas dans un `@layer`, elle l'emporterait sur un futur `focus:not-sr-only` du back-office. La supprimer : Tailwind la fournit déjà. → `/impeccable harden`

---

## Points demandés : ce qui a été vérifié

### Contrastes sur `#0c0b09` (calculés, formule WCAG)
| Token | Ratio | AA texte |
|---|---|---|
| crème `#f3eee3` | 17,0:1 | ✅ |
| crème 74 % (chapôs, prose) | 9,4:1 | ✅ |
| crème 56 % (métadonnées, rangs 2–3) | 5,7:1 | ✅ |
| or `#d4af37` | 9,4:1 | ✅ |
| or clair `#f5e6a8` | 15,7:1 | ✅ |
| nuit sur or (boutons, ruban, étiquette) | 9,4:1 | ✅ |
| libellés de l'échantillon (nuit 72 % sur crème) | 7,5:1 | ✅ |
| texte d'exemple 45 % | 4,0:1 | ❌ (P2-7) |
| bordure de champ 28 % | 2,2:1 | ❌ non textuel (P2-6) |
| cadre or 42 % (tuiles) | 2,5:1 | décoratif, sans exigence |

### Lecteurs d'écran et texte déformé ✅ (arbre d'accessibilité Chrome ; pas testé avec NVDA ni VoiceOver)
Le texte liquéfié reste du vrai texte : `heading "Platinum CBD Cup 2027 : Mesure-toi aux meilleurs" [level=1]` (les `<br>` donnent bien des espaces), « Palmarès 2026 », « Jusqu'au 31.12 ». Le SVG du filtre est `aria-hidden`. Une seule `h1` par page sur les 20 routes. Aucune image sans `alt`. Aucun champ sans libellé sur les pages rendues. Le podium est lu dans l'ordre 1, 2, 3 malgré l'affichage 2-1-3. Restent : P3-2 et P3-3.

### Clavier ✅
Le lien d'évitement est le premier arrêt de tabulation ; il est visible au focus (12, 12) et Entrée déplace bien le focus sur `#contenu-principal`. 33 arrêts sur l'accueil, dans un ordre logique, sans piège. Contour or clair 2 px sur tous les liens et boutons. Le canvas n'est pas focalisable, ce qui est correct pour un élément décoratif. Reste : P3-1.

### `prefers-reduced-motion` ✅
Aucun élément masqué par les révélations (`.rv` = 0), ruban arrêté, entrée et « respiration » du texte liquéfié désactivées (déplacement figé au repos), rotation de l'emblème coupée, `page-enter` neutralisé. Le texte reste déformé de façon statique, ce qui est voulu. Note : la règle globale préexistante `*{ animation-duration: .001ms }` de `platinum-styles.ts:841` supprime aussi des retours d'état utiles (transitions de survol) ; elle est hors du diff.

### Cibles tactiles (390 px) ✅
Aucune cible interactive sous 24 px hors liens dans le texte, donc **WCAG 2.5.8 (AA) respecté**. Sous 44 px (recommandation Apple / AAA) : liens du pied de page (30 px) et lien d'évitement (43 px). Les filtres du palmarès font 44 px.

### Performance
- **Filtre SVG** ✅ : coût faible. Au survol du titre de `/cups` (boucle `requestAnimationFrame` sur `scale`) : 0,030 s/s de CPU, contre 0,013 s/s pour le même survol sans filtre. Pas de recalcul de mise en page. Le filtre n'est appliqué qu'après hydratation (`size > 0`), donc rien côté serveur et aucun impact sur le CLS.
- **LCP** ✅ (serveur de dev, non représentatif de la prod) : titre principal à 560–820 ms à 1280/1440 px ; logo du hero à 608 ms à 390 px.
- **CLS** ✅ : 0,003 à 1440 px, 0,000 à 390 px, 0,052 à 1280 px (P1-2 / P2-5).
- **Emblème** : P2-4. Le GLB pèse 564 Ko ; three.js, R3F et drei sont chargés dès 881 px. Les tailles de paquets mesurées viennent du mode dev (Turbopack, non minifié) : ❓ à mesurer après `next build`.
- **ScrollReveal** ✅ : uniquement transform, opacité et clip-path ; un seul observateur ; classes retirées au bout de 2 s. Correct, hormis P2-1, P2-2 et P3-1.

### Responsive ✅
Aucun défilement horizontal sur les 20 routes × 3 largeurs (`scrollWidth = clientWidth` partout). `.shell{overflow-x: clip}` contient le ruban incliné et l'emblème. Ce découpage coupe le canvas de 25 px à 1440 px et de 66 px à 1280 px, mais seul le halo est touché. Les titres liquéfiés tiennent dans leur conteneur à toutes les largeurs (sauf P1-1). Le filtre de catégories du palmarès à 390 px est une bande horizontale qu'on fait défiler : c'est voulu.

### Robustesse sans JavaScript ✅
L'accueil, le palmarès, `/cups`, `/contact` et `/register` restent lisibles : titres en clair et non déformés, rien de masqué par les révélations (les classes ne sont posées que par JS). **Exception préexistante, hors diff :** `/login` sans JS n'affiche que « Chargement… » (formulaire rendu côté client uniquement). États vides : l'accueil masque proprement les sections sans données (`edition`/`teaser` nuls, `sansPanne`) 🔎 ; `.pal-empty` est stylé.

### Non-régression back-office, `/jury`, `/producer`
- 🔎 **Aucun fichier de ces espaces n'est modifié** (`git diff HEAD` : 14 fichiers, tous sous `(portal)` ou `portal/platinum`).
- 🔎 Le seul changement dans `platinum-styles.ts` est l'ajout de `streetCSS` en fin de concaténation. Analyse de tous les sélecteurs de `streetCSS` : tous commencent par `.shell`, `.st-` ou `.rv`, sauf `@font-face Unbounded` (police téléchargée seulement si elle est utilisée, et aucun fichier hors portail ne l'utilise), `@keyframes st-tape` et `.sr-only` (identique à Tailwind, voir P3-10). `.shell` n'est rendu que par `PlatinumShell` (portail et 404 globale). Les classes `st-*` et `rv*` ne sont utilisées nulle part hors du portail.
- ❓ **Non vérifié visuellement :** `/dashboard`, `/jury` et `/producer` redirigent vers `/login` (307), et je ne me suis pas connecté à un compte de la base copiée de la prod. Pour fermer ce point : une capture avant/après de 2 ou 3 écrans par espace avec un compte de test.

---

## Problèmes récurrents

- **Mesures de conteneur fragiles :** `container-type` posé sur des blocs dont la largeur dépend du contenu (P1-1). Même schéma possible ailleurs : toute nouvelle `.st-fit` dans une rangée flex.
- **Révélations pensées pour « l'écran qu'on fait défiler » seulement :** l'impression, les captures, le défilement rapide et le focus clavier ne sont pas pris en compte (P2-1, P2-2, P3-1).
- **Calibrages hérités de l'ancienne police :** seuils de l'en-tête (P1-2), cases du podium mobile (P2-3) : la largeur d'Unbounded en capitales n'a pas été reportée dans les règles `responsive/*` existantes.
- **« Bureau » assimilé à « largeur ≥ 881 px » :** l'emblème suppose souris et GPU confortable (P1-3, P2-4).

## Points positifs

- Isolement des styles exemplaire : tout est sous `.shell`, et le back-office n'est pas touché (vérifié dans le code).
- Le texte liquéfié reste du vrai texte : accessible, sélectionnable, non déformé sans JS, figé avec mouvement réduit, filtre recalculé selon la taille. Son coût CPU est faible.
- `fit` / `longestWord` : aucun titre géant ne déborde, de 390 à 1440 px.
- Contrastes de texte tous au-dessus de 4,5:1 (le plus faible : 5,7:1).
- Lien d'évitement fonctionnel, focus visible partout, une `h1` par page, arbre d'accessibilité propre (sauf P3-2 et P3-3).
- Aucun défilement horizontal sur aucune page ni largeur testée.
- L'emblème n'est pas monté sur mobile (pas de contexte WebGL caché) et il est protégé par un `RenderBoundary`.
- Pas d'animation de propriétés de mise en page.

---

## Actions recommandées

1. **[P1] `/impeccable harden`** : `.st-podium-head` (titre « Palmarès » à 0 px) ; dans la foulée, révélations à l'impression (P2-1), révélations imbriquées (P2-2), focus (P3-1), ruban lu deux fois (P3-2), `.sr-only` global (P3-10).
2. **[P1] `/impeccable adapt`** : seuils de l'en-tête pour Unbounded (P1-2), emblème réservé à `pointer: fine` (P1-3), note du podium mobile (P2-3).
3. **[P1] `/impeccable animate`** : pause du ruban (P1-4).
4. **[P2] `/impeccable optimize`** : `dpr` et pause hors écran de l'emblème (P2-4), préchargement d'Unbounded (P2-5).
5. **[P2] Redémarrer le serveur de dev puis `/impeccable audit`** sur `/about`, `/reglement` et `/cups/[cupId]` (P2-8), et faire des captures connectées de `/dashboard`, `/jury` et `/producer`.
6. **[P3] `/impeccable typeset`** : tailles minimales (P3-7).
7. **[P3] `/impeccable document`** : compléter le front-matter de DESIGN.md (P3-9).
8. **[P2/P3] `/impeccable polish`** : bordures et texte d'exemple des champs (P2-6, P2-7), lueurs (P3-5), survol des catégories (P3-6), étoiles orphelines (P3-4), tokens (P3-8). À passer en dernier.

## Non couvert

- Rendu connecté du back-office et des espaces juré/producteur (pas de compte de test).
- Parcours d'inscription et de paiement (`/cups/[id]/register` demande une connexion), `/paiement`, `/jury-invite/[token]`, `/articles/[slug]`.
- Vrais appareils (iPad, iPhone/Safari), vrais lecteurs d'écran (NVDA, VoiceOver), GPU matériel, build de production.
- Captures et artefacts de mesure : `/tmp/claude-1000/…/scratchpad/` (`sweep.json`, `shot-*.png`, `scr-*.png`, `aria-home.txt`).
