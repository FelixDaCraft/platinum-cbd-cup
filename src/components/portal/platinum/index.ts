// ── CSS ──────────────────────────────────────────────────────────────────────
export { platinumCSS } from "./platinum-styles";

// ── Layout shell ──────────────────────────────────────────────────────────────
// PlatinumLayout (l'ancienne coquille figée) a été supprimé : (portal)/layout.tsx
// n'utilise que PlatinumShell, qui reçoit le statut live côté serveur.
export { PlatinumShell } from "./platinum-shell";

// ── Primitives (design-faithful names) ──────────────────────────────────────
export {
  Pill,
  Eyebrow,
  Placeholder,
  Field,
  Check,
} from "./platinum-shared";

// ── Édition courante ─────────────────────────────────────────────────────────
// Les helpers d'édition ne sont plus réexportés : seul platinum-shell les
// consomme, en import direct depuis ./edition.

// ── Geometric emblem (R3F + GLB) ──────────────────────────────────────────────
// Re-exported through the lazy wrapper so Three.js is not bundled with the
// pages that statically import { GeometricEmblem }.
export { GeometricEmblem } from "./geometric-emblem-lazy";
