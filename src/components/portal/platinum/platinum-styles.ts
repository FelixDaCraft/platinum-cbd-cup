/**
 * Platinum Portal Design System — single source of CSS truth.
 *
 * Direction « Grand Cru » (octobre 2026) : nuit et or, sobre. Texte en
 * Hanken Grotesk ; Louize Display est réservée au logo (`.brand`) et au nom
 * de la cup (`.display--brand`). Boutons et pastilles rectangulaires à
 * coins légèrement arrondis ; plus de police mono ni de majuscules forcées.
 *
 * Injected via <style dangerouslySetInnerHTML={{__html: platinumCSS}} /> in layout.
 * Selectors live on :root / html / body — NOT scoped — matching the design package exactly.
 */
export const platinumCSS = `
@font-face{
  font-family: "Louize Display";
  src: url("/fonts/LouizeDisplay-BoldItalic.ttf") format("truetype");
  font-weight: 700;
  font-style: italic;
  font-display: swap;
}
:root{
  --bg: #0c0b09;
  --bg-2: #15130f;
  --fg: #f3eee3;
  --fg-2: rgba(242,242,242,.62);
  /* .50 sur --bg = 4.88:1, le minimum WCAG AA (4.5:1) pour les libellés de
     champs et les légendes qui portent de l'information. */
  --fg-3: rgba(242,242,242,.50);
  --line: rgba(212,175,55,.18);
  --line-strong: rgba(242,242,242,.24);
  --accent: #d4af37;
  --accent-hi: #f5e6a8;
  --accent-dim: rgba(212,175,55,.14);
  --accent-glow: rgba(212,175,55,.45);
  --danger: #ff3b30;
  --radius: 14px;
  --radius-control: 6px;
  --pad-x: clamp(24px, 4vw, 64px);
  --pad-y: 28px;
  --gap: 16px;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --sans: "Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --display: "Louize Display", "Playfair Display", Didot, "Bodoni 72", serif;
}
[data-theme="light"]{
  --bg: #f4f2ec;
  --bg-2: #ffffff;
  --fg: #0a0a0a;
  --fg-2: rgba(10,10,10,.62);
  /* .58 sur le fond clair = 4.76:1 (cf. --fg-3 du thème sombre). */
  --fg-3: rgba(10,10,10,.58);
  --line: rgba(10,10,10,.10);
  --line-strong: rgba(10,10,10,.20);
  --accent: #8a6a1f;
  --accent-hi: #c9a94a;
  --accent-dim: rgba(138,106,31,.10);
  --accent-glow: rgba(138,106,31,.25);
}
[data-density="compact"]{ --pad-y: 18px; --gap: 10px; }
[data-density="airy"]{ --pad-y: 44px; --gap: 24px; }

*{ box-sizing: border-box; }
html, body{ margin:0; padding:0; background: var(--bg); color: var(--fg); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
body{
  min-height: 100vh;
  font-size: 16px;
  line-height: 1.5;
  overflow-x: hidden;
}

/* ── Dot matrix background ─────────────────────────────── */
.matrix{
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: radial-gradient(circle, rgba(242,242,242,.08) 1px, transparent 1.2px);
  background-size: 22px 22px;
  background-position: 0 0;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 100%);
}
[data-theme="light"] .matrix{
  background-image: radial-gradient(circle, rgba(10,10,10,.12) 1px, transparent 1.2px);
}
[data-matrix="off"] .matrix{ display:none; }
/* Le fond à points est retiré de la direction Grand Cru. */
.matrix{ display: none; }

.shell{ position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

/* ── Lien d'évitement ───────────────────────────────────────
   Hors de l'écran tant qu'il n'a pas le focus : il ne doit rien coûter
   visuellement, mais rester le premier arrêt de tabulation. */
.skip-link{
  position: absolute; left: -9999px; top: 0; z-index: 100;
  padding: 10px 16px;
  font-family: var(--sans); font-size: 14px; font-weight: 600;
  text-decoration: none;
  background: var(--bg-2); color: var(--fg);
  border: 1px solid var(--line-strong); border-radius: var(--radius-control);
}
.skip-link:focus{ left: 12px; top: 12px; }
/* Le focus de <main> est programmatique (cible du lien d'évitement) : le
   contour permanent du navigateur n'apporte rien au clavier. */
.page:focus{ outline: none; }

/* ── Top navigation ─────────────────────────────────────── */
.topbar{
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px 32px; flex-wrap: wrap;
  padding: 14px var(--pad-x);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid var(--line);
}
.brand{ display:flex; align-items:center; gap:12px; text-decoration:none; color: inherit; }
.brand-mark{
  width: 36px; height: 36px;
  display:grid; place-items:center; position:relative;
  filter: drop-shadow(0 0 14px rgba(212,175,55,.18));
}
.brand-mark img{ width: 100%; height: 100%; object-fit: contain; }
/* Le nom de la cup, en Louize Display : un des deux seuls usages de la police. */
.brand-name{ font-family: var(--display); font-weight: 700; font-style: italic; font-size: 22px; letter-spacing: -0.01em; line-height: 1; white-space: nowrap; }

.nav{ display:flex; flex-wrap: wrap; gap: 4px 26px; font-size: 15px; font-weight: 500; }
.nav a, .nav button{
  appearance:none; border:0; background: transparent; color: var(--fg);
  font: inherit; padding: 10px 0; cursor: pointer; text-decoration: none;
  border-bottom: 2px solid transparent;
}
.nav a:hover, .nav button:hover{ color: var(--accent-hi); }
.nav a.active, .nav button.active{ color: var(--accent-hi); border-bottom-color: var(--accent); }

.topbar-right{ display:flex; align-items:center; gap: 10px; }
.topbar-link{ color: var(--fg); font-size: 15px; font-weight: 500; text-decoration: none; padding: 10px 6px; }
.topbar-link:hover{ color: var(--accent-hi); }

/* ── Page container ─────────────────────────────────────── */
.page{ flex: 1; padding: 0 var(--pad-x) 60px; }

/* ── Shared typographic utilities ───────────────────────── */
.eyebrow{
  font-family: var(--sans); font-size: 13px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--fg-2);
}
.eyebrow b{ color: var(--accent-hi); font-weight: 700; }
.display{
  font-family: var(--sans); font-weight: 600; font-style: normal;
  font-size: clamp(40px, 6vw, 76px);
  line-height: 1; letter-spacing: -0.03em;
  text-transform: none;
  background: linear-gradient(180deg, var(--fg) 0%, var(--fg) 60%, color-mix(in srgb, var(--fg) 75%, var(--accent)) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
[data-theme="light"] .display{
  background: linear-gradient(180deg, var(--fg) 0%, var(--fg) 60%, color-mix(in srgb, var(--fg) 65%, var(--accent)) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
/* Le nom de la cup en titre d'accueil : second et dernier usage de Louize. */
.display.display--brand{
  font-family: var(--display); font-weight: 700; font-style: italic;
  font-size: clamp(56px, 8.5vw, 112px); line-height: .95; letter-spacing: -0.01em;
}
.display em{
  font-style: inherit; font-family: inherit;
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}

/* Titres du portail en Hanken Grotesk : Louize Display est réservée au logo
   et au nom de la cup (.brand-name, .display--brand). */
.shell h1, .shell h2, .shell h3, .shell h4, .shell h5, .shell h6 {
  font-family: var(--sans);
  font-weight: 600;
  font-style: normal;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

h2.section-title{
  font-family: var(--sans); font-weight: 600; font-style: normal;
  font-size: clamp(28px, 3.2vw, 42px);
  letter-spacing: -0.02em; text-transform: none;
  line-height: 1.05;
  margin: 0;
}
.lede{ font-size: 18px; line-height: 1.6; color: var(--fg-2); max-width: 56ch; }

/* ── Pills & chips ─────────────────────────────────────── */
.pill{
  display:inline-flex; align-items:center; gap:8px;
  padding: 7px 12px; border-radius: var(--radius-control);
  border: 1px solid var(--line-strong);
  font-family: var(--sans); font-size: 14px; font-weight: 600;
  color: var(--fg-2);
}
.pill.accent{ border-color: var(--accent-hi); color: var(--accent-hi); background: var(--accent-dim); }
.pill.solid{ background: var(--fg); color: var(--bg); border-color: var(--fg); }

/* ── Buttons ───────────────────────────────────────────── */
.btn{
  appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 13px 22px; border-radius: var(--radius-control);
  font-family: var(--sans); font-size: 16px; font-weight: 600;
  border: 1px solid var(--fg); background: var(--fg); color: var(--bg);
  transition: transform .15s ease, background .15s ease;
  text-decoration: none;
}
.btn:hover{ filter: brightness(1.06); }
.btn:focus-visible, .nav button:focus-visible, .nav a:focus-visible{
  outline: 2px solid var(--accent-hi);
  outline-offset: 2px;
}

/* ── Check (platinum-shared) ──────────────────────────────
   L'<input> natif est étiré transparent au-dessus du carré décoratif : il
   reçoit les clics, le focus et les clics redirigés par un <label> parent.
   Le carré ne fait que refléter son état via :checked / :focus-visible. */
.pt-check{
  position: relative; width: 24px; height: 24px; margin: -3px;
  flex-shrink: 0; display: grid; place-items: center;
}
.pt-check input{
  position: absolute; inset: 0; width: 100%; height: 100%;
  margin: 0; opacity: 0; cursor: pointer;
}
.pt-check-box{
  width: 18px; height: 18px; border-radius: 4px;
  border: 1px solid var(--line-strong); background: transparent;
  display: grid; place-items: center;
  color: #002a00; font-size: 12px;
  transition: border-color .15s ease, background .15s ease;
  pointer-events: none;
}
.pt-check input:checked + .pt-check-box{
  border-color: var(--accent); background: var(--accent);
}
.pt-check input:focus-visible + .pt-check-box{
  outline: 2px solid var(--accent-hi);
  outline-offset: 2px;
}
.btn.ghost{ background: transparent; color: var(--fg); border-color: var(--line-strong); }
.btn.ghost:hover{ border-color: var(--fg); }
.btn.accent{
  background: var(--accent);
  border-color: var(--accent); color: #1a1200; font-weight: 700;
}
.btn.accent:hover{ filter: brightness(1.05); }
.btn-arrow{ display:inline-block; transition: transform .2s ease; }
.btn:hover .btn-arrow{ transform: translateX(3px); }

/* ── Card / block ──────────────────────────────────────── */
.card{
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--pad-y);
}
.card-hover{ transition: border-color .2s ease, transform .2s ease; }
.card-hover:hover{ border-color: var(--line-strong); }

/* ── Hairline grid helpers ─────────────────────────────── */
.row{ display:flex; gap: var(--gap); }
.grid{ display:grid; gap: var(--gap); }
.g-2{ grid-template-columns: repeat(2, 1fr); }
.g-3{ grid-template-columns: repeat(3, 1fr); }
.g-4{ grid-template-columns: repeat(4, 1fr); }
@media (max-width: 880px){
  .g-2, .g-3, .g-4{ grid-template-columns: 1fr; }
}

/* ── Data row ──────────────────────────────────────────── */
.kv{ display:flex; justify-content:space-between; align-items:center; gap: 16px;
     padding: 14px 0; border-bottom: 1px solid var(--line);
     font-size: 15px; }
.kv:last-child{ border-bottom: 0; }
.kv-k{ color: var(--fg-2); }
.kv-v{ color: var(--fg); font-variant-numeric: tabular-nums; }

/* ── Utility ───────────────────────────────────────────── */
.mono{ font-family: var(--mono); }
.tabular{ font-variant-numeric: tabular-nums; }
.muted{ color: var(--fg-2); }
.fg3{ color: var(--fg-3); }
.hr{ height:1px; background: var(--line); border:0; margin: 40px 0; }
.footer{
  padding: 40px var(--pad-x) 40px;
  border-top: 1px solid var(--line);
  display:flex; justify-content:space-between; align-items:center; gap: 20px; flex-wrap: wrap;
  font-size: 15px; color: var(--fg-2);
}
.footer a{ color: var(--fg-2); text-decoration: none; }
.footer a:hover{ color: var(--accent-hi); }

/* fade in when page switches — opacity only (no transform) so .page-enter
   never creates a containing block for descendant position:fixed
   elements. Browsers keep a composited transform layer even when the
   final state is transform:none, which silently breaks fixed
   positioning anywhere inside a .page-enter ancestor. */
.page-enter{ animation: fadeIn .4s cubic-bezier(.2,.7,.2,1) both; }
@keyframes fadeIn{ from{ opacity:0; } to{ opacity:1; } }

/* Scroll bar */
::-webkit-scrollbar{ width: 10px; height: 10px; }
::-webkit-scrollbar-track{ background: transparent; }
::-webkit-scrollbar-thumb{ background: var(--line-strong); border-radius: 999px; border: 2px solid var(--bg); }

/* ──────────────────────────────────────────────────────────
   MOBILE BOTTOM NAV (≤880px only)
   Hidden by default — only renders on phones.
   Desktop topbar nav + 735px hero emblem are unchanged.
   ────────────────────────────────────────────────────────── */
.mobile-bottom-nav{ display: none; }

@media (max-width: 880px){
  /* En-tête mobile réduit au logo et au nom : la navigation passe en bas. */
  .topbar > .nav{ display: none !important; }
  .topbar{ padding: 10px var(--pad-x); }
  /* Mobile : compte et inscription passent par la barre basse et le hero. */
  .topbar .topbar-right{ display: none; }
  .topbar .brand-name{ font-size: 19px; }

  /* Bottom nav: 4 equal segments, fixed bottom, safe-area inset, gold-on-black
     identity. Active item gets a 2px gold accent line on top + gold label. */
  .mobile-bottom-nav{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .mobile-bottom-nav__item{
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px;
    height: 56px;
    text-decoration: none; color: var(--fg-2);
    font-family: var(--sans);
    border-top: 2px solid transparent;
    transition: color .15s ease, border-color .15s ease;
  }
  .mobile-bottom-nav__idx{
    font-size: 8.5px; letter-spacing: .14em; color: inherit;
  }
  .mobile-bottom-nav__label{
    font-size: 12px; font-weight: 600;
    color: inherit;
  }
  .mobile-bottom-nav__item.is-active{
    color: var(--accent);
    border-top-color: var(--accent);
  }
  .mobile-bottom-nav__item:active{
    background: var(--accent-dim);
  }

  /* Reserve room at the bottom of every page so content isn't hidden by the
     fixed bottom nav. The 56px nav + safe-area + 12px breathing space. */
  .page{
    padding-bottom: calc(56px + env(safe-area-inset-bottom) + 12px);
  }
  .footer{
    padding-bottom: calc(40px + 56px + env(safe-area-inset-bottom));
  }

  /* ── Typographic ladder shrink for phones ─────────────────────── */
  .display{
    font-size: clamp(34px, 9vw, 48px);
    line-height: 1.05;
  }
  .display.display--brand{ font-size: clamp(46px, 13vw, 64px); }
  h2.section-title{
    font-size: clamp(24px, 6.5vw, 32px);
    line-height: 1.1;
  }
  .lede{
    font-size: 15px;
  }
  .page{
    padding-top: 0;
  }

  /* ── Card padding density ────────────────────────────────────── */
  .card{
    padding: 22px 18px;
  }

  /* ── Page sections that used multi-column grids ─────────────── */
  .grid.g-3{
    grid-template-columns: 1fr;
  }
  .grid.g-4{
    grid-template-columns: repeat(2, 1fr);
  }

  /* ── Footer compaction ───────────────────────────────────────── */
  .footer{
    padding: 28px var(--pad-x) calc(40px + 56px + env(safe-area-inset-bottom));
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
  }
}


/* ── Team roster (Manifesto page · hover-only flash, no auto-animation)
   Each <figure> stays muted/desaturated by default and resolves to full
   color + slight scale only when hovered. The flex row centers itself
   when partially filled. */
.team-roster{
  display: flex; flex-wrap: wrap; gap: 32px;
  align-items: stretch; justify-content: center;
}
.team-member{
  flex: 0 1 240px; min-width: 200px; max-width: 280px;
  margin: 0; display: flex; flex-direction: column; gap: 14px;
  text-align: center; align-items: center;
  filter: grayscale(1) brightness(.55);
  transform-origin: center;
  transition: filter .35s ease, transform .35s ease;
}
.team-member:hover{
  filter: grayscale(0) brightness(1.05) saturate(1.1);
  transform: scale(1.015);
}
.team-photo-frame{
  position: relative; width: 100%; aspect-ratio: 4/5;
  border-radius: 6px; overflow: hidden;
  background: var(--bg-2); border: 1px solid var(--line);
  display: grid; place-items: center;
}
.team-photo-frame img{
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.team-photo-placeholder{
  font-family: var(--mono); font-size: 36px; letter-spacing: .06em;
  color: var(--fg-3);
}
.team-member figcaption{
  font-family: var(--mono); display: flex; flex-direction: column;
  gap: 4px; align-items: center;
}
.team-member .team-idx{ color: var(--accent); font-size: 11px; letter-spacing: .15em; }
.team-member .team-nm{ font-size: 15px; letter-spacing: .03em; text-transform: uppercase; color: var(--fg); }
.team-member .team-rl{ font-size: 11px; letter-spacing: .12em; color: var(--fg-3); text-transform: uppercase; }
@media (prefers-reduced-motion: reduce){
  .team-member, .team-member:hover{ transform: none; transition: filter .15s ease; }
}

/* ── Ticker ───────────────────────────────────────────── */

/* ── Emblème 3D ───────────────────────────────────────────
   spin3d et spinRing servaient au PlatinumTrophy en CSS-3D, remplacé par
   GeometricEmblem (React Three Fiber) : supprimés avec lui. Seule l'ombre
   portée reste pilotée en CSS. */
@keyframes shadowPulse {
  0%, 100% { opacity: .9; transform: scaleX(1); }
  50%      { opacity: .6; transform: scaleX(.82); }
}

/* ── Form inputs (Field / Check) ──────────────────────── */
.field-input{
  appearance:none; width:100%; height: 44px; padding:0 14px;
  background: var(--bg); border: 1px solid var(--line-strong); border-radius: var(--radius-control);
  color: var(--fg); font-family: var(--sans); font-size: 16px; outline: none;
  transition: border-color .15s ease;
}
.field-input:focus{ border-color: var(--accent); }
.field-input.mono{ font-family: var(--mono); }
/* appearance:none supprime aussi le chevron natif des <select> : on le redessine. */
select.field-input{
  padding-right: 34px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--fg-2) 50%),
                    linear-gradient(135deg, var(--fg-2) 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% + 2px), calc(100% - 13px) calc(50% + 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
select.field-input option{ background: var(--bg-2); color: var(--fg); }

/* ── Accueil (direction « Grand Cru ») ─────────────────────
   Sections centrées à 1200px ; les bandeaux (.home-band) traversent toute
   la largeur en compensant la marge latérale de .page. */
.btn.btn-lg{ padding: 16px 28px; font-size: 17px; }
.home{ display: flex; flex-direction: column; }
.home-section{ width: 100%; max-width: 1200px; margin: 0 auto; padding: 96px 0 24px; display: flex; flex-direction: column; gap: 40px; }
.home-section-head{ display: flex; flex-direction: column; gap: 14px; max-width: 720px; }
.home-section-head.is-split{ max-width: none; flex-direction: row; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.home-section-head .eyebrow{ margin: 0 0 10px; }
.home-section-lede{ margin: 0; font-size: 19px; line-height: 1.6; color: var(--fg-2); }
.home-section-note{ margin: 0; font-size: 16px; color: var(--fg-3); }
.home-link{ font-size: 17px; font-weight: 600; color: var(--accent-hi); text-decoration: none; }
.home-link:hover{ text-decoration: underline; text-underline-offset: 4px; }

.home-hero{ width: 100%; max-width: 1200px; margin: 0 auto; padding: 80px 0 72px; display: flex; flex-wrap: wrap; align-items: center; gap: 48px; }
.home-hero-text{ flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 28px; }
.home-hero-title{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.home-hero-title h1{ margin: 0; }
.home-hero-mark{ display: none; width: 96px; height: 96px; object-fit: contain; flex-shrink: 0; }
.home-hero-lede{ margin: 0; font-size: 21px; max-width: 560px; }
.home-hero-emblem{ flex: 1 1 340px; display: flex; justify-content: center; min-height: 420px; align-items: center;
  background: radial-gradient(circle at 50% 48%, var(--accent-dim), transparent 62%); }
.home-status{ margin: 0; align-self: flex-start; display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 16px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: var(--radius-control); font-size: 15px; font-weight: 600; color: var(--accent-hi); }
.home-status-dot{ width: 8px; height: 8px; border-radius: 50%; background: var(--fg-3); flex-shrink: 0; }
.home-status.is-open .home-status-dot{ background: #7fd69a; }
.home-actions{ display: flex; flex-wrap: wrap; gap: 14px; }

.home-band{ margin: 0 calc(-1 * var(--pad-x)); padding: 0 var(--pad-x); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.home-band.is-filled{ background: var(--bg-2); margin-top: 72px; }
.home-band.is-filled .home-section{ padding: 88px 0; }
.home-steps{ max-width: 1200px; margin: 0 auto; padding: 32px 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
.home-step{ display: flex; flex-direction: column; gap: 6px; padding-left: 16px; border-left: 2px solid var(--line-strong); }
.home-step.is-current{ border-left-color: var(--accent); }
.home-step-tag{ font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--fg-3); }
.home-step.is-current .home-step-tag{ color: var(--accent-hi); }
.home-step-title{ font-size: 19px; font-weight: 600; }
.home-step-when{ font-size: 15px; color: var(--fg-2); }
.home-step.is-done .home-step-title, .home-step.is-done .home-step-when{ color: var(--fg-3); }

.home-juries{ display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
.home-jury{ padding: 40px; border: 1px solid var(--line); border-radius: 20px; background: var(--bg-2); display: flex; flex-direction: column; gap: 18px; }
.home-jury h3{ margin: 0; font-size: 30px; }
.home-jury p{ margin: 0; font-size: 17px; line-height: 1.6; color: var(--fg-2); }
.home-jury .home-jury-kicker{ font-size: 14px; color: var(--accent-hi); }
.home-jury .home-jury-kicker.is-pro{ color: #c9ced6; }
.home-tiers{ margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 10px; }
.home-tiers li{ display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--radius-control);
  background: var(--accent-dim); font-size: 15px; font-weight: 600; }
.home-tier-dot{ width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }

.home-cats{ margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.home-cats li{ display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: center;
  padding: 22px 0; border-bottom: 1px solid var(--line); }
.home-cat-name{ font-size: 22px; font-weight: 600; }
.home-cat-places{ font-size: 16px; color: var(--fg-2); }
.home-cat-places.is-low{ color: var(--accent-hi); }
.home-cat-price{ font-size: 20px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.home-cats li.is-full > span{ color: var(--fg-3); }
.home-cats-cta{ align-self: flex-start; }

.home-podium{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
.home-podium li{ padding: 32px; border-radius: 20px; background: var(--bg); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
.home-podium li.is-first{ border-color: var(--accent); }
.home-podium-rank{ font-size: 48px; font-weight: 600; letter-spacing: -.02em; line-height: 1; color: var(--fg-2); }
.home-podium-rank sup{ font-size: 24px; }
.home-podium li.is-first .home-podium-rank{ color: var(--accent-hi); }
.home-podium-name{ font-size: 24px; font-weight: 700; }
.home-podium-producer{ font-size: 16px; color: var(--fg-2); }
.home-podium-meta{ margin-top: 8px; font-size: 15px; font-weight: 600; color: #c9ced6; }
.home-podium li.is-first .home-podium-meta{ color: var(--accent-hi); }
.home-palmares-more{ align-self: flex-start; }
.home-hero.is-compact{ padding: 72px 0 56px; }
.home-hero.is-compact .home-hero-text{ max-width: 860px; }
.home-cat-criteria{ display: block; margin-top: 4px; font-size: 15px; font-weight: 400; color: var(--fg-3); }
.home-section-spacer{ height: 72px; }

/* ── Liste des éditions ── */
.eds-current{ display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; }
.eds-card{ padding: 36px; border-radius: 20px; background: var(--bg-2); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  display: flex; flex-direction: column; gap: 18px; }
.eds-card h2{ margin: 0; font-size: 30px; }
.eds-card-facts{ margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 16px; color: var(--fg-2); }
.eds-card-facts b{ color: var(--fg); font-weight: 600; }
.eds-past{ margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.eds-past li{ border-bottom: 1px solid var(--line); }
.eds-past a, .eds-past-row{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 16px; align-items: center;
  padding: 22px 0; color: var(--fg); text-decoration: none; }
.eds-past a:hover .eds-past-cta{ text-decoration: underline; text-underline-offset: 4px; }
.eds-past-year{ font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.eds-past-meta{ font-size: 16px; color: var(--fg-2); }
.eds-past-cta{ font-size: 16px; font-weight: 600; color: var(--accent-hi); white-space: nowrap; }
.eds-past-row .eds-past-cta{ color: var(--fg-3); }

.home-audiences{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
.home-audience{ height: 100%; text-decoration: none; color: var(--fg); padding: 28px; border-radius: 16px; border: 1px solid var(--line-strong);
  display: flex; flex-direction: column; gap: 10px; transition: border-color .2s ease; }
.home-audience:hover{ border-color: var(--accent); }
.home-audience-title{ font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.home-audience-text{ font-size: 16px; line-height: 1.5; color: var(--fg-2); }
.home-audience-cta{ margin-top: auto; padding-top: 6px; font-weight: 600; color: var(--accent-hi); }

@media (max-width: 880px){
  .home-hero{ padding: 32px 0 28px; gap: 20px; }
  .home-hero-text{ gap: 20px; flex-basis: 100%; }
  .home-hero-mark{ display: block; }
  .home-hero-emblem{ display: none; }
  .home-hero-lede{ font-size: 17px; }
  .home-actions{ flex-direction: column; }
  .home-actions .btn{ width: 100%; }
  .home-status{ font-size: 14px; padding: 7px 14px; }
  .home-section{ padding: 56px 0 8px; gap: 24px; }
  .home-section-lede{ font-size: 17px; }
  .home-band.is-filled{ margin-top: 48px; }
  .home-band.is-filled .home-section{ padding: 48px 0; }
  .home-steps{ grid-template-columns: 1fr; gap: 18px; padding: 24px 0; }
  .home-juries{ grid-template-columns: 1fr; gap: 16px; }
  .home-jury{ padding: 22px; border-radius: 16px; gap: 10px; }
  .home-jury h3{ font-size: 22px; }
  .home-jury p{ font-size: 16px; }
  .home-cats li{ grid-template-columns: minmax(0, 1fr) auto; padding: 16px 0; row-gap: 2px; }
  .home-cat-name{ font-size: 18px; }
  .home-cat-places{ grid-column: 1; grid-row: 2; font-size: 15px; }
  .home-cat-price{ grid-column: 2; grid-row: 1 / span 2; font-size: 17px; }
  .home-cats-cta{ align-self: stretch; }
  .home-podium{ grid-template-columns: 1fr; gap: 14px; }
  .home-podium li{ padding: 22px; border-radius: 16px; gap: 6px; }
  .home-podium-rank{ font-size: 40px; }
  .home-podium-name{ font-size: 21px; }
  .home-audiences{ grid-template-columns: 1fr; gap: 14px; }
  .home-audience{ padding: 22px; }
  .home-hero.is-compact{ padding: 32px 0 28px; }
  .home-section-spacer{ height: 32px; }
  .eds-current{ grid-template-columns: 1fr; }
  .eds-card{ padding: 22px; border-radius: 16px; }
  .eds-card h2{ font-size: 22px; }
  .eds-past a, .eds-past-row{ grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; padding: 16px 0; }
  .eds-past-meta{ grid-row: 2; grid-column: 1 / -1; font-size: 15px; }
  .eds-past-year{ font-size: 20px; }
}

/* ── Palmarès (direction « Grand Cru ») ───────────────────── */
.pal{ width: 100%; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; }
.pal-muted{ color: var(--fg-2); }
.pal-head{ padding: 72px 0 32px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 32px; }
.pal-head-title{ display: flex; flex-direction: column; gap: 14px; }
.pal-head h1{ margin: 0; font-size: clamp(44px, 6vw, 72px); }
.pal-head p{ margin: 0; font-size: 18px; color: var(--fg-2); }
.pal-edition{ display: flex; align-items: flex-end; gap: 10px; }
.pal-edition label{ display: flex; flex-direction: column; gap: 8px; font-size: 15px; font-weight: 600; color: var(--fg-2); }
.pal-edition select{ min-width: 220px; padding: 14px 16px; border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); background: var(--bg-2); color: var(--fg); font: inherit; font-size: 17px; }
.pal-edition select:focus-visible{ outline: 2px solid var(--accent-hi); outline-offset: 2px; }

.pal-controls{ padding-bottom: 40px; display: flex; flex-direction: column; gap: 20px; }
.pal-jury{ display: inline-flex; align-self: flex-start; padding: 6px; gap: 4px; border-radius: calc(var(--radius-control) + 4px);
  background: var(--bg-2); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
.pal-jury a{ font-size: 17px; font-weight: 600; padding: 12px 26px; border-radius: var(--radius-control); color: var(--fg); text-decoration: none; }
.pal-jury a:hover{ color: var(--accent-hi); }
.pal-jury a[aria-current]{ background: var(--accent); color: #1a1200; font-weight: 700; }
.pal-explain{ margin: 0; max-width: 760px; font-size: 17px; line-height: 1.6; color: var(--fg-2); }
.pal-cats{ display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.pal-cats-group{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.pal-cats-label{ min-width: 72px; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); }
.pal-cats a{ text-decoration: none; padding: 10px 18px; border-radius: var(--radius-control); border: 1px solid var(--line-strong);
  color: var(--fg); font-weight: 600; font-size: 16px; }
.pal-cats a:hover{ border-color: var(--fg); }
.pal-cats a[aria-current]{ background: var(--fg); border-color: var(--fg); color: var(--bg); font-weight: 700; }

.pal-category{ padding: 32px 0 64px; display: flex; flex-direction: column; gap: 36px; border-top: 1px solid var(--line); }
.pal-category-head{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 32px; }
.pal-category-head p{ margin: 0; font-size: 16px; color: var(--fg-2); }
.pal-podium{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: end; }
.pal-podium li{ padding: 32px; border-radius: 24px; background: var(--bg-2); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; min-height: 230px; }
.pal-podium li.is-rank-1{ order: 2; min-height: 300px; padding: 40px 32px; border-color: var(--accent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--accent) 4%, transparent)); }
.pal-podium li.is-rank-2{ order: 1; min-height: 250px; }
.pal-podium li.is-rank-3{ order: 3; }
.pal-podium-prize{ font-size: 14px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-hi); }
.pal-podium-rank{ font-size: 46px; font-weight: 600; letter-spacing: -.02em; line-height: .9; color: var(--fg-2); }
.pal-podium-rank sup{ font-size: 24px; }
.pal-podium li.is-rank-1 .pal-podium-rank{ font-size: 64px; color: var(--accent-hi); }
.pal-podium li.is-rank-1 .pal-podium-rank sup{ font-size: 30px; }
.pal-podium-name{ font-size: 24px; font-weight: 700; }
.pal-podium li.is-rank-1 .pal-podium-name{ font-size: 28px; }
.pal-podium-producer{ font-size: 16px; color: var(--fg-2); }
.pal-podium-meta{ margin-top: auto; padding-top: 8px; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }

.pal-medals{ display: flex; flex-direction: column; gap: 16px; }
.pal-medals h3{ margin: 0; font-size: 22px; font-weight: 700; }
.pal-medals-grid{ display: flex; flex-direction: column; gap: 28px; }
.pal-medals-grid .pal-list{ columns: 2 320px; column-gap: 40px; border-top: 0; }
.pal-medals-grid .pal-list li{ break-inside: avoid; }
.pal-medal-title{ margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
.pal-medal-dot{ width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.pal-list{ margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line-strong); }
.pal-list li{ display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line-strong); font-size: 17px; }
.pal-rank{ display: inline-block; min-width: 44px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.pal-score{ font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pal-dq{ font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--danger); }
.pal-note{ margin: 0; font-size: 15px; color: var(--fg-3); }

.pal-others{ padding-bottom: 64px; display: flex; flex-direction: column; gap: 12px; }
.pal-other{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; padding: 24px 32px;
  border-radius: 20px; border: 1px solid var(--line-strong); color: var(--fg); text-decoration: none; transition: border-color .2s ease; }
.pal-other:hover{ border-color: var(--accent); }
.pal-other-name{ font-size: 24px; font-weight: 600; letter-spacing: -.02em; }

.pal-juries{ padding: 32px 0 96px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 28px; }
.pal-juries h2{ padding-top: 32px; }
.pal-juries ul{ margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.pal-juror{ padding: 24px; border-radius: 16px; background: var(--bg-2); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 14px; }
.pal-juror-id{ display: flex; align-items: center; gap: 14px; }
.pal-juror-id > span:last-child{ display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pal-juror-avatar{ width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex-shrink: 0; display: grid; place-items: center;
  background: var(--accent-dim); color: var(--accent-hi); font-weight: 700; }
.pal-juror-avatar img{ width: 100%; height: 100%; object-fit: cover; }
.pal-juror p{ margin: 0; font-size: 15px; line-height: 1.55; color: var(--fg-2); }

.pal-empty{ padding: 40px; border-radius: 20px; background: var(--bg-2); border: 1px solid var(--line); margin-bottom: 96px; }
.pal-empty h2{ margin: 0 0 10px; font-size: 26px; }
.pal-empty p{ margin: 0; font-size: 17px; color: var(--fg-2); }

@media (max-width: 880px){
  .pal-head{ padding: 32px 0 24px; gap: 20px; }
  .pal-head p{ font-size: 16px; }
  .pal-edition, .pal-edition label, .pal-edition select{ width: 100%; }
  .pal-jury{ align-self: stretch; }
  .pal-jury a{ flex: 1; text-align: center; padding: 12px 10px; font-size: 16px; }
  .pal-explain{ font-size: 16px; }
  .pal-cats-group{ flex-wrap: nowrap; overflow-x: auto; margin: 0 calc(-1 * var(--pad-x)); padding: 0 var(--pad-x) 4px; scrollbar-width: none; }
  .pal-cats a{ white-space: nowrap; flex-shrink: 0; font-size: 15px; padding: 9px 14px; }
  .pal-cats-label{ min-width: 0; }
  .pal-category{ gap: 24px; padding-bottom: 40px; }
  .pal-category-head{ padding-top: 20px; }
  .pal-podium{ grid-template-columns: 1fr; gap: 14px; }
  .pal-podium li, .pal-podium li.is-rank-1, .pal-podium li.is-rank-2{ order: 0; min-height: 0; padding: 22px; border-radius: 16px; gap: 6px; }
  .pal-podium-rank{ font-size: 36px; }
  .pal-podium li.is-rank-1 .pal-podium-rank{ font-size: 46px; }
  .pal-podium-name, .pal-podium li.is-rank-1 .pal-podium-name{ font-size: 21px; }
  .pal-list li{ font-size: 16px; }
  .pal-other{ padding: 18px 20px; border-radius: 14px; }
  .pal-other-name{ font-size: 19px; }
  .pal-juries{ padding-bottom: 48px; }
}

/* ── Pages secondaires (direction « Grand Cru ») ──────────
   Gabarits communs : conteneur (.pg, .pg--narrow pour le texte, .pg--form
   pour les formulaires), en-tête (.pg-head), sections (.pg-section), texte
   long (.prose), carte de formulaire (.form-card), messages (.notice). */
.pg{ width: 100%; max-width: 1200px; margin: 0 auto; padding-bottom: 96px; display: flex; flex-direction: column; }
.pg--narrow{ max-width: 760px; }
.pg--form{ max-width: 560px; }
.pg-head{ padding: 72px 0 40px; display: flex; flex-direction: column; gap: 16px; }
.pg-head h1{ margin: 0; }
.pg-head .eyebrow{ margin: 0; }
.pg-lede{ margin: 0; max-width: 640px; font-size: 19px; line-height: 1.6; color: var(--fg-2); }
.pg-section{ padding: 48px 0; display: flex; flex-direction: column; gap: 28px; }
.pg-section + .pg-section{ border-top: 1px solid var(--line); }
.pg-section-head{ display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 24px; }
.pg-grid{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
.pg-tile{ padding: 28px; border-radius: 16px; background: var(--bg-2); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 12px; color: var(--fg); text-decoration: none; }
a.pg-tile{ transition: border-color .2s ease; }
a.pg-tile:hover{ border-color: var(--accent); }
.pg-tile h3{ margin: 0; font-size: 22px; }
.pg-tile p{ margin: 0; font-size: 16px; line-height: 1.55; color: var(--fg-2); }
.pg-meta{ font-size: 15px; color: var(--fg-3); }
.pg-link{ font-weight: 600; color: var(--accent-hi); text-decoration: none; }
.pg-link:hover{ text-decoration: underline; text-underline-offset: 4px; }

.prose{ font-size: 17px; line-height: 1.7; color: var(--fg-2); }
.prose > * + *{ margin-top: 1em; }
.prose h2{ margin-top: 2em; font-size: 28px; line-height: 1.2; color: var(--fg); }
.prose h3{ margin-top: 1.6em; font-size: 21px; color: var(--fg); }
.prose h2 + *, .prose h3 + *{ margin-top: .6em; }
.prose p, .prose ul, .prose ol{ margin-bottom: 0; }
.prose ul, .prose ol{ padding-left: 1.3em; }
.prose li + li{ margin-top: .4em; }
.prose strong, .prose b{ color: var(--fg); }
.prose a{ color: var(--accent-hi); text-underline-offset: 3px; }
.prose img{ max-width: 100%; height: auto; border-radius: 12px; }
.prose blockquote{ margin-left: 0; padding-left: 18px; border-left: 2px solid var(--accent); color: var(--fg); }

.form-card{ padding: 36px; border-radius: 20px; background: var(--bg-2); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 22px; }
.form-card h2{ margin: 0; font-size: 24px; }
.form-stack{ display: flex; flex-direction: column; gap: 18px; }
.form-row{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; }
.form-actions{ display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.form-actions .btn{ min-width: 180px; }
.form-foot{ margin: 0; padding-top: 20px; border-top: 1px solid var(--line); font-size: 15px; color: var(--fg-2); }
.field{ display: flex; flex-direction: column; gap: 8px; }
.field-input.is-error{ border-color: var(--danger); }
/* Mot de passe : bouton « afficher » posé dans le champ, critères en grille. */
.pw-toggle{ position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px;
  display: grid; place-items: center; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--fg-2); cursor: pointer; }
.pw-toggle:hover{ color: var(--fg); }
.pw-toggle:focus-visible{ outline: 2px solid var(--accent-hi); outline-offset: -2px; }
.pw-criteria{ margin: 6px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 16px; font-size: 14px; }
/* Liste libellé / valeur qui passe sur deux lignes en mobile. */
.pg-dl{ margin: 0; display: flex; flex-direction: column; }
.pg-dl > div{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.pg-dl > div:last-child{ border-bottom: 0; }
.pg-dl dt{ color: var(--fg-2); }
.pg-dl dd{ margin: 0; color: var(--fg); font-weight: 600; text-align: right; }
[id]{ scroll-margin-top: 96px; }
.form-foot a{ color: var(--accent-hi); font-weight: 600; }
.field-label{ font-size: 15px; font-weight: 600; color: var(--fg); }
.field-hint{ font-size: 14px; line-height: 1.45; color: var(--fg-3); }
.field-error{ font-size: 14px; line-height: 1.45; color: var(--danger); }
textarea.field-input{ height: auto; min-height: 140px; padding: 12px 14px; line-height: 1.5; resize: vertical; }

.notice{ padding: 16px 18px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--bg-2); font-size: 16px; line-height: 1.55; color: var(--fg); }
.notice.is-info{ border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: var(--accent-dim); }
.notice.is-success{ border-color: rgba(127,214,154,.45); background: rgba(127,214,154,.08); }
.notice.is-error{ border-color: color-mix(in srgb, var(--danger) 55%, transparent); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.notice b{ font-weight: 700; }

@media (max-width: 880px){
  .pg{ padding-bottom: 48px; }
  .pg-head{ padding: 32px 0 24px; gap: 12px; }
  .pg-lede{ font-size: 17px; }
  .pg-section{ padding: 32px 0; gap: 20px; }
  .pg-grid{ grid-template-columns: 1fr; gap: 14px; }
  .pg-tile{ padding: 22px; }
  .prose{ font-size: 16px; }
  .prose h2{ font-size: 23px; }
  .form-card{ padding: 22px; border-radius: 16px; }
  .form-actions .btn{ width: 100%; }
}

/* ── Reduced motion (WCAG 2.3.3) ──────────────────────────
   Users with vestibular disorders or who set prefers-reduced-motion
   should not see the ticker, the shadow pulse, the live dot, etc. */
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .live-dot{ animation: none !important; }
}
`;
