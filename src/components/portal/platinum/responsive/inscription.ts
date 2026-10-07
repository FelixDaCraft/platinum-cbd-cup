/**
 * Ajustements responsive (mobile et tablette) — groupe « inscription ».
 * Concaténé à la fin de platinumCSS : ces règles l'emportent sur les styles
 * de base à spécificité égale.
 *
 * Parcours d'inscription (/cups/[cupId]/register) : toutes les classes sont
 * préfixées « reg- » ; les classes partagées (.form-card, .kv, .btn) ne sont
 * retouchées que sous .reg-flow.
 */
export const responsiveCSS = `
/* ── Étapes ─────────────────────────────────────────────── */
.reg-stepper{ margin-bottom: 28px; }
.reg-steps{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.reg-step{
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 7px 12px; border-radius: var(--radius-control);
  border: 1px solid var(--line-strong); background: transparent;
  font-size: 15px; font-weight: 500; color: var(--fg-3);
}
.reg-step.is-done{ color: var(--fg-2); }
.reg-step.is-current{ border-color: var(--accent); background: var(--accent-dim); font-weight: 700; color: var(--fg); }
.reg-step-n{ font-weight: 700; color: inherit; }
.reg-step.is-current .reg-step-n{ color: var(--accent-hi); }

/* ── Deux colonnes : contenu de l'étape + récapitulatif ─── */
.reg-layout{ display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
.reg-main{ min-width: 0; }
.reg-summary{ min-width: 0; gap: 0; }
.reg-summary h2{ font-size: 20px; margin-bottom: 8px; }
/* Pas de double filet entre la dernière ligne et le total. */
.reg-summary .reg-line:last-child{ border-bottom: 0; }
@media (min-width: 960px){
  .reg-layout{ grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); }
  .reg-summary{ position: sticky; top: calc(var(--topbar-h, 73px) + 24px); }
}

/* ── Étape 1 : catégories ───────────────────────────────── */
.reg-cat{
  width: 100%; min-height: 44px; text-align: left; padding: 18px 20px;
  border-radius: 12px; color: var(--fg); font: inherit;
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 6px 16px;
  transition: border-color .15s ease, background .15s ease;
}
.reg-cat-info{ min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.reg-cat-name{ font-size: 19px; font-weight: 600; overflow-wrap: anywhere; }
.reg-cat-price{ font-size: 19px; font-weight: 700; white-space: nowrap; }

/* ── Étape 2 : déclaratif labo ──────────────────────────── */
.reg-fieldset{
  margin: 0; padding: 20px; min-width: 0;
  border: 1px solid var(--line); border-radius: 12px;
  display: flex; flex-direction: column; gap: 18px;
}

/* ── Lignes de panier (étape 3 et récapitulatif) ────────── */
.reg-line{
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 16px;
  padding: 16px 0; border-bottom: 1px solid var(--line);
}
.reg-line-info{ min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.reg-line-name{ font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.reg-line-cat{ font-size: 15px; color: var(--fg-2); overflow-wrap: anywhere; }
.reg-line-side{ display: flex; align-items: center; gap: 14px; }
.reg-line-price{ font-size: 17px; font-weight: 700; white-space: nowrap; }
.reg-flow .btn.reg-remove{ padding: 8px 14px; font-size: 15px; min-height: 44px; }

/* ── Étape 4 : coordonnées ──────────────────────────────── */
.reg-kv-v{ text-align: right; overflow-wrap: anywhere; min-width: 0; }

/* ── Étape 5 : paiement ─────────────────────────────────── */
.reg-pay-box{
  padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg);
  display: flex; flex-direction: column; gap: 12px; align-items: flex-start;
}

/* ── Navigation Précédent / Continuer ───────────────────── */
.reg-nav{
  display: flex; flex-wrap: wrap-reverse; justify-content: space-between; gap: 12px;
  padding-top: 22px; border-top: 1px solid var(--line);
}
.reg-nav .btn{ flex: 1 1 auto; max-width: 100%; min-height: 48px; }

/* ── Tablette portrait et mobile ────────────────────────── */
@media (max-width: 959px){
  /* À l'étape panier, la liste du panier EST le récapitulatif : pas de doublon
     sous la carte quand les colonnes sont empilées. */
  .reg-flow[data-step="3"] .reg-summary{ display: none; }
}

/* ── Mobile ─────────────────────────────────────────────── */
@media (max-width: 560px){
  /* Étapes sur une seule ligne : pastilles numérotées, seule l'étape en
     cours affiche son libellé (les autres restent lus par les lecteurs
     d'écran). */
  .reg-stepper{ margin-bottom: 20px; }
  .reg-steps{ flex-wrap: nowrap; gap: 6px; }
  .reg-step{ flex: 0 0 40px; height: 40px; padding: 0; gap: 6px; font-size: 15px; }
  .reg-step.is-current{ flex: 1 1 auto; min-width: 0; padding: 0 10px; }
  .reg-step:not(.is-current) .reg-step-label{
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .reg-step.is-current .reg-step-label{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Prix + « Retirer » empilés à droite, alignés sur le nom du produit. */
  .reg-line{ align-items: start; }
  .reg-line-side{ flex-direction: column; align-items: flex-end; gap: 8px; }

  /* Coordonnées : libellé au-dessus de la valeur (l'email ne tient pas en
     regard de son libellé). */
  .reg-flow .kv{ flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 0; }
  .reg-kv-v{ text-align: left; font-weight: 600; }

  .reg-nav .btn{ flex-basis: 100%; }
}

@media (max-width: 480px){
  /* Cartes imbriquées : on rend de la largeur aux champs. */
  .reg-flow .form-card{ padding: 20px 16px; }
  .reg-cat{ padding: 16px; }
  .reg-cat-name, .reg-cat-price{ font-size: 17px; }
  .reg-fieldset{ padding: 16px 14px; }
  .reg-pay-box{ padding: 16px; }
}
`;
