/**
 * Ajustements responsive (mobile et tablette) — groupe « shell-home ».
 * Concaténé à la fin de platinumCSS : ces règles l'emportent sur les styles
 * de base à spécificité égale.
 *
 * Paliers :
 * - ≤ 880 px : en-tête réduit au logo, barre de navigation basse (base).
 * - 600–880 px : tablette portrait, mises en page à deux colonnes.
 * - 881–1199 px : en-tête bureau resserré, hero de l'accueil sur une ligne.
 * - 881–1023 px / 881–959 px : l'en-tête masque « Presse » puis « Le
 *   concours » (nav.ts, `hideBelow`), tous deux repris dans le pied de page.
 */
export const responsiveCSS = `
/* ── Classes partagées ─────────────────────────────────────── */
/* 14 px minimum pour le texte qui porte de l'information. */
.eyebrow{ font-size: 14px; letter-spacing: .07em; }
/* Bouton « afficher le mot de passe » : cible tactile de 44 px. */
.pw-toggle{ right: 0; width: 44px; height: 44px; }
/* Case à cocher (24 px visibles) : l'<input> transparent déborde de 10 px
   de chaque côté, soit une zone de clic de 44 px sans toucher au rendu. */
.pt-check input{ inset: -10px; width: auto; height: auto; }
/* Liens en ligne : zone tactile de 44 px sans changer le rythme des lignes
   (la marge négative annule le padding dans la boîte de ligne). */
.form-foot a{ display: inline-block; padding-block: 12px; margin-block: -12px; }
.home-link{ display: inline-block; padding-block: 10px; margin-block: -10px; }

/* Titres saisis par l'organisateur (nom d'édition) : jamais de débordement. */
.home-hero h1, .eds-card h2{ overflow-wrap: anywhere; }

/* Pied de page (styles auparavant en ligne dans PlatinumShell). */
.footer-brand{ font-size: 20px; color: var(--fg); }
.footer-nav{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px 24px; }

/* Cartes d'édition : les deux boutons se partagent la ligne, ou prennent
   chacun toute la largeur une fois passés à la ligne. */
.eds-card .home-actions .btn{ flex: 1 1 auto; }

/* ── Bureau : en-tête de hauteur fixe ──────────────────────────
   Le hero de l'accueil retranche --topbar-h de 100svh : la hauteur réelle
   de l'en-tête doit lui être égale (le bouton de 52 px donnait 81 px). */
@media (min-width: 881px){
  :root{ --topbar-h: 76px; }
  .topbar{ min-height: var(--topbar-h); padding-top: 8px; padding-bottom: 8px; }

  /* Emblème du hero : jamais plus haut que l'écran (portables de 720 px),
     place réservée avant le montage du canvas (pas de saut de mise en page). */
  /* Taille portée à 690 px (+50 %, demande du 08/10/2026), toujours bornée
     par la hauteur de l'écran. L'emblème déborde derrière le texte : le
     canvas est transparent autour du modèle, et le texte reste au-dessus
     (z-index) et cliquable. */
  .home-hero:not(.is-compact){
    flex-wrap: nowrap;
    --emblem: max(320px, min(690px, calc(100svh - var(--topbar-h) - 48px)));
  }
  .home-hero:not(.is-compact) .home-hero-text{ flex: 1 1 auto; position: relative; z-index: 1; }
  .home-hero:not(.is-compact) .home-hero-emblem{
    flex: 0 0 var(--emblem); min-height: var(--emblem);
    margin-left: calc(var(--emblem) * -0.28);
    margin-right: calc(var(--pad-x) * -0.5);
  }
  .home-hero:not(.is-compact) .home-hero-emblem > div{
    width: var(--emblem) !important; height: var(--emblem) !important;
  }
}

/* ── 881–1199 px : en-tête resserré, hero sur une ligne ─────── */
@media (min-width: 881px) and (max-width: 1199px){
  .topbar{ column-gap: 20px; }
  .topbar .brand-name{ font-size: 20px; }
  .nav{ column-gap: 18px; }
  .topbar-right{ gap: 6px; }
  .topbar-right .btn{ padding: 10px 16px; font-size: 15px; }

  /* Sans cela l'emblème (460 px) passait sous le texte jusqu'à ~1170 px. */
  .home-hero:not(.is-compact){
    flex-wrap: nowrap; gap: 32px;
    --emblem: max(320px, min(51vw, 600px, calc(100svh - var(--topbar-h) - 48px)));
  }
  .home-hero:not(.is-compact) .home-hero-text{ flex: 1 1 auto; }
  .home-hero:not(.is-compact) .home-hero-emblem{ flex: 0 0 var(--emblem); }

  /* 4 cartes en auto-fit donnaient 3 + 1 orpheline. */
  .home-audiences{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 881px) and (max-width: 1023px){
  .nav a[data-hide-below="1024"]{ display: none; }
}
@media (min-width: 881px) and (max-width: 959px){
  .nav a[data-hide-below="960"]{ display: none; }
}

/* ── Mobile et tablette portrait (≤ 880 px) ─────────────────── */
@media (max-width: 880px){
  /* Logo de l'en-tête : cible de 44 px, même hauteur d'en-tête qu'avant
     (6 + 44 + 6 + 1 px de bordure). */
  :root{ --topbar-h: 57px; }
  .topbar{ min-height: var(--topbar-h); padding-top: 6px; padding-bottom: 6px; }
  .topbar .brand{ min-height: 44px; }

  .mobile-bottom-nav__label{ font-size: 14px; }

  /* Liens du pied de page : 44 px de haut, rangées sans chevauchement. */
  .footer-nav{ gap: 0 20px; }
  .footer-nav a{ display: inline-flex; align-items: center; min-height: 44px; }
}

/* Formulaires : boutons côte à côte jusqu'à 561 px, pleine largeur dessous. */
@media (min-width: 561px) and (max-width: 880px){
  .form-actions .btn{ width: auto; }
}

/* ── Tablette portrait (600–880 px) ───────────────────────────
   La mise en page téléphone (une colonne, boutons pleine largeur) étirait
   tout sur 700 px. */
@media (min-width: 600px) and (max-width: 880px){
  .home-actions{ flex-direction: row; }
  .home-actions .btn{ width: auto; }
  .home-cats-cta{ align-self: flex-start; }
  .home-steps{ grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
  .home-juries{ grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .home-podium{ grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .home-audiences{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
