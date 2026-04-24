"use client";

import { LabelBadge } from "~/components/portal/platinum";

type LabelTier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

interface ProductRow {
  rank: number;
  code: string;
  catCode: string;
  score: number;
  labelTier: LabelTier;
}

interface RankingRowProps {
  row: ProductRow;
  isLast: boolean;
}

/**
 * Single row in the public palmarès rankings table.
 * Client component so that mouse-enter/leave hover handlers work
 * while the parent page.tsx remains a Server Component.
 */
export function RankingRow({ row, isLast }: RankingRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 90px 1fr 110px 110px 120px",
        padding: "20px 28px",
        alignItems: "center",
        borderBottom: isLast ? 0 : "1px solid var(--line)",
        fontFamily: "var(--mono)",
        fontSize: 14,
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
      {/* Rank */}
      <span
        className="tabular"
        style={{
          fontSize: 22,
          fontWeight: 300,
          color: row.rank === 1 ? "var(--accent)" : "var(--fg)",
        }}
      >
        {String(row.rank).padStart(2, "0")}
      </span>

      {/* Anonymous code */}
      <span style={{ color: "var(--fg)", fontSize: 16 }}>{row.code}</span>

      {/* Producer — always redacted on public ledger */}
      <span
        style={{
          color: "var(--fg-2)",
          fontStyle: "italic",
          fontFamily: "var(--sans)",
          fontSize: 13,
        }}
      >
        · disclosure pending ·
      </span>

      {/* Category code */}
      <span className="fg3" style={{ fontSize: 12, letterSpacing: ".08em" }}>
        {row.catCode}
      </span>

      {/* Score */}
      <span
        className="tabular"
        style={{ textAlign: "right", fontSize: 16, color: "var(--accent)" }}
      >
        {row.score.toFixed(1)}
      </span>

      {/* Label badge */}
      <span style={{ textAlign: "right" }}>
        <LabelBadge label={row.labelTier} />
      </span>
    </div>
  );
}
