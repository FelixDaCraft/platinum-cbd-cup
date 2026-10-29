/**
 * Direction « street » 2027 du portail public (octobre 2026).
 *
 * Le site reprend la DA des visuels Instagram 2027 : fond nuit, or en
 * aplats, Unbounded en capitales pour les titres (mots-clés liquéfiés),
 * étoiles, barre d'édition entre deux filets, cadres à angle droit, photos
 * en bichromie or. Louize Display reste réservée au nom de la cup dans
 * l'en-tête et le pied de page ; les couleurs ne changent pas.
 *
 * Tout est limité à `.shell` (la coquille du portail) : le back-office et
 * les espaces jury / producteur partagent `.btn`, `.card` et les variables
 * de platinum-styles.ts, et ne doivent pas bouger.
 */
export const streetCSS = `
@font-face{
  font-family: "Unbounded";
  src: url("/fonts/Unbounded-VF.woff2") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}

.shell{
  --st-display: "Unbounded", "Hanken Grotesk", ui-sans-serif, sans-serif;
  --st-night: #0c0b09;
  --st-ink: #f3eee3;
  --st-ink-2: rgba(243,238,227,.74);
  --st-ink-3: rgba(243,238,227,.56);
  --st-gold: var(--accent);
  --st-gold-hi: var(--accent-hi);
  --st-frame: rgba(212,175,55,.42);
  --st-rule: rgba(243,238,227,.86);
  --st-hair: rgba(243,238,227,.14);
  /* Limites de contrôles (champs, pastilles) : ≥ 3:1 sur la nuit (WCAG 1.4.11). */
  --st-control: rgba(243,238,227,.42);
  --st-control-hi: rgba(243,238,227,.62);
  --st-raised: #13110d;
  --st-max: 1320px;
  --st-ease: cubic-bezier(.16,1,.3,1);
  color: var(--st-ink);
  font-size: 17px;
  /* Ruban incliné et mots géants : rien ne doit élargir la page. */
  overflow-x: clip;
}
.shell ::selection{ background: var(--st-gold); color: var(--st-night); }
.shell{ caret-color: var(--st-gold); accent-color: var(--st-gold); }
.st-defs{ position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }

/* Angles droits partout : la DA n'a aucun coin arrondi. Seuls les
   pastilles et avatars restent ronds. */
.shell [class], .shell a, .shell button, .shell input, .shell select, .shell textarea, .shell img{ border-radius: 0; }
.shell .home-tier-dot, .shell .pal-medal-dot, .shell .home-status-dot,
.shell .pal-juror-avatar, .shell .st-dot, .shell .live-dot{ border-radius: 50%; }

/* ── Typographie ───────────────────────────────────────────── */
.shell h1, .shell h2, .shell h3, .shell h4{
  font-family: var(--st-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  line-height: .98;
  text-wrap: balance;
}
.shell h3, .shell h4{ font-weight: 700; letter-spacing: 0; line-height: 1.1; }
.shell .display, .shell h2.section-title{
  font-family: var(--st-display); font-weight: 800; text-transform: uppercase;
  background: none; -webkit-text-fill-color: currentColor; color: var(--st-ink);
  letter-spacing: -0.01em; line-height: .95;
}
.shell .display em{ background: none; -webkit-text-fill-color: currentColor; color: var(--st-gold); font-style: normal; }
.shell h2.section-title{ font-size: clamp(30px, 4.6vw, 60px); }
.shell .eyebrow{ font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .16em; color: var(--st-gold); }
.shell .eyebrow b{ color: var(--st-gold); font-weight: 600; }
.shell .lede, .shell .pg-lede{ color: var(--st-ink-2); }
.shell a{ text-underline-offset: 4px; }
.shell .tabular, .shell .pal-score, .shell .home-cat-price{ font-variant-numeric: tabular-nums; }

/* Mot liquéfié : la taille se règle sur l'élément, le filtre suit. */
.st-liquid{ display: block; font-family: var(--st-display); font-weight: 900; text-transform: uppercase;
  line-height: .84; letter-spacing: -0.02em; color: var(--st-ink); }

.st-sparkle{ flex: none; color: var(--st-gold); }

/* Titre ajusté : jamais plus large que son conteneur, quel que soit l'écran.
   Unbounded 900 en capitales occupe environ 0,93 em par caractère. */
/* Uniquement sur des blocs dont la largeur vient du parent : un élément flex
   dimensionné par son contenu tomberait à 0 et son titre avec. */
.st-head, .st-hero-text, .st-pal-head, .st-close-text, .st-jury, .st-podium-sec{ container-type: inline-size; }
.shell .st-fit{ font-size: min(var(--fs), calc(100cqw / (var(--fit-chars) * .96))); }

/* ── Boutons ───────────────────────────────────────────────── */
.shell .btn{
  font-family: var(--st-display); font-weight: 700; font-size: 13px; letter-spacing: .08em;
  text-transform: uppercase; line-height: 1.2;
  padding: 16px 24px; border: 2px solid var(--st-ink); background: var(--st-ink); color: var(--st-night);
  transition: background .2s var(--st-ease), color .2s var(--st-ease), border-color .2s var(--st-ease), transform .2s var(--st-ease);
}
.shell .btn:hover{ filter: none; transform: translateY(-2px); }
.shell .btn:active{ transform: translateY(0); }
.shell .btn.accent{ background: var(--st-gold); border-color: var(--st-gold); color: var(--st-night); }
.shell .btn.accent:hover{ background: var(--st-gold-hi); border-color: var(--st-gold-hi); }
.shell .btn.ghost{ background: transparent; color: var(--st-ink); border-color: var(--st-ink); }
.shell .btn.ghost:hover{ border-color: var(--st-gold); color: var(--st-gold-hi); }
.shell .btn.btn-lg{ padding: 19px 30px; font-size: 14px; }
.shell .btn:disabled, .shell .btn[aria-disabled="true"]{ opacity: .45; cursor: not-allowed; transform: none; }
.shell .btn:focus-visible, .shell a:focus-visible, .shell button:focus-visible, .shell select:focus-visible{
  outline: 2px solid var(--st-gold-hi); outline-offset: 3px;
}

/* ── Pastilles et champs ───────────────────────────────────── */
.shell .pill{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; border-color: var(--st-frame); }
.shell .field-input{ height: 50px; background: var(--st-raised); border: 1px solid var(--st-control); color: var(--st-ink); font-size: 16px; }
.shell .field-input:hover{ border-color: var(--st-control-hi); }
.shell .field-input:focus{ border-color: var(--st-gold); box-shadow: 0 0 0 1px var(--st-gold); }
.shell textarea.field-input{ height: auto; }
.shell .field-label{ font-family: var(--st-display); font-weight: 600; font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--st-ink); }
.shell .field-hint{ color: var(--st-ink-3); }
.shell .pt-check-box{ border-radius: 0; border-color: var(--st-control); }
.shell input::placeholder, .shell textarea::placeholder{ color: var(--st-ink-3); }

/* ── Barre d'édition, liste dorée, ruban ────────────────────── */
.st-edition{
  margin: 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 14px;
  padding: 11px 0; border-top: 2px solid var(--st-rule); border-bottom: 2px solid var(--st-rule);
  font-family: var(--st-display); font-weight: 700; font-size: 13px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--st-gold); text-align: center;
}
.st-goldlist{ margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
  font-family: var(--st-display); font-weight: 700; font-size: 15px; line-height: 1.15; text-transform: uppercase; color: var(--st-gold); }
.st-goldlist li{ display: inline-flex; align-items: center; gap: 14px; white-space: nowrap; }

.st-tape{ position: relative; z-index: 2; margin: 0 calc(-1 * var(--pad-x)); overflow: hidden;
  transform: rotate(-2.2deg); background: var(--st-gold); color: var(--st-night);
  box-shadow: 0 18px 40px -18px rgba(0,0,0,.9); }
.st-tape .st-sparkle{ color: var(--st-night); }
/* Trois tours puis arrêt (WCAG 2.2.2 : un mouvement de plus de 5 s doit
   pouvoir cesser) ; pause au survol et quand le focus est dedans. */
.st-tape-track{ display: flex; width: max-content; animation: st-tape 38s linear 3 forwards; }
.st-tape:hover .st-tape-track, .st-tape:focus-within .st-tape-track{ animation-play-state: paused; }
.st-tape-run{ display: flex; align-items: center; gap: 22px; padding: 14px 11px; white-space: nowrap;
  font-family: var(--st-display); font-weight: 800; font-size: clamp(15px, 1.6vw, 22px); letter-spacing: .02em; text-transform: uppercase; }
@keyframes st-tape{ from{ transform: translateX(0); } to{ transform: translateX(-50%); } }




/* ── En-tête de page ───────────────────────────────────────── */
.st-head{ width: 100%; max-width: var(--st-max); margin: 0 auto; padding: 40px 0 56px; display: flex; flex-direction: column; gap: 28px; }
.st-head .st-edition{ align-self: stretch; }
.st-head-title{ margin: 12px 0 0; --fs: clamp(54px, 10.5vw, 156px); font-size: var(--fs); }
.st-head-lede{ margin: 0; max-width: 62ch; font-size: clamp(17px, 1.5vw, 20px); line-height: 1.6; color: var(--st-ink-2); }
.st-head .home-actions, .st-head .form-actions{ margin-top: 4px; }

/* ── Coquille : en-tête ────────────────────────────────────── */
.shell .topbar{
  padding: 0 var(--pad-x); min-height: 76px; gap: 12px 28px;
  background: color-mix(in srgb, var(--st-night) 92%, transparent);
  border-bottom: 2px solid var(--st-rule);
}
.shell .brand{ gap: 12px; }
.shell .brand-mark{ width: 40px; height: 40px; filter: none; }
.shell .brand-name{ font-size: 25px; }
.shell .topbar{ flex-wrap: nowrap; }
.shell .nav{ flex-wrap: nowrap; white-space: nowrap; gap: 4px 28px; font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
.shell .topbar-right{ flex: none; white-space: nowrap; }
.shell .nav a{ position: relative; padding: 27px 0; border-bottom: 0; color: var(--st-ink); }
.shell .nav a::after{ content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 5px; background: var(--st-gold);
  transform: scaleX(0); transform-origin: left; transition: transform .35s var(--st-ease); }
.shell .nav a:hover{ color: var(--st-gold-hi); }
.shell .nav a:hover::after, .shell .nav a.active::after{ transform: scaleX(1); }
.shell .nav a.active{ color: var(--st-gold); }
.shell .topbar-link{ font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
.shell .topbar .btn{ padding: 12px 18px; font-size: 12px; }

/* Unbounded en capitales est plus large que l'ancienne police : l'en-tête
   allège sa navigation plus tôt pour rester sur une ligne. « Presse » et
   « Le concours » restent dans le pied de page. */
@media (min-width: 881px) and (max-width: 1400px){
  .shell .nav{ gap: 4px 22px; letter-spacing: .08em; }
  .shell .topbar-link{ letter-spacing: .08em; }
  .shell .nav a[data-hide-below="1024"]{ display: none; }
}
@media (min-width: 881px) and (max-width: 1220px){
  .shell .nav a[data-hide-below="960"]{ display: none; }
  .shell .topbar{ gap: 12px 20px; }
}
@media (min-width: 881px) and (max-width: 1060px){
  .shell .brand-name{ font-size: 21px; }
  .shell .nav{ gap: 4px 16px; font-size: 11px; }
  .shell .topbar-link{ font-size: 11px; padding: 10px 2px; }
  .shell .topbar .btn{ padding: 11px 12px; font-size: 11px; letter-spacing: .04em; }
}

/* ── Coquille : pied de page ───────────────────────────────── */
.shell .footer.st-footer{ display: block; padding: 0 var(--pad-x) 40px; border-top: 0; color: var(--st-ink-2); font-size: 15px; }
.st-footer-inner{ max-width: var(--st-max); margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
.st-footer-top{ display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 48px; align-items: end; padding-top: 72px; }
.st-footer-brand{ display: flex; flex-direction: column; gap: 22px; }
.st-footer-name{ font-family: var(--display); font-style: italic; font-weight: 700; font-size: clamp(48px, 7vw, 104px); line-height: .92; color: var(--st-ink); letter-spacing: -0.01em; }
.st-footer-tag{ margin: 0; max-width: 40ch; line-height: 1.6; }
.st-footer-nav{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 32px; }
.shell .st-footer-nav a{ font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--st-ink); padding: 6px 0; }
.shell .st-footer-nav a:hover{ color: var(--st-gold-hi); }
.st-footer-base{ display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 18px 32px; padding-top: 22px; border-top: 1px solid var(--st-hair); }
.st-footer-links{ display: flex; flex-direction: column; gap: 28px; }
.st-footer-social{ margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 12px; }
.shell .st-footer-social a{ display: inline-flex; align-items: center; gap: 14px; padding: 12px 18px 12px 14px; border: 2px solid var(--st-ink);
  color: var(--st-ink); text-decoration: none; transition: background .25s var(--st-ease), color .25s var(--st-ease), border-color .25s var(--st-ease); }
.shell .st-footer-social a:hover{ background: var(--st-gold); border-color: var(--st-gold); color: var(--st-night); }
.st-footer-social span{ display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.1; }
.st-footer-social b{ font-family: var(--st-display); font-weight: 700; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }

/* ── Conteneurs communs ────────────────────────────────────── */
.shell .page{ padding-bottom: 0; }
.shell .pg, .shell .pal{ max-width: var(--st-max); }
.shell .pg--narrow{ max-width: 860px; }
.shell .pg--form{ max-width: 620px; }
.shell .pg-head{ padding: 56px 0 40px; }
.shell .pg-head h1, .shell .pal-head h1{ font-size: clamp(40px, 7vw, 96px); line-height: .92; }
.shell .pg-section{ padding: 64px 0; }
.shell .pg-section + .pg-section{ border-top: 2px solid var(--st-rule); }
.shell .pg-section h2{ font-size: clamp(26px, 3.4vw, 44px); }
.shell .pg-tile, .shell .card, .shell .form-card, .shell .pal-empty, .shell .pal-juror{
  background: transparent; border: 1px solid var(--st-frame);
}
.shell a.pg-tile{ transition: background .25s var(--st-ease), border-color .25s var(--st-ease); }
.shell a.pg-tile:hover{ border-color: var(--st-gold); background: rgba(212,175,55,.06); }
.shell .pg-tile h3{ font-size: clamp(18px, 1.6vw, 22px); }
.shell .pg-meta{ color: var(--st-ink-3); }
.shell .pg-link, .shell .home-link{ font-family: var(--st-display); font-weight: 700; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--st-gold); }
.shell .form-card{ padding: 40px; gap: 24px; }
.shell .form-card h2{ font-size: 22px; }
.shell .form-foot{ border-top-color: var(--st-hair); }
.shell .notice{ border-color: var(--st-hair); background: var(--st-raised); }
.shell .notice.is-info{ border-color: var(--st-frame); background: rgba(212,175,55,.07); }

/* Texte long (articles, règlement, légales). */
.shell .prose{ font-size: 18px; line-height: 1.75; color: var(--st-ink-2); max-width: 70ch; }
.shell .prose h2{ font-size: clamp(22px, 2.4vw, 30px); margin-top: 2.2em; color: var(--st-ink); }
.shell .prose h3{ font-size: 18px; margin-top: 1.8em; color: var(--st-ink); }
.shell .prose a{ color: var(--st-gold-hi); }
.shell .prose blockquote{ border-left: 0; padding: 4px 0 4px 26px; position: relative; font-size: 1.1em; color: var(--st-ink); }
.shell .prose blockquote::before{ content: ""; position: absolute; left: 0; top: .45em; width: 12px; height: 12px; background: var(--st-gold);
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%); }
.shell .prose img{ border-radius: 0; }

/* Barre basse mobile. */
.shell .mobile-bottom-nav{ font-family: var(--st-display); border-top: 2px solid var(--st-rule); background: color-mix(in srgb, var(--st-night) 94%, transparent); }
.shell .mobile-bottom-nav__label{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
.shell .mobile-bottom-nav__item.is-active{ color: var(--st-night); background: var(--st-gold); border-top-color: var(--st-gold); }

@media (max-width: 880px){
  .shell{ font-size: 16px; }
  .shell .topbar{ min-height: 60px; border-bottom-width: 1px; }
  .shell .brand-mark{ width: 32px; height: 32px; }
  .shell .brand-name{ font-size: 21px; }
  .st-head{ padding: 20px 0 36px; gap: 20px; }
  .st-head-title{ --fs: clamp(42px, 14vw, 72px); }
  .st-edition{ font-size: 11px; letter-spacing: .12em; padding: 9px 0; }
  .st-goldlist{ font-size: 13px; gap: 6px 10px; }
  .st-goldlist li{ gap: 10px; }
  .shell .btn{ padding: 16px 20px; }
  .shell .form-card{ padding: 24px 20px; }
  .shell .pg-section{ padding: 40px 0; }
  .shell .footer.st-footer{ padding-bottom: calc(40px + 56px + env(safe-area-inset-bottom)); }
  .st-footer-top{ grid-template-columns: 1fr; padding-top: 48px; gap: 32px; }
  .st-footer-inner{ gap: 32px; }
  .shell .prose{ font-size: 17px; }
}


/* ── Sections communes ─────────────────────────────────────── */
.st-home{ display: flex; flex-direction: column; }
.st-sec{ width: 100%; max-width: var(--st-max); margin: 0 auto; padding: 120px 0 0; display: flex; flex-direction: column; gap: 48px; }
.st-sec-head{ display: flex; flex-direction: column; gap: 20px; max-width: 900px; }
.st-sec-head.is-split{ max-width: none; flex-direction: row; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px 48px; }
.st-sec-head.is-split > .st-sec-lede{ max-width: 40ch; }
.shell .st-h2{ margin: 0; font-size: clamp(34px, 5.4vw, 76px); font-weight: 900; line-height: .9; letter-spacing: -0.02em; }
.st-h2-liquid{ margin: 0; --fs: clamp(40px, 7vw, 104px); font-size: var(--fs); }
.st-sec-lede{ margin: 0; font-size: clamp(17px, 1.4vw, 19px); line-height: 1.6; color: var(--st-ink-2); max-width: 58ch; }
.st-actions{ display: flex; flex-wrap: wrap; gap: 14px; }
.shell .st-link-arrow{ display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; text-decoration: none; padding: 6px 0;
  border-bottom: 2px solid currentColor; }
.shell .st-link-arrow svg{ transition: transform .3s var(--st-ease); }
.shell .st-link-arrow:hover{ color: var(--st-gold-hi); }
.shell .st-link-arrow:hover svg{ transform: translate(2px, -2px); }

/* Statut de l'édition : étiquette or pleine, inclinée comme le ruban
   (ouverte) ; simple filet crème sinon. */
.st-status{ margin: 0; align-self: flex-start; display: inline-block; padding: 11px 16px 10px;
  font-family: var(--st-display); font-weight: 800; font-size: 13px; line-height: 1.25; letter-spacing: .06em; text-transform: uppercase;
  color: var(--st-ink); border: 2px solid var(--st-ink); transform: rotate(-1.6deg); transform-origin: left center; }
.st-status.is-open{ background: var(--st-gold); border-color: var(--st-gold); color: var(--st-night);
  box-shadow: 0 14px 30px -16px rgba(0,0,0,.9); }

/* ── Hero de l'accueil ─────────────────────────────────────── */
.st-hero{ width: 100%; max-width: var(--st-max); margin: 0 auto; padding: 28px 0 88px; display: flex; flex-direction: column; gap: 56px; }
.st-hero-grid{ display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); gap: 56px; align-items: center; }
.st-hero-text{ display: flex; flex-direction: column; gap: 28px; min-width: 0; }
.st-hero-title{ margin: 0; --fs: clamp(56px, 7.6vw, 124px); font-size: var(--fs); }
.st-hero-lede{ margin: 0; max-width: 46ch; font-size: clamp(17px, 1.45vw, 20px); line-height: 1.6; color: var(--st-ink-2); }
.st-hero-text{ position: relative; z-index: 2; }
.st-hero-visual{ position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 640px; }
/* L'emblème (750 px) déborde de sa colonne : il mord sur les marges plutôt
   que d'allonger le hero. */
.st-hero-visual > div{ flex: none; margin: -55px -90px; }
.st-hero-visual canvas{ cursor: grab; }
/* Logo fixe quand l'emblème 3D n'est pas monté (mobile, tablette, écran
   tactile) ; masqué dès que le canvas est là. */
.st-hero-mark{ display: block; width: min(100%, 340px); height: auto; aspect-ratio: 1; object-fit: contain; transform: rotate(8deg); }
.st-hero-visual:has(canvas) .st-hero-mark{ display: none; }

/* ── Calendrier ────────────────────────────────────────────── */
.st-steps{ width: 100%; max-width: var(--st-max); margin: 0 auto; padding: 104px 0 0; }
.st-steps ol{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  border-top: 2px solid var(--st-rule); border-bottom: 2px solid var(--st-rule); }
.st-step{ display: flex; flex-direction: column; gap: 10px; padding: 28px 28px 30px; }
.st-step + .st-step{ border-left: 1px solid var(--st-hair); }
.st-step:first-child{ padding-left: 0; }
.st-step-tag{ display: inline-flex; align-items: center; gap: 8px; font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--st-ink-3); }
.st-step.is-current .st-step-tag{ color: var(--st-gold); }
.st-step-title{ font-family: var(--st-display); font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: .02em; }
.st-step-dates{ font-family: var(--st-display); font-weight: 800; font-size: clamp(24px, 2.6vw, 38px); letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.st-step.is-current .st-step-dates{ color: var(--st-gold); }
.st-step.is-done .st-step-dates, .st-step.is-done .st-step-title{ color: var(--st-ink-3); }
.st-step-when{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
.st-step-when.is-visible{ position: static; width: auto; height: auto; clip: auto; white-space: normal; color: var(--st-ink-2); font-size: 15px; }

/* ── Catégories et tarifs ──────────────────────────────────── */
.st-cats-list{ margin: 0; padding: 0; list-style: none; border-top: 2px solid var(--st-rule); }
.st-cats-list li{ position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, auto) 120px; gap: 24px; align-items: center;
  padding: 26px 0; border-bottom: 1px solid var(--st-hair); isolation: isolate; }
/* Les lignes ne sont pas des liens : survol discret, sans aplat. */
.st-cats-list li:hover .st-cat-name{ color: var(--st-gold-hi); }
.st-cat-name{ font-family: var(--st-display); font-weight: 800; font-size: clamp(22px, 3.1vw, 44px); text-transform: uppercase; letter-spacing: -0.015em; line-height: 1; transition: color .3s; }
.st-cat-criteria{ display: block; margin-top: 10px; font-family: var(--sans); font-size: 15px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--st-ink-3); }
.st-cat-places{ font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--st-ink-2); text-align: right; }
.st-cat-places.is-low{ color: var(--st-gold-hi); }
.st-cat-price{ font-family: var(--st-display); font-weight: 800; font-size: clamp(22px, 2.4vw, 32px); text-align: right; color: var(--st-gold); font-variant-numeric: tabular-nums; }
.st-cats-list li.is-full .st-cat-name, .st-cats-list li.is-full .st-cat-price{ color: var(--st-ink-3); text-decoration: line-through; text-decoration-thickness: 2px; }
.shell .st-cats-cta{ align-self: flex-start; }

/* ── Deux jurys ────────────────────────────────────────────── */
.st-juries-grid{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, .78fr) minmax(0, 1fr); gap: 0; border-top: 2px solid var(--st-rule); border-bottom: 2px solid var(--st-rule); }
.st-jury{ display: flex; flex-direction: column; gap: 18px; padding: 40px 40px 48px 0; min-width: 0; }
.st-jury.is-public{ padding: 40px 0 48px 40px; }
.st-jury-word{ --fs: clamp(52px, 5.6vw, 92px); font-size: var(--fs); margin-bottom: 8px; }
.st-jury.is-public .st-jury-word{ color: var(--st-gold); }
.shell .st-jury h3{ margin: 0; font-size: clamp(17px, 1.5vw, 21px); }
.st-jury p{ margin: 0; line-height: 1.65; color: var(--st-ink-2); }
.st-tiers{ margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; border-top: 1px solid var(--st-hair); }
.st-tiers li{ display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--st-hair); }
.st-tiers b{ font-family: var(--st-display); font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; }
.st-tiers li > span:last-child{ font-variant-numeric: tabular-nums; color: var(--st-ink-2); }
.st-dot{ width: 12px; height: 12px; display: inline-block; }

.st-sample{ margin: 0; align-self: center; justify-self: center; width: min(100%, 300px); padding: 22px; background: var(--st-ink); color: var(--st-night);
  transform: rotate(2.5deg); box-shadow: 0 30px 60px -24px rgba(0,0,0,.9), 0 2px 0 rgba(0,0,0,.4);
  display: flex; flex-direction: column; gap: 18px; transition: transform .6s var(--st-ease); }
.st-sample:hover{ transform: rotate(0deg) translateY(-4px); }
.st-sample-head{ display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 2px solid var(--st-night);
  font-family: var(--st-display); font-weight: 700; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.st-sample-flag{ padding: 4px 8px; background: var(--st-night); color: var(--st-ink); font-size: 11px; }
.st-sample-codes{ margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.st-sample-codes div{ display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.st-sample-codes div + div{ padding-left: 16px; border-left: 2px dashed rgba(12,11,9,.5); }
.st-sample-codes dt{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: rgba(12,11,9,.72); }
.st-sample-codes dd{ margin: 0; font-family: var(--st-display); font-weight: 900; font-size: 46px; line-height: .9; letter-spacing: -0.03em; }
.st-sample-note{ margin: 0; font-size: 14px; line-height: 1.5; color: rgba(12,11,9,.82); }

/* ── Podium (accueil) ──────────────────────────────────────── */
.st-podium-head{ display: flex; flex-direction: column; gap: 14px; }
.st-podium{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; align-items: end; }
.st-podium li{ position: relative; display: flex; flex-direction: column; gap: 10px; min-width: 0; overflow-wrap: anywhere; }
.st-podium li.is-rank-1{ order: 2; }
.st-podium li.is-rank-2{ order: 1; }
.st-podium li.is-rank-3{ order: 3; }
.st-podium-rank{ font-family: var(--st-display); font-weight: 900; font-size: clamp(72px, 8vw, 128px); line-height: .8; letter-spacing: -0.04em;
  color: transparent; -webkit-text-stroke: 2px var(--st-ink-3); }
.st-podium-rank sup{ font-size: .32em; -webkit-text-stroke: 0; color: var(--st-ink-3); vertical-align: top; position: relative; top: .25em; margin-left: 4px; letter-spacing: 0; }
.st-podium li.is-rank-1 .st-podium-rank{ color: var(--st-gold); -webkit-text-stroke: 0; font-size: clamp(96px, 11vw, 172px); }
.st-podium li.is-rank-1 .st-podium-rank sup{ color: var(--st-gold); }
.st-podium-logo{ display: grid; place-items: center; aspect-ratio: 5 / 4; border: 1px solid var(--st-frame); background: var(--st-night); padding: 14%; margin: 8px 0 10px; }
.st-podium-logo.is-score{ align-content: center; gap: 10px; text-align: center; }
.st-podium-logo.is-score b{ white-space: nowrap; overflow-wrap: normal; font-family: var(--st-display); font-weight: 900; font-size: clamp(40px, 4.4vw, 68px); line-height: .9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.st-podium-logo.is-score small{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--st-ink-3); }
.st-podium li.is-rank-1 .st-podium-logo.is-score{ background: var(--st-gold); color: var(--st-night); }
.st-podium li.is-rank-1 .st-podium-logo.is-score small{ color: rgba(12,11,9,.7); }
.st-podium li.is-rank-1 .st-podium-logo{ border: 2px solid var(--st-gold); }
.st-podium-logo img{ width: 100%; height: 100%; object-fit: contain; }
.st-podium-name{ font-family: var(--st-display); font-weight: 800; font-size: clamp(19px, 1.9vw, 26px); text-transform: uppercase; line-height: 1.05; }
.st-podium-producer{ color: var(--st-ink-2); }
.st-podium-prize{ align-self: flex-start; margin-top: 6px; padding: 6px 10px; background: var(--st-gold); color: var(--st-night);
  font-family: var(--st-display); font-weight: 700; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.st-podium li:not(.is-rank-1) .st-podium-prize{ background: transparent; color: var(--st-ink); outline: 1px solid var(--st-ink-3); }
.st-podium-score{ font-family: var(--st-display); font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }

/* ── Par profil ────────────────────────────────────────────── */
.st-routes ul{ margin: 0; padding: 0; list-style: none; border-top: 2px solid var(--st-rule); }
.st-routes li{ border-bottom: 1px solid var(--st-hair); }
.shell .st-route{ position: relative; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) auto; gap: 16px 40px; align-items: center;
  padding: 30px 0; color: var(--st-ink); text-decoration: none; isolation: isolate; }
.st-route::before{ content: ""; position: absolute; inset: 0 calc(-1 * var(--pad-x)); z-index: -1; background: var(--st-ink);
  clip-path: inset(0 100% 0 0); transition: clip-path .55s var(--st-ease); }
.st-route:hover::before, .st-route:focus-visible::before{ clip-path: inset(0 0 0 0); }
.shell .st-route:hover, .shell .st-route:focus-visible{ color: var(--st-night); }
.st-route-name{ font-family: var(--st-display); font-weight: 900; font-size: clamp(30px, 4.6vw, 68px); text-transform: uppercase; letter-spacing: -0.02em; line-height: .95; }
.st-route-text{ line-height: 1.55; color: inherit; opacity: .78; }
.st-route-cta{ display: inline-flex; align-items: center; gap: 10px; font-family: var(--st-display); font-weight: 700; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }

/* ── Clôture ───────────────────────────────────────────────── */
.st-close{ width: 100%; max-width: var(--st-max); margin: 120px auto 0; padding: 0 0 24px; }
.st-close .st-close-text{ max-width: 980px; }
.st-close-text{ display: flex; flex-direction: column; gap: 28px; }
.st-close-text .st-edition{ align-self: stretch; }
.st-close-title{ margin: 8px 0 0; --fs: clamp(48px, 6.4vw, 104px); font-size: var(--fs); color: var(--st-gold); }

@media (max-width: 1100px){
  .st-juries-grid{ grid-template-columns: 1fr 1fr; }
  .st-sample{ grid-column: 1 / -1; grid-row: 2; margin: 8px 0 40px; }
}
@media (max-width: 880px){
  .st-sec{ padding-top: 72px; gap: 28px; }
  .st-hero{ padding: 16px 0 48px; gap: 28px; }
  .st-hero-grid{ grid-template-columns: 1fr; gap: 36px; }
  .st-hero-title{ --fs: clamp(54px, 17vw, 88px); }
  .st-hero-visual{ min-height: 0; padding: 8px 0 0; }
  .st-hero-mark{ display: block; width: 132px; height: 132px; }
  .st-status{ font-size: 11.5px; padding: 9px 12px 8px; }
  .st-actions{ flex-direction: column; }
  .st-actions .btn{ width: 100%; }
  .st-tape-run{ padding: 11px 8px; gap: 16px; }
  .st-steps{ padding-top: 64px; }
  .st-steps ol{ grid-template-columns: 1fr; }
  .st-step, .st-step:first-child{ padding: 20px 0; }
  .st-step + .st-step{ border-left: 0; border-top: 1px solid var(--st-hair); }
  .st-cats-list li{ grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; padding: 20px 0; }
  .st-cat-places{ grid-column: 1; grid-row: 2; text-align: left; }
  .st-cat-price{ grid-column: 2; grid-row: 1 / span 2; }
  .st-juries-grid{ grid-template-columns: 1fr; }
  .st-jury, .st-jury.is-public{ padding: 32px 0; }
  .st-jury.is-public{ border-top: 1px solid var(--st-hair); }
  .st-sample{ grid-row: auto; margin: 8px auto 32px; transform: rotate(1.5deg); }
  .st-podium{ grid-template-columns: 1fr; gap: 40px; }
  .st-podium li.is-rank-1, .st-podium li.is-rank-2, .st-podium li.is-rank-3{ order: 0; }
  .st-podium li{ display: grid; grid-template-columns: 96px minmax(0, 1fr); column-gap: 18px; row-gap: 6px; align-items: start; }
  .st-podium-rank{ grid-column: 1 / -1; font-size: 72px; }
  .st-podium li.is-rank-1 .st-podium-rank{ font-size: 96px; }
  .st-podium-logo{ grid-column: 1; grid-row: 2 / span 4; margin: 0; padding: 14%; aspect-ratio: 1; }
  .st-podium-logo{ padding: 8%; }
  .st-podium-logo.is-score b{ font-size: 22px; white-space: nowrap; overflow-wrap: normal; }
  .st-podium-logo.is-score small{ font-size: 11px; letter-spacing: .04em; }
  .st-podium-name, .st-podium-producer, .st-podium-prize, .st-podium-score{ grid-column: 2; }
  .st-podium-prize{ margin-top: 2px; }
  .shell .st-route{ grid-template-columns: 1fr auto; padding: 24px 0; gap: 8px 16px; }
  .st-route-text{ grid-column: 1 / -1; grid-row: 2; font-size: 15px; }
  .st-route-cta{ grid-column: 2; grid-row: 1; }
  .st-route-cta{ font-size: 0; gap: 0; }
  .st-close{ margin-top: 72px; }
  .st-close-title{ --fs: clamp(44px, 14vw, 72px); }
  .st-jury-word{ --fs: clamp(52px, 17vw, 76px); }
}


/* ── Palmarès ──────────────────────────────────────────────── */
.shell .st-pal-head{ padding: 28px 0 48px; flex-direction: column; align-items: stretch; gap: 36px; }
.st-pal-head-row{ display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 28px 48px; }
.shell .st-pal-head h1.st-pal-title{ margin: 0; --fs: clamp(60px, 9vw, 136px); font-size: min(var(--fs), calc(100cqw / (var(--fit-chars) * .96))); line-height: .84; }
.shell .pal-edition label{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--st-ink-2); }
.shell .pal-edition select{ border: 2px solid var(--st-ink); background-color: var(--st-night); font-family: var(--st-display); font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; padding: 15px 44px 15px 16px; }
.shell .pal-controls{ gap: 28px; padding-bottom: 48px; }
.shell .pal-jury{ padding: 0; gap: 0; background: transparent; border: 2px solid var(--st-ink); }
.shell .pal-jury a{ font-family: var(--st-display); font-weight: 700; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; padding: 16px 26px; }
.shell .pal-jury a + a{ border-left: 2px solid var(--st-ink); }
.shell .pal-jury a[aria-current]{ background: var(--st-ink); color: var(--st-night); }
.shell .pal-explain{ font-size: 17px; color: var(--st-ink-2); max-width: 70ch; }
.shell .pal-cats-label{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .14em; color: var(--st-gold); }
.shell .pal-cats a{ font-family: var(--st-display); font-weight: 700; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; padding: 12px 16px;
  border: 1px solid var(--st-control); }
.shell .pal-cats a:hover{ border-color: var(--st-gold); color: var(--st-gold-hi); }
.shell .pal-cats a[aria-current]{ background: var(--st-gold); border-color: var(--st-gold); color: var(--st-night); }
.shell .pal-category{ border-top: 2px solid var(--st-rule); gap: 56px; padding-bottom: 96px; }
.shell .pal-category-head .section-title{ font-size: clamp(32px, 5vw, 72px); font-weight: 900; }
.shell .pal-category-head p{ font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--st-ink-2); }
.st-pal-podium{ max-width: 1040px; width: 100%; align-self: center; }
.shell .pal-medals h3{ font-size: 15px; letter-spacing: .1em; }
.shell .pal-list{ border-top: 2px solid var(--st-rule); }
.shell .pal-list li{ border-bottom: 1px solid var(--st-hair); padding: 16px 0; font-size: 16px; transition: background .2s; }
.shell .pal-list li:hover{ background: rgba(243,238,227,.04); }
.shell .pal-rank{ font-family: var(--st-display); font-weight: 800; font-size: 15px; min-width: 52px; color: var(--st-ink-3); }
.shell .pal-ranking-id > :first-child, .shell .pal-ranking-id b{ font-weight: 700; color: var(--st-ink); }
.shell .pal-tag{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--st-ink-2); }
.shell .pal-score{ font-family: var(--st-display); font-weight: 700; font-size: 14px; }
.shell .pal-dq{ font-family: var(--st-display); font-size: 11px; }
.shell .pal-others{ gap: 0; border-top: 2px solid var(--st-rule); padding-bottom: 96px; }
.shell .pal-other{ position: relative; border: 0; border-bottom: 1px solid var(--st-hair); padding: 26px 0; isolation: isolate; }
.shell .pal-other::before{ content: ""; position: absolute; inset: 0 calc(-1 * var(--pad-x)); z-index: -1; background: var(--st-gold); clip-path: inset(0 100% 0 0); transition: clip-path .5s var(--st-ease); }
.shell .pal-other:hover::before{ clip-path: inset(0); }
.shell .pal-other:hover, .shell .pal-other:hover *{ color: var(--st-night); }
.shell .pal-other-name{ font-family: var(--st-display); font-weight: 800; font-size: clamp(22px, 3vw, 40px); text-transform: uppercase; letter-spacing: -0.01em; }
.shell .pal-juries{ border-top: 2px solid var(--st-rule); }
.shell .pal-juries .section-title{ font-size: clamp(28px, 4vw, 56px); }
.shell .pal-juror{ padding: 24px; }
.shell .pal-juror-avatar{ background: var(--st-gold); color: var(--st-night); font-family: var(--st-display); }
.shell .pal-juror-avatar img{ filter: url(#st-duotone); }
@media (max-width: 880px){
  .shell .st-pal-head{ padding: 16px 0 32px; gap: 24px; }
  .shell .st-pal-head h1.st-pal-title{ --fs: clamp(54px, 17vw, 88px); }
  .shell .pal-jury a{ padding: 14px 10px; font-size: 11px; }
  .shell .pal-category{ gap: 36px; }
}


/* ── Pages secondaires : éditions, participer, tuiles ──────── */
.st-archive-year{ margin: 8px 0 4px; font-size: clamp(44px, 4.2vw, 66px) !important; font-weight: 900; line-height: .85; letter-spacing: -0.04em;
  color: transparent; -webkit-text-stroke: 2px var(--st-ink); transition: color .35s var(--st-ease), -webkit-text-stroke-color .35s; }
.shell a.pg-tile:hover .st-archive-year{ color: var(--st-gold); -webkit-text-stroke-color: var(--st-gold); }
.shell .pg-grid{ gap: 20px; }
.shell .pg-tile{ padding: 32px; gap: 14px; }
.shell .pg-tile .pg-meta{ font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--st-gold); }
.shell .home-section{ max-width: var(--st-max); padding-top: 72px; }
.shell .eds-current{ gap: 20px; }
.shell .eds-card{ background: transparent; border: 2px solid var(--st-gold); padding: 40px; position: relative; }
.shell .eds-card h2{ font-size: clamp(26px, 3vw, 40px); font-weight: 900; }
.shell .eds-card-facts{ font-size: 16px; }
.shell .eds-card-facts li{ padding-left: 22px; position: relative; }
.shell .eds-card-facts li::before{ content: ""; position: absolute; left: 0; top: .45em; width: 10px; height: 10px; background: var(--st-gold);
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%); }
.shell .eds-card .home-actions{ display: flex; flex-wrap: wrap; gap: 12px; }
.shell .eds-past{ border-top: 2px solid var(--st-rule); }
.shell .eds-past li{ border-bottom: 1px solid var(--st-hair); }
.shell .eds-past-year{ font-family: var(--st-display); font-weight: 800; font-size: clamp(22px, 2.6vw, 34px); text-transform: uppercase; }
.shell .eds-past-cta{ font-family: var(--st-display); font-weight: 700; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--st-gold); }
.shell .eds-past a:hover .eds-past-year{ color: var(--st-gold-hi); }
.st-cups .home-section:last-of-type{ padding-bottom: 96px; }
.shell .st-home .st-head + .st-steps{ padding-top: 24px; }
.shell .st-home > .st-sec:last-child{ padding-bottom: 120px; }
.shell .pal-empty{ padding: 40px; }
.shell .pal-empty h2{ font-size: clamp(22px, 2.6vw, 32px); }
.shell .pal-empty a{ color: var(--st-gold-hi); }
@media (max-width: 880px){
  .shell .pg-tile{ padding: 24px; }
  .shell .eds-card{ padding: 24px; }
  .shell .st-home > .st-sec:last-child{ padding-bottom: 72px; }
}


/* ── Révélations au défilement (voir scroll-reveal.tsx) ────────
   Seuls les éléments sous la ligne de flottaison reçoivent .rv ; tout le
   reste est visible d'emblée. Transform, opacité et clip-path seulement. */
.rv{ transition-timing-function: var(--st-ease); }
/* Un liseré d'un pixel reste visible : Chrome tient compte du clip-path pour
   l'IntersectionObserver, un élément entièrement masqué ne serait jamais vu. */
.rv.rv-wipe{ clip-path: inset(0 calc(100% - 1px) 0 0); transition: clip-path 1.1s var(--st-ease); }
.rv.rv-rise{ opacity: 0; transform: translateY(28px); transition: opacity .8s var(--st-ease), transform .9s var(--st-ease); }
.st-cats-cta.rv.rv-rise, .st-sec > .st-link-arrow.rv.rv-rise{ transition-delay: .35s; }
.rv.rv-row{ opacity: 0; transform: translateY(22px); clip-path: inset(0 0 calc(100% - 1px) 0);
  transition: opacity .7s var(--st-ease), transform .8s var(--st-ease), clip-path .8s var(--st-ease);
  transition-delay: calc(var(--rv-i, 0) * 55ms + 60ms); }
.rv.rv-slap{ opacity: 0; transform: translateY(-60px) rotate(16deg) scale(1.12);
  transition: opacity .35s ease-out, transform .75s cubic-bezier(.34,1.56,.64,1); transition-delay: .25s; }
.rv.rv-in.rv-wipe{ clip-path: inset(0 0 0 0); }
.rv.rv-in.rv-rise{ opacity: 1; transform: none; }
.rv.rv-in.rv-row{ opacity: 1; transform: none; clip-path: inset(0 0 0 0); }
.rv.rv-in.rv-slap{ opacity: 1; transform: rotate(2.5deg); }
/* Podium : le 3e, puis le 2e, puis le 1er. */
.st-podium > li.rv.is-rank-3{ --rv-i: 0; }
.st-podium > li.rv.is-rank-2{ --rv-i: 2; }
.st-podium > li.rv.is-rank-1{ --rv-i: 5; }
.st-podium > li.rv{ transform: translateY(70px); clip-path: none; }


/* ── Pages éditoriales et légales ──────────────────────────── */
.shell .pg-tile p{ color: var(--st-ink-2); }
.shell .pg-section > h2{ margin: 0; }
/* Photos de l'équipe en noir et blanc (la bichromie or est réservée aux visuels de la cup) */
.st-team-photo{ display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; filter: grayscale(1) contrast(1.06); }
.shell .pg > .st-sec{ padding-top: 24px; padding-bottom: 64px; }
.legal-updated{ margin: 0; font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--st-ink-3); }
.shell .legal-toc{ margin: 0 0 8px; padding: 22px 0 26px; background: transparent; border: 0;
  border-top: 2px solid var(--st-rule); border-bottom: 2px solid var(--st-rule); }
.shell .legal-toc-title{ margin: 0 0 14px; font-family: var(--st-display); font-weight: 600; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--st-gold); }
.shell .legal-toc-list{ font-size: 15px; }
.shell .legal-toc-list a{ color: var(--st-ink-2); text-decoration-color: var(--st-hair); }
.shell .legal-toc-list a:hover{ color: var(--st-gold-hi); text-decoration-color: currentColor; }
.shell .legal-section{ padding: 40px 0; border-top: 0; max-width: none; }
.shell .legal-section + .legal-section{ border-top: 2px solid var(--st-rule); }
.shell .legal-kv{ background: transparent; border: 0; border-top: 1px solid var(--st-hair); padding: 0; }
.shell .legal-kv > div{ border-color: var(--st-hair); }
.shell .legal-top{ display: inline-flex; align-items: center; gap: 6px; margin-top: 28px; text-decoration: none;
  font-family: var(--st-display); font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--st-ink-3); }
.shell .legal-top:hover{ color: var(--st-gold-hi); }
/* Critères de notation (page d'une édition) : lisibles, pas tassés. */
.st-cat-criteria{ line-height: 1.55; max-width: 72ch; }

/* À l'impression ou en PDF, tout s'affiche, révélé ou non. */
@media print{
  .rv{ opacity: 1 !important; transform: none !important; clip-path: none !important; }
  .st-tape-track{ animation: none !important; }
}

@media (prefers-reduced-motion: reduce){
  .st-tape-track{ animation: none !important; }
  .rv{ opacity: 1 !important; transform: none !important; clip-path: none !important; }
  .st-route::before{ transition: none; }
}
`;
