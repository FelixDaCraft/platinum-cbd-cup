"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { RatingScale } from "~/server/db/schema/cups";
import { convertScoreToScale, getMaxScoreForScale } from "~/lib/validations/labels";

interface JuryCriterionScore {
  criterionId: string;
  criterionName: string;
  coefficient: number;
  score: number | null;
  rawScore: number | null;
}

interface JuryScore {
  juryId: string;
  juryLabel: string;
  submittedAt: Date | null;
  totalScore: number | null;
  criteria: JuryCriterionScore[];
  comment: string | null;
}

interface JuryStats {
  juryCount: number;
  averageScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  standardDeviation: number | null;
}

interface JuryScoresTableProps {
  juryScores: JuryScore[];
  stats: JuryStats;
  ratingScale: RatingScale;
  className?: string;
}

/**
 * Table showing anonymized jury scores with expandable details
 */
export function JuryScoresTable({
  juryScores,
  stats,
  ratingScale,
  className,
}: JuryScoresTableProps) {
  const [expandedJury, setExpandedJury] = useState<string | null>(null);
  const maxScale = getMaxScoreForScale(ratingScale);

  // Format score from percentage to scale (e.g., "7.5/10")
  const formatScore = (score: number | null) => {
    if (score === null) return "N/A";
    const converted = convertScoreToScale(score, ratingScale);
    return converted !== null ? `${converted.toFixed(1)}/${maxScale}` : "N/A";
  };

  // Format just the numeric value (for diffs)
  const formatScoreValue = (score: number | null) => {
    if (score === null) return null;
    return convertScoreToScale(score, ratingScale);
  };

  const formatDate = (date: Date | null | string) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getScoreTrend = (score: number | null, average: number | null) => {
    if (score === null || average === null) return null;
    // Convert to scale for comparison
    const scoreConverted = convertScoreToScale(score, ratingScale);
    const avgConverted = convertScoreToScale(average, ratingScale);
    if (scoreConverted === null || avgConverted === null) return null;
    const diff = scoreConverted - avgConverted;
    // Threshold based on scale (0.2 for scale 0-10, 0.4 for scale 0-20, etc.)
    const threshold = maxScale * 0.02;
    if (Math.abs(diff) < threshold) return "neutral";
    return diff > 0 ? "up" : "down";
  };

  if (juryScores.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 bg-muted/30 rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground">
          Aucune note de jury soumise pour ce produit
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Stats Summary - Compact */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Jurys</p>
          <p className="text-lg font-bold">{stats.juryCount}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Moyenne</p>
          <p className="text-lg font-bold">{formatScore(stats.averageScore)}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Min</p>
          <p className="text-lg font-bold text-red-500">{formatScore(stats.minScore)}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Max</p>
          <p className="text-lg font-bold text-green-500">{formatScore(stats.maxScore)}</p>
        </div>
      </div>

      {/* Jury Scores List */}
      <div className="space-y-1">
        {juryScores.map((jury) => {
          const trend = getScoreTrend(jury.totalScore, stats.averageScore);
          const isExpanded = expandedJury === jury.juryId;
          // Calculate diff in scale values
          const juryScoreConverted = formatScoreValue(jury.totalScore);
          const avgScoreConverted = formatScoreValue(stats.averageScore);
          const diff = juryScoreConverted !== null && avgScoreConverted !== null
            ? juryScoreConverted - avgScoreConverted
            : 0;

          return (
            <div key={jury.juryId} className="rounded-lg border border-border/50 overflow-hidden">
              {/* Jury Row */}
              <div
                className="flex items-center gap-2 p-2 hover:bg-muted/30 cursor-pointer"
                onClick={() => setExpandedJury(isExpanded ? null : jury.juryId)}
              >
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>

                <Badge variant="outline" className="shrink-0 text-xs">
                  {jury.juryLabel}
                </Badge>

                {jury.comment && (
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                )}

                <span className="font-medium text-sm ml-auto">
                  {formatScore(jury.totalScore)}
                </span>

                <span className={`text-xs w-14 text-right ${
                  trend === "up" ? "text-green-500" :
                  trend === "down" ? "text-red-500" :
                  "text-muted-foreground"
                }`}>
                  {trend === "up" && <span className="flex items-center justify-end gap-0.5"><TrendingUp className="h-3 w-3" />+{diff.toFixed(1)}</span>}
                  {trend === "down" && <span className="flex items-center justify-end gap-0.5"><TrendingDown className="h-3 w-3" />{diff.toFixed(1)}</span>}
                  {trend === "neutral" && <span className="flex items-center justify-end gap-0.5"><Minus className="h-3 w-3" />0</span>}
                  {trend === null && "-"}
                </span>

                <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
                  {formatDate(jury.submittedAt)}
                </span>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 bg-muted/10 border-t border-border/30">
                  <div className="grid gap-1 mt-2">
                    {jury.criteria.map((criterion) => {
                      // Use rawScore for display (already in scale) and score (percentage) for badge variant
                      const scoreConverted = formatScoreValue(criterion.score);
                      const goodThreshold = maxScale * 0.7; // 70% of scale
                      const okThreshold = maxScale * 0.5; // 50% of scale

                      return (
                        <div
                          key={criterion.criterionId}
                          className="flex items-center justify-between py-1 px-2 rounded bg-background/50 text-xs"
                        >
                          <span>
                            {criterion.criterionName}
                            <span className="text-muted-foreground ml-1">(coef. {criterion.coefficient})</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                scoreConverted !== null && scoreConverted >= goodThreshold
                                  ? "default"
                                  : scoreConverted !== null && scoreConverted >= okThreshold
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-[10px] h-5"
                            >
                              {criterion.rawScore !== null ? `${criterion.rawScore}/${maxScale}` : "N/A"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {jury.comment && (
                    <div className="mt-2 p-2 rounded bg-background/50 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Commentaire: </span>
                      {jury.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
