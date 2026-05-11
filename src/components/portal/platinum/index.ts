// ── CSS ──────────────────────────────────────────────────────────────────────
export { platinumCSS } from "./platinum-styles";

// ── Layout shells ─────────────────────────────────────────────────────────────
export { PlatinumLayout } from "./platinum-layout";
export type { PlatinumLayoutProps } from "./platinum-layout";
export { PlatinumShell } from "./platinum-shell";

// ── Primitives (design-faithful names) ──────────────────────────────────────
export {
  Pill,
  Eyebrow,
  Countdown,
  Placeholder,
  Ticker,
  CodeChip,
  Field,
  Check,
  LabelBadge,
} from "./platinum-shared";

// ── Legacy Pt-prefixed aliases (backward compat) ─────────────────────────────
export {
  PtPill,
  PtEyebrow,
  PtCountdown,
  PtTicker,
  PtCodeChip,
} from "./platinum-shared";

// ── Trophy ────────────────────────────────────────────────────────────────────
export { PlatinumTrophy } from "./platinum-trophy";

// ── Geometric emblem (R3F + GLB) ──────────────────────────────────────────────
// Re-exported through the lazy wrapper so Three.js is not bundled with the
// pages that statically import { GeometricEmblem }.
export { GeometricEmblem } from "./geometric-emblem-lazy";
