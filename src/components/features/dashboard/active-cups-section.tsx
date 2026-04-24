"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// Status configuration
type StatusConfig = { label: string; color: string };

const defaultStatusConfig: StatusConfig = {
  label: "BROUILLON",
  color: "var(--n-text-disabled)",
};

const statusConfig: Record<string, StatusConfig> = {
  draft: defaultStatusConfig,
  published: {
    label: "INSCRIPTIONS",
    color: "var(--n-success)",
  },
  registration_closed: {
    label: "INSCRIPTIONS FERMÉES",
    color: "var(--n-warning)",
  },
  rating: {
    label: "NOTATION",
    color: "var(--n-interactive)",
  },
  completed: {
    label: "TERMINÉE",
    color: "var(--n-text-secondary)",
  },
};

interface CupCardProps {
  cup: {
    id: string;
    name: string;
    type: "public" | "pro";
    status: string;
    confirmedCount: number;
    pendingCount: number;
    totalProducts: number;
    categoriesCount: number;
    revenue: number;
    currency: string | null;
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
    ratingStartAt: Date | null;
    ratingEndAt: Date | null;
    nextDeadline: { date: Date; label: string } | null;
    ratingStats: {
      totalRatings: number;
      expectedRatings: number;
      completion: number;
      activeJuries: number;
      confirmedProducts: number;
    } | null;
  };
}

function CupCard({ cup }: CupCardProps) {
  const config = statusConfig[cup.status] ?? defaultStatusConfig;

  const isRating = cup.status === "rating";
  const ratingProgress = cup.ratingStats?.completion ?? 0;

  const formatCurrency = (amount: number, currency: string | null) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency ?? "EUR",
    }).format(amount / 100);
  };

  // Build segmented progress bar for rating phase
  const totalSegments = 12;
  const filledSegments = Math.round((ratingProgress / 100) * totalSegments);

  return (
    <Link href={`/dashboard/cups/${cup.id}`} style={{ textDecoration: "none" }}>
      <div
        className="n-card"
        style={{
          padding: "20px",
          cursor: "pointer",
          transition: "border-color 0.15s",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "var(--n-border-visible)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "var(--n-border)";
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              className="n-font-body"
              style={{
                fontSize: "15px",
                fontWeight: "500",
                color: "var(--n-text-primary)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cup.name}
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "6px",
              }}
            >
              <span
                className="n-label"
                style={{ color: config.color }}
              >
                {config.label}
              </span>
              <span
                className="n-label"
                style={{ color: "var(--n-text-disabled)" }}
              >
                {cup.type === "public" ? "PUBLIQUE" : "PRO"}
              </span>
            </div>
          </div>
          <span
            className="n-font-data"
            style={{
              fontSize: "13px",
              color: "var(--n-text-disabled)",
              flexShrink: 0,
            }}
          >
            &gt;
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0",
            border: "1px solid var(--n-border)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRight: "1px solid var(--n-border)",
            }}
          >
            <p
              className="n-label"
              style={{ color: "var(--n-text-disabled)", marginBottom: "4px" }}
            >
              INSCRITS
            </p>
            <p
              className="n-font-data"
              style={{
                fontSize: "18px",
                color: "var(--n-text-display)",
                lineHeight: 1,
              }}
            >
              {cup.confirmedCount}
            </p>
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRight: "1px solid var(--n-border)",
            }}
          >
            <p
              className="n-label"
              style={{ color: "var(--n-text-disabled)", marginBottom: "4px" }}
            >
              PRODUITS
            </p>
            <p
              className="n-font-data"
              style={{
                fontSize: "18px",
                color: "var(--n-text-display)",
                lineHeight: 1,
              }}
            >
              {cup.totalProducts}
            </p>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <p
              className="n-label"
              style={{ color: "var(--n-text-disabled)", marginBottom: "4px" }}
            >
              REVENUS
            </p>
            <p
              className="n-font-data"
              style={{
                fontSize: "14px",
                color: cup.revenue > 0 ? "var(--n-success)" : "var(--n-text-disabled)",
                lineHeight: 1,
                marginTop: "2px",
              }}
            >
              {cup.revenue > 0 ? formatCurrency(cup.revenue, cup.currency) : "—"}
            </p>
          </div>
        </div>

        {/* Rating progress */}
        {isRating && cup.ratingStats && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                NOTES {cup.ratingStats.totalRatings}/{cup.ratingStats.expectedRatings}
                {cup.ratingStats.activeJuries > 0 && (
                  <span style={{ marginLeft: "8px" }}>
                    — {cup.ratingStats.activeJuries} JURY
                    {cup.ratingStats.activeJuries > 1 ? "S" : ""}
                  </span>
                )}
              </span>
              <span
                className="n-font-data"
                style={{
                  fontSize: "11px",
                  color: "var(--n-interactive)",
                }}
              >
                {ratingProgress}%
              </span>
            </div>
            {/* Segmented progress bar */}
            <div className="n-progress-bar" style={{ display: "flex", gap: "2px" }}>
              {Array.from({ length: totalSegments }).map((_, i) => (
                <div
                  key={i}
                  className={`n-progress-segment${i < filledSegments ? " filled" : ""}`}
                  style={{ flex: 1 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending payments alert */}
        {cup.pendingCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              border: "1px solid var(--n-warning)",
              borderRadius: "4px",
            }}
          >
            <span
              className="n-font-data"
              style={{ fontSize: "10px", color: "var(--n-warning)" }}
            >
              !
            </span>
            <span
              className="n-label"
              style={{ color: "var(--n-warning)" }}
            >
              {cup.pendingCount} INSCRIPTION
              {cup.pendingCount > 1 ? "S" : ""} EN ATTENTE DE PAIEMENT
            </span>
          </div>
        )}

        {/* Next deadline */}
        {cup.nextDeadline?.date && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingTop: "12px",
              borderTop: "1px solid var(--n-border)",
            }}
          >
            <span
              className="n-label"
              style={{ color: "var(--n-text-disabled)" }}
            >
              {cup.nextDeadline.label.toUpperCase()}
            </span>
            <span
              className="n-font-data"
              style={{ fontSize: "11px", color: "var(--n-text-secondary)" }}
            >
              {formatDistanceToNow(new Date(cup.nextDeadline.date), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ActiveCupsSection() {
  const { data, isLoading } = api.cup.getOverviewStats.useQuery();

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          CUPS ACTIVES
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="n-card"
              style={{ padding: "20px", minHeight: "160px" }}
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
      </div>
    );
  }

  if (!data?.cups?.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            MES CUPS
          </p>
          <Link
            href="/dashboard/cups"
            style={{ textDecoration: "none" }}
          >
            <span
              className="n-label"
              style={{
                color: "var(--n-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              VOIR TOUT &gt;
            </span>
          </Link>
        </div>
        <div
          className="n-card"
          style={{
            padding: "40px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <p
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              margin: 0,
            }}
          >
            Aucune cup pour le moment
          </p>
          <p
            className="n-label"
            style={{ color: "var(--n-text-disabled)" }}
          >
            Créez votre première cup pour commencer
          </p>
          <Link
            href="/dashboard/cups"
            style={{ textDecoration: "none", marginTop: "8px" }}
          >
            <span
              className="n-label"
              style={{
                color: "var(--n-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              CRÉER UNE CUP &gt;
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const activeCups = data.cups.filter((cup) => cup.status !== "completed");
  const displayCups = activeCups.length > 0 ? activeCups : data.cups.slice(0, 3);
  const sectionLabel = activeCups.length > 0 ? "CUPS ACTIVES" : "MES CUPS";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <p className="n-label" style={{ color: "var(--n-text-disabled)", margin: 0 }}>
            {sectionLabel}
          </p>
          {activeCups.length > 0 && (
            <span
              className="n-font-data"
              style={{
                fontSize: "11px",
                color: "var(--n-text-display)",
                background: "var(--n-surface-raised)",
                border: "1px solid var(--n-border-visible)",
                borderRadius: "4px",
                padding: "1px 6px",
              }}
            >
              {activeCups.length}
            </span>
          )}
        </div>
        <Link href="/dashboard/cups" style={{ textDecoration: "none" }}>
          <span
            className="n-label"
            style={{
              color: "var(--n-text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            VOIR TOUT ({data.cups.length}) &gt;
          </span>
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {displayCups.map((cup) => (
          <CupCard
            key={cup.id}
            cup={{
              ...cup,
              nextDeadline:
                cup.nextDeadline?.date
                  ? { date: cup.nextDeadline.date, label: cup.nextDeadline.label }
                  : null,
              ratingStats: cup.ratingStats ?? null,
            }}
          />
        ))}
      </div>
    </div>
  );
}
