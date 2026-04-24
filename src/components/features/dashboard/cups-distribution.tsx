"use client";

import { api } from "~/trpc/react";

// Status configuration for distribution
type StatusConfigItem = { label: string; color: string };

const defaultStatusConfig: StatusConfigItem = {
  label: "Brouillon",
  color: "var(--n-text-disabled)",
};

const statusConfig: Record<string, StatusConfigItem> = {
  draft: defaultStatusConfig,
  published: {
    label: "Inscriptions",
    color: "var(--n-success)",
  },
  registration_closed: {
    label: "Inscriptions fermées",
    color: "var(--n-warning)",
  },
  rating: {
    label: "Notation",
    color: "var(--n-interactive)",
  },
  completed: {
    label: "Terminée",
    color: "var(--n-text-secondary)",
  },
};

interface DistributionItem {
  status: string;
  count: number;
  percentage: number;
  config: StatusConfigItem;
}

export function CupsDistribution() {
  const { data, isLoading } = api.cup.getOverviewStats.useQuery();

  if (isLoading) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          RÉPARTITION DES CUPS
        </p>
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </p>
      </div>
    );
  }

  if (!data?.cups?.length) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          RÉPARTITION DES CUPS
        </p>
        <p
          className="n-font-body"
          style={{
            fontSize: "13px",
            color: "var(--n-text-disabled)",
            paddingTop: "16px",
            paddingBottom: "16px",
          }}
        >
          Créez des cups pour voir les statistiques.
        </p>
      </div>
    );
  }

  // Calculate distribution by status
  const statusCounts: Record<string, number> = {};
  data.cups.forEach((cup) => {
    statusCounts[cup.status] = (statusCounts[cup.status] ?? 0) + 1;
  });

  const total = data.cups.length;
  const distribution: DistributionItem[] = Object.entries(statusCounts)
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 100),
      config: statusConfig[status] ?? defaultStatusConfig,
    }))
    .sort((a, b) => b.count - a.count);

  // Number of segments per bar row
  const totalSegments = 16;

  return (
    <div className="n-card" style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <p className="n-label" style={{ color: "var(--n-text-disabled)", margin: 0 }}>
          RÉPARTITION DES CUPS
        </p>
        <span
          className="n-font-data"
          style={{
            fontSize: "28px",
            color: "var(--n-text-display)",
            lineHeight: 1,
          }}
        >
          {total}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {distribution.map((item) => {
          const filledSegments = Math.max(
            1,
            Math.round((item.count / total) * totalSegments)
          );

          return (
            <div
              key={item.status}
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  className="n-label"
                  style={{ color: item.config.color }}
                >
                  {item.config.label.toUpperCase()}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "8px",
                  }}
                >
                  <span
                    className="n-font-data"
                    style={{
                      fontSize: "16px",
                      color: "var(--n-text-primary)",
                    }}
                  >
                    {item.count}
                  </span>
                  <span
                    className="n-label"
                    style={{ color: "var(--n-text-disabled)" }}
                  >
                    {item.percentage}%
                  </span>
                </div>
              </div>

              {/* Segmented progress bar */}
              <div
                className="n-progress-bar"
                style={{ display: "flex", gap: "2px" }}
              >
                {Array.from({ length: totalSegments }).map((_, i) => (
                  <div
                    key={i}
                    className={`n-progress-segment${i < filledSegments ? " filled" : ""}`}
                    style={{
                      flex: 1,
                      ...(i < filledSegments
                        ? { background: item.config.color, opacity: 1 }
                        : {}),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
