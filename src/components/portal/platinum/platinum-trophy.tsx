"use client";

interface PlatinumTrophyProps {
  logoUrl: string;
  size?: number;
}

/**
 * 3D rotating logo component for the Platinum portal template.
 *
 * Renders a perspective-wrapped logo with:
 * - Radial glow halo behind the logo
 * - Breathing ground shadow (pt-shadowPulse)
 * - Two-face 3D spin (pt-spin3d, 16s)
 * - Orbiting SVG text ring (pt-spinRing, 42s)
 * - Outer dotted orbit circle
 */
export function PlatinumTrophy({ logoUrl, size = 420 }: PlatinumTrophyProps) {
  const half = size / 2;
  // Ring sits slightly outside the logo
  const ringRadius = half * 0.72;
  const ringDiameter = ringRadius * 2;
  const ringOffset = half - ringRadius;

  // SVG text on a circular path — we'll repeat the label to fill the ring
  const circumference = Math.round(2 * Math.PI * ringRadius);
  const ringText = "CUPMETRICS ✦ ";
  // Repeat enough times to fill the arc
  const repeats = Math.ceil(circumference / (ringText.length * 7.2)) + 1;
  const svgLabel = ringText.repeat(repeats);

  return (
    <div
      className="pt-trophy-root"
      style={{
        position: "relative",
        width: size,
        height: size,
        perspective: "1400px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Radial glow halo */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, var(--pt-accent-glow, rgba(200,160,60,0.35)) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Ground shadow with breathing animation */}
      <div
        aria-hidden="true"
        className="pt-shadowPulse"
        style={{
          position: "absolute",
          bottom: "4%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "55%",
          height: "6%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, var(--pt-accent-glow, rgba(180,140,40,0.45)) 0%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(8px)",
        }}
      />

      {/* Outer dotted orbit circle */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: `${ringOffset * 0.6}px`,
          borderRadius: "50%",
          border: "1px dashed var(--pt-accent, rgba(200,160,60,0.3))",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Orbiting SVG text ring */}
      <div
        aria-hidden="true"
        className="pt-spinRing"
        style={{
          position: "absolute",
          inset: ringOffset,
          width: ringDiameter,
          height: ringDiameter,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <svg
          width={ringDiameter}
          height={ringDiameter}
          viewBox={`0 0 ${ringDiameter} ${ringDiameter}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <path
              id="pt-ring-path"
              d={`M ${ringRadius},${ringRadius} m -${ringRadius * 0.9},0 a ${ringRadius * 0.9},${ringRadius * 0.9} 0 1,1 ${ringRadius * 1.8},0 a ${ringRadius * 0.9},${ringRadius * 0.9} 0 1,1 -${ringRadius * 1.8},0`}
            />
          </defs>
          <text
            fontFamily="var(--font-mono, monospace)"
            fontSize="10"
            letterSpacing="2"
            fill="var(--pt-accent, #c8a03c)"
            opacity="0.7"
          >
            <textPath href="#pt-ring-path" startOffset="0%">
              {svgLabel}
            </textPath>
          </text>
        </svg>
      </div>

      {/* 3D spinning logo — two faces */}
      <div
        className="pt-spin3d"
        style={{
          position: "relative",
          zIndex: 3,
          width: Math.round(size * 0.52),
          height: Math.round(size * 0.52),
          transformStyle: "preserve-3d",
        }}
      >
        {/* Front face */}
        <img
          src={logoUrl}
          alt="Organisation logo"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />
        {/* Back face — mirrored */}
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
            transform: "rotateY(180deg) scaleX(-1)",
          }}
        />
      </div>
    </div>
  );
}
