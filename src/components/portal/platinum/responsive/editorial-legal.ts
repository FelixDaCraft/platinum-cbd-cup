/**
 * Ajustements responsive (mobile et tablette) — groupe « editorial-legal ».
 * Concaténé à la fin de platinumCSS : ces règles l'emportent sur les styles
 * de base à spécificité égale.
 *
 * Pages : presse, articles, partenaires, contact (classe `.editorial` sur le
 * conteneur `.pg`) et documents légaux (`.legal`, via LegalPage). Les classes
 * partagées (.pg-*, .prose, .form-*, .btn…) ne sont surchargées que sous ces
 * deux portées.
 */
export const responsiveCSS = `
/* ── Documents légaux (LegalPage) ───────────────────────── */
/* Adresses email, URL et références (« 261-7-1° ») ne doivent jamais
   pousser la page en largeur sur un écran étroit. */
.legal .prose, .legal .pg-lede{ overflow-wrap: break-word; }
.legal .prose a{ overflow-wrap: anywhere; }

.legal-section{
  padding: 36px 0;
  border-top: 1px solid var(--line);
  /* En-tête collant : le titre visé par une ancre ne doit pas passer dessous. */
  scroll-margin-top: 96px;
}

.legal-toc{
  margin-bottom: 16px;
  padding: 20px 22px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-2);
}
.legal-toc-title{ margin: 0 0 12px; font-size: 16px; font-weight: 700; color: var(--fg); }
.legal-toc-list{
  margin: 0; padding: 0; list-style: none;
  columns: 2 240px; column-gap: 32px;
  font-size: 15px; line-height: 1.5;
}
.legal-toc-list li{ break-inside: avoid; padding: 4px 0; }
/* Règlement édité dans le back-office : l'intertitre ouvre sa section. */
.legal-section > h2:first-child{ margin-top: 0; text-wrap: balance; }
.legal-toc-list a{
  color: var(--fg-2);
  text-decoration-color: var(--line-strong);
  text-underline-offset: 4px;
}
.legal-toc-list a:hover{ color: var(--fg); }

/* Tableau clé / valeur : chaque ligne passe sur deux lignes quand la
   largeur manque (mobile) au lieu de déborder. */
.legal-kv{
  margin-bottom: 0;
  padding: 4px 22px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  font-size: 16px; line-height: 1.5;
}
.legal-kv > div{
  display: flex; flex-wrap: wrap; gap: 2px 20px;
  padding: 12px 0;
}
.legal-kv > div + div{ border-top: 1px solid var(--line); }
.legal-kv dt{ flex: 0 0 190px; color: var(--fg-3); }
.legal-kv dd{
  flex: 1 1 260px; min-width: 0; margin: 0;
  color: var(--fg); overflow-wrap: anywhere;
}

/* ── Pages éditoriales (presse, articles, partenaires, contact) ── */
/* Titres, extraits et adresses viennent de l'administration : un mot ou une
   URL sans espace ne doit pas élargir une tuile au-delà de l'écran. */
.editorial .pg-lede, .editorial .pg-tile, .editorial .prose,
.editorial h1, .editorial h2{ overflow-wrap: break-word; }
.editorial .pg-link[href^="mailto:"], .editorial .prose a{ overflow-wrap: anywhere; }

.editorial-cover{
  position: relative; aspect-ratio: 16 / 9;
  border-radius: 14px; overflow: hidden;
  margin-bottom: 40px;
}
.editorial .prose pre{ max-width: 100%; overflow-x: auto; }

/* Contact : formulaire et coordonnées côte à côte dès que la place le permet. */
.contact-layout{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 32px; align-items: start;
}
.contact-consent{ display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
.contact-consent-text{ font-size: 15px; line-height: 1.5; color: var(--fg-2); }

/* ── Écrans tactiles : cibles d'au moins 44px ─────────────── */
@media (max-width: 880px), (pointer: coarse){
  .legal-toc-list li{ padding: 0; }
  .legal-toc-list a{
    display: flex; align-items: center; min-height: 44px;
    padding: 4px 0;
  }
  /* Liens de retour (« Tous les articles ») : zone de toucher agrandie sans
     décaler la mise en page. */
  .editorial .editorial-back{
    display: inline-flex; align-items: center; align-self: flex-start;
    min-height: 44px; margin: -10px 0;
  }
  .editorial .sponsor-links a{ display: inline-flex; align-items: center; min-height: 44px; }
  .contact-consent{ min-height: 44px; padding: 10px 0; margin: -10px 0; }
}

/* ── Mobile (≤ 880px) ─────────────────────────────────────── */
@media (max-width: 880px){
  .legal-section{ padding: 28px 0; scroll-margin-top: 80px; }
  .legal-toc{ padding: 16px 18px; }
  .legal-toc-list{ columns: 1; }
  .legal-kv{ padding: 2px 16px; font-size: 15px; }
  .legal-kv > div{ padding: 10px 0; }
  .legal-kv dt{ flex-basis: 100%; }
  .legal-kv dd{ flex-basis: 100%; }

  .editorial-cover{ margin-bottom: 24px; border-radius: 12px; }
  .contact-layout{ gap: 20px; }
}

/* ── Téléphones : boutons isolés pleine largeur, comme .form-actions ── */
@media (max-width: 560px){
  .editorial .pg-section-head{ flex-direction: column; align-items: stretch; }
  .editorial .pg-section-head .btn,
  .editorial .editorial-cta{ width: 100%; }
}
`;
