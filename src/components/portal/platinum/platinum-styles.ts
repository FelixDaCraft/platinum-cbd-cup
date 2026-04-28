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

/* fade in when page switches */
.page-enter{ animation: fadeUp .4s cubic-bezier(.2,.7,.2,1) both; }
@keyframes fadeUp{ from{ opacity:0; transform: translateY(8px); } to{ opacity:1; transform:none; } }

/* Scroll bar */
::-webkit-scrollbar{ width: 10px; height: 10px; }
::-webkit-scrollbar-track{ background: transparent; }
::-webkit-scrollbar-thumb{ background: var(--line-strong); border-radius: 999px; border: 2px solid var(--bg); }

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
