"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  convertScoreToScale,
  getMaxScoreForScale,
} from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

export default function ProducerLabelsPage() {
  const { data: labels, isLoading } = api.producer.getMyLabels.useQuery();
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const getMyPdf = api.results.getMyPdf.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.base64}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Synthese PDF telechargee");
      setDownloadingPdf(null);
    },
    onError: (error) => {
      toast.error(error.message);
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
        <span className="n-font-data text-sm tracking-widest">[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/producer/dashboard">
          <button className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
            ← RETOUR
          </button>
        </Link>
        <div>
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            PRODUCTEUR
          </div>
          <h1
            className="n-font-data text-2xl font-bold"
            style={{ color: "var(--n-text-display)" }}
          >
            MES LABELS
          </h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            {labels && labels.length > 0
              ? `${labels.length} LABEL${labels.length !== 1 ? "S" : ""} OBTENU${labels.length !== 1 ? "S" : ""}`
              : "VOS RECOMPENSES OBTENUES LORS DES COMPETITIONS"}
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
            AUCUN LABEL
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
            Participez aux competitions pour remporter des labels.
          </p>
          <Link href="/cups">
            <button className="n-btn-secondary text-xs">
              DECOUVRIR LES COMPETITIONS
            </button>
          </Link>
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
                        COMPETITION
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
                          CLASSEMENT
                        </span>
                        <span
                          className="n-font-data text-sm"
                          style={{ color: "var(--n-warning)" }}
                        >
                          {item.categoryRank === 1
                            ? "1ER"
                            : item.categoryRank === 2
                              ? "2EME"
                              : `${item.categoryRank}EME`}{" "}
                          DE SA CATEGORIE
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2">
                      <span
                        className="n-label"
                        style={{ color: "var(--n-text-disabled)" }}
                      >
                        OBTENU LE
                      </span>
                      <span
                        className="n-font-data text-xs"
                        style={{ color: "var(--n-text-secondary)" }}
                      >
                        {formatDate(item.obtainedAt)}
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
                      ? "[TELECHARGEMENT...]"
                      : "TELECHARGER LA SYNTHESE PDF"}
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
