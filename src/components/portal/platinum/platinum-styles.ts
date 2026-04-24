/**
 * Platinum Portal Design System — CSS-in-JS string
 *
 * Injected via a <style> tag when the platinum template is active.
 * All selectors are scoped under `.platinum-portal` to avoid conflicts
 * with the host application's stylesheet.
 */
export const platinumCSS = `
@font-face {
  font-family: "Louize Display";
  src: url("/fonts/LouizeDisplay-BoldItalic.ttf") format("truetype");
  font-weight: 700;
  font-style: italic;
  font-display: swap;
}

.platinum-portal {
  --pt-bg: #0a0a0a;
  --pt-bg-2: #111111;
  --pt-fg: #f2f2f2;
  --pt-fg-2: rgba(242,242,242,.62);
  --pt-fg-3: rgba(242,242,242,.38);
  --pt-line: rgba(242,242,242,.10);
  --pt-line-strong: rgba(242,242,242,.20);
  --pt-accent: #d4af37;
  --pt-accent-hi: #f5e6a8;
  --pt-accent-dim: rgba(212,175,55,.14);
  --pt-accent-glow: rgba(212,175,55,.45);
  --pt-danger: #ff3b30;
  --pt-radius: 14px;
  --pt-pad-x: clamp(24px, 4vw, 64px);
  --pt-pad-y: 28px;
  --pt-gap: 16px;
  --pt-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --pt-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --pt-display: "Louize Display", "Playfair Display", Didot, "Bodoni 72", serif;

  background-color: var(--pt-bg) !important;
  color: var(--pt-fg) !important;
  font-family: var(--pt-sans) !important;
  -webkit-font-smoothing: antialiased;
  font-size: 14px;
  letter-spacing: -0.005em;
}

/* Override portal-root font rules for platinum */
#portal-root .platinum-portal h1, #portal-root .platinum-portal h2, #portal-root .platinum-portal h3,
#portal-root .platinum-portal h4, #portal-root .platinum-portal h5, #portal-root .platinum-portal h6 {
  font-family: var(--pt-sans) !important;
}
#portal-root .platinum-portal p, #portal-root .platinum-portal span, #portal-root .platinum-portal div,
#portal-root .platinum-portal a, #portal-root .platinum-portal li, #portal-root .platinum-portal td, #portal-root .platinum-portal th {
  font-family: var(--pt-sans) !important;
}

/* Light mode variant */
.platinum-portal[data-pt-theme="light"] {
  --pt-bg: #f4f2ec;
  --pt-bg-2: #ffffff;
  --pt-fg: #0a0a0a;
  --pt-fg-2: rgba(10,10,10,.62);
  --pt-fg-3: rgba(10,10,10,.38);
  --pt-line: rgba(10,10,10,.10);
  --pt-line-strong: rgba(10,10,10,.20);
  --pt-accent: #8a6a1f;
  --pt-accent-hi: #c9a94a;
  --pt-accent-dim: rgba(138,106,31,.10);
  --pt-accent-glow: rgba(138,106,31,.25);
}

/* Density variants */
.platinum-portal[data-pt-density="compact"] { --pt-pad-y: 18px; --pt-gap: 10px; }
.platinum-portal[data-pt-density="airy"]    { --pt-pad-y: 44px; --pt-gap: 24px; }

/* Dot matrix background */
.pt-matrix {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: radial-gradient(circle, rgba(242,242,242,.08) 1px, transparent 1.2px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 100%);
}
.platinum-portal[data-pt-theme="light"] .pt-matrix {
  background-image: radial-gradient(circle, rgba(10,10,10,.12) 1px, transparent 1.2px);
}

/* Top navigation */
.pt-topbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px var(--pt-pad-x);
  background: color-mix(in srgb, var(--pt-bg) 82%, transparent);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid var(--pt-line);
}

/* Brand */
.pt-brand { display:flex; align-items:center; gap:12px; font-family: var(--pt-mono); font-weight:500; font-size:12px; letter-spacing:.02em; }
.pt-brand-mark { width: 34px; height: 34px; display:grid; place-items:center; filter: drop-shadow(0 0 14px rgba(212,175,55,.18)); }
.pt-brand-mark img { width: 100%; height: 100%; object-fit: contain; }

/* Navigation pills */
.pt-nav {
  display:flex; gap: 2px;
  font-family: var(--pt-mono); font-size: 11px;
  border: 1px solid var(--pt-line); border-radius: 999px; padding: 3px;
}
.pt-nav a, .pt-nav button {
  appearance:none; border:0; background: transparent; color: var(--pt-fg-2);
  font: inherit; padding: 7px 14px; border-radius: 999px; cursor: pointer;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
}
.pt-nav a.active, .pt-nav button.active { background: var(--pt-fg); color: var(--pt-bg); }
.pt-nav a:hover:not(.active), .pt-nav button:hover:not(.active) { color: var(--pt-fg); }

/* Typography */
.pt-eyebrow {
  font-family: var(--pt-mono); font-size: 11px; letter-spacing: .15em;
  text-transform: uppercase; color: var(--pt-fg-3);
}
.pt-eyebrow b { color: var(--pt-accent); font-weight: 500; }

#portal-root .platinum-portal .pt-display, .pt-display {
  font-family: var(--pt-display) !important; font-weight: 700 !important; font-style: italic !important;
  font-size: clamp(56px, 10vw, 148px);
  line-height: .92; letter-spacing: -0.02em;
  background: linear-gradient(180deg, var(--pt-fg) 0%, var(--pt-fg) 60%, color-mix(in srgb, var(--pt-fg) 75%, var(--pt-accent)) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
#portal-root .platinum-portal .pt-display em, .pt-display em {
  font-style: italic !important; font-family: var(--pt-display) !important;
  background: linear-gradient(180deg, var(--pt-accent-hi) 0%, var(--pt-accent) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}

#portal-root .platinum-portal .pt-section-title, .pt-section-title {
  font-family: var(--pt-mono) !important; font-weight: 400 !important;
  font-size: clamp(24px, 3.2vw, 40px);
  letter-spacing: -0.02em; text-transform: uppercase;
  margin: 0;
}

.pt-lede { font-size: 16px; line-height: 1.55; color: var(--pt-fg-2); max-width: 52ch; }

/* Pills & chips */
.pt-pill {
  display:inline-flex; align-items:center; gap:8px;
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--pt-line-strong);
  font-family: var(--pt-mono); font-size: 10.5px; letter-spacing: .08em;
  text-transform: uppercase; color: var(--pt-fg-2);
}
.pt-pill.accent { border-color: var(--pt-accent); color: var(--pt-accent); background: var(--pt-accent-dim); }
.pt-pill.solid  { background: var(--pt-fg); color: var(--pt-bg); border-color: var(--pt-fg); }

/* Buttons */
.pt-btn {
  appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 22px; border-radius: 999px;
  font-family: var(--pt-mono); font-size: 12px; letter-spacing: .08em;
  text-transform: uppercase; font-weight: 500;
  border: 1px solid var(--pt-fg); background: var(--pt-fg); color: var(--pt-bg);
  transition: transform .15s ease, background .15s ease;
  text-decoration: none;
}
.pt-btn:hover { transform: translateY(-1px); }
.pt-btn.ghost { background: transparent; color: var(--pt-fg); }
.pt-btn.ghost:hover { background: var(--pt-fg); color: var(--pt-bg); }
.pt-btn.accent {
  background: linear-gradient(180deg, var(--pt-accent-hi) 0%, var(--pt-accent) 100%);
  border-color: var(--pt-accent); color: #1a1200;
  box-shadow: 0 0 0 1px rgba(255,255,255,.06) inset, 0 1px 0 rgba(255,255,255,.35) inset, 0 10px 30px -10px var(--pt-accent-glow);
}
.pt-btn.accent:hover { filter: brightness(1.05); }

/* Cards */
.pt-card {
  background: var(--pt-bg-2);
  border: 1px solid var(--pt-line);
  border-radius: var(--pt-radius);
  padding: var(--pt-pad-y);
}
.pt-card-hover { transition: border-color .2s ease; }
.pt-card-hover:hover { border-color: var(--pt-line-strong); }

/* Grid */
.pt-grid { display: grid; gap: var(--pt-gap); }
.pt-g2 { grid-template-columns: repeat(2, 1fr); }
.pt-g3 { grid-template-columns: repeat(3, 1fr); }
.pt-g4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 880px) {
  .pt-g2, .pt-g3, .pt-g4 { grid-template-columns: 1fr; }
}

/* Key-value rows */
.pt-kv {
  display:flex; justify-content:space-between; align-items:center;
  padding: 14px 0; border-bottom: 1px solid var(--pt-line);
  font-family: var(--pt-mono); font-size: 12px;
}
.pt-kv:last-child { border-bottom: 0; }
.pt-kv-k { color: var(--pt-fg-3); text-transform: uppercase; letter-spacing: .08em; }
.pt-kv-v { color: var(--pt-fg); font-variant-numeric: tabular-nums; }

/* Ticker */
.pt-ticker {
  overflow: hidden; white-space: nowrap;
  border-top: 1px solid var(--pt-line);
  border-bottom: 1px solid var(--pt-line);
  font-family: var(--pt-mono); font-size: 11px;
  padding: 12px 0; color: var(--pt-fg-2); letter-spacing: .1em;
  text-transform: uppercase;
}
.pt-ticker-track { display:inline-flex; gap: 40px; animation: pt-tick 42s linear infinite; padding-left: 100%; }
.pt-ticker-track .dot { width:5px; height:5px; border-radius:50%; background: var(--pt-accent); }
@keyframes pt-tick { from { transform: translateX(0); } to { transform: translateX(-100%); } }

/* Utilities */
.pt-mono    { font-family: var(--pt-mono); }
.pt-tabular { font-variant-numeric: tabular-nums; }
.pt-muted   { color: var(--pt-fg-2); }
.pt-fg3     { color: var(--pt-fg-3); }

/* Footer */
.pt-footer {
  padding: 40px var(--pt-pad-x);
  border-top: 1px solid var(--pt-line);
  display:flex; justify-content:space-between; align-items:center; gap: 20px; flex-wrap: wrap;
  font-family: var(--pt-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--pt-fg-3);
}

/* Page animation */
.pt-page-enter { animation: pt-fadeUp .4s cubic-bezier(.2,.7,.2,1) both; }
@keyframes pt-fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }

/* Live dot */
.pt-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pt-accent); box-shadow: 0 0 10px var(--pt-accent); animation: pt-pulse 1.6s ease-in-out infinite; }
@keyframes pt-pulse { 50% { opacity: .35; transform: scale(.85); } }

/* 3D Trophy animations */
@keyframes pt-spin3d {
  0%   { transform: rotateY(0deg) rotateX(2deg); }
  50%  { transform: rotateY(180deg) rotateX(-2deg); }
  100% { transform: rotateY(360deg) rotateX(2deg); }
}
@keyframes pt-spinRing { to { transform: rotate(360deg); } }
@keyframes pt-shadowPulse {
  0%, 100% { opacity: .9; transform: scaleX(1); }
  50%      { opacity: .6; transform: scaleX(.82); }
}

/* Scrollbar */
.platinum-portal ::-webkit-scrollbar { width: 10px; height: 10px; }
.platinum-portal ::-webkit-scrollbar-track { background: transparent; }
.platinum-portal ::-webkit-scrollbar-thumb { background: var(--pt-line-strong); border-radius: 999px; border: 2px solid var(--pt-bg); }

/* =========================================================
   LAYOUT — Page root & sections
   ========================================================= */

/* Root page wrapper — sits inside platinum-portal */
.pt-root {
  position: relative;
  z-index: 1;
  padding: 0 var(--pt-pad-x);
}

/* Page wrapper applied by PlatinumLayout */
.pt-page {
  min-height: calc(100vh - 64px);
}

/* Generic section spacing */
.pt-section {
  padding-top: clamp(40px, 6vw, 64px);
  padding-bottom: clamp(32px, 5vw, 48px);
}

.pt-section-sm {
  padding-top: 24px;
  padding-bottom: 24px;
}

.pt-section-cta {
  padding-top: clamp(40px, 6vw, 64px);
  padding-bottom: clamp(48px, 8vw, 80px);
}

/* Section header — eyebrow + title stacked */
.pt-section-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

/* =========================================================
   HERO
   ========================================================= */

.pt-hero {
  padding-top: clamp(40px, 6vw, 64px);
  padding-bottom: clamp(48px, 8vw, 80px);
}

.pt-hero-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 40px;
  align-items: center;
}

.pt-hero-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.pt-hero-trophy {
  display: grid;
  place-items: center;
}

.pt-hero-ctas {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 880px) {
  .pt-hero-grid {
    grid-template-columns: 1fr;
  }
  .pt-hero-trophy {
    order: -1;
  }
  .pt-hero-trophy img,
  .pt-hero-trophy > div {
    max-width: 280px !important;
    width: 100% !important;
    height: auto !important;
  }
}

/* =========================================================
   CARDS GRID (info cards, etc.)
   ========================================================= */

.pt-cards-grid {
  display: grid;
  gap: var(--pt-gap);
}

.pt-cards-2 { grid-template-columns: repeat(2, 1fr); }
.pt-cards-3 { grid-template-columns: repeat(3, 1fr); }
.pt-cards-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 880px) {
  .pt-cards-2,
  .pt-cards-3,
  .pt-cards-4 {
    grid-template-columns: 1fr;
  }
}

/* Card content typography */
.pt-card-title {
  font-family: var(--pt-mono);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--pt-fg);
  margin: 16px 0 10px;
}

.pt-card-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--pt-fg-2);
  margin: 0;
}

/* =========================================================
   CATEGORIES GRID
   ========================================================= */

.pt-categories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--pt-gap);
}

@media (max-width: 880px) {
  .pt-categories-grid {
    grid-template-columns: 1fr;
  }
}

.pt-category-card {
  background: var(--pt-bg-2);
  border: 1px solid var(--pt-line);
  border-radius: var(--pt-radius);
  padding: var(--pt-pad-y);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color .2s ease;
}
.pt-category-card:hover {
  border-color: var(--pt-line-strong);
}

.pt-category-code {
  font-family: var(--pt-mono);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--pt-accent);
  line-height: 1;
}

.pt-category-name {
  font-family: var(--pt-mono);
  font-size: 13px;
  color: var(--pt-fg);
  letter-spacing: 0.01em;
}

.pt-category-count {
  font-family: var(--pt-mono);
  font-size: 11px;
  color: var(--pt-fg-3);
  letter-spacing: .04em;
  margin-top: auto;
}

/* =========================================================
   COUNTDOWN BAR
   ========================================================= */

.pt-countdown-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.pt-countdown-bar-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pt-countdown-bar-divider {
  width: 1px;
  height: 48px;
  background: var(--pt-line-strong);
  flex-shrink: 0;
}

.pt-countdown-bar-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

@media (max-width: 640px) {
  .pt-countdown-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .pt-countdown-bar-divider {
    width: 100%;
    height: 1px;
  }
  .pt-countdown-bar-stat {
    align-items: flex-start;
  }
}

/* =========================================================
   STATS — shared value/label blocks
   ========================================================= */

.pt-label {
  font-family: var(--pt-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--pt-fg-3);
}

.pt-stat-value {
  font-family: var(--pt-mono);
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--pt-fg);
}

.pt-stat-label {
  font-family: var(--pt-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--pt-fg-3);
}

/* =========================================================
   CTA CARD (bottom section)
   ========================================================= */

.pt-cta-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
  margin: 0 auto;
}

.pt-cta-title {
  font-family: var(--pt-display);
  font-weight: 700;
  font-style: italic;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, var(--pt-fg) 0%, color-mix(in srgb, var(--pt-fg) 75%, var(--pt-accent)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  margin: 0;
}

.pt-cta-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--pt-fg-2);
  max-width: 60ch;
  margin: 0;
}

.pt-cta-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.pt-cta-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 24px;
  margin-top: 8px;
  border-top: 1px solid var(--pt-line);
}

.pt-cta-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pt-cta-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--pt-line-strong);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .pt-cta-stats {
    gap: 16px;
  }
  .pt-cta-stat-divider {
    display: none;
  }
}

/* =========================================================
   COUNTDOWN component (shared)
   ========================================================= */

.pt-countdown {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.pt-countdown-compact {
  font-family: var(--pt-mono);
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--pt-fg);
}

.pt-countdown-digit {
  font-family: var(--pt-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--pt-fg);
}

.pt-countdown-label {
  font-family: var(--pt-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: var(--pt-accent);
  margin-top: 0.25rem;
  text-transform: uppercase;
}

/* =========================================================
   TICKER item
   ========================================================= */

.pt-ticker-item {
  white-space: nowrap;
  font-family: var(--pt-mono);
  font-size: 11px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--pt-fg-2);
}

/* =========================================================
   CODE CHIP (shared)
   ========================================================= */

.pt-code-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--pt-mono);
  font-size: 0.75rem;
  padding: 0.2em 0.6em;
  border-radius: 0.25em;
  background: color-mix(in srgb, var(--pt-fg) 4%, transparent);
  border: 1px solid var(--pt-line);
  color: var(--pt-fg-2);
  white-space: nowrap;
}

/* =========================================================
   TROPHY component
   ========================================================= */

.pt-trophy-root {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Apply the 3D spin keyframe */
.pt-spin3d {
  animation: pt-spin3d 16s ease-in-out infinite;
  transform-style: preserve-3d;
}

/* Apply the ring spin keyframe */
.pt-spinRing {
  animation: pt-spinRing 42s linear infinite;
}

/* Apply the shadow pulse keyframe */
.pt-shadowPulse {
  animation: pt-shadowPulse 3s ease-in-out infinite;
}
`;
