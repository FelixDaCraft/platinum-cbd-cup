"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PtPill
// ---------------------------------------------------------------------------

interface PtPillProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "solid";
  dot?: boolean;
}

/**
 * Small status/label pill component.
 *
 * Variant mapping:
 *   "default" → .pt-pill
 *   "accent"  → .pt-pill.accent
 *   "solid"   → .pt-pill.solid
 */
export function PtPill({ children, variant = "default", dot = false }: PtPillProps) {
  const variantClass = variant === "default" ? "pt-pill" : `pt-pill ${variant}`;

  return (
    <span className={variantClass}>
      {dot && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--pt-accent, #c8a03c)",
            boxShadow: "0 0 5px var(--pt-accent-glow, rgba(200,160,60,0.6))",
            marginRight: "0.4em",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PtEyebrow
// ---------------------------------------------------------------------------

interface PtEyebrowProps {
  idx?: number;
  children: React.ReactNode;
}

/**
 * Monospace uppercase section label.
 * When `idx` is supplied it renders a zero-padded 3-digit accent number before the text.
 */
export function PtEyebrow({ idx, children }: PtEyebrowProps) {
  return (
    <p className="pt-eyebrow">
      {idx !== undefined && (
        <span
          style={{
            color: "var(--pt-accent, #c8a03c)",
            fontFeatureSettings: "'tnum'",
            marginRight: "0.6em",
          }}
        >
          {String(idx).padStart(3, "0")}
        </span>
      )}
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// PtCountdown
// ---------------------------------------------------------------------------

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(target: number): TimeLeft {
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    expired: false,
  };
}

interface PtCountdownProps {
  /** Timestamp in milliseconds */
  target: number;
  compact?: boolean;
}

/**
 * Live countdown to a target timestamp.
 *
 * `compact` → `DDD:HH:MM:SS` inline monospace string
 * default   → large digit blocks with DAYS / HRS / MIN / SEC labels
 */
export function PtCountdown({ target, compact = false }: PtCountdownProps) {
  const [tl, setTl] = useState<TimeLeft>(() => calcTimeLeft(target));

  useEffect(() => {
    if (tl.expired) return;
    const id = setInterval(() => {
      const next = calcTimeLeft(target);
      setTl(next);
      if (next.expired) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target, tl.expired]);

  const pad = (n: number, w = 2) => String(n).padStart(w, "0");

  if (compact) {
    return (
      <span
        className="pt-countdown-compact"
        style={{ fontFamily: "var(--font-mono, monospace)", tabularNums: "true" } as React.CSSProperties}
      >
        {pad(tl.days, 3)}:{pad(tl.hours)}:{pad(tl.minutes)}:{pad(tl.seconds)}
      </span>
    );
  }

  const units: Array<{ label: string; value: number }> = [
    { label: "DAYS", value: tl.days },
    { label: "HRS", value: tl.hours },
    { label: "MIN", value: tl.minutes },
    { label: "SEC", value: tl.seconds },
  ];

  return (
    <div
      className="pt-countdown"
      style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
    >
      {units.map((u, i) => (
        <div key={u.label} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "3.5rem",
            }}
          >
            <span
              className="pt-countdown-digit"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "var(--pt-foreground, #f0ede8)",
              }}
            >
              {pad(u.value)}
            </span>
            <span
              className="pt-countdown-label"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
                color: "var(--pt-accent, #c8a03c)",
                marginTop: "0.25rem",
              }}
            >
              {u.label}
            </span>
          </div>
          {/* Colon separator — hidden after last unit */}
          {i < units.length - 1 && (
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "clamp(1.5rem, 3vw, 2.8rem)",
                fontWeight: 700,
                lineHeight: 1,
                color: "var(--pt-accent-muted, rgba(200,160,60,0.4))",
                margin: "0 0.15rem",
                alignSelf: "flex-start",
                paddingTop: "0.05em",
              }}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PtTicker
// ---------------------------------------------------------------------------

interface PtTickerProps {
  items: string[];
}

/**
 * Infinite horizontally-scrolling ticker bar.
 * Items are duplicated to create a seamless loop.
 * Uses `.pt-ticker` and `.pt-ticker-track` CSS classes.
 */
export function PtTicker({ items }: PtTickerProps) {
  if (items.length === 0) return null;

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="pt-ticker" aria-hidden="true">
      <div className="pt-ticker-track">
        {doubled.map((item, i) => (
          <span key={i} className="pt-ticker-item">
            {item}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                margin: "0 1em",
                color: "var(--pt-accent, #c8a03c)",
                opacity: 0.6,
              }}
            >
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PtCodeChip
// ---------------------------------------------------------------------------

interface PtCodeChipProps {
  code: string;
  score?: number | null;
  rank: number;
}

/**
 * Small badge showing rank + anonymized code + optional numeric score.
 * Monospace font. Score rendered in accent colour.
 */
export function PtCodeChip({ code, score, rank }: PtCodeChipProps) {
  return (
    <span
      className="pt-code-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4em",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.75rem",
        padding: "0.2em 0.6em",
        borderRadius: "0.25em",
        background: "var(--pt-surface-2, rgba(255,255,255,0.04))",
        border: "1px solid var(--pt-border, rgba(255,255,255,0.08))",
        color: "var(--pt-muted, rgba(240,237,232,0.6))",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          color: "var(--pt-accent, #c8a03c)",
          fontWeight: 600,
          minWidth: "1.4em",
          textAlign: "right",
        }}
      >
        #{rank}
      </span>
      <span>{code}</span>
      {score != null && (
        <>
          <span style={{ opacity: 0.3 }}>·</span>
          <span style={{ color: "var(--pt-accent, #c8a03c)", fontWeight: 600 }}>
            {score}
          </span>
        </>
      )}
    </span>
  );
}
