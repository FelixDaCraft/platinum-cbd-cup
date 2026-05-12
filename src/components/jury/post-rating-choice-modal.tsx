"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

export interface PostRatingChoiceModalProps {
  open: boolean;
  mode: "submitted" | "draft";
  cupId: string;
  categoryId: string;
  nextProductId: string | null;
  allCategoryComplete: boolean;
  allComplete: boolean;
  onClose: () => void;
}

export function PostRatingChoiceModal({
  open,
  mode,
  cupId,
  categoryId,
  nextProductId,
  allCategoryComplete,
  allComplete,
  onClose,
}: PostRatingChoiceModalProps) {
  const router = useRouter();

  // Determine title and description based on state
  let title: string;
  let description: string;

  if (mode === "submitted") {
    if (allComplete) {
      title = "TOUTES LES NOTATIONS TERMINÉES";
      description =
        "Vous avez noté tous vos produits assignés. Excellente contribution !";
    } else if (allCategoryComplete) {
      title = "CATÉGORIE TERMINÉE";
      description =
        "Toutes vos notations pour cette catégorie sont enregistrées.";
    } else {
      title = "NOTATION SOUMISE";
      description = "Votre notation a bien été enregistrée et verrouillée.";
    }
  } else {
    title = "BROUILLON ENREGISTRÉ";
    description =
      "Votre progression est sauvegardée. Vous pouvez reprendre plus tard.";
  }

  // Determine primary CTA destination
  const showNextProduct =
    mode === "submitted" && !!nextProductId && !allComplete;
  const showDashboard = mode === "submitted" && (allComplete || allCategoryComplete);

  const handleCategoryBack = () => {
    onClose();
    router.push(`/jury/cups/${cupId}/category/${categoryId}`);
  };

  const handleNextProduct = () => {
    if (!nextProductId) return;
    onClose();
    router.push(`/jury/rate/${cupId}/product/${nextProductId}`);
  };

  const handleDashboard = () => {
    onClose();
    router.push("/jury/dashboard");
  };

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        {/* Overlay — blur + semi-transparent */}
        <DialogPrimitive.Overlay
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0,0,0,0.68)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        />

        {/* Modal content */}
        <DialogPrimitive.Content
          aria-labelledby="post-rating-title"
          aria-describedby="post-rating-desc"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 101,
            width: "calc(100% - 32px)",
            maxWidth: "460px",
            backgroundColor: "var(--n-surface-raised)",
            border: "1px solid var(--n-border-visible)",
            borderRadius: "14px",
            padding: "32px",
            boxShadow:
              "0 24px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)",
            outline: "none",
          }}
          // Radix animate-in/out via data-[state] attrs — handled by CSS below
        >
          {/* Style block scoped to this modal via a wrapper div */}
          <style>{`
            [data-radix-dialog-content] {
              animation: nModalIn 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            [data-radix-dialog-content][data-state="closed"] {
              animation: nModalOut 120ms ease-in both;
            }
            @keyframes nModalIn {
              from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
              to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes nModalOut {
              from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              to   { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-radix-dialog-content],
              [data-radix-dialog-content][data-state="closed"] {
                animation: none;
              }
            }
          `}</style>

          {/* Status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background:
                  mode === "submitted"
                    ? "var(--n-success)"
                    : "var(--n-warning)",
                flexShrink: 0,
              }}
            />
            <span
              className="n-label"
              style={{
                color:
                  mode === "submitted"
                    ? "var(--n-success)"
                    : "var(--n-warning)",
              }}
            >
              {mode === "submitted" ? "SOUMIS" : "BROUILLON"}
            </span>
          </div>

          {/* Title */}
          <DialogPrimitive.Title
            id="post-rating-title"
            className="n-font-data"
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: "10px",
            }}
          >
            {title}
          </DialogPrimitive.Title>

          {/* Description */}
          <DialogPrimitive.Description
            id="post-rating-desc"
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              lineHeight: 1.55,
              margin: 0,
              marginBottom: "32px",
            }}
          >
            {description}
          </DialogPrimitive.Description>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Primary CTA */}
            {showNextProduct && nextProductId && (
              <button
                className="n-btn-primary"
                onClick={handleNextProduct}
                style={{ width: "100%" }}
              >
                PRODUIT SUIVANT
              </button>
            )}
            {showDashboard && (
              <button
                className="n-btn-primary"
                onClick={handleDashboard}
                style={{ width: "100%" }}
              >
                VOIR LE TABLEAU DE BORD
              </button>
            )}

            {/* Secondary — always visible for submit mode; for draft it's the only CTA besides the implicit "stay" */}
            <button
              className="n-btn-secondary"
              onClick={handleCategoryBack}
              style={{ width: "100%" }}
            >
              RETOUR À LA CATÉGORIE
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
