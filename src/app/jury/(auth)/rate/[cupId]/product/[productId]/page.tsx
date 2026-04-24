"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { getMaxScoreForScale } from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";

export default function RatingPage() {
  const params = useParams();
  const router = useRouter();
  const cupId = params.cupId as string;
  const productId = params.productId as string;

  const utils = api.useUtils();

  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [comment, setComment] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<{ scores: Map<string, number>; comment: string } | null>(null);

  const localStorageKey = `rating-draft-${cupId}-${productId}`;

  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const { data, isLoading, error } = api.jury.getProductForRating.useQuery(
    { cupId, productId },
    {
      enabled: !!session?.user,
      retry: false,
    }
  );

  const { data: existingRating, isLoading: ratingLoading } =
    api.jury.getMyRating.useQuery(
      { cupId, productId },
      {
        enabled: !!session?.user && !!data,
      }
    );

  const submitMutation = api.jury.submitRating.useMutation({
    onSuccess: (result) => {
      if (result.submitted) {
        setIsSubmitted(true);
        void utils.jury.getMyJuryCup.invalidate({ cupId });
        void utils.jury.getMyRating.invalidate({ cupId, productId });
        localStorage.removeItem(localStorageKey);

        if (result.nextProductId) {
          toast.success("Notation soumise!", {
            description: "Passage au produit suivant...",
          });
          setTimeout(() => {
            router.push(`/jury/rate/${cupId}/product/${result.nextProductId}`);
          }, 1500);
        } else if (result.categoryComplete && !result.allComplete) {
          toast.success("Categorie terminee!", {
            description: "Vous avez note tous les produits de cette categorie.",
          });
          setTimeout(() => {
            router.push(`/jury/cups/${cupId}`);
          }, 2000);
        } else {
          toast.success("Toutes les notations terminees!", {
            description: "Vous avez note tous vos produits assignes.",
          });
          setTimeout(() => {
            router.push("/jury");
          }, 2000);
        }
      } else {
        toast.success("Brouillon sauvegarde");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const autoSaveMutation = api.jury.submitRating.useMutation({
    onSuccess: () => {
      setAutoSaveStatus("saved");
      setHasUnsavedChanges(false);
      lastSavedRef.current = { scores: new Map(scores), comment };
      saveToLocalStorage();
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    },
    onError: () => {
      setAutoSaveStatus("error");
      saveToLocalStorage();
    },
  });

  const saveToLocalStorage = useCallback(() => {
    if (scores.size === 0) return;
    const payload = {
      scores: Array.from(scores.entries()),
      comment,
      timestamp: Date.now(),
    };
    localStorage.setItem(localStorageKey, JSON.stringify(payload));
  }, [scores, comment, localStorageKey]);

  useEffect(() => {
    if (isSubmitted || existingRating) return;

    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const payload = JSON.parse(saved) as {
          scores: [string, number][];
          comment: string;
          timestamp: number;
        };
        if (Date.now() - payload.timestamp < 24 * 60 * 60 * 1000) {
          setScores(new Map(payload.scores));
          setComment(payload.comment);
          toast.info("Brouillon local restaure", {
            description: "Vos notes precedentes ont ete recuperees",
          });
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [localStorageKey, isSubmitted, existingRating]);

  useEffect(() => {
    if (isSubmitted || scores.size === 0) return;

    const hasChanges =
      lastSavedRef.current === null ||
      lastSavedRef.current.comment !== comment ||
      !mapsEqual(lastSavedRef.current.scores, scores);

    if (!hasChanges) return;

    setHasUnsavedChanges(true);

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      setAutoSaveStatus("saving");
      autoSaveMutation.mutate({
        cupId,
        productId,
        scores: Array.from(scores.entries()).map(([criterionId, score]) => ({
          criterionId,
          score,
        })),
        comment: comment || undefined,
        submit: false,
      });
    }, 300);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [scores, comment, isSubmitted, cupId, productId, autoSaveMutation]);

  function mapsEqual(map1: Map<string, number>, map2: Map<string, number>): boolean {
    if (map1.size !== map2.size) return false;
    for (const [key, value] of map1) {
      if (map2.get(key) !== value) return false;
    }
    return true;
  }

  useEffect(() => {
    if (existingRating) {
      const newScores = new Map<string, number>();
      existingRating.scores.forEach((s) => {
        newScores.set(s.criterionId, s.score);
      });
      setScores(newScores);
      setComment(existingRating.comment ?? "");
      setIsSubmitted(!!existingRating.submittedAt);
    }
  }, [existingRating]);

  const handleScoreChange = (criterionId: string, score: number) => {
    if (isSubmitted) return;
    setScores((prev) => {
      const newScores = new Map(prev);
      newScores.set(criterionId, score);
      return newScores;
    });
  };

  const handleSaveDraft = () => {
    if (scores.size === 0) {
      toast.error("Veuillez noter au moins un critere");
      return;
    }

    submitMutation.mutate({
      cupId,
      productId,
      scores: Array.from(scores.entries()).map(([criterionId, score]) => ({
        criterionId,
        score,
      })),
      comment: comment || undefined,
      submit: false,
    });
  };

  const handleSubmit = () => {
    if (!data) return;

    const allCriteria = data.criteria.map((c) => c.id);
    const missing = allCriteria.filter((id) => !scores.has(id));

    if (missing.length > 0) {
      toast.error(`Veuillez noter tous les criteres (${missing.length} manquant${missing.length > 1 ? "s" : ""})`);
      return;
    }

    submitMutation.mutate({
      cupId,
      productId,
      scores: Array.from(scores.entries()).map(([criterionId, score]) => ({
        criterionId,
        score,
      })),
      comment: comment || undefined,
      submit: true,
    });
  };

  const calculateAverage = () => {
    if (!data || scores.size === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    scores.forEach((score, criterionId) => {
      const criterion = data.criteria.find((c) => c.id === criterionId);
      const coefficient = criterion?.coefficient ?? 1;
      weightedSum += score * coefficient;
      totalWeight += coefficient;
    });

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  };

  // --- Loading state ---
  if (sessionLoading || (session?.user && (isLoading || ratingLoading))) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--n-black)",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            color: "var(--n-text-secondary)",
            letterSpacing: "0.1em",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  // --- Not logged in ---
  if (!session?.user) {
    const callbackUrl = `/jury/rate/${cupId}/product/${productId}`;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--n-black)",
          padding: "16px",
        }}
      >
        <div
          className="n-card"
          style={{ width: "100%", maxWidth: "400px", padding: "32px" }}
        >
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              color: "var(--n-text-secondary)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ACCES REQUIS
          </p>
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "14px",
              color: "var(--n-text-primary)",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Vous devez etre connecte pour acceder a l&apos;interface de notation.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="n-btn-primary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              SE CONNECTER
            </Link>
            <Link
              href="/"
              className="n-btn-ghost"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              RETOUR A L&apos;ACCUEIL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    const isUnauthorized = error.data?.code === "UNAUTHORIZED";
    const isForbidden = error.data?.code === "FORBIDDEN";
    const isPrecondition = error.data?.code === "PRECONDITION_FAILED";

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--n-black)",
          padding: "16px",
        }}
      >
        <div
          className="n-card"
          style={{ width: "100%", maxWidth: "400px", padding: "32px" }}
        >
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              color: isPrecondition ? "var(--n-warning)" : "var(--n-accent)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            {isUnauthorized && "CONNEXION REQUISE"}
            {isForbidden && "ACCES REFUSE"}
            {isPrecondition && "ECHANTILLONS NON CONFIRMES"}
            {!isUnauthorized && !isForbidden && !isPrecondition && "ERREUR"}
          </p>
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            {error.message}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {isPrecondition && (
              <Link
                href={`/jury/cups/${cupId}`}
                className="n-btn-primary"
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                CONFIRMER LA RECEPTION
              </Link>
            )}
            <Link
              href={`/jury/cups/${cupId}`}
              className="n-btn-ghost"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              RETOUR AU DASHBOARD
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { cup, product, criteria } = data;
  const maxScore = getMaxScoreForScale((cup.ratingScale ?? "0-10") as RatingScale);
  const minScore = 1;
  const scoreOptions = Array.from(
    { length: maxScore - minScore + 1 },
    (_, i) => minScore + i
  );
  const scoredCount = scores.size;
  const totalCount = criteria.length;
  const allScored = scoredCount === totalCount;
  const currentAverage = calculateAverage();
  const anonymousCode = product.anonymousCode ?? `#${product.id.slice(0, 4).toUpperCase()}`;

  // Auto-save status label
  const autoSaveLabel =
    autoSaveStatus === "saving"
      ? "[SAVING...]"
      : autoSaveStatus === "saved"
        ? "[SAVED]"
        : autoSaveStatus === "error"
          ? "[ERROR]"
          : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--n-black)",
        paddingBottom: "48px",
      }}
    >
      {/* Sticky anonymous code banner */}
      <div
        style={{
          position: "sticky",
          top: "48px",
          zIndex: 40,
          background: "var(--n-black)",
          borderBottom: "1px solid var(--n-border)",
          padding: "20px 24px",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <div
            style={{
              fontFamily: "'Doto', monospace",
              fontSize: "48px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              letterSpacing: "0.08em",
              lineHeight: 1,
            }}
          >
            {anonymousCode}
          </div>
          <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="n-label">{product.categoryName}</span>
            {isSubmitted && (
              <span
                className="n-font-data"
                style={{
                  fontSize: "11px",
                  color: "var(--n-success)",
                  letterSpacing: "0.1em",
                }}
              >
                [SUBMITTED]
              </span>
            )}
            {!isSubmitted && autoSaveLabel && (
              <span
                className="n-font-data"
                style={{
                  fontSize: "11px",
                  color:
                    autoSaveStatus === "error"
                      ? "var(--n-accent)"
                      : autoSaveStatus === "saved"
                        ? "var(--n-success)"
                        : "var(--n-text-secondary)",
                  letterSpacing: "0.1em",
                }}
              >
                {autoSaveLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {/* Back link + cup info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
          }}
        >
          <Link
            href={`/jury/cups/${cupId}`}
            className="n-btn-ghost"
            style={{ textDecoration: "none", fontSize: "11px" }}
          >
            &lt; RETOUR
          </Link>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "11px",
                color: "var(--n-text-secondary)",
                letterSpacing: "0.08em",
              }}
            >
              {cup.name}
            </p>
            <p
              className="n-label"
              style={{ marginTop: "2px" }}
            >
              Platinum CBD Cup
            </p>
          </div>
        </div>

        {/* Already submitted notice */}
        {isSubmitted && (
          <div
            style={{
              borderTop: "1px solid var(--n-border-visible)",
              borderBottom: "1px solid var(--n-border-visible)",
              padding: "12px 0",
              marginBottom: "32px",
            }}
          >
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "11px",
                color: "var(--n-success)",
                letterSpacing: "0.1em",
              }}
            >
              [SUBMITTED] — Les modifications ne sont plus possibles.
            </p>
          </div>
        )}

        {/* Progress header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "16px",
              fontWeight: 500,
              color: "var(--n-text-primary)",
            }}
          >
            Notation
          </p>
          <span className="n-label">
            {scoredCount} / {totalCount} CRITERE{totalCount !== 1 ? "S" : ""}
          </span>
        </div>

        {/* Criteria rows */}
        {criteria.length === 0 && (
          <div
            style={{
              borderTop: "1px solid var(--n-border)",
              borderBottom: "1px solid var(--n-border)",
              padding: "40px 0",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "11px",
                color: "var(--n-text-secondary)",
                letterSpacing: "0.1em",
              }}
            >
              AUCUN CRITERE CONFIGURE
            </p>
            <p
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "13px",
                color: "var(--n-text-disabled)",
                marginTop: "8px",
              }}
            >
              L&apos;organisateur doit configurer les criteres de notation
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {criteria.map((criterion, index) => {
            const currentScore = scores.get(criterion.id);

            return (
              <div
                key={criterion.id}
                style={{
                  borderTop: index === 0 ? "1px solid var(--n-border)" : "none",
                  borderBottom: "1px solid var(--n-border)",
                  padding: "20px 0",
                }}
              >
                {/* Criterion header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    marginBottom: criterion.description ? "6px" : "16px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "var(--n-text-primary)",
                    }}
                  >
                    {index + 1}. {criterion.name}
                  </span>
                  <span
                    className="n-label"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    x{criterion.coefficient}
                  </span>
                  {currentScore !== undefined && (
                    <span
                      className="n-font-data"
                      style={{
                        marginLeft: "auto",
                        fontSize: "12px",
                        color: "var(--n-text-secondary)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {currentScore}/{maxScore}
                    </span>
                  )}
                </div>

                {criterion.description && (
                  <p
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "12px",
                      color: "var(--n-text-disabled)",
                      marginBottom: "16px",
                      lineHeight: 1.5,
                    }}
                  >
                    {criterion.description}
                  </p>
                )}

                {/* Score buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {scoreOptions.map((score) => {
                    const isSelected = currentScore === score;
                    return (
                      <button
                        key={score}
                        onClick={() => handleScoreChange(criterion.id, score)}
                        disabled={isSubmitted || submitMutation.isPending}
                        style={{
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Space Mono', monospace",
                          fontSize: "13px",
                          fontWeight: isSelected ? 700 : 400,
                          border: `1px solid ${isSelected ? "var(--n-text-display)" : "var(--n-border-visible)"}`,
                          background: isSelected ? "var(--n-text-display)" : "transparent",
                          color: isSelected ? "var(--n-black)" : "var(--n-text-secondary)",
                          cursor: isSubmitted || submitMutation.isPending ? "not-allowed" : "pointer",
                          transition: "all 0.1s ease",
                          opacity: isSubmitted ? 0.6 : 1,
                        }}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Score summary */}
        {scoredCount > 0 && (
          <div
            style={{
              marginTop: "32px",
              padding: "24px 0",
              borderTop: "1px solid var(--n-border-visible)",
              borderBottom: "1px solid var(--n-border-visible)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontFamily: "'Doto', monospace",
                  fontSize: "48px",
                  fontWeight: 700,
                  color: "var(--n-text-display)",
                  lineHeight: 1,
                }}
              >
                {currentAverage}
              </span>
              <span className="n-label" style={{ fontSize: "13px" }}>
                /{maxScore}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "12px",
                  color: "var(--n-text-secondary)",
                }}
              >
                SCORE MOYEN PONDERE
              </span>
            </div>

            {/* Segmented progress bar */}
            <div
              className="n-progress-bar"
              style={{ display: "flex", gap: "2px" }}
            >
              {Array.from({ length: maxScore }, (_, i) => (
                <div
                  key={i}
                  className={`n-progress-segment${i < Math.round(currentAverage) ? " filled" : ""}`}
                  style={{ flex: 1 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        {criteria.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--n-text-primary)",
                }}
              >
                Commentaire{" "}
                <span
                  style={{ fontWeight: 400, color: "var(--n-text-secondary)" }}
                >
                  (optionnel)
                </span>
              </p>
              <span
                className="n-label"
                style={{
                  color:
                    comment.length >= 500
                      ? "var(--n-accent)"
                      : comment.length >= 450
                        ? "var(--n-warning)"
                        : undefined,
                }}
              >
                {comment.length}/500
              </span>
            </div>
            <textarea
              className="n-textarea"
              placeholder="Vos remarques sur ce produit..."
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              disabled={isSubmitted || submitMutation.isPending}
              style={{
                width: "100%",
                minHeight: "100px",
                resize: "none",
                opacity: isSubmitted ? 0.6 : 1,
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            marginTop: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {!isSubmitted && (
            <>
              <button
                className="n-btn-primary"
                onClick={handleSubmit}
                disabled={submitMutation.isPending || !allScored}
                style={{
                  opacity: submitMutation.isPending || !allScored ? 0.5 : 1,
                  cursor: submitMutation.isPending || !allScored ? "not-allowed" : "pointer",
                }}
              >
                {submitMutation.isPending && submitMutation.variables?.submit
                  ? "[SUBMITTING...]"
                  : "VALIDER LA NOTATION"}
              </button>
              <button
                className="n-btn-secondary"
                onClick={handleSaveDraft}
                disabled={submitMutation.isPending || scores.size === 0}
                style={{
                  opacity: submitMutation.isPending || scores.size === 0 ? 0.5 : 1,
                  cursor: submitMutation.isPending || scores.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                {submitMutation.isPending && !submitMutation.variables?.submit
                  ? "[SAVING...]"
                  : "SAUVEGARDER LE BROUILLON"}
              </button>
            </>
          )}
          <Link
            href={`/jury/cups/${cupId}`}
            className="n-btn-ghost"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            ANNULER
          </Link>
        </div>

        {/* Progress indicator */}
        {data.progress && (
          <div
            style={{
              marginTop: "48px",
              paddingTop: "24px",
              borderTop: "1px solid var(--n-border)",
              textAlign: "center",
            }}
          >
            <p
              className="n-label"
              style={{ fontSize: "11px", letterSpacing: "0.15em" }}
            >
              PRODUIT {data.progress.current} / {data.progress.total}
            </p>
            <p
              className="n-label"
              style={{
                marginTop: "4px",
                color: "var(--n-text-disabled)",
              }}
            >
              {data.progress.rated} NOTE{data.progress.rated !== 1 ? "S" : ""} SOUMISE{data.progress.rated !== 1 ? "S" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
