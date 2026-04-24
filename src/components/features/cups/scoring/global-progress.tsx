"use client";

import { BarChart3, Users, Package, CheckCircle2 } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";

interface GlobalProgressProps {
  cupId: string;
}

export function GlobalProgress({ cupId }: GlobalProgressProps) {
  const { data, isLoading, error } = api.scoring.getGlobalProgress.useQuery(
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
          padding: "24px",
        }}
      >
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </p>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.status !== "rating" && data.status !== "completed") {
    return null;
  }

  const isComplete = data.completionPercentage === 100;

  return (
    <div
      style={{
        background: "var(--n-surface)",
        border: "1px solid var(--n-border)",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3
              className="h-5 w-5 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--n-text-secondary)" }}
            />
            <div>
              <p
                className="n-font-body text-sm font-semibold"
                style={{ color: "var(--n-text-display)" }}
              >
                Progression globale
              </p>
              <p className="n-label mt-0.5">
                {data.status === "completed" ? "NOTATION TERMINÉE" : "NOTATION EN COURS"}
              </p>
            </div>
          </div>

          {/* Percentage badge */}
          <span
            className="n-font-data text-sm font-bold px-3 py-1"
            style={{
              border: "1px solid",
              borderColor: isComplete ? "var(--n-success)" : "var(--n-border-visible)",
              borderRadius: "999px",
              color: isComplete ? "var(--n-success)" : "var(--n-text-display)",
            }}
          >
            {data.completionPercentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress
            value={data.completionPercentage}
            className={`h-2 ${isComplete ? "[&>[data-slot=progress-indicator]]:bg-[var(--n-success)]" : ""}`}
          />
          <div
            className="flex justify-between n-label"
            style={{ color: "var(--n-text-disabled)" }}
          >
            <span>{data.totalRatings} notes soumises</span>
            <span>{data.expectedRatings} attendues</span>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-4 pt-4"
          style={{ borderTop: "1px solid var(--n-border)" }}
        >
          <div className="flex items-center gap-2">
            <Package
              className="h-4 w-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--n-text-secondary)" }}
            />
            <div>
              <p
                className="n-font-data text-lg font-bold"
                style={{ color: "var(--n-text-display)" }}
              >
                {data.totalProducts}
              </p>
              <p className="n-label">PRODUITS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users
              className="h-4 w-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--n-text-secondary)" }}
            />
            <div>
              <p
                className="n-font-data text-lg font-bold"
                style={{ color: "var(--n-text-display)" }}
              >
                {data.activeJuries}
              </p>
              <p className="n-label">JURYS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="h-4 w-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--n-text-secondary)" }}
            />
            <div>
              <p
                className="n-font-data text-lg font-bold"
                style={{ color: "var(--n-text-display)" }}
              >
                {data.totalRatings}
              </p>
              <p className="n-label">NOTES</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
