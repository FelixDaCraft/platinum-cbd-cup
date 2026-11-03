"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useServerError } from "~/i18n/server-error";
import { Link } from "~/i18n/navigation";
import { formatDate as formatLocaleDate, type Locale } from "~/i18n/locales";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  convertScoreToScale,
  getMaxScoreForScale,
} from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";

function formatDate(date: Date | string | null | undefined, locale: Locale): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return formatLocaleDate(dateObj, locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ProducerLabelsPage() {
  const t = useTranslations("producerLabels");
  const tr = useTranslations("producerResults");
  const tc = useTranslations("producerSpace");
  const serverError = useServerError();
  const locale = useLocale() as Locale;
  const {
    data: labels,
    isLoading,
    isError,
    refetch,
  } = api.producer.getMyLabels.useQuery();
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const getMyPdf = api.results.getMyPdf.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.base64}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(tr("pdfDownloaded"));
      setDownloadingPdf(null);
    },
    onError: (error) => {
      toast.error(serverError(error));
      setDownloadingPdf(null);
    },
  });

  const handleDownloadPdf = (registrationId: string) => {
    setDownloadingPdf(registrationId);
    getMyPdf.mutate({ registrationId });
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ color: "var(--n-text-disabled)" }}
      >
        <span className="n-font-data text-sm tracking-widest">{tc("loading")}</span>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une liste vide :
  // « vous n'avez rien » est plausible et masquerait l'incident.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-font-data text-sm tracking-widest" style={{ color: "var(--n-text-secondary)" }}>
          {t("error")}
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          {tc("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/producer/dashboard" className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
          {tr("back")}
        </Link>
        <div>
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            {tr("eyebrow")}
          </div>
          <h1
            className="n-font-data text-2xl font-bold"
            style={{ color: "var(--n-text-display)" }}
          >
            {t("title")}
          </h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            {labels && labels.length > 0
              ? t("count", { count: labels.length })
              : t("subtitle")}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {!labels || labels.length === 0 ? (
        <div
          className="py-16 text-center max-w-md mx-auto"
          style={{
            border: "1px dashed var(--n-border-visible)",
            borderRadius: "12px",
          }}
        >
          <div className="n-label mb-2" style={{ color: "var(--n-text-secondary)" }}>
            {t("empty")}
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
            {t("emptyText")}
          </p>
          <Link href="/cups" className="n-btn-secondary text-xs">{t("discover")}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((item) => {
            const scoreConverted =
              item.finalScore !== null
                ? convertScoreToScale(
                    item.finalScore,
                    item.cup.ratingScale as RatingScale
                  )
                : null;
            const maxScale = getMaxScoreForScale(item.cup.ratingScale as RatingScale);
            const labelColor = item.label.color ?? "var(--n-warning)";

            return (
              <div
                key={item.id}
                className="n-card"
                style={{ borderColor: "var(--n-border)" }}
              >
                {/* Color accent bar */}
                <div
                  className="h-[2px] -mx-6 -mt-6 mb-5"
                  style={{ backgroundColor: labelColor }}
                />

                {/* Label + Score header */}
                <div className="flex items-start justify-between mb-4">
                  <span
                    className="n-tag"
                    style={{
                      borderColor: labelColor,
                      color: labelColor,
                    }}
                  >
                    {item.label.name}
                  </span>
                  {scoreConverted !== null && (
                    <div className="text-right">
                      <div
                        className="n-font-data text-3xl font-bold leading-none"
                        style={{ color: "var(--n-text-display)" }}
                      >
                        {scoreConverted.toFixed(1)}
                      </div>
                      <div
                        className="n-label mt-0.5"
                        style={{ color: "var(--n-text-disabled)" }}
                      >
                        /{maxScale}
                      </div>
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="space-y-3">
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--n-text-display)" }}
                    >
                      {item.productName}
                    </p>
                    <p
                      className="n-label mt-0.5"
                      style={{ color: "var(--n-text-disabled)" }}
                    >
                      {item.categoryName}
                    </p>
                  </div>

                  {/* Stat rows */}
                  <div
                    className="space-y-0 divide-y"
                    style={{ borderColor: "var(--n-border)" }}
                  >
                    <div className="flex items-center justify-between py-2">
                      <span
                        className="n-label"
                        style={{ color: "var(--n-text-disabled)" }}
                      >
                        {t("competition")}
                      </span>
                      <span
                        className="text-sm truncate max-w-[60%] text-right"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {item.cup.name}
                      </span>
                    </div>

                    {item.categoryRank && (
                      <div className="flex items-center justify-between py-2">
                        <span
                          className="n-label"
                          style={{ color: "var(--n-text-disabled)" }}
                        >
                          {t("ranking")}
                        </span>
                        <span
                          className="n-font-data text-sm"
                          style={{ color: "var(--n-warning)" }}
                        >
                          {t("rankInCategory", { rank: item.categoryRank })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2">
                      <span
                        className="n-label"
                        style={{ color: "var(--n-text-disabled)" }}
                      >
                        {t("obtainedOn")}
                      </span>
                      <span
                        className="n-font-data text-xs"
                        style={{ color: "var(--n-text-secondary)" }}
                      >
                        {formatDate(item.obtainedAt, locale)}
                      </span>
                    </div>
                  </div>

                  {/* Download PDF */}
                  <button
                    className="n-btn-secondary w-full text-xs mt-2"
                    onClick={() => handleDownloadPdf(item.registrationId)}
                    disabled={downloadingPdf === item.registrationId}
                  >
                    {downloadingPdf === item.registrationId
                      ? tr("downloading")
                      : tr("downloadPdf")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
