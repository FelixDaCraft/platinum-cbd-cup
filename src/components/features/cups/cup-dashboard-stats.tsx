"use client";

import { Layers, ListChecks, Award } from "lucide-react";

interface CupDashboardStatsProps {
  categoriesCount: number;
  criteriaCount: number;
  labelsCount: number;
  isLoading?: boolean;
}

export function CupDashboardStats({
  categoriesCount,
  criteriaCount,
  labelsCount,
  isLoading,
}: CupDashboardStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <p
              className="n-label"
              style={{ color: "var(--n-text-disabled)" }}
            >
              [LOADING...]
            </p>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "CATÉGORIES",
      value: categoriesCount,
      icon: Layers,
    },
    {
      label: "CRITÈRES",
      value: criteriaCount,
      icon: ListChecks,
    },
    {
      label: "LABELS",
      value: labelsCount,
      icon: Award,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <div className="flex items-center gap-4">
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={1.5}
                style={{ color: "var(--n-text-secondary)" }}
              />
              <div>
                <p
                  className="n-font-data text-3xl font-bold"
                  style={{ color: "var(--n-text-display)" }}
                >
                  {stat.value}
                </p>
                <p className="n-label mt-1">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
