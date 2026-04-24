"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

/**
 * Jury Results List Page
 * Lists all completed cups where the jury can view results
 */
export default function JuryResultsListPage() {
  const { data: completedCups, isLoading } =
    api.jury.getCompletedCupsWithResults.useQuery();

  // Single-tenant: no org filter
  const orgCups = completedCups ?? [];

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "12px", letterSpacing: "0.08em" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 className="n-font-body" style={{ fontSize: "24px", fontWeight: 600, color: "var(--n-text-display)", marginBottom: "4px" }}>
          RÉSULTATS
        </h1>
        <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
          Consultez vos résultats et la correspondance codes / variétés / producteurs
        </p>
      </div>

      {/* Cup list */}
      {orgCups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--n-border-visible)" }}>
          {orgCups.map((cup, idx) => (
            <Link
              key={cup.cupId}
              href={`/jury/results/${cup.cupId}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: "var(--n-surface)",
                  borderBottom: idx < orgCups.length - 1 ? "1px solid var(--n-border)" : "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--n-surface-raised)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--n-surface)";
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <span className="n-font-body" style={{ fontWeight: 600, color: "var(--n-text-primary)", fontSize: "15px" }}>
                    {cup.cupName}
                  </span>
                  <span className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)" }}>
                    PUBLIÉ LE {formatDate(cup.resultsPublishedAt).toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                  <span className="n-font-data" style={{ fontSize: "12px", color: "var(--n-text-secondary)" }}>
                    {cup.totalProducts} PRODUIT{cup.totalProducts > 1 ? "S" : ""}
                  </span>
                  <span className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "16px" }}>›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="n-label" style={{ color: "var(--n-text-primary)", marginBottom: "8px" }}>AUCUN RÉSULTAT DISPONIBLE</p>
          <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
            Les résultats seront disponibles une fois les cups terminées et les résultats publiés.
          </p>
        </div>
      )}
    </div>
  );
}
