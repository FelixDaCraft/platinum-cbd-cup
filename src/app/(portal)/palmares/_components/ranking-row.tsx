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
}

interface RankingRowProps {
  row: ProductRow;
  isLast: boolean;
}

/**
 * Single row in the public palmarès rankings table.
 * Client component for the hover interaction. Columns:
 * Rang · Code · Variété · Producteur · Score · Label
 */
export function RankingRow({ row, isLast }: RankingRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 80px 1.2fr 1fr 90px 110px",
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

      {/* Label */}
      <span style={{ textAlign: "right" }}>
        {row.labelName ? (
          <span
            className="mono"
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: ".12em",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              background: "var(--accent-dim)",
            }}
          >
            {row.labelName}
          </span>
        ) : (
          <span className="fg3" style={{ fontSize: 10 }}>
            —
          </span>
        )}
      </span>
    </div>
  );
}
