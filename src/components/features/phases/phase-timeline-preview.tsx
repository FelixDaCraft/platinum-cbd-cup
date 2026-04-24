"use client";

import { cn } from "~/lib/utils";
import type { PhaseStatus } from "~/lib/validations/phases";

interface PhaseTimelinePreviewProps {
  currentStatus: PhaseStatus;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
}

const phases = [
  { key: "draft", label: "Brouillon" },
  { key: "pending", label: "En attente" },
  { key: "registration", label: "Inscriptions" },
  { key: "closed", label: "Cloturees" },
  { key: "rating", label: "Notation" },
  { key: "completed", label: "Terminee" },
] as const;

const phaseOrder: Record<PhaseStatus, number> = {
  draft: 0,
  pending: 1,
  registration: 2,
  closed: 3,
  rating: 4,
  completed: 5,
};

export function PhaseTimelinePreview({
  currentStatus,
  registrationOpenAt,
  registrationCloseAt,
  ratingStartAt,
  ratingEndAt,
}: PhaseTimelinePreviewProps) {
  const currentIndex = phaseOrder[currentStatus];

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
    }).format(date);
  };

  const getPhaseDate = (phaseKey: string): string | null => {
    switch (phaseKey) {
      case "pending":
        return formatDate(registrationOpenAt);
      case "registration":
        return formatDate(registrationOpenAt);
      case "closed":
        return formatDate(registrationCloseAt);
      case "rating":
        return formatDate(ratingStartAt);
      case "completed":
        return formatDate(ratingEndAt);
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Timeline des phases</div>

      {/* Timeline visualization */}
      <div className="relative flex items-center justify-between">
        {/* Background line */}
        <div className="absolute left-0 right-0 h-0.5 bg-muted" />

        {/* Progress line */}
        <div
          className="absolute left-0 h-0.5 bg-primary transition-all duration-500"
          style={{
            width: `${(currentIndex / (phases.length - 1)) * 100}%`,
          }}
        />

        {/* Phase dots */}
        {phases.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const date = getPhaseDate(phase.key);

          return (
            <div
              key={phase.key}
              className="relative z-10 flex flex-col items-center"
            >
              {/* Dot */}
              <div
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all",
                  isCompleted
                    ? "border-primary bg-primary"
                    : isCurrent
                      ? "border-primary bg-background ring-4 ring-primary/20"
                      : "border-muted bg-background"
                )}
              >
                {isCompleted && (
                  <svg
                    className="h-full w-full text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "mt-2 text-xs whitespace-nowrap",
                  isCurrent
                    ? "font-semibold text-primary"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                )}
              >
                {phase.label}
              </span>

              {/* Date (if available) */}
              {date && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {date}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase indicator */}
      <div className="text-center text-sm">
        Phase actuelle:{" "}
        <span className="font-semibold text-primary">
          {phases.find((p) => p.key === currentStatus)?.label}
        </span>
      </div>
    </div>
  );
}
