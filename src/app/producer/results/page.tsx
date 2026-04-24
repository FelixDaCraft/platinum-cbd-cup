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
import { ProductRadarChart, JuryScoresTable } from "~/components/features/results";

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

// Inline product details component
function ProductDetailsInline({
  productId,
  ratingScale,
}: {
  productId: string;
  ratingScale: RatingScale;
}) {
  const { data: criteriaData, isLoading: loadingCriteria } =
    api.producer.getMyProductCriteriaScores.useQuery({ productId }, { enabled: true });

  const { data: juryData, isLoading: loadingJury } =
    api.producer.getMyProductJuryScores.useQuery({ productId }, { enabled: true });

  const maxScale = getMaxScoreForScale(ratingScale);

  if (loadingCriteria || loadingJury) {
    return (
      <div className="py-8 text-center">
        <span className="n-font-data text-sm" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Criteria */}
        <div className="space-y-4">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            ANALYSE PAR CRITERE
          </div>

          {criteriaData ? (
            <>
              <ProductRadarChart
                criteriaScores={criteriaData.criteriaScores}
                productName={criteriaData.productName}
                ratingScale={ratingScale}
                className="w-full"
              />

              <div className="space-y-1">
                {criteriaData.criteriaScores.map((criterion) => {
                  const productScoreConverted = convertScoreToScale(
                    criterion.productScore,
                    ratingScale
                  );
                  const avgScoreConverted = convertScoreToScale(
                    criterion.categoryAverage,
                    ratingScale
                  );
                  const diff =
                    productScoreConverted !== null && avgScoreConverted !== null
                      ? productScoreConverted - avgScoreConverted
                      : null;

                  return (
                    <div
                      key={criterion.criterionId}
                      className="flex items-center justify-between py-2 px-3"
                      style={{ borderBottom: "1px solid var(--n-border)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className="font-medium text-sm truncate block"
                          style={{ color: "var(--n-text-primary)" }}
                        >
                          {criterion.criterionName}
                        </span>
                        <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                          COEF. {criterion.coefficient}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                            MOY. CAT.
                          </p>
                          <p
                            className="n-font-data text-xs"
                            style={{ color: "var(--n-text-secondary)" }}
                          >
                            {avgScoreConverted !== null
                              ? `${avgScoreConverted.toFixed(1)}/${maxScale}`
                              : "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                            VOUS
                          </p>
                          <p
                            className="n-font-data text-sm font-bold"
                            style={{ color: "var(--n-text-display)" }}
                          >
                            {productScoreConverted !== null
                              ? `${productScoreConverted.toFixed(1)}/${maxScale}`
                              : "N/A"}
                          </p>
                        </div>
                        <div
                          className="n-font-data text-xs font-medium px-2 py-1 min-w-[48px] text-center"
                          style={{
                            color:
                              diff !== null && diff > 0
                                ? "var(--n-success)"
                                : diff !== null && diff < 0
                                  ? "var(--n-accent)"
                                  : "var(--n-text-disabled)",
                            border: "1px solid",
                            borderColor:
                              diff !== null && diff > 0
                                ? "var(--n-success)"
                                : diff !== null && diff < 0
                                  ? "var(--n-accent)"
                                  : "var(--n-border)",
                            borderRadius: "4px",
                          }}
                        >
                          {diff !== null
                            ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`
                            : "-"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p
              className="text-center py-4 text-sm"
              style={{ color: "var(--n-text-disabled)" }}
            >
              Aucune donnee disponible
            </p>
          )}
        </div>

        {/* Jury Scores */}
        <div className="space-y-4">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            NOTES DES JURYS{" "}
            {juryData?.detailedScoresAvailable ? "(ANONYMISEES)" : "(SYNTHESE)"}
          </div>

          {juryData ? (
            juryData.detailedScoresAvailable ? (
              <JuryScoresTable
                juryScores={juryData.juryScores}
                stats={juryData.stats}
                ratingScale={ratingScale}
              />
            ) : (
              <div className="space-y-4">
                {/* Stats grid */}
                <div
                  className="grid grid-cols-4 gap-px"
                  style={{ backgroundColor: "var(--n-border)" }}
                >
                  {[
                    {
                      label: "JURYS",
                      value: juryData.stats.juryCount,
                      color: "var(--n-text-display)",
                    },
                    {
                      label: "MOYENNE",
                      value:
                        juryData.stats.averageScore !== null
                          ? `${convertScoreToScale(juryData.stats.averageScore, ratingScale)?.toFixed(1)}/${maxScale}`
                          : "N/A",
                      color: "var(--n-text-display)",
                    },
                    {
                      label: "MIN",
                      value:
                        juryData.stats.minScore !== null
                          ? `${convertScoreToScale(juryData.stats.minScore, ratingScale)?.toFixed(1)}/${maxScale}`
                          : "N/A",
                      color: "var(--n-accent)",
                    },
                    {
                      label: "MAX",
                      value:
                        juryData.stats.maxScore !== null
                          ? `${convertScoreToScale(juryData.stats.maxScore, ratingScale)?.toFixed(1)}/${maxScale}`
                          : "N/A",
                      color: "var(--n-success)",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 text-center"
                      style={{ backgroundColor: "var(--n-surface-raised)" }}
                    >
                      <p className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
                        {stat.label}
                      </p>
                      <p
                        className="n-font-data font-bold text-lg"
                        style={{ color: stat.color }}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Criteria averages */}
                {juryData.criteriaAverages && juryData.criteriaAverages.length > 0 && (
                  <div className="space-y-1">
                    <div
                      className="n-label mb-2"
                      style={{ color: "var(--n-text-disabled)" }}
                    >
                      MOYENNES PAR CRITERE
                    </div>
                    {juryData.criteriaAverages.map((criterion) => {
                      const avgConverted =
                        criterion.averageScore !== null
                          ? convertScoreToScale(criterion.averageScore, ratingScale)
                          : null;

                      return (
                        <div
                          key={criterion.criterionId}
                          className="flex items-center justify-between py-2 px-3"
                          style={{ borderBottom: "1px solid var(--n-border)" }}
                        >
                          <span
                            className="font-medium text-sm"
                            style={{ color: "var(--n-text-primary)" }}
                          >
                            {criterion.criterionName}
                          </span>
                          <span
                            className="n-font-data font-bold text-sm"
                            style={{ color: "var(--n-text-display)" }}
                          >
                            {avgConverted !== null
                              ? `${avgConverted.toFixed(1)}/${maxScale}`
                              : "N/A"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div
                  className="px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "var(--n-surface-raised)",
                    border: "1px solid var(--n-border)",
                    borderRadius: "8px",
                    color: "var(--n-text-secondary)",
                  }}
                >
                  Pour les competitions publiques, seuls les resultats synthetises sont
                  affiches afin de proteger l&apos;anonymat des membres du jury.
                </div>
              </div>
            )
          ) : (
            <p
              className="text-center py-4 text-sm"
              style={{ color: "var(--n-text-disabled)" }}
            >
              Aucune note de jury disponible
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProducerResultsPage() {
  const { data: cups, isLoading } = api.producer.getMyResultsByCup.useQuery();
  const [expandedCups, setExpandedCups] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
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

  const toggleCup = (cupId: string) => {
    setExpandedCups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cupId)) newSet.delete(cupId);
      else newSet.add(cupId);
      return newSet;
    });
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) newSet.delete(productId);
      else newSet.add(productId);
      return newSet;
    });
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

  const totalProducts = cups?.reduce((acc, cup) => acc + cup.products.length, 0) ?? 0;
  const totalLabels =
    cups?.reduce((acc, cup) => acc + cup.products.filter((p) => p.label).length, 0) ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/producer/dashboard">
          <button
            className="n-btn-ghost text-xs"
            style={{ padding: "8px 12px" }}
          >
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
            MES RESULTATS
          </h1>
          {cups && cups.length > 0 && (
            <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
              {cups.length} COMPETITION{cups.length !== 1 ? "S" : ""} · {totalProducts}{" "}
              PRODUIT{totalProducts !== 1 ? "S" : ""} · {totalLabels} LABEL
              {totalLabels !== 1 ? "S" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!cups || cups.length === 0 ? (
        <div
          className="py-16 text-center max-w-md mx-auto"
          style={{
            border: "1px dashed var(--n-border-visible)",
            borderRadius: "12px",
          }}
        >
          <div className="n-label mb-2" style={{ color: "var(--n-text-secondary)" }}>
            AUCUN RESULTAT
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
            Vos resultats apparaitront ici une fois que les organisateurs auront publie les
            resultats.
          </p>
          <Link href="/producer/registrations">
            <button className="n-btn-secondary text-xs">VOIR MES INSCRIPTIONS</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {cups.map((cup) => {
            const isExpanded = expandedCups.has(cup.id);
            const labelsCount = cup.products.filter((p) => p.label).length;

            return (
              <div key={cup.id} className="n-card">
                {/* Cup Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleCup(cup.id)}
                >
                  <div className="min-w-0 flex-1">
                    <h2
                      className="font-semibold text-lg"
                      style={{ color: "var(--n-text-display)" }}
                    >
                      {cup.name}
                    </h2>
                    <div
                      className="n-label mt-1"
                      style={{ color: "var(--n-text-disabled)" }}
                    >
                      RESULTATS PUBLIES LE {formatDate(cup.resultsPublishedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p
                        className="n-font-data text-sm"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {cup.products.length} PRODUIT{cup.products.length !== 1 ? "S" : ""}
                      </p>
                      {labelsCount > 0 && (
                        <p
                          className="n-font-data text-sm"
                          style={{ color: "var(--n-warning)" }}
                        >
                          {labelsCount} LABEL{labelsCount !== 1 ? "S" : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-text-disabled)" }}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Products */}
                {isExpanded && (
                  <div
                    className="mt-4 pt-4 space-y-2"
                    style={{ borderTop: "1px solid var(--n-border)" }}
                  >
                    {cup.products.map((product) => {
                      const isProductExpanded = expandedProducts.has(product.id);

                      return (
                        <div
                          key={product.id}
                          style={{
                            border: "1px solid var(--n-border)",
                            borderRadius: "8px",
                            overflow: "hidden",
                          }}
                        >
                          {/* Product row */}
                          <div
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-4 cursor-pointer transition-colors"
                            style={{ backgroundColor: "var(--n-surface-raised)" }}
                            onClick={() => toggleProduct(product.id)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {product.label ? (
                                <div
                                  className="w-1 h-10 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: product.label.color ?? "var(--n-warning)",
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-1 h-10 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: "var(--n-border-visible)" }}
                                />
                              )}

                              <div className="min-w-0 flex-1">
                                <p
                                  className="font-medium truncate"
                                  style={{ color: "var(--n-text-primary)" }}
                                >
                                  {product.name}
                                </p>
                                <p
                                  className="n-label truncate mt-0.5"
                                  style={{ color: "var(--n-text-disabled)" }}
                                >
                                  {product.categoryName}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              {product.categoryRank && (
                                <span
                                  className="n-font-data text-xs"
                                  style={{ color: "var(--n-warning)" }}
                                >
                                  {product.categoryRank === 1
                                    ? "1ER"
                                    : product.categoryRank === 2
                                      ? "2EME"
                                      : `${product.categoryRank}EME`}
                                </span>
                              )}

                              {product.label && (
                                <span
                                  className="n-tag"
                                  style={{
                                    borderColor: product.label.color ?? "var(--n-warning)",
                                    color: product.label.color ?? "var(--n-warning)",
                                  }}
                                >
                                  {product.label.name}
                                </span>
                              )}

                              {product.finalScore !== null && (
                                <div className="text-right min-w-[60px]">
                                  <p
                                    className="n-font-data font-bold text-xl leading-none"
                                    style={{ color: "var(--n-text-display)" }}
                                  >
                                    {convertScoreToScale(
                                      product.finalScore,
                                      cup.ratingScale as RatingScale
                                    )?.toFixed(1)}
                                  </p>
                                  <p
                                    className="n-label mt-0.5"
                                    style={{ color: "var(--n-text-disabled)" }}
                                  >
                                    /{getMaxScoreForScale(cup.ratingScale as RatingScale)}
                                  </p>
                                </div>
                              )}

                              <span
                                className="n-font-data text-xs"
                                style={{ color: "var(--n-text-disabled)" }}
                              >
                                {isProductExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>

                          {/* Product details */}
                          {isProductExpanded && (
                            <div
                              className="p-4"
                              style={{
                                backgroundColor: "var(--n-surface)",
                                borderTop: "1px solid var(--n-border)",
                              }}
                            >
                              <ProductDetailsInline
                                productId={product.id}
                                ratingScale={cup.ratingScale as RatingScale}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Download PDF */}
                    {cup.products.length > 0 && (
                      <div className="pt-2">
                        <button
                          className="n-btn-secondary w-full text-xs"
                          onClick={() =>
                            handleDownloadPdf(cup.products[0]!.registrationId)
                          }
                          disabled={downloadingPdf === cup.products[0]!.registrationId}
                        >
                          {downloadingPdf === cup.products[0]!.registrationId
                            ? "[TELECHARGEMENT...]"
                            : "TELECHARGER LA SYNTHESE PDF"}
                        </button>
                      </div>
                    )}
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
