"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";

export default function PortalJuryCupPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const utils = api.useUtils();

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
      toast.success("Réception des échantillons confirmée");
      void utils.jury.getMyJuryCup.invalidate({ cupId });
    },
    onError: (err) => {
      toast.error(err.message);
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
          <Link href="/jury">
            <button className="n-btn-secondary">Retour au dashboard</button>
          </Link>
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
          <p className="n-label" style={{ marginBottom: "8px" }}>CONFIRMATION REQUISE</p>
          <h1 className="n-font-body" style={{ color: "var(--n-text-display)", fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>
            Confirmation de réception
          </h1>
          <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            Avant de commencer à noter, confirmez avoir reçu vos échantillons pour{" "}
            <span style={{ color: "var(--n-text-primary)", fontWeight: 500 }}>{cup.name}</span>
          </p>

          {/* Org */}
          <div style={{ borderBottom: "1px solid var(--n-border)", paddingBottom: "20px", marginBottom: "20px" }}>
            <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "13px" }}>
              Organisé par{" "}
              <span style={{ color: "var(--n-text-primary)" }}>Platinum CBD Cup</span>
            </p>
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: "24px" }}>
            <p className="n-label" style={{ marginBottom: "12px" }}>AVANT DE CONFIRMER</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                "Vous avez bien reçu tous vos échantillons",
                "Les échantillons sont en bon état",
                "Vous êtes prêt à commencer la notation",
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
              <p className="n-label" style={{ marginBottom: "10px" }}>CATÉGORIES À NOTER</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                {jury.categoryAssignments.map((cat) => (
                  <span key={cat.id} className="n-tag">{cat.categoryName}</span>
                ))}
              </div>
              <p className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "11px", letterSpacing: "0.08em" }}>
                {totalProductsToRate} PRODUIT{totalProductsToRate !== 1 ? "S" : ""} À NOTER
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
            {confirmMutation.isPending ? "[CONFIRMATION...]" : "Je confirme avoir reçu mes échantillons"}
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
              <span className="n-tag accent">TERMINÉ</span>
            ) : isDeadlineNear ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span
                  className="n-font-data"
                  style={{ fontSize: "36px", lineHeight: 1, color: "var(--n-warning)", fontWeight: 700 }}
                >
                  {daysRemaining}
                </span>
                <span className="n-label" style={{ color: "var(--n-warning)" }}>
                  JOUR{daysRemaining !== 1 ? "S" : ""} RESTANT{daysRemaining !== 1 ? "S" : ""}
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
                  JOUR{daysRemaining !== 1 ? "S" : ""} RESTANT{daysRemaining !== 1 ? "S" : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deadline banners */}
      {isDeadlinePassed && (
        <p className="n-font-body" style={{ color: "var(--n-accent)", fontSize: "14px", fontWeight: 500 }}>
          Phase de notation terminée. La date limite est passée, vous ne pouvez plus modifier vos notations.
        </p>
      )}

      {isDeadlineNear && !isDeadlinePassed && (
        <p className="n-font-body" style={{ color: "var(--n-warning)", fontSize: "14px", fontWeight: 500 }}>
          Date limite proche — il vous reste {daysRemaining} jour{daysRemaining !== 1 ? "s" : ""} pour terminer vos notations.
        </p>
      )}

      {/* Progress card */}
      <div className="n-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p className="n-label">VOTRE PROGRESSION</p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="n-tag success">ÉCHANTILLONS REÇUS</span>
            {progressPercent === 100 && (
              <span className="n-tag success">TERMINÉ</span>
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
          <p className="n-label">PRODUITS NOTÉS</p>
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
            DATE LIMITE :{" "}
            {new Date(cup.ratingEndDate).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).toUpperCase()}
          </p>
        )}
      </div>

      {/* Categories */}
      <div>
        <p className="n-label" style={{ marginBottom: "12px" }}>CATÉGORIES À NOTER</p>

        {jury.categoryAssignments.length === 0 ? (
          <div className="n-card" style={{ padding: "32px", textAlign: "center" }}>
            <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px", marginBottom: "4px" }}>
              Aucune catégorie assignée
            </p>
            <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px" }}>
              L&apos;organisateur doit vous assigner des catégories
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
