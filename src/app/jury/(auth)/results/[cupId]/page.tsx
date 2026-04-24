"use client";

import { use, useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";

interface PageProps {
  params: Promise<{ cupId: string }>;
}

// ─── Expandable product detail row component ────────────────────────────────

interface ProductDetailRowProps {
  productId: string;
  cupId: string;
}

function ProductDetailRow({ productId, cupId }: ProductDetailRowProps) {
  const { data, isLoading, error } = api.jury.getJuryProductDetail.useQuery(
    { productId, cupId },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "24px", textAlign: "center" }}>
          <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "11px" }}>
            [LOADING...]
          </span>
        </td>
      </tr>
    );
  }

  if (error || !data) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "16px", textAlign: "center" }}>
          <span className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px" }}>
            Impossible de charger les détails.
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: "0 0 0 0" }}>
        <div style={{
          background: "var(--n-surface-raised)",
          borderTop: "1px solid var(--n-border)",
          borderBottom: "1px solid var(--n-border-visible)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {/* Criteria table */}
          <div>
            <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "12px" }}>
              DÉTAIL PAR CRITÈRE
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>CRITÈRE</span>
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>MA NOTE</span>
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>MOY. CAT.</span>
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>ÉCART</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.criteriaDetails.map((criterion) => {
                    const diff =
                      criterion.juryScore !== null && criterion.categoryAverage !== null
                        ? criterion.juryScore - criterion.categoryAverage
                        : null;
                    return (
                      <tr
                        key={criterion.criterionName}
                        style={{ borderBottom: "1px solid var(--n-border)" }}
                      >
                        <td style={{ padding: "10px 12px" }}>
                          <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "13px" }}>
                            {criterion.criterionName}
                          </span>
                          <span className="n-font-data" style={{ marginLeft: "6px", fontSize: "10px", color: "var(--n-text-disabled)" }}>
                            x{criterion.coefficient}
                          </span>
                          {criterion.criterionDescription && (
                            <p className="n-font-body" style={{ fontSize: "11px", color: "var(--n-text-disabled)", marginTop: "2px", fontStyle: "italic" }}>
                              {criterion.criterionDescription}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span className="n-font-data" style={{ fontSize: "14px", color: "var(--n-text-display)" }}>
                            {criterion.juryScore !== null ? criterion.juryScore.toFixed(1) : "-"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span className="n-font-data" style={{ fontSize: "14px", color: "var(--n-text-secondary)" }}>
                            {criterion.categoryAverage !== null
                              ? criterion.categoryAverage.toFixed(1)
                              : "-"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {diff !== null ? (
                            <span
                              className="n-font-data"
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: diff > 0 ? "#4A90D9" : diff < 0 ? "#D4843A" : "var(--n-text-disabled)",
                              }}
                            >
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--n-text-disabled)" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comment */}
          {data.juryComment && data.juryComment.trim().length > 0 && (
            <div>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "8px" }}>
                MON COMMENTAIRE
              </p>
              <p className="n-font-body" style={{
                fontSize: "13px",
                fontStyle: "italic",
                color: "var(--n-text-secondary)",
                borderLeft: "2px solid var(--n-border-visible)",
                paddingLeft: "12px",
              }}>
                &laquo;&nbsp;{data.juryComment.trim()}&nbsp;&raquo;
              </p>
            </div>
          )}

          {/* Download button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href={`/api/jury-pdf/product/${productId}?cupId=${cupId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="n-btn-secondary" style={{ fontSize: "12px", padding: "6px 14px" }}>
                Télécharger la fiche
              </button>
            </a>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

/**
 * Jury Results Comparison Page
 * Shows detailed comparison between jury's ratings and final results.
 * Each product row is expandable to reveal per-criterion breakdown.
 */
export default function JuryResultsComparisonPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const { data, isLoading, error } = api.jury.getCupRatingsComparison.useQuery({
    cupId: resolvedParams.cupId,
  });

  // Format date
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  // Get difference indicator
  const getDifferenceIndicator = (diff: number | null) => {
    if (diff === null) return null;
    if (Math.abs(diff) <= 1) {
      return { color: "var(--n-text-disabled)", label: "~0", sentiment: "aligned" };
    }
    if (diff > 0) {
      return { color: "#4A90D9", label: `+${diff.toFixed(1)}`, sentiment: "high" };
    }
    return { color: "#D4843A", label: `${diff.toFixed(1)}`, sentiment: "low" };
  };

  const toggleExpand = (productId: string) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <Link href="/jury/dashboard">
          <button className="n-btn-ghost" style={{ fontSize: "13px" }}>
            &lt; Retour au tableau de bord
          </button>
        </Link>
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="n-label" style={{ color: "var(--n-accent)", marginBottom: "8px" }}>RÉSULTATS NON DISPONIBLES</p>
          <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Group products by category
  const productsByCategory = data.products.reduce(
    (acc, product) => {
      const categoryProducts = acc[product.categoryName] ?? [];
      categoryProducts.push(product);
      acc[product.categoryName] = categoryProducts;
      return acc;
    },
    {} as Record<string, typeof data.products>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Back button */}
      <div>
        <Link href="/jury/dashboard">
          <button className="n-btn-ghost" style={{ fontSize: "13px" }}>
            &lt; Retour
          </button>
        </Link>
      </div>

      {/* Cup Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <h1 className="n-font-body" style={{ fontSize: "24px", fontWeight: 600, color: "var(--n-text-display)" }}>
          {data.cupName}
        </h1>
        <p className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)" }}>
          RÉSULTATS PUBLIÉS LE {formatDate(data.resultsPublishedAt).toUpperCase()}
        </p>
      </div>

      {/* Download buttons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <a href={`/api/jury-pdf/${resolvedParams.cupId}/all-details`}>
          <button className="n-btn-secondary" style={{ fontSize: "12px" }}>
            Télécharger toutes les fiches
          </button>
        </a>
        <a href={`/api/jury-pdf/${resolvedParams.cupId}`}>
          <button className="n-btn-secondary" style={{ fontSize: "12px" }}>
            Exporter en PDF
          </button>
        </a>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "var(--n-border-visible)" }}>
        <div style={{ background: "var(--n-surface)", padding: "20px" }}>
          <p className="n-font-data" style={{ fontSize: "36px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
            {data.stats.ratedByJury}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>
            PRODUITS ÉVALUÉS
          </p>
          <p className="n-font-data" style={{ fontSize: "10px", color: "var(--n-text-disabled)", marginTop: "2px" }}>
            SUR {data.stats.totalProducts}
          </p>
        </div>
        <div style={{ background: "var(--n-surface)", padding: "20px" }}>
          <p className="n-font-data" style={{ fontSize: "36px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
            {data.stats.alignmentScore !== null ? `${data.stats.alignmentScore}%` : "-"}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>
            SCORE D'ALIGNEMENT
          </p>
        </div>
        <div style={{ background: "var(--n-surface)", padding: "20px" }}>
          <p className="n-font-data" style={{ fontSize: "36px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
            {data.stats.averageDifference !== null
              ? `${data.stats.averageDifference > 0 ? "+" : ""}${data.stats.averageDifference}`
              : "-"}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>
            ÉCART MOYEN
          </p>
        </div>
        <div style={{ background: "var(--n-surface)", padding: "20px" }}>
          <p className="n-font-data" style={{ fontSize: "36px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
            {data.categories.length}
          </p>
          <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>
            CATÉGORIE{data.categories.length > 1 ? "S" : ""} ÉVALUÉE{data.categories.length > 1 ? "S" : ""}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "16px",
        padding: "12px 16px",
        border: "1px solid var(--n-border)",
        background: "var(--n-surface)",
      }}>
        <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>LÉGENDE :</span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4A90D9", flexShrink: 0 }} />
          <span className="n-font-data" style={{ fontSize: "11px", color: "#4A90D9" }}>PLUS GÉNÉREUX</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--n-text-disabled)", flexShrink: 0 }} />
          <span className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)" }}>ALIGNÉ (±1 PT)</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#D4843A", flexShrink: 0 }} />
          <span className="n-font-data" style={{ fontSize: "11px", color: "#D4843A" }}>PLUS SÉVÈRE</span>
        </span>
        <span className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)", marginLeft: "4px" }}>
          · CLIQUEZ SUR UN PRODUIT POUR VOIR LE DÉTAIL
        </span>
      </div>

      {/* Products by Category */}
      {Object.entries(productsByCategory).map(([categoryName, products]) => (
        <div key={categoryName} className="n-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Category header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--n-border-visible)",
            display: "flex",
            alignItems: "baseline",
            gap: "12px",
          }}>
            <p className="n-font-body" style={{ fontWeight: 600, color: "var(--n-text-primary)", fontSize: "15px" }}>
              {categoryName}
            </p>
            <span className="n-font-data" style={{ fontSize: "11px", color: "var(--n-text-disabled)" }}>
              {products.length} PRODUIT{products.length > 1 ? "S" : ""}
            </span>
          </div>

          {/* Products table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "48px" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>#</span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>PRODUIT</span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>PRODUCTEUR</span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>MA NOTE</span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>SCORE FINAL</span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>ÉCART</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const diffIndicator = getDifferenceIndicator(product.difference);
                  const isExpanded = expandedProductId === product.productId;

                  return (
                    <>
                      <tr
                        key={product.productId}
                        onClick={() => toggleExpand(product.productId)}
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid var(--n-border)",
                          cursor: "pointer",
                          background: isExpanded ? "var(--n-surface-raised)" : "transparent",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "var(--n-surface-raised)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "12px 12px" }}>
                          <span className="n-font-data" style={{ fontSize: "13px", color: "var(--n-text-secondary)" }}>
                            {product.categoryRank ?? "-"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px" }}>
                          <p className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px", marginBottom: "2px" }}>
                            {product.productName}
                          </p>
                          {product.anonymousCode && (
                            <p className="n-font-data" style={{ fontSize: "10px", color: "var(--n-text-disabled)" }}>
                              {product.anonymousCode}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: "12px 12px" }}>
                          <span className="n-font-body" style={{ fontSize: "13px", color: "var(--n-text-secondary)" }}>
                            {product.producerName}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "right" }}>
                          {product.juryScore !== null ? (
                            <span className="n-font-data" style={{ fontSize: "14px", color: "var(--n-text-display)" }}>
                              {product.juryScore}
                            </span>
                          ) : (
                            <span style={{ color: "var(--n-text-disabled)" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "right" }}>
                          {product.finalScore !== null ? (
                            <span className="n-font-data" style={{ fontSize: "14px", color: "var(--n-accent)" }}>
                              {product.finalScore.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--n-text-disabled)" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                            {diffIndicator ? (
                              <span
                                className="n-font-data"
                                style={{ fontSize: "13px", color: diffIndicator.color }}
                              >
                                {diffIndicator.label}
                              </span>
                            ) : (
                              <span style={{ color: "var(--n-text-disabled)" }}>-</span>
                            )}
                            <span style={{ color: "var(--n-text-disabled)", fontSize: "12px" }}>
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <ProductDetailRow
                          key={`detail-${product.productId}`}
                          productId={product.productId}
                          cupId={resolvedParams.cupId}
                        />
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Summary Card */}
      <div className="n-card" style={{ padding: "24px" }}>
        <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "24px" }}>
          RÉSUMÉ DE VOTRE CONTRIBUTION
        </p>
        <div style={{ display: "grid", gap: "32px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {/* Alignment score ring */}
          <div>
            <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "16px", fontSize: "10px" }}>
              SCORE D'ALIGNEMENT
            </p>
            {data.stats.alignmentScore !== null ? (
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{ position: "relative", width: "96px", height: "96px", flexShrink: 0 }}>
                  <svg
                    style={{ width: "96px", height: "96px", transform: "rotate(-90deg)" }}
                    viewBox="0 0 100 100"
                  >
                    <circle
                      stroke="var(--n-border)"
                      strokeWidth="8"
                      fill="none"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      stroke="var(--n-text-display)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                      r="40"
                      cx="50"
                      cy="50"
                      strokeDasharray={`${data.stats.alignmentScore * 2.51} 251`}
                      style={{ transition: "stroke-dasharray 0.5s" }}
                    />
                  </svg>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span className="n-font-data" style={{ fontSize: "20px", color: "var(--n-text-display)" }}>
                      {data.stats.alignmentScore}%
                    </span>
                  </div>
                </div>
                <p className="n-font-body" style={{ fontSize: "13px", color: "var(--n-text-secondary)" }}>
                  {data.stats.alignmentScore >= 80 && "Excellent alignement avec le consensus."}
                  {data.stats.alignmentScore >= 60 && data.stats.alignmentScore < 80 && "Bon alignement avec les autres jurys."}
                  {data.stats.alignmentScore >= 40 && data.stats.alignmentScore < 60 && "Alignement modéré, votre vision est unique."}
                  {data.stats.alignmentScore < 40 && "Votre évaluation diffère significativement du consensus."}
                </p>
              </div>
            ) : (
              <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px" }}>
                Pas assez de données pour calculer l'alignement.
              </p>
            )}
          </div>

          {/* Tendance */}
          <div>
            <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "16px", fontSize: "10px" }}>
              TENDANCE DE NOTATION
            </p>
            {data.stats.averageDifference !== null ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: data.stats.averageDifference > 2
                      ? "#4A90D9"
                      : data.stats.averageDifference < -2
                        ? "#D4843A"
                        : "var(--n-text-disabled)",
                  }} />
                  <span className="n-font-body" style={{ fontSize: "14px", color: "var(--n-text-primary)" }}>
                    {data.stats.averageDifference > 2
                      ? "Plus généreux que la moyenne"
                      : data.stats.averageDifference < -2
                        ? "Plus exigeant que la moyenne"
                        : "Notes très proches de la moyenne"}
                  </span>
                </div>
                <p className="n-font-body" style={{ fontSize: "13px", color: "var(--n-text-disabled)" }}>
                  En moyenne,{" "}
                  <span className="n-font-data" style={{ color: "var(--n-text-secondary)" }}>
                    {Math.abs(data.stats.averageDifference).toFixed(1)} pts
                  </span>{" "}
                  {data.stats.averageDifference > 0 ? "au-dessus" : "en-dessous"} du score final.
                </p>
              </div>
            ) : (
              <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px" }}>
                Pas assez de données pour déterminer la tendance.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Back button at bottom */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px" }}>
        <Link href="/jury/dashboard">
          <button className="n-btn-ghost">
            &lt; Retour au tableau de bord
          </button>
        </Link>
      </div>
    </div>
  );
}
