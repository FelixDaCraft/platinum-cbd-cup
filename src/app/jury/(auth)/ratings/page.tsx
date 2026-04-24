"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

/**
 * Jury Ratings Page
 * Shows all submitted ratings by the jury
 */
export default function JuryRatingsPage() {
  // Get all jury cups with their products
  const { data: juryCups, isLoading, error } = api.jury.getMyJuryCups.useQuery();

  // Single-tenant: no org filter
  const orgCups = juryCups ?? [];

  // Calculate total ratings
  const totalRatings = orgCups.reduce((sum, cup) => sum + cup.progress.rated, 0);

  // Format date
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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

  if (error) {
    return (
      <div className="n-card" style={{ maxWidth: "480px", margin: "32px auto", padding: "32px", textAlign: "center" }}>
        <p className="n-label" style={{ color: "var(--n-accent)", marginBottom: "8px" }}>ERREUR</p>
        <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>{error.message}</p>
      </div>
    );
  }

  const hasNoRatings = orgCups.length === 0 || orgCups.every(cup => cup.progress.rated === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 className="n-font-body" style={{ fontSize: "24px", fontWeight: 600, color: "var(--n-text-display)", marginBottom: "4px" }}>
          NOTES SOUMISES
        </h1>
        <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
          Historique de vos évaluations
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--n-border-visible)" }}>
        <div style={{ background: "var(--n-surface)", padding: "24px" }}>
          <p className="n-font-data" style={{ fontSize: "40px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "8px" }}>
            {totalRatings}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>NOTES SOUMISES</p>
        </div>
        <div style={{ background: "var(--n-surface)", padding: "24px" }}>
          <p className="n-font-data" style={{ fontSize: "40px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "8px" }}>
            {orgCups.length}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>COMPETITIONS</p>
        </div>
      </div>

      {/* Ratings by Cup */}
      {hasNoRatings ? (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="n-label" style={{ color: "var(--n-text-primary)", marginBottom: "8px" }}>AUCUNE NOTE SOUMISE</p>
          <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
            Rendez-vous dans &quot;Mes évaluations&quot; pour commencer à noter.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {orgCups.map((cup) => {
            const ratedCount = cup.progress.rated;

            if (ratedCount === 0) return null;

            return (
              <div key={cup.cupId} className="n-card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Cup header */}
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--n-border-visible)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}>
                  <div>
                    <p className="n-font-body" style={{ fontWeight: 600, color: "var(--n-text-primary)", marginBottom: "2px" }}>
                      {cup.cupName}
                    </p>
                    <p className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)" }}>
                      {cup.ratingEndAt ? `LIMITE: ${formatDate(cup.ratingEndAt)}` : "PAS DE DATE LIMITE"}
                    </p>
                  </div>
                  <span className="n-tag success">
                    {ratedCount} NOTE{ratedCount > 1 ? "S" : ""}
                  </span>
                </div>

                {/* Categories table */}
                {cup.assignedCategories.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
                          <th style={{ padding: "10px 20px", textAlign: "left" }}>
                            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>CATÉGORIE</span>
                          </th>
                          <th style={{ padding: "10px 20px", textAlign: "right" }}>
                            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>ACTION</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cup.assignedCategories.map((category) => (
                          <tr
                            key={category.id}
                            style={{ borderBottom: "1px solid var(--n-border)" }}
                          >
                            <td style={{ padding: "12px 20px" }}>
                              <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px" }}>
                                {category.name}
                              </span>
                            </td>
                            <td style={{ padding: "12px 20px", textAlign: "right" }}>
                              <Link href={`/jury/cups/${cup.cupId}`}>
                                <button className="n-btn-ghost" style={{ padding: "4px 12px", fontSize: "12px" }}>
                                  Voir
                                </button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center" }}>
                    <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
                      Aucune catégorie assignée
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
