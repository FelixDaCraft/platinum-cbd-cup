"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { RatingScale } from "~/server/db/schema/cups";
import { convertScoreToScale, getMaxScoreForScale } from "~/lib/validations/labels";

interface CriteriaScore {
  criterionName: string;
  productScore: number | null;
  categoryAverage: number | null;
  coefficient: number;
}

interface ProductRadarChartProps {
  criteriaScores: CriteriaScore[];
  productName?: string;
  ratingScale?: RatingScale;
  className?: string;
}

/**
 * Interactive radar chart showing product scores vs category average
 * Similar to the PDF version but interactive
 */
export function ProductRadarChart({
  criteriaScores,
  productName = "Produit",
  ratingScale = "0-20",
  className,
}: ProductRadarChartProps) {
  const maxScale = getMaxScoreForScale(ratingScale);

  // Need at least 3 criteria for a radar chart
  if (criteriaScores.length < 3) {
    return (
      <div className={`flex items-center justify-center p-8 bg-muted/30 rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground text-center">
          Graphique radar non disponible
          <br />
          <span className="text-xs">(minimum 3 criteres requis)</span>
        </p>
      </div>
    );
  }

  // Transform data for recharts - convert percentages to scale values
  const chartData = criteriaScores.map((score) => ({
    criterion: score.criterionName.length > 15
      ? score.criterionName.substring(0, 12) + "..."
      : score.criterionName,
    fullName: score.criterionName,
    product: convertScoreToScale(score.productScore, ratingScale) ?? 0,
    average: convertScoreToScale(score.categoryAverage, ratingScale) ?? 0,
    coefficient: score.coefficient,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
          <PolarGrid stroke="rgba(255,255,255,0.2)" />
          <PolarAngleAxis
            dataKey="criterion"
            tick={{ fill: "#e5e5e5", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxScale]}
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickCount={5}
          />
          <Radar
            name="Moyenne catégorie"
            dataKey="average"
            stroke="#6b7280"
            fill="#6b7280"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Radar
            name={productName}
            dataKey="product"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.5}
            strokeWidth={2}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0]?.payload;
              return (
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
                  <p className="font-medium text-sm mb-2 text-white">{data?.fullName}</p>
                  <p className="text-xs text-zinc-400 mb-1">
                    Coefficient: {data?.coefficient}
                  </p>
                  {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                      {entry.name}: {(entry.value as number)?.toFixed(1)}/{maxScale}
                    </p>
                  ))}
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
