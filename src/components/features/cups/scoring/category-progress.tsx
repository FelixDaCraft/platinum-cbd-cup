"use client";

import { Layers, CheckCircle2 } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";

interface CategoryProgressProps {
  cupId: string;
}

export function CategoryProgress({ cupId }: CategoryProgressProps) {
  const { data, isLoading, error } = api.scoring.getCategoryProgress.useQuery(
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
          <Layers
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p className="n-font-body text-sm font-semibold" style={{ color: "var(--n-text-display)" }}>
              Progression par catégorie
            </p>
            <p className="n-label mt-0.5">[LOADING...]</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>—</p>
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>—</p>
              </div>
              <div
                style={{
                  height: "4px",
                  background: "var(--n-border)",
                  borderRadius: "2px",
                }}
              />
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
        className="p-4 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--n-border)" }}
      >
        <Layers
          className="h-4 w-4 shrink-0"
          strokeWidth={1.5}
          style={{ color: "var(--n-text-secondary)" }}
        />
        <div>
          <p className="n-font-body text-sm font-semibold" style={{ color: "var(--n-text-display)" }}>
            Progression par catégorie
          </p>
          <p className="n-label mt-0.5">
            {data.categories.filter((c) => c.isComplete).length}/{data.categories.length} catégories complètes
          </p>
        </div>
      </div>

      {/* Category list */}
      <div className="p-4 space-y-4">
        {data.categories.map((category) => (
          <div key={category.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="n-font-body text-sm font-medium"
                  style={{ color: "var(--n-text-primary)" }}
                >
                  {category.name}
                </span>
                {category.isComplete && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    strokeWidth={1.5}
                    style={{ color: "var(--n-success)" }}
                  />
                )}
              </div>
              <div
                className="n-font-data text-xs"
                style={{ color: "var(--n-text-secondary)" }}
              >
                <span style={{ color: "var(--n-text-display)", fontWeight: 600 }}>
                  {category.completedRatings}
                </span>
                /{category.expectedRatings}{" "}
                <span style={{ color: "var(--n-accent)" }}>
                  ({category.completionPercentage}%)
                </span>
              </div>
            </div>
            <Progress
              value={category.completionPercentage}
              className={`h-1.5 ${
                category.isComplete
                  ? "[&>[data-slot=progress-indicator]]:bg-[var(--n-success)]"
                  : ""
              }`}
            />
            <div
              className="flex justify-between n-label"
              style={{ color: "var(--n-text-disabled)" }}
            >
              <span>{category.totalProducts} produits</span>
              <span>{category.assignedJuries} jurys assignés</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
