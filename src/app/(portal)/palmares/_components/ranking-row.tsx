"use client";

interface ProductRow {
  rank: number;
  code: string;
  productName: string;
  producerName: string;
  categoryName: string;
  categoryId: string;
  score: number;
  scoreFormatted: string;
  labelName: string | null;
  labelColor: string | null;
  /** True for the top-3 of a category — only these rows show their score. */
  isPodium: boolean;
  /** Disqualified (cheating): "—" rank/code/score + a red DISQUALIFIÉ badge. */
  disqualified: boolean;
}

interface RankingRowProps {
  row: ProductRow;
  isLast: boolean;
  /** Hide the trailing label column (pro cups in podium-only mode). */
  showLabel?: boolean;
  /**
   * Public-jury cups reveal the score for the podium only; medalists outside
   * the top 3 get a "Médaillé" placeholder. Pro cups leave this false and show
   * every visible score.
   */
  maskNonPodiumScore?: boolean;
  /** Edition with no numeric notes (e.g. 2023) — the score cell shows "—". */
  hideScore?: boolean;
}

/**
 * Single row in the public palmarès rankings table.
 * Client component for the hover interaction. Columns:
 * Rang · Code · Variété · Producteur · Score · Label?
 */
export function RankingRow({
  row,
  isLast,
  showLabel = true,
  maskNonPodiumScore = false,
  hideScore = false,
}: RankingRowProps) {
  return (
    <div
      className="ranking-row"
      style={{
        display: "grid",
        gridTemplateColumns: showLabel
          ? "60px 80px 1.2fr 1fr 90px 110px"
          : "60px 80px 1.2fr 1fr 90px",
        padding: "16px 28px",
        alignItems: "center",
        borderBottom: isLast ? 0 : "1px solid var(--line)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        transition: "background .15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "color-mix(in srgb, var(--fg) 3%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Rank within category — hidden (—) whenever the score is hidden, so a
          public-jury medalist outside the top 3 exposes neither rank nor note. */}
      <span
        className="tabular"
        style={{
          fontSize: 18,
          fontWeight: 300,
          color: row.rank === 1 ? "var(--accent)" : "var(--fg)",
        }}
      >
        {row.disqualified || (maskNonPodiumScore && !row.isPodium)
          ? "—"
          : row.rank > 0
            ? String(row.rank).padStart(2, "0")
            : "—"}
      </span>

      {/* Anonymous code */}
      <span
        style={{
          color: "var(--fg)",
          fontSize: 13,
          letterSpacing: ".02em",
        }}
      >
        {row.disqualified ? "—" : row.code}
      </span>

      {/* Variety / product name */}
      <span
        style={{
          color: "var(--fg)",
          fontFamily: "var(--sans)",
          fontSize: 14,
        }}
      >
        {row.productName || "—"}
      </span>

      {/* Producer */}
      <span
        style={{
          color: "var(--fg-2)",
          fontFamily: "var(--sans)",
          fontSize: 13,
        }}
      >
        {row.producerName}
      </span>

      {/* Score — editions without notes (2023) and disqualified rows show "—";
          otherwise public-jury cups reveal it for the podium only (medalists get
          "Médaillé") while pro cups always show the number. */}
      {hideScore || row.disqualified ? (
        <span
          className="mono"
          style={{ textAlign: "right", fontSize: 11, color: "var(--fg-3)" }}
        >
          —
        </span>
      ) : maskNonPodiumScore && !row.isPodium ? (
        <span
          className="mono score-medal"
          style={{
            textAlign: "right",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          Médaillé
        </span>
      ) : (
        <span
          className="tabular"
          style={{
            textAlign: "right",
            fontSize: 16,
            color: "var(--accent)",
          }}
        >
          {row.scoreFormatted}
        </span>
      )}

      {/* Label — DISQUALIFIÉ badge for disqualified rows, else the cup_labels
          colored badge. Omitted entirely in podium-only mode (no DQ present). */}
      {showLabel && (
        <span style={{ textAlign: "right" }}>
          {row.disqualified ? (
            <span
              className="mono"
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: ".12em",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 14%, transparent)",
              }}
            >
              DISQUALIFIÉ
            </span>
          ) : row.labelName ? (
            <span
              className="mono"
              style={
                {
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  border: `1px solid ${row.labelColor ?? "var(--accent)"}`,
                  color: row.labelColor ?? "var(--accent)",
                  // Faint tinted background using the same color at low alpha
                  background: row.labelColor
                    ? `color-mix(in srgb, ${row.labelColor} 14%, transparent)`
                    : "var(--accent-dim)",
                } satisfies React.CSSProperties
              }
            >
              {row.labelName}
            </span>
          ) : (
            <span className="fg3" style={{ fontSize: 10 }}>
              —
            </span>
          )}
        </span>
      )}
    </div>
  );
}
