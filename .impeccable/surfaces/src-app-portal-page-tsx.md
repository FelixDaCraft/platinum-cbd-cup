---
version: 1
slug: "src-app-portal-page-tsx"
primary_target: "src/app/(portal)/page.tsx"
related_targets: ["src/app/(portal)"]
---

# Portail public — platinumcbdcup.eu

Scope : toutes les pages publiques du groupe `(portal)` (accueil, concours, participer, édition, inscription, palmarès, éditions, presse, partenaires, articles, règlement, contact, connexion, création de compte, activation juré, pages légales, paiement, 404/erreur). Mode : Persuade (accueil, concours, participer, palmarès), Read (articles, règlement, légales), Operate (formulaires).

Audience prioritaire : producteurs de CBD pendant la période d'inscription 2027. Action : inscrire ses produits. Preuve : palmarès réels, logos producteurs, photos d'événement réelles, règles (deux jurys, anonymat).

Contraintes : Louize Display pour le nom dans l'en-tête et le pied de page ; couleurs `#0c0b09` / `#d4af37` / `#f5e6a8` ; styles limités à `.shell` (le back-office partage `.btn`, `.card` et les variables).

## Direction contract

THESIS : le site devient le prolongement des visuels « street » 2027 d'Instagram : affiche de concours, pas page SaaS. Il refuse le hero centré + cartes arrondies égales + titres sans-serif sages de la version « Grand Cru ».

OWN-WORLD : fond nuit #0c0b09, or #d4af37 en aplats (boutons, ruban, listes), crème #f3eee3 pour le texte. Unbounded 800–900 en capitales pour les titres, mots-clés liquéfiés par un filtre SVG (turbulence + déplacement) ; Hanken Grotesk pour le texte courant. Étoiles ✦ dessinées en SVG comme séparateurs, barre « 5e édition · 2027 » entre deux filets blancs, cadres à angle droit filetés d'or, photos virées en bichromie nuit→or, badge circulaire au texte tournant, code-barres. Aucun coin arrondi, aucune carte grise.

STORY : le producteur voit en un écran que la 5e édition est ouverte, jusqu'à quand, combien ça coûte, et que la notation est à l'aveugle par deux jurys ; il voit le palmarès réel avec logos de producteurs ; il clique « Inscrire mes produits ».

FIRST VIEWPORT : barre d'édition pleine largeur en haut ; à gauche, étiquette or inclinée du statut (« Inscriptions ouvertes jusqu'au … »), titre liquéfié géant « MESURE-TOI / AUX / MEILLEURS », sous-titre court, liste or des catégories, bouton or « Inscrire mes produits » + bouton filet « Palmarès 2026 » ; à droite, l'emblème 3D (750 px) en rotation lente, penché vers la droite, manipulable au cliquer-glisser (bureau ; logo fixe sur mobile). Ruban or incliné qui défile sous le hero (dates, prix, catégories). Signature de mouvement : mots qui fondent puis se figent à l'entrée, filets qui se tracent, lignes qui montent en cascade, podium 3e→2e→1er.

FORM : direction fixée par l'utilisateur (DA street 2027), pas de tirage. seed: none (direction pinned by user)

FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
