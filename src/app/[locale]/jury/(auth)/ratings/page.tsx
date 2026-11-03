"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";
import { useServerError } from "~/i18n/server-error";
import { intlLocale, type Locale } from "~/i18n/locales";
import { api } from "~/trpc/react";

/**
 * Jury Ratings Page
 * Shows all submitted ratings by the jury
 */
export default function JuryRatingsPage() {
  const t = useTranslations("juryMisc.ratings");
  const tc = useTranslations("jurySpace");
  const locale = useLocale() as Locale;
  const serverError = useServerError();
  // Get all jury cups with their products
  const { data: juryCups, isLoading, error } = api.jury.getMyJuryCups.useQuery();

  // Single-tenant: no org filter
  const orgCups = juryCups ?? [];

  // Calculate total ratings
  const totalRatings = orgCups.reduce((sum, cup) => sum + cup.progress.rated, 0);

  // Format date
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(intlLocale(locale), {
      timeZone: "Europe/Paris",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "12px", letterSpacing: "0.08em" }}>
          {tc("loading")}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="n-card" style={{ maxWidth: "480px", margin: "32px auto", padding: "32px", textAlign: "center" }}>
        <p className="n-label" style={{ color: "var(--n-accent)", marginBottom: "8px" }}>{t("error")}</p>
        <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>{serverError(error)}</p>
      </div>
    );
  }

  const hasNoRatings = orgCups.length === 0 || orgCups.every(cup => cup.progress.rated === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 className="n-font-body" style={{ fontSize: "24px", fontWeight: 600, color: "var(--n-text-display)", marginBottom: "4px" }}>
          {t("title")}
        </h1>
        <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--n-border-visible)" }}>
        <div style={{ background: "var(--n-surface)", padding: "24px" }}>
          <p className="n-font-data" style={{ fontSize: "40px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "8px" }}>
            {totalRatings}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>{t("submitted")}</p>
        </div>
        <div style={{ background: "var(--n-surface)", padding: "24px" }}>
          <p className="n-font-data" style={{ fontSize: "40px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "8px" }}>
            {orgCups.length}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>{t("competitions")}</p>
        </div>
      </div>

      {/* Ratings by Cup */}
      {hasNoRatings ? (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="n-label" style={{ color: "var(--n-text-primary)", marginBottom: "8px" }}>{t("empty")}</p>
          <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
            {t("emptyText")}
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
                      {cup.ratingEndAt ? t("deadline", { date: formatDate(cup.ratingEndAt) }) : t("noDeadline")}
                    </p>
                  </div>
                  <span className="n-tag success">
                    {t("count", { count: ratedCount })}
                  </span>
                </div>

                {/* Categories table */}
                {cup.assignedCategories.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      {/* scope="col" : le rattachement d'une cellule à son en-tête ne se
                          déduit pas du seul <thead>. Sans lui, un lecteur d'écran annonce
                          les catégories et les liens de notation à la file, sans jamais
                          rappeler ce que chaque colonne contient. */}
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
                          <th scope="col" style={{ padding: "10px 20px", textAlign: "left" }}>
                            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>{t("category")}</span>
                          </th>
                          <th scope="col" style={{ padding: "10px 20px", textAlign: "right" }}>
                            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>{t("action")}</span>
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
                              <Link href={`/jury/cups/${cup.cupId}`} className="n-btn-ghost" style={{ padding: "4px 12px", fontSize: "12px" }}>
                                {t("view")}
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
                      {t("noCategory")}
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
