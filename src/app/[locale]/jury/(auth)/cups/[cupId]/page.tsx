"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";
import { useServerError } from "~/i18n/server-error";
import { intlLocale, type Locale } from "~/i18n/locales";
import { toast } from "sonner";

import { api } from "~/trpc/react";

export default function PortalJuryCupPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const utils = api.useUtils();
  const t = useTranslations("juryCup");
  const tc = useTranslations("jurySpace");
  const locale = useLocale() as Locale;
  const serverError = useServerError();

  // Get jury cup data
  const {
    data,
    isLoading,
    error,
  } = api.jury.getMyJuryCup.useQuery(
    { cupId },
    { refetchOnWindowFocus: true }
  );

  // Confirm samples mutation
  const confirmMutation = api.jury.confirmSamplesReceived.useMutation({
    onSuccess: () => {
      toast.success(t("samplesConfirmed"));
      void utils.jury.getMyJuryCup.invalidate({ cupId });
    },
    onError: (err) => {
      toast.error(serverError(err));
    },
  });

  const handleConfirmSamples = () => {
    confirmMutation.mutate({ cupId });
  };

  // Calculate days remaining
  const getDaysRemaining = (endDate: Date | null) => {
    if (!endDate) return null;
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "14px", letterSpacing: "0.1em" }}>
          {tc("loading")}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
          <p className="n-font-data" style={{ color: "var(--n-accent)", fontSize: "12px", letterSpacing: "0.1em", marginBottom: "12px" }}>
            {t("error")}
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
            {t("accessDenied")}
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            {serverError(error)}
          </p>
          <Link href="/jury" className="n-btn-secondary">{t("backDashboard")}</Link>
        </div>
      </div>
    );
  }

  const { cup, jury, productsToRate, totalProductsToRate, ratedProductsCount } = data!;
  const samplesConfirmed = !!jury.samplesReceivedAt;
  const daysRemaining = getDaysRemaining(cup.ratingEndDate);
  const isDeadlinePassed = daysRemaining !== null && daysRemaining <= 0;
  const isDeadlineNear = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;

  // If samples not confirmed, show confirmation step
  if (!samplesConfirmed) {
    return (
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div className="n-card" style={{ padding: "32px" }}>
          {/* Heading */}
          <p className="n-label" style={{ marginBottom: "8px" }}>{t("confirmRequired")}</p>
          <h1 className="n-font-body" style={{ color: "var(--n-text-display)", fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>
            {t("confirmTitle")}
          </h1>
          <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            {t.rich("confirmText", {
              cup: cup.name,
              b: (chunks) => (
                <span style={{ color: "var(--n-text-primary)", fontWeight: 500 }}>{chunks}</span>
              ),
            })}
          </p>

          {/* Org */}
          <div style={{ borderBottom: "1px solid var(--n-border)", paddingBottom: "20px", marginBottom: "20px" }}>
            <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "13px" }}>
              {t.rich("organizedBy", {
                b: (chunks) => <span style={{ color: "var(--n-text-primary)" }}>{chunks}</span>,
              })}
            </p>
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: "24px" }}>
            <p className="n-label" style={{ marginBottom: "12px" }}>{t("beforeConfirm")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                t("check1"),
                t("check2"),
                t("check3"),
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--n-border)" }}>
                  <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "11px", marginTop: "2px", flexShrink: 0 }}>—</span>
                  <span className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category list */}
          {jury.categoryAssignments.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <p className="n-label" style={{ marginBottom: "10px" }}>{t("categoriesToRate")}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                {jury.categoryAssignments.map((cat) => (
                  <span key={cat.id} className="n-tag">{cat.categoryName}</span>
                ))}
              </div>
              <p className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "11px", letterSpacing: "0.08em" }}>
                {t("productsToRate", { count: totalProductsToRate })}
              </p>
            </div>
          )}

          {/* Confirm button */}
          <button
            className="n-btn-primary"
            style={{ width: "100%" }}
            onClick={handleConfirmSamples}
            disabled={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? t("confirming") : t("confirm")}
          </button>
        </div>
      </div>
    );
  }

  // Samples confirmed - show jury dashboard
  const progressPercent = totalProductsToRate > 0 ? Math.round((ratedProductsCount / totalProductsToRate) * 100) : 0;
  const totalSegments = Math.max(totalProductsToRate, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>Platinum CBD Cup</p>
          <h1 className="n-font-body" style={{ color: "var(--n-text-display)", fontSize: "24px", fontWeight: 600, margin: 0 }}>
            {cup.name}
          </h1>
        </div>
        {daysRemaining !== null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {isDeadlinePassed ? (
              <span className="n-tag accent">{t("finished")}</span>
            ) : isDeadlineNear ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span
                  className="n-font-data"
                  style={{ fontSize: "36px", lineHeight: 1, color: "var(--n-warning)", fontWeight: 700 }}
                >
                  {daysRemaining}
                </span>
                <span className="n-label" style={{ color: "var(--n-warning)" }}>
                  {t("daysLeft", { count: daysRemaining })}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span
                  className="n-font-data"
                  style={{ fontSize: "36px", lineHeight: 1, color: "var(--n-text-primary)", fontWeight: 700 }}
                >
                  {daysRemaining}
                </span>
                <span className="n-label">
                  {t("daysLeft", { count: daysRemaining })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deadline banners */}
      {isDeadlinePassed && (
        <p className="n-font-body" style={{ color: "var(--n-accent)", fontSize: "14px", fontWeight: 500 }}>
          {t("deadlinePassed")}
        </p>
      )}

      {isDeadlineNear && !isDeadlinePassed && (
        <p className="n-font-body" style={{ color: "var(--n-warning)", fontSize: "14px", fontWeight: 500 }}>
          {t("deadlineNear", { count: daysRemaining })}
        </p>
      )}

      {/* Progress card */}
      <div className="n-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p className="n-label">{t("yourProgress")}</p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="n-tag success">{t("samplesReceived")}</span>
            {progressPercent === 100 && (
              <span className="n-tag success">{t("finished")}</span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <p
            className="n-font-body"
            style={{
              color: progressPercent === 100 ? "var(--n-success)" : "var(--n-text-primary)",
              fontSize: "28px",
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: "4px",
            }}
          >
            {ratedProductsCount} / {totalProductsToRate}
          </p>
          <p className="n-label">{t("productsRated")}</p>
        </div>

        <div className="n-progress-bar" style={{ marginBottom: "12px" }}>
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div
              key={i}
              className={`n-progress-segment${i < ratedProductsCount ? " filled" : ""}`}
            />
          ))}
        </div>

        {cup.ratingEndDate && (
          <p
            className="n-font-data"
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: isDeadlinePassed
                ? "var(--n-accent)"
                : isDeadlineNear
                ? "var(--n-warning)"
                : "var(--n-text-disabled)",
            }}
          >
            {t("deadline", {
              date: new Date(cup.ratingEndDate)
                .toLocaleDateString(intlLocale(locale), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Paris",
                })
                .toUpperCase(),
            })}
          </p>
        )}
      </div>

      {/* Categories */}
      <div>
        <p className="n-label" style={{ marginBottom: "12px" }}>{t("categoriesToRate")}</p>

        {jury.categoryAssignments.length === 0 ? (
          <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
            <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "4px" }}>
              {t("noCategory")}
            </p>
            <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px" }}>
              {t("noCategoryText")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {jury.categoryAssignments.map((category, idx) => {
              const categoryProducts = productsToRate.filter(
                (p) => p.categoryId === category.categoryId
              );
              const categoryRatedCount = categoryProducts.filter((p) => p.isRated).length;
              const isComplete = categoryRatedCount === categoryProducts.length && categoryProducts.length > 0;
              const catSegments = Math.max(categoryProducts.length, 1);

              return (
                <Link
                  key={category.id}
                  href={`/jury/cups/${cupId}/category/${category.categoryId}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px 0",
                      borderTop: idx === 0 ? "1px solid var(--n-border-visible)" : "1px solid var(--n-border)",
                      borderBottom: idx === jury.categoryAssignments.length - 1 ? "1px solid var(--n-border-visible)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {/* Name + progress bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="n-font-body"
                        style={{
                          color: isComplete ? "var(--n-success)" : "var(--n-text-primary)",
                          fontSize: "15px",
                          fontWeight: 500,
                          marginBottom: "8px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {category.categoryName}
                      </p>
                      <div className="n-progress-bar" style={{ marginBottom: "4px" }}>
                        {Array.from({ length: catSegments }).map((_, i) => (
                          <div
                            key={i}
                            className={`n-progress-segment${i < categoryRatedCount ? " filled" : ""}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Fraction + chevron */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                      <p
                        className="n-font-data"
                        style={{
                          fontSize: "13px",
                          color: isComplete ? "var(--n-success)" : "var(--n-text-secondary)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {categoryRatedCount} / {categoryProducts.length}
                      </p>
                      <span
                        className="n-font-body"
                        style={{ color: "var(--n-text-disabled)", fontSize: "16px" }}
                      >
                        ›
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
