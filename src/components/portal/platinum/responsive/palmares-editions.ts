/**
 * Ajustements responsive (mobile et tablette) — groupe « palmares-editions ».
 * Concaténé à la fin de platinumCSS : ces règles l'emportent sur les styles
 * de base à spécificité égale.
 */
export const responsiveCSS = `
/* ── Classement complet : un produit par ligne, à toutes les largeurs ──
   Ligne en grille : rang | produit · producteur | label | note. Les colonnes
   label et note ont une largeur fixe pour rester alignées d'une ligne à
   l'autre ; la liste est bornée pour que la note reste proche du nom. */
.pal-ranking, .pal-medals-grid .pal-list{ columns: auto; column-gap: normal; border-top: 1px solid var(--line-strong); }
.pal-ranking{ max-width: 960px; }
.pal-ranking li{
  display: grid; grid-template-columns: 3rem minmax(0, 1fr) 6.5rem;
  align-items: baseline; column-gap: 16px; padding: 14px 12px;
  transition: background-color .15s ease;
}
.pal-ranking.has-labels li{ grid-template-columns: 3rem minmax(0, 1fr) 6.5rem 6.5rem; }
.pal-ranking.no-scores li{ grid-template-columns: 3rem minmax(0, 1fr); }
.pal-ranking.has-labels.no-scores li{ grid-template-columns: 3rem minmax(0, 1fr) 6.5rem; }
@media (hover: hover){ .pal-ranking li:hover{ background: var(--bg-2); } }
.pal-ranking .pal-rank{ grid-column: 1; min-width: 0; }
.pal-ranking-id{ grid-column: 2; min-width: 0; overflow-wrap: anywhere; }
.pal-ranking-meta{ display: contents; }
.pal-ranking .pal-tag{ grid-column: 3; }
.pal-ranking .pal-score{ grid-column: -2; justify-self: end; text-align: right; }
.pal-ranking--dq li{ grid-template-columns: 3rem minmax(0, 1fr) auto; }
.pal-ranking--dq .pal-dq{ grid-column: 3; }

/* Puces de catégorie et bascule de jury : cible tactile de 44px. */
.pal-cats a{ min-height: 44px; display: inline-flex; align-items: center; }

@media (max-width: 880px){
  /* Le libellé de groupe (France, Europe) ne doit pas être écrasé par les
     puces qui défilent. */
  .pal-cats-label{ flex-shrink: 0; }
  /* Largeur selon le contenu : « Jury professionnel » tient sur une ligne. */
  .pal-jury a{ flex: 1 1 auto; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 10px 14px; }
}

/* Tablette : puces sur plusieurs lignes, podium sur trois colonnes, grilles
   des éditions et des jurys sur deux colonnes. */
@media (min-width: 640px) and (max-width: 880px){
  .pal-cats-group{ flex-wrap: wrap; overflow-x: visible; margin: 0; padding: 0; }
  .pal-podium{ grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; }
  .pal-podium li.is-rank-1{ order: 2; }
  .pal-podium li.is-rank-2{ order: 1; margin-top: 24px; }
  .pal-podium li.is-rank-3{ order: 3; margin-top: 40px; }
  .pal-podium li, .pal-podium li.is-rank-1, .pal-podium li.is-rank-2, .pal-podium li.is-rank-3{ padding: 20px; }
  .pal-podium-name, .pal-podium li.is-rank-1 .pal-podium-name{ font-size: 19px; }
  .pal-podium-producer{ font-size: 15px; }
  .pal-podium-meta{ font-size: 16px; }
  .pal-archives-grid, .pal-about-juries{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Mobile : le producteur passe sous le nom, la note à droite et le label
   en dessous de la note. */
@media (max-width: 639px){
  .pal-ranking li, .pal-ranking.has-labels li, .pal-ranking.no-scores li, .pal-ranking.has-labels.no-scores li{
    grid-template-columns: 2.5rem minmax(0, 1fr) auto; column-gap: 12px; row-gap: 0; padding: 12px 0;
  }
  .pal-ranking .pal-rank{ grid-row: 1 / span 2; }
  .pal-ranking-id{ grid-row: 1 / span 2; }
  .pal-ranking-sep{ display: none; }
  .pal-ranking-id .pal-muted{ display: block; margin-top: 2px; font-size: 15px; }
  .pal-ranking .pal-score{ grid-column: 3; grid-row: 1; }
  .pal-ranking .pal-tag{ grid-column: 3; grid-row: 2; justify-self: end; margin-top: 4px; }
  .pal-ranking.no-scores .pal-tag{ grid-row: 1; margin-top: 0; }
  .pal-ranking--dq li{ grid-template-columns: minmax(0, 1fr) auto; }
  .pal-ranking--dq .pal-ranking-id{ grid-column: 1; }
  .pal-ranking--dq .pal-dq{ grid-column: 2; grid-row: 1; }
}
`;
