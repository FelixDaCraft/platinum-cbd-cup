"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";

export default function ProducerDashboardPage() {
  const organization = useOrganization();
  const theme = usePortalTheme();

  const { data: profile, isLoading: isProfileLoading } = api.producer.getProfile.useQuery();
  const { data: stats, isLoading: isStatsLoading } = api.producer.getDashboardStats.useQuery();

  const { data: registrations, isLoading: isRegistrationsLoading } =
    api.producer.getMyRegistrations.useQuery({ limit: 5 });

  const { data: labels, isLoading: isLabelsLoading } =
    api.producer.getMyLabels.useQuery({ limit: 6 });

  const isLoading = isProfileLoading || isStatsLoading;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ color: "var(--n-text-disabled)" }}
      >
        <span className="n-font-data text-sm tracking-widest">[LOADING...]</span>
      </div>
    );
  }

  const pendingResults = stats?.registeredProducts
    ? stats.registeredProducts - (stats.obtainedLabels ?? 0)
    : 0;

  const profileScore = [profile?.brandName, profile?.companyName, profile?.website].filter(
    Boolean
  ).length;
  const profileIncomplete =
    profile && (!profile.brandName || !profile.companyName || !profile.website);

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex items-center gap-4">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt={organization.name}
              className="h-12 w-12 rounded-lg object-contain"
              style={{ backgroundColor: "var(--n-surface)", padding: "6px" }}
            />
          ) : (
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center n-font-data text-lg font-bold"
              style={{ backgroundColor: "var(--n-surface)", color: "var(--n-text-secondary)" }}
            >
              {(profile?.brandName ?? organization.name ?? "P")[0]?.toUpperCase() ?? "P"}
            </div>
          )}
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              ESPACE PRODUCTEUR · {organization.name}
            </div>
            <h1
              className="n-font-data text-2xl font-bold"
              style={{ color: "var(--n-text-display)" }}
            >
              {profile?.brandName ?? profile?.companyName ?? "MON ESPACE"}
            </h1>
            {profile?.companyName && profile.brandName && (
              <p className="text-sm mt-0.5" style={{ color: "var(--n-text-secondary)" }}>
                {profile.companyName}
              </p>
            )}
          </div>
        </div>

        <Link href="/producer/registrations">
          <button className="n-btn-secondary text-sm">VOIR MES INSCRIPTIONS</button>
        </Link>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: "var(--n-border)" }}>
        {[
          {
            href: "/producer/registrations?filter=active",
            label: "CUPS ACTIVES",
            value: stats?.activeCompetitions ?? 0,
            unit: "en cours",
          },
          {
            href: "/producer/registrations",
            label: "PRODUITS INSCRITS",
            value: stats?.registeredProducts ?? 0,
            unit: "total",
          },
          {
            href: "/producer/results",
            label: "LABELS OBTENUS",
            value: stats?.obtainedLabels ?? 0,
            unit: "distinctions",
            color: "var(--n-warning)",
          },
          {
            href: "/producer/results",
            label: "EN ATTENTE",
            value: pendingResults > 0 ? pendingResults : 0,
            unit: "resultats a venir",
            color: pendingResults > 0 ? "var(--n-text-primary)" : "var(--n-text-disabled)",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="block transition-colors"
            style={{ backgroundColor: "var(--n-surface)" }}
          >
            <div
              className="p-6 hover:bg-opacity-80 transition-colors"
              style={{ backgroundColor: "var(--n-surface)" }}
            >
              <div className="n-label mb-3" style={{ color: "var(--n-text-disabled)" }}>
                {stat.label}
              </div>
              <div
                className="n-font-data text-4xl font-bold leading-none"
                style={{ color: stat.color ?? "var(--n-text-display)" }}
              >
                {stat.value}
              </div>
              <div className="n-label mt-2" style={{ color: "var(--n-text-disabled)" }}>
                {stat.unit}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: 2/3 */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Activity */}
          <div className="n-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
                  ACTIVITE
                </div>
                <h2 className="text-base font-medium" style={{ color: "var(--n-text-display)" }}>
                  Activite recente
                </h2>
              </div>
              <Link href="/producer/registrations">
                <button className="n-btn-ghost text-xs">TOUT VOIR</button>
              </Link>
            </div>

            {isRegistrationsLoading ? (
              <div className="py-8 text-center">
                <span
                  className="n-font-data text-sm"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  [LOADING...]
                </span>
              </div>
            ) : registrations && registrations.length > 0 ? (
              <div className="space-y-0 divide-y" style={{ borderColor: "var(--n-border)" }}>
                {registrations.map((reg) => (
                  <Link key={reg.id} href={`/producer/registrations/${reg.id}`} className="block">
                    <div
                      className="py-4 flex items-center justify-between gap-4 transition-colors"
                      style={{ color: "var(--n-text-primary)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span
                            className="font-medium truncate"
                            style={{ color: "var(--n-text-display)" }}
                          >
                            {reg.cupName}
                          </span>
                          <span
                            className={`n-tag ${
                              reg.status === "confirmed"
                                ? "success"
                                : reg.status === "pending_payment"
                                  ? "warning"
                                  : ""
                            }`}
                            style={
                              reg.status === "pending_payment"
                                ? {
                                    borderColor: "var(--n-warning)",
                                    color: "var(--n-warning)",
                                  }
                                : undefined
                            }
                          >
                            {reg.status === "confirmed"
                              ? "CONFIRME"
                              : reg.status === "pending_payment"
                                ? "EN ATTENTE"
                                : "ANNULE"}
                          </span>
                        </div>
                        <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                          {reg.productsCount} PRODUIT{reg.productsCount > 1 ? "S" : ""} INSCRIT
                          {reg.productsCount > 1 ? "S" : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="n-font-data text-xs" style={{ color: "var(--n-text-disabled)" }}>
                          {new Date(reg.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                        {reg.hasResults && (
                          <div
                            className="n-label mt-1"
                            style={{ color: "var(--n-warning)" }}
                          >
                            RESULTATS DISPO
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="n-label mb-2" style={{ color: "var(--n-text-secondary)" }}>
                  AUCUNE ACTIVITE
                </div>
                <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>
                  Vos inscriptions apparaitront ici.
                </p>
              </div>
            )}
          </div>

          {/* Labels / Distinctions */}
          {labels && labels.length > 0 && (
            <div className="n-card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
                    DISTINCTIONS
                  </div>
                  <h2
                    className="text-base font-medium"
                    style={{ color: "var(--n-text-display)" }}
                  >
                    Mes distinctions
                  </h2>
                </div>
                <Link href="/producer/labels">
                  <button className="n-btn-ghost text-xs">TOUT VOIR</button>
                </Link>
              </div>

              {isLabelsLoading ? (
                <div className="py-8 text-center">
                  <span
                    className="n-font-data text-sm"
                    style={{ color: "var(--n-text-disabled)" }}
                  >
                    [LOADING...]
                  </span>
                </div>
              ) : (
                <div className="space-y-0 divide-y" style={{ borderColor: "var(--n-border)" }}>
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: label.label.color ?? "var(--n-warning)" }}
                        />
                        <div className="min-w-0">
                          <p
                            className="font-medium truncate"
                            style={{ color: "var(--n-text-primary)" }}
                          >
                            {label.productName}
                          </p>
                          <p className="n-label truncate" style={{ color: "var(--n-text-disabled)" }}>
                            {label.label.name}
                          </p>
                        </div>
                      </div>
                      <span
                        className="n-tag shrink-0"
                        style={{
                          borderColor: label.label.color ?? "var(--n-warning)",
                          color: label.label.color ?? "var(--n-warning)",
                        }}
                      >
                        {label.label.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: 1/3 */}
        <div className="space-y-6">
          {/* Profile completion */}
          {profileIncomplete && (
            <div
              className="n-card"
              style={{ borderColor: "var(--n-warning)", borderWidth: "1px" }}
            >
              <div className="n-label mb-1" style={{ color: "var(--n-warning)" }}>
                PROFIL INCOMPLET
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--n-text-secondary)" }}>
                Completez votre profil pour augmenter votre visibilite.
              </p>

              {/* Segmented progress */}
              <div className="mb-1 flex items-center justify-between">
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  PROGRESSION
                </span>
                <span className="n-font-data text-xs" style={{ color: "var(--n-text-primary)" }}>
                  {profileScore}/3
                </span>
              </div>
              <div className="n-progress-bar mb-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`n-progress-segment ${i < profileScore ? "filled" : ""}`}
                    style={
                      i < profileScore
                        ? { background: "var(--n-warning)" }
                        : undefined
                    }
                  />
                ))}
              </div>

              <Link href="/producer/profile" className="block">
                <button className="n-btn-secondary w-full text-xs">COMPLETER MON PROFIL</button>
              </Link>
            </div>
          )}

          {/* Widget */}
          <div className="n-card">
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              WIDGET
            </div>
            <h3
              className="text-sm font-medium mb-2"
              style={{ color: "var(--n-text-display)" }}
            >
              Widget de distinctions
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--n-text-secondary)" }}>
              Affichez vos recompenses sur votre site web.
            </p>
            <Link href="/producer/widget" className="block">
              <button className="n-btn-secondary w-full text-xs">CONFIGURER LE WIDGET</button>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="n-card">
            <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
              ACTIONS RAPIDES
            </div>
            <div className="space-y-2">
              <Link href="/producer/results" className="block">
                <button className="n-btn-ghost w-full justify-start text-xs">
                  VOIR MES RESULTATS
                </button>
              </Link>
              <Link href="/producer/profile" className="block">
                <button className="n-btn-ghost w-full justify-start text-xs">
                  MON PROFIL
                </button>
              </Link>
            </div>
          </div>

          {/* Info */}
          <div
            className="px-4 py-3 rounded-lg"
            style={{
              backgroundColor: "var(--n-surface-raised)",
              border: "1px solid var(--n-border)",
            }}
          >
            <p className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              NOTIFICATIONS
            </p>
            <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
              Vous recevrez un email lorsque les resultats de vos inscriptions seront disponibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
