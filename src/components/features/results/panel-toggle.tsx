"use client";

import { JURY_PANEL_LABELS, juryPanelEnum, type JuryPanel } from "~/lib/enums";

interface PanelToggleProps {
  value: JuryPanel;
  onChange: (panel: JuryPanel) => void;
  /** Panels proposés ; par défaut les deux. */
  panels?: readonly JuryPanel[];
}

/**
 * Bascule entre le classement du jury pro et celui du jury public : chaque
 * cup en produit deux, qui ne se mélangent jamais.
 */
export function PanelToggle({ value, onChange, panels = juryPanelEnum }: PanelToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Jury"
      style={{
        display: "inline-flex",
        border: "1px solid var(--n-border-visible)",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {panels.map((panel) => {
        const active = panel === value;
        return (
          <button
            key={panel}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(panel)}
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              border: 0,
              cursor: "pointer",
              background: active ? "var(--n-text-display)" : "transparent",
              color: active ? "var(--n-black)" : "var(--n-text-secondary)",
            }}
          >
            {JURY_PANEL_LABELS[panel]}
          </button>
        );
      })}
    </div>
  );
}
