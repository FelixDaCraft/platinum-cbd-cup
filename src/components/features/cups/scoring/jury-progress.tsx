"use client";

import { Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface JuryProgressProps {
  cupId: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Jamais";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export function JuryProgress({ cupId }: JuryProgressProps) {
  const { data, isLoading, error } = api.scoring.getJuryProgress.useQuery(
    { cupId },
    {
      refetchInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
        }}
      >
        <div
          className="p-4 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--n-border)" }}
        >
          <Users
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p
              className="n-font-body text-sm font-semibold"
              style={{ color: "var(--n-text-display)" }}
            >
              Activité des jurys
            </p>
            <p className="n-label mt-0.5">[LOADING...]</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                padding: "12px",
                border: "1px solid var(--n-border)",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--n-border)",
                }}
              />
              <div className="flex-1 space-y-2">
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>—</p>
                <div
                  style={{
                    height: "4px",
                    background: "var(--n-border)",
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.cupStatus !== "rating" && data.cupStatus !== "completed") {
    return null;
  }

  const completedJuries = data.juries.filter((j) => j.completionPercentage === 100);
  const notStartedJuries = data.juries.filter((j) => j.completionPercentage === 0);

  return (
    <div
      style={{
        background: "var(--n-surface)",
        border: "1px solid var(--n-border)",
        borderRadius: "12px",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--n-border)" }}
      >
        <div className="flex items-center gap-2">
          <Users
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p
              className="n-font-body text-sm font-semibold"
              style={{ color: "var(--n-text-display)" }}
            >
              Activité des jurys
            </p>
            <p className="n-label mt-0.5">
              {completedJuries.length}/{data.totalJuries} JURYS ONT TERMINÉ
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {notStartedJuries.length > 0 && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                color: "var(--n-accent)",
                borderColor: "var(--n-accent)",
                fontFamily: "'Space Mono', monospace",
                letterSpacing: "0.04em",
              }}
            >
              <AlertCircle className="h-3 w-3 mr-1" strokeWidth={1.5} />
              {notStartedJuries.length} en attente
            </Badge>
          )}
        </div>
      </div>

      {/* Jury list */}
      <div className="p-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {data.juries.map((jury) => {
            const isComplete = jury.completionPercentage === 100;
            const hasStarted = jury.completionPercentage > 0;

            const rowBorderColor = isComplete
              ? "var(--n-success)"
              : hasStarted
              ? "var(--n-border-visible)"
              : "var(--n-accent)";

            const pctColor = isComplete
              ? "var(--n-success)"
              : hasStarted
              ? "var(--n-text-display)"
              : "var(--n-accent)";

            return (
              <div
                key={jury.id}
                className="flex items-center gap-3"
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: rowBorderColor,
                  borderLeftWidth: "2px",
                }}
              >
                {/* Avatar */}
                <Avatar
                  className="h-9 w-9 shrink-0"
                  style={{ border: "1px solid var(--n-border-visible)" }}
                >
                  <AvatarImage src={jury.image ?? undefined} />
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{
                      background: "var(--n-surface-raised)",
                      color: "var(--n-text-secondary)",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {getInitials(jury.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="n-font-body text-sm font-medium truncate"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {jury.name}
                      </span>
                      {isComplete && (
                        <CheckCircle2
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={1.5}
                          style={{ color: "var(--n-success)" }}
                        />
                      )}
                    </div>
                    <span
                      className="n-font-data text-xs font-bold shrink-0"
                      style={{ color: pctColor }}
                    >
                      {jury.completionPercentage}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <Progress
                    value={jury.completionPercentage}
                    className={`h-1 mt-2 ${
                      isComplete
                        ? "[&>[data-slot=progress-indicator]]:bg-[var(--n-success)]"
                        : !hasStarted
                        ? "[&>[data-slot=progress-indicator]]:bg-[var(--n-accent)]"
                        : ""
                    }`}
                  />

                  {/* Meta */}
                  <div
                    className="flex items-center justify-between mt-1.5 n-label"
                    style={{ color: "var(--n-text-disabled)" }}
                  >
                    <span>
                      {jury.completedRatings}/{jury.totalToRate} produits
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {formatRelativeTime(jury.lastActivityAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
