"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { api } from "~/trpc/react";

export default function PortalCategoryProductsPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const categoryId = params.categoryId as string;

  // Reuse getMyJuryCup query
  const {
    data,
    isLoading,
    error,
  } = api.jury.getMyJuryCup.useQuery(
    { cupId },
    { refetchOnWindowFocus: true }
  );

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
          [LOADING...]
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
          <p className="n-font-data" style={{ color: "var(--n-accent)", fontSize: "12px", letterSpacing: "0.1em", marginBottom: "12px" }}>
            [ERROR]
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
            Accès refusé
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            {error.message}
          </p>
          <Link href={`/jury/cups/${cupId}`}>
            <button className="n-btn-secondary">Retour</button>
          </Link>
        </div>
      </div>
    );
  }

  const { cup, jury, productsToRate } = data!;

  // Find the category assignment
  const categoryAssignment = jury.categoryAssignments.find(
    (a) => a.categoryId === categoryId
  );

  if (!categoryAssignment) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
          <p className="n-font-data" style={{ color: "var(--n-accent)", fontSize: "12px", letterSpacing: "0.1em", marginBottom: "12px" }}>
            [ERROR]
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
            Catégorie non trouvée
          </p>
          <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            Vous n&apos;êtes pas assigné à cette catégorie
          </p>
          <Link href={`/jury/cups/${cupId}`}>
            <button className="n-btn-secondary">Retour</button>
          </Link>
        </div>
      </div>
    );
  }

  // Filter products for this category
  const categoryProducts = productsToRate.filter(
    (p) => p.categoryId === categoryId
  );
  const ratedCount = categoryProducts.filter((p) => p.isRated).length;
  const totalSegments = Math.max(categoryProducts.length, 1);

  const daysRemaining = getDaysRemaining(cup.ratingEndDate);
  const isDeadlinePassed = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Back button */}
        <Link href={`/jury/cups/${cupId}`} style={{ textDecoration: "none", flexShrink: 0 }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--n-surface)",
              border: "1px solid var(--n-border-visible)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "16px", lineHeight: 1 }}>
              ‹
            </span>
          </div>
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="n-label" style={{ marginBottom: "2px" }}>{cup.name}</p>
          <h1
            className="n-font-body"
            style={{
              color: "var(--n-text-display)",
              fontSize: "22px",
              fontWeight: 600,
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {categoryAssignment.categoryName}
          </h1>
        </div>

        {daysRemaining !== null && (
          <div style={{ flexShrink: 0 }}>
            {isDeadlinePassed ? (
              <span className="n-tag accent">TERMINÉ</span>
            ) : daysRemaining <= 3 ? (
              <span className="n-tag warning">{daysRemaining}J</span>
            ) : (
              <span className="n-tag">{daysRemaining}J</span>
            )}
          </div>
        )}
      </div>

      {/* Deadline warning */}
      {isDeadlinePassed && (
        <p className="n-font-body" style={{ color: "var(--n-accent)", fontSize: "14px", fontWeight: 500 }}>
          Phase de notation terminée. Vous ne pouvez plus modifier vos notations.
        </p>
      )}

      {/* Progress card */}
      <div className="n-card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <p
              className="n-font-body"
              style={{
                color: ratedCount === categoryProducts.length && categoryProducts.length > 0
                  ? "var(--n-success)"
                  : "var(--n-text-primary)",
                fontSize: "28px",
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: "4px",
              }}
            >
              {ratedCount} / {categoryProducts.length}
            </p>
            <p className="n-label">PRODUITS NOTÉS</p>
          </div>
          {ratedCount === categoryProducts.length && categoryProducts.length > 0 && (
            <span className="n-tag success">TERMINÉ</span>
          )}
        </div>
        <div className="n-progress-bar">
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div
              key={i}
              className={`n-progress-segment${i < ratedCount ? " filled" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* Products list */}
      <div>
        <p className="n-label" style={{ marginBottom: "12px" }}>PRODUITS À NOTER</p>

        {categoryProducts.length === 0 ? (
          <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
            <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
              Aucun produit dans cette catégorie
            </p>
          </div>
        ) : (
          <div>
            {categoryProducts.map((product, idx) => {
              // Determine product state
              const getProductState = () => {
                if (product.isRated) return "rated";
                if (product.hasDraft) return "draft";
                return "pending";
              };
              const state = getProductState();
              const isDisabled = isDeadlinePassed && !product.isRated;

              const stateColor =
                state === "rated"
                  ? "var(--n-success)"
                  : state === "draft"
                  ? "var(--n-warning)"
                  : "var(--n-text-disabled)";

              const stateLabel =
                state === "rated"
                  ? "NOTE SOUMISE"
                  : state === "draft"
                  ? "BROUILLON"
                  : "À NOTER";

              return (
                <Link
                  key={product.id}
                  href={isDisabled ? "#" : `/jury/rate/${cupId}/product/${product.id}`}
                  style={{ textDecoration: "none" }}
                  onClick={(e) => {
                    if (isDisabled) e.preventDefault();
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px 0",
                      borderTop: idx === 0 ? "1px solid var(--n-border-visible)" : "1px solid var(--n-border)",
                      borderBottom: idx === categoryProducts.length - 1 ? "1px solid var(--n-border-visible)" : "none",
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {/* Anonymous code */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="n-font-data"
                        style={{
                          color: "var(--n-text-display)",
                          fontSize: "20px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          marginBottom: "3px",
                        }}
                      >
                        {product.anonymousCode ?? `#${product.id.slice(0, 4).toUpperCase()}`}
                      </p>
                      <p
                        className="n-font-data"
                        style={{
                          color: stateColor,
                          fontSize: "11px",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {stateLabel}
                      </p>
                    </div>

                    {/* Chevron */}
                    {!isDisabled && (
                      <span
                        className="n-font-body"
                        style={{ color: "var(--n-text-disabled)", fontSize: "16px", flexShrink: 0 }}
                      >
                        ›
                      </span>
                    )}
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
