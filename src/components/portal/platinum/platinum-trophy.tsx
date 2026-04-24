"use client";

interface PlatinumTrophyProps {
  size?: number;
  glow?: boolean;
}

/**
 * 3D rotating logo centerpiece — faithful port of trophy.jsx.
 *
 * Uses CSS 3D transforms (spin3d, spinRing, shadowPulse keyframes)
 * declared in platinum-styles.ts. The logo path is hardcoded to the
 * single-tenant asset at /brand/platinum-cbd-cup-logo.png.
 *
 * Orbit text ring: "PLATINUM CBD CUP · EDITION 03 · EUROPE · INDEPENDENT
 * · 2026 · BLIND PANEL · ISO 17025" — repeats to fill the full 360°.
 */
export function PlatinumTrophy({ size = 420, glow = true }: PlatinumTrophyProps) {
  const logoUrl = "/brand/platinum-cbd-cup-logo.png";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        perspective: "1400px",
      }}
    >
      {/* Halo glow behind */}
      {glow && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "10%",
            background:
              "radial-gradient(circle, var(--accent-glow) 0%, rgba(212,175,55,.06) 45%, transparent 70%)",
            filter: "blur(20px)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Ground shadow — breathes via shadowPulse keyframe */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "10%",
          left: "20%",
          right: "20%",
          height: 22,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,.45) 0%, transparent 70%)",
          filter: "blur(8px)",
          animation: "shadowPulse 8s ease-in-out infinite",
        }}
      />

      {/* 3D rotating logo — two faces so the back also reads correctly */}
      <div
        style={{
          width: "72%",
          height: "72%",
          position: "relative",
          transformStyle: "preserve-3d",
          animation: "spin3d 16s cubic-bezier(.45,.05,.55,.95) infinite",
        }}
      >
        {/* Front face */}
        <img
          src={logoUrl}
          alt="Platinum CBD Cup"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            filter:
              "drop-shadow(0 0 40px var(--accent-glow)) drop-shadow(0 12px 30px rgba(0,0,0,.5))",
          }}
        />
        {/* Back face — mirrored so the logo reads on both sides */}
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            filter:
              "drop-shadow(0 0 40px var(--accent-glow)) drop-shadow(0 12px 30px rgba(0,0,0,.5)) brightness(.78)",
          }}
        />
      </div>

      {/* Orbiting text ring — stays in 2D, monospace at 9px */}
      <svg
        viewBox="-200 -200 400 400"
        width={size}
        height={size}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <g
          style={{
            transformOrigin: "center",
            animation: "spinRing 42s linear infinite",
          }}
        >
          <path
            id="labelRing"
            d="M -172 0 A 172 172 0 1 1 172 0 A 172 172 0 1 1 -172 0"
            fill="none"
          />
          <text
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: ".3em",
              fill: "var(--fg-3)",
            }}
          >
            <textPath href="#labelRing" startOffset="0">
              · PLATINUM CBD CUP · EDITION 03 · EUROPE · INDEPENDENT · 2026 ·
              BLIND PANEL · ISO 17025 · PLATINUM CBD CUP · EDITION 03 ·
            </textPath>
          </text>
        </g>
        {/* Faint outer rings */}
        <circle r="180" fill="none" stroke="var(--line)" strokeWidth=".5" />
        <circle
          r="172"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth=".5"
          strokeDasharray="2 4"
        />
      </svg>
    </div>
  );
}
