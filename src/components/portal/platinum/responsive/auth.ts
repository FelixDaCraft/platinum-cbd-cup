/**
 * Ajustements responsive (mobile et tablette) — groupe « auth ».
 * Concaténé à la fin de platinumCSS : ces règles l'emportent sur les styles
 * de base à spécificité égale.
 *
 * Pages : /login, /register, /register/jury, /forgot-password,
 * /reset-password, /activate, /jury-invite/[token]. Leur conteneur porte
 * `.auth-page` : les classes partagées (.form-card, .pw-toggle, .form-foot,
 * .notice…) ne sont surchargées que sous ce préfixe.
 */
export const responsiveCSS = `
/* Carte d'attente (chargement, redirection) : remplace un style en ligne. */
.form-card.auth-pending{ margin-top: 72px; align-items: center; padding: 56px 24px; text-align: center; }

@media (max-width: 880px){
  /* Aligné sur le haut de .pg-head en mobile (32px) plutôt que 72px. */
  .form-card.auth-pending{ margin-top: 32px; padding: 44px 22px; }

  /* Bouton « afficher le mot de passe » : 40px → 44px, la hauteur du champ. */
  .auth-page .pw-toggle{ right: 0; width: 44px; height: 44px; }

  /* Liens texte (« Mot de passe oublié ? », pied de carte) : zone tactile
     portée à 44px sans décaler la ligne (marge négative = padding). */
  .auth-page .auth-forgot,
  .auth-page .form-foot a{
    display: inline-block; padding: 12px 0; margin: -12px 0;
  }
  /* « Créer un compte », « Se connecter » : jamais coupés en deux lignes. */
  .auth-page .form-foot a{ white-space: nowrap; }
}

@media (max-width: 480px){
  /* Carte et message d'erreur imbriqués : on rend de la largeur au texte. */
  .auth-page .form-card .notice{ padding: 14px; }
  .auth-page .pw-criteria{ gap: 4px 16px; }
}
`;
