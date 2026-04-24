"use client";

import { CalendarDays, Check, CircleDot } from "lucide-react";
import { cn } from "~/lib/utils";

interface PhaseDate {
  label: string;
  date: Date | null;
  icon: string;
}

interface CupPhaseTimelineProps {
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
}

function formatDate(date: Date | null): string {
  if (!date) return "Non configuré";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPhaseStatus(date: Date | null): "past" | "current" | "future" | "none" {
  if (!date) return "none";
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < -oneDay) return "past";
  if (diff < oneDay) return "current";
  return "future";
}

export function CupPhaseTimeline({
  registrationOpenAt,
  registrationCloseAt,
  ratingStartAt,
  ratingEndAt,
}: CupPhaseTimelineProps) {
  const phases: PhaseDate[] = [
    { label: "Ouverture inscriptions", date: registrationOpenAt, icon: "📝" },
    { label: "Clôture inscriptions", date: registrationCloseAt, icon: "🔒" },
    { label: "Début notation", date: ratingStartAt, icon: "⭐" },
    { label: "Fin notation", date: ratingEndAt, icon: "🏆" },
  ];

  const getProgressWidth = () => {
    let lastCompletedIndex = -1;
    let currentIndex = -1;

    phases.forEach((phase, idx) => {
      const status = getPhaseStatus(phase.date);
      if (status === "past") lastCompletedIndex = idx;
      if (status === "current" && currentIndex === -1) currentIndex = idx;
    });

    if (currentIndex !== -1) {
      return ((currentIndex) / (phases.length - 1)) * 100;
    }
    if (lastCompletedIndex === -1) return 0;
    if (lastCompletedIndex === phases.length - 1) return 100;
    return ((lastCompletedIndex + 1) / (phases.length - 1)) * 100;
  };

  return (
    <div
      style={{
        background: "var(--n-surface)",
        border: "1px solid var(--n-border)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--n-border)" }}
      >
        <CalendarDays
          className="h-4 w-4 shrink-0"
          strokeWidth={1.5}
          style={{ color: "var(--n-text-secondary)" }}
        />
        <span
          className="n-label"
          style={{ color: "var(--n-text-secondary)" }}
        >
          PHASES DE LA COMPÉTITION
        </span>
      </div>

      {/* Timeline */}
      <div className="p-4 pb-6">
        <div className="relative pt-2">
          {/* Track line */}
          <div
            className="absolute top-[26px] rounded-full"
            style={{
              left: "calc(12.5% + 20px)",
              right: "calc(12.5% + 20px)",
              height: "1px",
              background: "var(--n-border-visible)",
            }}
          />

          {/* Progress line */}
          <div
            className="absolute top-[26px] rounded-full transition-all duration-700 ease-out"
            style={{
              left: "calc(12.5% + 20px)",
              height: "1px",
              width: `calc(${getProgressWidth()}% * 0.75)`,
              background: "var(--n-success)",
            }}
          />

          {/* Phases */}
          <div className="relative flex justify-between">
            {phases.map((phase) => {
              const status = getPhaseStatus(phase.date);

              const circleStyle: React.CSSProperties = {
                position: "relative",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "1px solid",
                transition: "all 0.3s",
                ...(status === "past" && {
                  borderColor: "var(--n-success)",
                  backgroundColor: "var(--n-success)",
                  color: "var(--n-black)",
                }),
                ...(status === "current" && {
                  borderColor: "var(--n-text-display)",
                  backgroundColor: "var(--n-surface-raised)",
                  color: "var(--n-text-display)",
                }),
                ...(status === "future" && {
                  borderColor: "var(--n-border-visible)",
                  backgroundColor: "var(--n-surface)",
                  color: "var(--n-text-disabled)",
                }),
                ...(status === "none" && {
                  borderColor: "var(--n-border)",
                  borderStyle: "dashed",
                  backgroundColor: "var(--n-surface)",
                  color: "var(--n-text-disabled)",
                }),
              };

              const labelColor =
                status === "past"
                  ? "var(--n-success)"
                  : status === "current"
                  ? "var(--n-text-display)"
                  : status === "future"
                  ? "var(--n-text-primary)"
                  : "var(--n-text-disabled)";

              return (
                <div
                  key={phase.label}
                  className={cn("flex flex-col items-center", "w-1/4")}
                >
                  <div style={circleStyle}>
                    {status === "past" && <Check className="h-4 w-4" strokeWidth={2.5} />}
                    {status === "current" && (
                      <span
                        className="n-font-data text-xs font-bold"
                        style={{ color: "var(--n-text-display)" }}
                      >
                        NOW
                      </span>
                    )}
                    {status === "future" && (
                      <span className="text-sm">{phase.icon}</span>
                    )}
                    {status === "none" && <CircleDot className="h-4 w-4" />}
                  </div>

                  <div className="mt-4 text-center px-1">
                    <p
                      className="n-font-body text-xs font-semibold leading-tight"
                      style={{ color: labelColor }}
                    >
                      {phase.label}
                    </p>

                    {phase.date ? (
                      <div className="mt-1.5 space-y-0.5">
                        <p
                          className="n-font-data text-xs"
                          style={{ color: labelColor, opacity: 0.8 }}
                        >
                          {formatDate(phase.date)}
                        </p>
                        <p
                          className="n-font-data text-xs"
                          style={{ color: "var(--n-text-disabled)" }}
                        >
                          {formatTime(phase.date)}
                        </p>
                      </div>
                    ) : (
                      <p
                        className="mt-1.5 n-label"
                        style={{ color: "var(--n-text-disabled)" }}
                      >
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
