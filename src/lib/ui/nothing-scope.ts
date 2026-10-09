/**
 * Portée des feuilles de style « Nothing » (organisateur, jury, producteur).
 *
 * Chaque espace scope ses règles sous une classe racine (`.nothing-org`…).
 * Or les dialogues, menus et listes déroulantes (Radix) sont rendus en portail
 * directement dans <body>, hors de cette racine : ils retombaient sur le thème
 * du portail public (boutons dorés, autres polices) — d'où des sous-écrans
 * hors DA. On étend donc chaque sélecteur racine aux contenus portés tant que
 * l'espace est affiché (`body:has(.racine)`).
 */
export function withPortalScope(css: string, rootClass: string): string {
  const scope = `:is(.${rootClass}, body:has(.${rootClass}) > [data-slot$="-content"], body:has(.${rootClass}) > [data-radix-popper-content-wrapper])`;
  const scoped = css.replace(new RegExp(`\\.${rootClass}(?![\\w-])`, "g"), scope);
  // Un dialogue est une surface, pas le fond de page.
  return `${scoped}
body:has(.${rootClass}) > [data-slot$="-content"]{
  background-color: var(--n-surface) !important;
  border-color: var(--n-border-visible) !important;
}
body:has(.${rootClass}) > [data-slot$="-content"] :is([data-slot="dialog-title"], [data-slot="alert-dialog-title"], [data-slot="sheet-title"]){
  font-family: "Doto", "Space Mono", monospace !important;
  font-size: 16px !important; font-weight: 700 !important;
  letter-spacing: 0.04em !important; text-transform: uppercase !important;
  color: var(--n-text-display) !important;
}
body:has(.${rootClass}) > [data-slot$="-content"] :is([data-slot="dialog-description"], [data-slot="alert-dialog-description"]){
  color: var(--n-text-secondary) !important;
}`;
}
