"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Pill
// ---------------------------------------------------------------------------

interface PillProps {
  children: ReactNode;
  variant?: "default" | "accent" | "solid";
  dot?: boolean;
}

/**
 * Small status/label pill. Maps directly to .pill, .pill.accent, .pill.solid
 * from the design package (unscoped CSS vars on :root).
 */
export function Pill({ children, variant = "default", dot = false }: PillProps) {
  const cls =
    variant === "accent" ? "pill accent" : variant === "solid" ? "pill solid" : "pill";
  return (
    <span className={cls}>
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            boxShadow: "0 0 8px currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Eyebrow
// ---------------------------------------------------------------------------

interface EyebrowProps {
  idx?: number;
  children: ReactNode;
}

/**
 * Monospace uppercase section label. Renders:
 *   <div class="eyebrow"><b>001</b> children</div>
 * when idx is supplied, plain otherwise.
 */
export function Eyebrow({ idx, children }: EyebrowProps) {
  return (
    <div className="eyebrow">
      {idx !== undefined && <b>{String(idx).padStart(3, "0")}</b>}{" "}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

interface CountdownProps {
  /** Target timestamp in milliseconds */
  target: number;
  compact?: boolean;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/**
 * Live countdown to a target timestamp.
 *
 * compact → "DDD:HH:MM:SS" monospace inline
 * default → 4 large tabular blocks with DAYS / HRS / MIN / SEC labels
 */
export function Countdown({ target, compact = false }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  if (compact) {
    return (
      <span className="mono tabular" style={{ letterSpacing: ".05em" }}>
        {pad(days, 3)}:{pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    );
  }

  const units = [
    { v: pad(days, 3), l: "DAYS" },
    { v: pad(hours), l: "HRS" },
    { v: pad(mins), l: "MIN" },
    { v: pad(secs), l: "SEC" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "flex-end",
        fontFamily: "var(--mono)",
      }}
    >
      {units.map((x) => (
        <div
          key={x.l}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <div
            className="tabular"
            style={{
              fontSize: "clamp(42px, 6vw, 72px)",
              lineHeight: 1,
              fontWeight: 300,
              letterSpacing: "-0.03em",
            }}
          >
            {x.v}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: ".15em",
              color: "var(--fg-3)",
            }}
          >
            {x.l}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

interface PlaceholderProps {
  label: string;
  aspect?: string;
  caption?: string;
  style?: React.CSSProperties;
}

/**
 * Monospace hatched placeholder for imagery — shows during layout/design phase.
 */
export function Placeholder({ label, aspect = "1/1", caption, style }: PlaceholderProps) {
  return (
    <div
      style={{
        aspectRatio: aspect,
        border: "1px solid var(--line-strong)",
        borderRadius: 12,
        background:
          "repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--fg) 4%, transparent) 10px 11px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 16,
        fontFamily: "var(--mono)",
        color: "var(--fg-3)",
        fontSize: 10,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      <div>[ {label} ]</div>
      {caption && <div style={{ alignSelf: "flex-end" }}>{caption}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

interface TickerProps {
  items: string[];
}

/**
 * Infinite horizontally-scrolling ticker bar.
 * Items are duplicated for seamless loop. Uses .ticker + .ticker-track CSS classes.
 */
export function Ticker({ items }: TickerProps) {
  if (items.length === 0) return null;
  return (
    <div className="ticker">
      <div className="ticker-track">
        {[...items, ...items].map((t, i) => (
          <span key={i}>
            <span className="dot" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeChip
// ---------------------------------------------------------------------------

interface CodeChipProps {
  code: string;
  score?: number | null;
  rank: number;
}

/**
 * Strain/category code swatch — shows zero-padded rank, anonymized code, optional score.
 */
export function CodeChip({ code, score, rank }: CodeChipProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "10px 12px",
        fontFamily: "var(--mono)",
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: "var(--fg-3)",
          fontSize: 10,
          letterSpacing: ".1em",
        }}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <span style={{ color: "var(--fg)", fontWeight: 500 }}>{code}</span>
      {score != null && (
        <span
          style={{ marginLeft: "auto", color: "var(--accent)" }}
          className="tabular"
        >
          {score.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  hint?: string;
  mono?: boolean;
  type?: string;
  required?: boolean;
}

/**
 * Labeled input with hairline border and focus accent. Mono uppercase label.
 * Stateful focus glow handled via inline event handlers (design fidelity).
 */
export function Field({
  label,
  placeholder,
  value,
  onChange,
  hint,
  mono = false,
  type = "text",
  required = false,
}: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: ".1em",
          color: "var(--fg-3)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`field-input${mono ? " mono" : ""}`}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = "var(--accent)";
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = "var(--line-strong)";
        }}
      />
      {hint && (
        <span
          className="mono fg3"
          style={{ fontSize: 10, letterSpacing: ".08em" }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

interface CheckProps {
  on: boolean;
  onClick: () => void;
}

/**
 * 18×18 checkbox primitive. Accent-filled when on, hairline border when off.
 */
export function Check({ on, onClick }: CheckProps) {
  return (
    <span
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
        background: on ? "var(--accent)" : "transparent",
        display: "grid",
        placeItems: "center",
        color: "#002a00",
        fontSize: 12,
        cursor: "pointer",
        transition: "border-color .15s ease, background .15s ease",
      }}
    >
      {on && "✓"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LabelBadge
// ---------------------------------------------------------------------------

type LabelValue = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

interface LabelBadgeProps {
  label: LabelValue;
}

const LABEL_COLORS: Record<
  LabelValue,
  { bg: string; fg: string; bd: string }
> = {
  PLATINUM: {
    bg: "var(--accent-dim)",
    fg: "var(--accent)",
    bd: "var(--accent)",
  },
  GOLD: {
    bg: "transparent",
    fg: "var(--fg)",
    bd: "var(--line-strong)",
  },
  SILVER: {
    bg: "transparent",
    fg: "var(--fg-2)",
    bd: "var(--line)",
  },
  BRONZE: {
    bg: "transparent",
    fg: "var(--fg-3)",
    bd: "var(--line)",
  },
};

/**
 * Award label badge — PLATINUM / GOLD / SILVER / BRONZE.
 * Ported from page-results.jsx LabelBadge.
 */
export function LabelBadge({ label }: LabelBadgeProps) {
  const c = LABEL_COLORS[label] ?? LABEL_COLORS.SILVER;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 10,
        letterSpacing: ".12em",
        fontFamily: "var(--mono)",
        color: c.fg,
        border: `1px solid ${c.bd}`,
        background: c.bg,
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Legacy named exports for backward compat with index.ts
// (previously PtPill, PtEyebrow, etc.)
// ---------------------------------------------------------------------------
export { Pill as PtPill };
export { Eyebrow as PtEyebrow };
export { Countdown as PtCountdown };
export { Ticker as PtTicker };
export { CodeChip as PtCodeChip };
