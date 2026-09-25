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
  // Start mounted=false so SSR and first client render produce identical
  // placeholders. The interval kicks in only after hydration → no mismatch.
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(target);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = mounted ? Math.max(0, target - now) : 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  if (compact) {
    return (
      <span
        className="mono tabular"
        style={{ letterSpacing: ".05em" }}
        suppressHydrationWarning
      >
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
            suppressHydrationWarning
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
 * Two identical groups + 50% translate produce a seamless gap-free loop.
 */
export function Ticker({ items }: TickerProps) {
  if (items.length === 0) return null;
  const renderGroup = (key: string, ariaHidden = false) => (
    <div className="ticker-group" key={key} aria-hidden={ariaHidden}>
      {items.map((t, i) => (
        <span key={`${key}-${i}`}>
          <span className="dot" /> {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker">
      <div className="ticker-track">
        {renderGroup("a")}
        {renderGroup("b", true)}
      </div>
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
  /** Nom du champ — indispensable à l'autoremplissage du navigateur. */
  name?: string;
  /** Jeton autocomplete HTML ("name", "email", "organization"…). */
  autoComplete?: string;
  /** Message d'erreur de validation, annoncé via aria-describedby. */
  error?: string;
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
  name,
  autoComplete,
  error,
}: FieldProps) {
  // Identifiants dérivés du name pour relier input, aide et erreur ; sans
  // name on retombe sur l'association implicite du <label> parent.
  const hintId = name && hint ? `${name}-hint` : undefined;
  const errorId = name && error ? `${name}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

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
        name={name}
        autoComplete={autoComplete}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`field-input${mono ? " mono" : ""}`}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = "var(--accent)";
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = error
            ? "var(--danger)"
            : "var(--line-strong)";
        }}
        style={error ? { borderColor: "var(--danger)" } : undefined}
      />
      {error && (
        <span
          id={errorId}
          className="mono"
          style={{ fontSize: 10.5, letterSpacing: ".08em", color: "var(--danger)" }}
        >
          {error}
        </span>
      )}
      {hint && (
        <span
          id={hintId}
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
  /**
   * Id de l'élément qui porte le libellé visible. Inutile quand la case est
   * déjà enveloppée dans un <label> : celui-ci nomme l'input nativement.
   */
  labelledBy?: string;
  /** Libellé accessible quand aucun texte visible n'est associable. */
  ariaLabel?: string;
}

/**
 * Case à cocher 18×18, remplie à l'accent quand cochée, filet fin sinon.
 *
 * C'est un vrai <input type="checkbox"> rendu transparent au-dessus du carré
 * décoratif : un <label> parent redirige donc ses clics vers lui (cliquer le
 * texte « J'accepte… » coche la case), le clavier et les lecteurs d'écran
 * fonctionnent nativement. L'ancienne version — un <span role="checkbox"> —
 * n'était pas labellisable : le texte du label restait inerte.
 *
 * L'apparence est portée par `.pt-check` dans platinumCSS (état `:checked`,
 * anneau de focus `:focus-visible`). La cible tactile fait 24px, avec une
 * marge négative pour ne pas décaler les mises en page existantes.
 */
export function Check({ on, onClick, labelledBy, ariaLabel }: CheckProps) {
  return (
    <span className="pt-check">
      <input
        type="checkbox"
        checked={on}
        onChange={onClick}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
      />
      <span className="pt-check-box" aria-hidden="true">
        {on && "✓"}
      </span>
    </span>
  );
}
