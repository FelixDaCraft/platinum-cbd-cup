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
}

interface RankingRowProps {
  row: ProductRow;
  isLast: boolean;
  /** Hide the trailing label column when the cup is podium-only. */
  showLabel?: boolean;
}

/**
 * Single row in the public palmarès rankings table.
 * Client component for the hover interaction. Columns:
 * Rang · Code · Variété · Producteur · Score · Label?
 */
export function RankingRow({ row, isLast, showLabel = true }: RankingRowProps) {
  return (
    <div
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
      {/* Rank within category */}
      <span
        className="tabular"
        style={{
          fontSize: 18,
          fontWeight: 300,
          color: row.rank === 1 ? "var(--accent)" : "var(--fg)",
        }}
      >
        {row.rank > 0 ? String(row.rank).padStart(2, "0") : "—"}
      </span>

      {/* Anonymous code */}
      <span
        style={{
          color: "var(--fg)",
          fontSize: 13,
          letterSpacing: ".02em",
        }}
      >
        {row.code}
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

      {/* Score */}
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

      {/* Label — colored from cup_labels.color, omitted in podium-only mode */}
      {showLabel && (
        <span style={{ textAlign: "right" }}>
          {row.labelName ? (
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
