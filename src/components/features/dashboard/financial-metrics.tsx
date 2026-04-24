"use client";

import { api } from "~/trpc/react";

interface MetricCellProps {
  label: string;
  value: string;
  subValue?: string;
  valueColor?: string;
  isLast?: boolean;
}

function MetricCell({
  label,
  value,
  subValue,
  valueColor = "var(--n-text-display)",
  isLast = false,
}: MetricCellProps) {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderRight: isLast ? "none" : "1px solid var(--n-border)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <p
        className="n-label"
        style={{ color: "var(--n-text-disabled)", margin: 0 }}
      >
        {label}
      </p>
      <p
        className="n-font-data"
        style={{
          fontSize: "28px",
          color: valueColor,
          lineHeight: 1,
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
      {subValue && (
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", margin: 0 }}
        >
          {subValue.toUpperCase()}
        </p>
      )}
    </div>
  );
}

export function FinancialMetrics() {
  const { data, isLoading } = api.cup.getOverviewStats.useQuery();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          FINANCES
        </p>
        <div
          className="n-card"
          style={{
            display: "flex",
            flexWrap: "wrap",
            padding: 0,
            overflow: "hidden",
          }}
        >
          {[1, 2, 3, 4].map((i, idx) => (
            <div
              key={i}
              style={{
                padding: "20px 24px",
                flex: 1,
                minWidth: "140px",
                borderRight: idx < 3 ? "1px solid var(--n-border)" : "none",
              }}
            >
              <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                [LOADING...]
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalRevenue = data?.totalRevenue ?? 0;
  const totalRegistrations = data?.totalRegistrations ?? 0;

  const pendingPayments =
    data?.cups?.reduce((sum, cup) => sum + cup.pendingCount, 0) ?? 0;
  const pendingAmount =
    data?.cups?.reduce((sum, cup) => {
      const avgRevenue =
        cup.confirmedCount > 0 ? cup.revenue / cup.confirmedCount : 0;
      return sum + cup.pendingCount * avgRevenue;
    }, 0) ?? 0;

  const activeCups =
    data?.cups?.filter(
      (cup) => cup.status !== "completed" && cup.status !== "draft"
    ).length ?? 0;

  const totalCups = data?.cups?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
        FINANCES
      </p>
      <div
        className="n-card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <MetricCell
          label="REVENUS TOTAUX"
          value={formatCurrency(totalRevenue)}
          subValue={`${totalRegistrations} inscription${totalRegistrations !== 1 ? "s" : ""} confirmée${totalRegistrations !== 1 ? "s" : ""}`}
          valueColor={
            totalRevenue > 0 ? "var(--n-success)" : "var(--n-text-display)"
          }
        />
        <MetricCell
          label="EN ATTENTE"
          value={formatCurrency(pendingAmount)}
          subValue={`${pendingPayments} paiement${pendingPayments !== 1 ? "s" : ""} en attente`}
          valueColor={
            pendingPayments > 0 ? "var(--n-warning)" : "var(--n-text-display)"
          }
        />
        <MetricCell
          label="INSCRIPTIONS"
          value={totalRegistrations.toString()}
          subValue="TOTAL CONFIRMÉES"
        />
        <MetricCell
          label="CUPS ACTIVES"
          value={activeCups.toString()}
          subValue={`SUR ${totalCups} CUP${totalCups !== 1 ? "S" : ""}`}
          isLast
        />
      </div>
    </div>
  );
}
