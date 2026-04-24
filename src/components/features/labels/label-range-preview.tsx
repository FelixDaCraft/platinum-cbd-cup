"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

interface Label {
  id: string;
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
}

interface LabelRangePreviewProps {
  labels: Label[];
  scaleMax?: number; // Maximum score based on cup's rating scale (10 or 20)
}

/**
 * Format a score for display (removes unnecessary decimals)
 */
function formatScore(score: number): string {
  if (Number.isInteger(score)) {
    return score.toString();
  }
  return score.toFixed(1);
}

export function LabelRangePreview({ labels, scaleMax = 10 }: LabelRangePreviewProps) {
  // Sort labels by minScore
  const sortedLabels = [...labels].sort((a, b) => a.minScore - b.minScore);

  // Find gaps (uncovered ranges) - using small epsilon for decimal comparison
  const gaps: { start: number; end: number }[] = [];
  let currentEnd = 0;
  const epsilon = 0.01; // Small tolerance for floating point comparison

  for (const label of sortedLabels) {
    // If there's a gap between current end and this label's start
    if (label.minScore > currentEnd + epsilon) {
      gaps.push({ start: currentEnd, end: label.minScore - 0.1 });
    }
    const labelMax = label.maxScore ?? scaleMax;
    if (labelMax >= currentEnd) {
      currentEnd = labelMax + 0.1; // Move to next possible decimal
    }
  }

  // Check if there's a gap at the end
  if (currentEnd <= scaleMax - epsilon) {
    gaps.push({ start: currentEnd, end: scaleMax });
  }

  const hasGaps = gaps.length > 0 && gaps.some((g) => g.end - g.start >= epsilon);

  return (
    <div className="space-y-4">
      {/* Progress bar visualization */}
      <div className="relative h-10 w-full overflow-hidden rounded-lg bg-white/5 border border-white/10">
        {/* Render each label as a segment */}
        {sortedLabels.map((label) => {
          const start = label.minScore;
          const end = label.maxScore ?? scaleMax;
          // Calculate percentage position/width relative to scaleMax
          const leftPercent = (start / scaleMax) * 100;
          // Calculate width ensuring it doesn't overflow the container
          const endPercent = Math.min(((end + 1) / scaleMax) * 100, 100);
          const widthPercent = endPercent - leftPercent;

          return (
            <div
              key={label.id}
              className="absolute top-0 h-full flex items-center justify-center overflow-hidden transition-all hover:brightness-110"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                backgroundColor: label.color ?? "#888888",
              }}
              title={`${label.name}: ${formatScore(label.minScore)}-${formatScore(label.maxScore ?? scaleMax)}pts`}
            >
              <span
                className={cn(
                  "text-xs font-semibold truncate px-2 drop-shadow-md",
                  // Use white text for most colors
                  "text-white"
                )}
              >
                {widthPercent >= 10 ? label.name : ""}
              </span>
            </div>
          );
        })}

        {/* Render gaps as striped areas */}
        {gaps.map((gap, index) => {
          if (gap.end < gap.start) return null;
          // Calculate percentage position/width relative to scaleMax
          const leftPercent = (gap.start / scaleMax) * 100;
          const endPercent = Math.min(((gap.end + 1) / scaleMax) * 100, 100);
          const widthPercent = endPercent - leftPercent;
          if (widthPercent <= 0) return null;

          return (
            <div
              key={`gap-${index}`}
              className="absolute top-0 h-full"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                background:
                  "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251, 191, 36, 0.2) 4px, rgba(251, 191, 36, 0.2) 8px)",
              }}
              title={`Non couvert: ${formatScore(gap.start)}-${formatScore(gap.end)}pts`}
            />
          );
        })}
      </div>

      {/* Scale indicators */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span className="font-medium">0 pts</span>
        <span>{Math.floor(scaleMax / 4)} pts</span>
        <span>{Math.floor(scaleMax / 2)} pts</span>
        <span>{Math.floor((scaleMax * 3) / 4)} pts</span>
        <span className="font-medium">{scaleMax} pts</span>
      </div>

      {/* Legend */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {sortedLabels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02] border border-white/5"
            >
              <div
                className="h-3 w-3 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: label.color ?? "#888888" }}
              />
              <span className="text-xs font-medium">{label.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatScore(label.minScore)}-{formatScore(label.maxScore ?? scaleMax)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Warning for gaps */}
      {hasGaps && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            Certaines plages de scores ne sont pas couvertes par un label
          </p>
        </div>
      )}
    </div>
  );
}
