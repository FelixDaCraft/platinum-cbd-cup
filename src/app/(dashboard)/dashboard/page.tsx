"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import {
  ActiveCupsSection,
  FinancialMetrics,
  RecentActivity,
  UpcomingEvents,
  CupsDistribution,
} from "~/components/features/dashboard";

/**
 * Dashboard Overview Page
 * Route: /dashboard
 * Shows key metrics, cups overview, and quick access to main features
 */
export default function DashboardOverviewPage() {
  const { data: sponsors } = api.sponsors.list.useQuery();
  const { data: newsletterStats } = api.newsletter.getStats.useQuery();
  const { data: unreadMessages } = api.contactMessages.getUnreadCount.useQuery();

  const miniStats = [
    {
      label: "SPONSORS",
      value: sponsors?.length ?? 0,
      href: "/dashboard/settings/sponsors",
    },
    {
      label: "ABONNÉS",
      value: newsletterStats?.active ?? 0,
      href: "/dashboard/settings/newsletter",
    },
    {
      label: "MESSAGES",
      value: unreadMessages?.count ?? 0,
      href: "/dashboard/settings/portal/messages",
      highlight: (unreadMessages?.count ?? 0) > 0,
    },
  ];

  const quickActions = [
    {
      label: "Créer une Cup",
      href: "/dashboard/cups",
      description: "Lancer une nouvelle compétition",
    },
    {
      label: "Personnaliser le portail",
      href: "/dashboard/settings/portal/appearance",
      description: "Modifier l'apparence",
    },
    {
      label: "Gérer le contenu",
      href: "/dashboard/settings/portal/about",
      description: "Page à propos & actualités",
    },
  ];

  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "48px",
        maxWidth: "1400px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          {/* Title block */}
          <div>
            <p
              className="n-label"
              style={{ marginBottom: "6px", color: "var(--n-text-disabled)" }}
            >
              TABLEAU DE BORD
            </p>
            <h1
              className="n-font-body"
              style={{
                fontSize: "28px",
                fontWeight: "500",
                color: "var(--n-text-display)",
                margin: 0,
              }}
            >
              Vue d&apos;ensemble
            </h1>
          </div>

          {/* Mini stats — border-separated cells */}
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              border: "1px solid var(--n-border-visible)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {miniStats.map((stat, i) => (
              <Link key={stat.label} href={stat.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderLeft: i > 0 ? "1px solid var(--n-border-visible)" : "none",
                    gap: "4px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    minWidth: "72px",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--n-surface-raised)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <span
                    className="n-font-data"
                    style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: stat.highlight
                        ? "var(--n-accent)"
                        : "var(--n-text-display)",
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </span>
                  <span
                    className="n-label"
                    style={{ color: "var(--n-text-disabled)" }}
                  >
                    {stat.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <p
            className="n-label"
            style={{
              marginBottom: "12px",
              color: "var(--n-text-disabled)",
            }}
          >
            ACTIONS RAPIDES
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1px",
              border: "1px solid var(--n-border-visible)",
              borderRadius: "8px",
              overflow: "hidden",
              background: "var(--n-border-visible)",
            }}
          >
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "var(--n-surface)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--n-surface-raised)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--n-surface)";
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      className="n-font-body"
                      style={{
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "var(--n-text-primary)",
                      }}
                    >
                      {action.label}
                    </span>
                    <span
                      className="n-font-body"
                      style={{
                        fontSize: "12px",
                        color: "var(--n-text-disabled)",
                      }}
                    >
                      {action.description}
                    </span>
                  </div>
                  <span
                    className="n-font-data"
                    style={{
                      fontSize: "14px",
                      color: "var(--n-text-secondary)",
                      flexShrink: 0,
                      marginLeft: "16px",
                    }}
                  >
                    &gt;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <FinancialMetrics />

      {/* Active Cups Section */}
      <ActiveCupsSection />

      {/* Two Column Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <UpcomingEvents />
          <CupsDistribution />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
