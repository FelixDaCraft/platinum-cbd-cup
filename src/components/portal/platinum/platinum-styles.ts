/**
 * Platinum Portal Design System — single source of CSS truth.
 *
 * This is the verbatim <style> block from the HTML design package,
 * with a single adaptation: @font-face src updated to Next.js public path.
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
  --bg: #0a0a0a;
  --bg-2: #111111;
  --fg: #f2f2f2;
  --fg-2: rgba(242,242,242,.62);
  --fg-3: rgba(242,242,242,.38);
  --line: rgba(242,242,242,.10);
  --line-strong: rgba(242,242,242,.20);
  --accent: #d4af37;
  --accent-hi: #f5e6a8;
  --accent-dim: rgba(212,175,55,.14);
  --accent-glow: rgba(212,175,55,.45);
  --danger: #ff3b30;
  --radius: 14px;
  --pad-x: clamp(24px, 4vw, 64px);
  --pad-y: 28px;
  --gap: 16px;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --display: "Louize Display", "Playfair Display", Didot, "Bodoni 72", serif;
}
[data-theme="light"]{
  --bg: #f4f2ec;
  --bg-2: #ffffff;
  --fg: #0a0a0a;
  --fg-2: rgba(10,10,10,.62);
  --fg-3: rgba(10,10,10,.38);
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
  font-size: 14px;
  letter-spacing: -0.005em;
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

.shell{ position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

/* ── Top navigation ─────────────────────────────────────── */
.topbar{
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px var(--pad-x);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid var(--line);
}
.brand{ display:flex; align-items:center; gap:12px; font-family: var(--mono); font-weight:500; font-size:12px; letter-spacing:.02em; text-decoration:none; color: inherit; }
.brand-mark{
  width: 34px; height: 34px;
  display:grid; place-items:center; position:relative;
  filter: drop-shadow(0 0 14px rgba(212,175,55,.18));
}
.brand-mark img{ width: 100%; height: 100%; object-fit: contain; }
.brand-text{ display:flex; flex-direction:column; line-height:1; gap:4px; }
.brand-text b{ font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing: .12em; }
.brand-text span{ font-size:9.5px; color: var(--fg-3); letter-spacing: .14em; text-transform: uppercase; }

.nav{
  display:flex; gap: 2px;
  font-family: var(--mono); font-size: 11px;
  background: transparent;
  border: 1px solid var(--line); border-radius: 999px; padding: 3px;
}
.nav button{
  appearance:none; border:0; background: transparent; color: var(--fg-2);
  font: inherit; padding: 7px 14px; border-radius: 999px; cursor: pointer;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
}
.nav a{
  appearance:none; border:0; background: transparent; color: var(--fg-2);
  font: inherit; padding: 7px 14px; border-radius: 999px; cursor: pointer;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
  display: inline-flex; align-items: center;
}
.nav button.active, .nav a.active{ background: var(--fg); color: var(--bg); }
.nav button:hover:not(.active), .nav a:hover:not(.active){ color: var(--fg); }
.nav .sep{ color: var(--fg-3); padding: 0 2px; display:flex; align-items:center; }

.topbar-right{ display:flex; align-items:center; gap: 14px; font-family: var(--mono); font-size: 11px; color: var(--fg-2); }
.live-dot{ width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse{ 50%{ opacity: .35; transform: scale(.85); } }
/* Crosshair for the idle "WAITING FOR SIGNAL" state — outline circle with
   a thin cross overshooting both axes, glowing the same accent as the
   live dot but static (no animation, system is dormant). box-shadow on
   both the circle and the cross lines so the glow has enough opaque mass
   to propagate (drop-shadow on a 1px outline barely shows). */
.live-crosshair{
  position: relative; width: 12px; height: 12px;
  border: 1px solid var(--accent); border-radius: 50%;
  box-shadow: 0 0 10px var(--accent);
  flex-shrink: 0;
}
.live-crosshair::before,
.live-crosshair::after{
  content: ""; position: absolute; background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}
.live-crosshair::before{ top: 50%; left: -3px; right: -3px; height: 1px; transform: translateY(-50%); }
.live-crosshair::after{ left: 50%; top: -3px; bottom: -3px; width: 1px; transform: translateX(-50%); }
.live{ display:flex; align-items:center; gap:8px; letter-spacing: .1em; text-transform: uppercase; }

/* ── Page container ─────────────────────────────────────── */
.page{ flex: 1; padding: 0 var(--pad-x) 60px; }

/* ── Shared typographic utilities ───────────────────────── */
.eyebrow{
  font-family: var(--mono); font-size: 11px; letter-spacing: .15em;
  text-transform: uppercase; color: var(--fg-3);
}
.eyebrow b{ color: var(--accent); font-weight: 500; }
.display{
  font-family: var(--display); font-weight: 700; font-style: italic;
  font-size: clamp(56px, 10vw, 148px);
  line-height: .92; letter-spacing: -0.02em;
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
.display em{
  font-style: italic; font-family: var(--display);
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}

/* All headings inside the public portal shell render in Louize Display
   (bold-italic). The single .ttf face declared above only matches
   weight: 700 + style: italic, so we pin both explicitly. Pages that
   previously relied on .section-title (mono) now inherit the display face. */
.shell h1, .shell h2, .shell h3, .shell h4, .shell h5, .shell h6 {
  font-family: var(--display);
  font-weight: 700;
  font-style: italic;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

h2.section-title{
  font-family: var(--display); font-weight: 700; font-style: italic;
  font-size: clamp(28px, 3.4vw, 44px);
  letter-spacing: -0.02em; text-transform: none;
  line-height: 1.05;
  margin: 0;
}
.lede{ font-size: 16px; line-height: 1.55; color: var(--fg-2); max-width: 52ch; }

/* ── Pills & chips ─────────────────────────────────────── */
.pill{
  display:inline-flex; align-items:center; gap:8px;
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--line-strong);
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em;
  text-transform: uppercase; color: var(--fg-2);
}
.pill.accent{ border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.pill.solid{ background: var(--fg); color: var(--bg); border-color: var(--fg); }

/* ── Buttons ───────────────────────────────────────────── */
.btn{
  appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 22px; border-radius: 999px;
  font-family: var(--mono); font-size: 12px; letter-spacing: .08em;
  text-transform: uppercase; font-weight: 500;
  border: 1px solid var(--fg); background: var(--fg); color: var(--bg);
  transition: transform .15s ease, background .15s ease;
  text-decoration: none;
}
.btn:hover{ transform: translateY(-1px); }
.btn.ghost{ background: transparent; color: var(--fg); }
.btn.ghost:hover{ background: var(--fg); color: var(--bg); }
.btn.accent{
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  border-color: var(--accent); color: #1a1200;
  box-shadow: 0 0 0 1px rgba(255,255,255,.06) inset, 0 1px 0 rgba(255,255,255,.35) inset, 0 10px 30px -10px var(--accent-glow);
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
.kv{ display:flex; justify-content:space-between; align-items:center;
     padding: 14px 0; border-bottom: 1px solid var(--line);
     font-family: var(--mono); font-size: 12px; }
.kv:last-child{ border-bottom: 0; }
.kv-k{ color: var(--fg-3); text-transform: uppercase; letter-spacing: .08em; }
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
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--fg-3);
}

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
  /* Hide desktop nav + brand secondary line + topbar live indicator's verbose
     state — keep just the brand mark, name, and live dot. */
  .topbar > .nav{ display: none !important; }
  .topbar{ padding: 10px var(--pad-x); }
  .topbar .brand-text span{ display: none; }
  .topbar .brand-text b{ font-size: 11px; letter-spacing: .14em; }
  .topbar .live span{ display: none; }
  .topbar .live{ gap: 0; }

  /* Bottom nav: 5 equal segments, fixed bottom, safe-area inset, gold-on-black
     identity. Active item gets a 2px gold accent line on top + gold label. */
  .mobile-bottom-nav{
    display: grid;
    grid-template-columns: repeat(5, 1fr);
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
    text-decoration: none; color: var(--fg-3);
    font-family: var(--mono);
    border-top: 2px solid transparent;
    transition: color .15s ease, border-color .15s ease;
  }
  .mobile-bottom-nav__idx{
    font-size: 8.5px; letter-spacing: .14em; color: inherit;
  }
  .mobile-bottom-nav__label{
    font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
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

  /* ── Mobile home hero (3D fullscreen, scroll-driven) ─────────── */
  .mobile-home-hero{
    position: relative;
    min-height: 100svh;
    margin: 0 calc(-1 * var(--pad-x));
    padding: 0 var(--pad-x);
    overflow: hidden;
  }
  .mobile-home-hero__canvas{
    position: fixed;
    top: 56px;
    left: 0; right: 0;
    bottom: 56px;
    display: grid;
    place-items: center;
    pointer-events: none;
    z-index: 0;
    transition: opacity .12s linear;
    will-change: opacity;
  }
  .mobile-home-hero__content{
    position: relative;
    z-index: 2;
    display: flex; flex-direction: column;
    justify-content: space-between;
    min-height: calc(100svh - 56px - 56px);
    padding: 24px 0 32px;
  }
  .mobile-home-hero__eyebrow{
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 10.5px;
    letter-spacing: .14em; text-transform: uppercase;
    color: var(--fg-3);
  }
  .mobile-home-hero__eyebrow-tag{ color: var(--accent); font-weight: 500; }
  .mobile-home-hero__hint{
    align-self: center;
    font-family: var(--mono); font-size: 9.5px;
    letter-spacing: .14em; text-transform: uppercase;
    color: var(--fg-3); opacity: .55;
    pointer-events: none;
    margin-top: 12px;
  }
  .mobile-home-hero__below{
    display: flex; flex-direction: column; gap: 18px;
    /* A subtle backdrop wash so the title stays readable when the 3D
       is at full opacity behind it. Fades organically from transparent
       at the top to a near-opaque base at the CTAs. */
    background: linear-gradient(180deg,
      transparent 0%,
      color-mix(in srgb, var(--bg) 30%, transparent) 35%,
      color-mix(in srgb, var(--bg) 78%, transparent) 100%);
    margin: 0 calc(-1 * var(--pad-x));
    padding: 56px var(--pad-x) 0;
  }
  .mobile-home-hero__title{
    font-size: clamp(48px, 12vw, 72px);
    line-height: .95;
    margin: 0;
  }
  .mobile-home-hero__sub{
    font-size: 10.5px;
    letter-spacing: .18em;
    color: var(--fg-3);
    text-transform: uppercase;
  }
  .mobile-home-hero__cta{
    display: flex; flex-direction: column; gap: 10px;
    margin-top: 8px;
  }
  .mobile-home-hero__cta .btn{
    width: 100%;
    justify-content: center;
  }

  /* Hide the desktop fixed top-right palmarès emblem on mobile —
     the MobilePalmaresBackdrop replaces it with a centered viewport-fill
     ghost canvas. */
  .palmares-desktop-emblem{ display: none !important; }

  /* ── Mobile palmarès 3D backdrop ─────────────────────────────── */
  .mobile-palmares-backdrop{
    position: fixed;
    top: 56px;
    left: 50%;
    bottom: 56px;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    pointer-events: none;
    z-index: 0;
    /* Bumped from .15 → .25 so the emblem stays visibly transparent
       through the scrolled cards and rankings. The Best in Show /
       rankings cards are also softened to ~45% bg-2 below for the same
       reason — the user wants the logo to keep a slight, persistent
       presence behind the data. */
    opacity: .25;
    transition: opacity .8s ease, transform .8s ease;
    will-change: opacity, transform;
  }
  .mobile-palmares-backdrop > div{
    pointer-events: none;
  }
  .mobile-palmares-backdrop.is-pulsing{
    opacity: .38;
    animation: mobilePalmaresPulse 4s ease-in-out infinite;
  }
  @keyframes mobilePalmaresPulse{
    0%, 100%{ transform: translateX(-50%) scale(1); }
    50%{ transform: translateX(-50%) scale(1.05); }
  }

  /* ── Palmarès cards · let the 3D backdrop bleed through ──────
     The desktop cards use ~55-60% bg-2 — opaque enough to read but on
     mobile we want the emblem to remain visibly transparent through the
     content. Override inline backgrounds via data attributes (specific
     enough to win without polluting the whole .card class). */
  [data-best-in-show]{
    background: color-mix(in srgb, var(--bg-2) 38%, transparent) !important;
    backdrop-filter: blur(14px) saturate(160%) !important;
    -webkit-backdrop-filter: blur(14px) saturate(160%) !important;
  }
  [data-rankings-card]{
    background: color-mix(in srgb, var(--bg-2) 42%, transparent) !important;
    backdrop-filter: blur(16px) saturate(160%) !important;
    -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  }
  [data-methodology-card]{
    background: color-mix(in srgb, var(--bg-2) 45%, transparent) !important;
    backdrop-filter: blur(14px) saturate(160%) !important;
    -webkit-backdrop-filter: blur(14px) saturate(160%) !important;
  }

  /* ── Palmarès filter strips · single-line horizontal scroll ───
     The desktop wraps the edition pills + category chips when they
     overflow. On mobile that wraps onto multiple lines and eats the
     viewport. Here we override flex-wrap to keep them single-line and
     turn the container into a snap scroller that bleeds to the viewport
     edges with a soft mask-image fade on the right (so the user can see
     there's more content past the edge). Inline styles set flex-wrap
     so we use !important. */
  .palmares-edition-strip,
  .palmares-category-strip{
    flex-wrap: nowrap !important;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    /* Bleed to viewport edges so the fade gradient sits at the screen
       edge, not inside the page padding. */
    margin-left: calc(-1 * var(--pad-x));
    margin-right: calc(-1 * var(--pad-x));
    padding: 4px var(--pad-x);
    /* Right-edge fade gradient — last 36px of the strip fades to
       transparent so partially-visible pills hint at "scroll for more". */
    mask-image: linear-gradient(to right,
      black 0%,
      black calc(100% - 36px),
      transparent 100%);
    -webkit-mask-image: linear-gradient(to right,
      black 0%,
      black calc(100% - 36px),
      transparent 100%);
  }
  .palmares-edition-strip::-webkit-scrollbar,
  .palmares-category-strip::-webkit-scrollbar{ display: none; }
  .palmares-edition-strip > *,
  .palmares-category-strip > *{
    flex-shrink: 0 !important;
    scroll-snap-align: start;
  }
  /* The edition strip parent (header flex-row) needs a width hint so
     the strip can grow to fill the line below the H1. With flex-wrap
     on the parent and the strip on a fresh line, we want it to claim
     the whole row. */
  .palmares-edition-strip{
    width: 100%;
    margin-top: 8px;
  }

  /* ── Typographic ladder shrink for phones ─────────────────────── */
  .display{
    /* Smaller default for any .display on mobile (palmares "Results.",
       cup detail, etc.). The home hero overrides this with its own
       .mobile-home-hero__title rule below to stay impactful. */
    font-size: clamp(36px, 10vw, 56px);
    line-height: 1.0;
  }
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

  /* ── Ranking table → stacked cards ────────────────────────────
     The desktop table grid is repurposed into a 3-row card layout where
     the rank is a tall left anchor, name/code/producer stack in the
     middle, and score/label sit on the right. Inline styles set on the
     RankingRow children win specificity, so we override with !important
     where needed. */
  .ranking-header{ display: none !important; }

  .ranking-row{
    grid-template-columns: 44px 1fr auto !important;
    grid-template-rows: auto auto auto !important;
    grid-template-areas:
      "rank name     score"
      "rank code     label"
      "rank producer producer" !important;
    column-gap: 14px;
    row-gap: 2px;
    padding: 14px 18px !important;
    align-items: center !important;
  }
  .ranking-row > :nth-child(1){
    grid-area: rank;
    align-self: center;
    font-size: 22px !important;
  }
  .ranking-row > :nth-child(2){
    grid-area: code;
    font-size: 10.5px !important;
    color: var(--fg-3) !important;
    letter-spacing: .12em !important;
    text-transform: uppercase;
  }
  .ranking-row > :nth-child(3){
    grid-area: name;
    font-size: 14px !important;
    line-height: 1.25;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ranking-row > :nth-child(4){
    grid-area: producer;
    font-size: 11.5px !important;
    color: var(--fg-3) !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ranking-row > :nth-child(5){
    grid-area: score;
    align-self: center;
    font-size: 22px !important;
    text-align: right;
  }
  /* Medalists outside the top 3 show the "Médaillé" placeholder instead of a
     number — keep it small so it doesn't inherit the 22px score sizing. */
  .ranking-row > :nth-child(5).score-medal{
    font-size: 10px !important;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--fg-3) !important;
  }
  .ranking-row > :nth-child(6){
    grid-area: label;
    align-self: center;
    text-align: right;
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
    font-size: 9.5px;
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
.ticker{
  overflow: hidden; white-space: nowrap;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  font-family: var(--mono); font-size: 11px;
  padding: 12px 0; color: var(--fg-2); letter-spacing: .1em;
  text-transform: uppercase;
}
.ticker-track{ display:inline-flex; animation: tick 60s linear infinite; will-change: transform; }
.ticker-group{ display:inline-flex; gap: 40px; padding-right: 40px; flex-shrink: 0; }
.ticker-group span{ display:inline-flex; align-items:center; gap: 10px; flex-shrink: 0; }
.ticker-group .dot{ width:5px; height:5px; border-radius:50%; background: var(--accent); }
@keyframes tick{ from{ transform: translateX(0); } to{ transform: translateX(-50%); } }

/* ── Trophy keyframes ─────────────────────────────────── */
@keyframes spin3d {
  0%   { transform: rotateY(0deg) rotateX(2deg); }
  50%  { transform: rotateY(180deg) rotateX(-2deg); }
  100% { transform: rotateY(360deg) rotateX(2deg); }
}
@keyframes spinRing { to { transform: rotate(360deg); } }
@keyframes shadowPulse {
  0%, 100% { opacity: .9; transform: scaleX(1); }
  50%      { opacity: .6; transform: scaleX(.82); }
}

/* ── Form inputs (Field / Check) ──────────────────────── */
.field-input{
  appearance:none; width:100%; height: 44px; padding:0 14px;
  background: var(--bg); border: 1px solid var(--line-strong); border-radius: 10px;
  color: var(--fg); font-family: var(--sans); font-size: 14px; outline: none;
  transition: border-color .15s ease;
}
.field-input:focus{ border-color: var(--accent); }
.field-input.mono{ font-family: var(--mono); }
`;
