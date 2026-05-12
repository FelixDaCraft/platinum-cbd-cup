"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

/**
 * Post-rating choice modal — Nothing design system.
 *
 * IMPORTANT: Radix Dialog portals to document.body, OUTSIDE the
 * `.nothing-jury` wrapper. That means the `--n-*` CSS vars and the
 * `.n-btn-*` utility classes defined under `.nothing-jury` are NOT
 * inherited here. Every visual property therefore has to be inlined
 * with hardcoded values pulled from the Nothing design tokens
 * (see references/tokens.md + components.md):
 *
 *  - Backdrop:    rgba(0,0,0,0.8)
 *  - Dialog bg:   #111111 (--surface)
 *  - Border:      1px solid #333333 (--border-visible)
 *  - Radius:      16px
 *  - Max width:   480px
 *  - Buttons:     Space Mono 13px UPPERCASE, letter-spacing 0.06em,
 *                 padding 12px 24px, min-height 44px, radius 999px
 *    Primary:     bg #FFFFFF, color #000000, no border
 *    Secondary:   transparent, color #E8E8E8, 1px solid #333333
 */

const TOKENS = {
  black: "#000000",
  surface: "#111111",
  borderVisible: "#333333",
  textPrimary: "#E8E8E8",
  textSecondary: "#999999",
  textDisplay: "#FFFFFF",
  success: "#4A9E5C",
  warning: "#D4A843",
} as const;

const MONO = "'Space Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS =
  "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif";

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

  let title: string;
  let description: string;

  if (mode === "submitted") {
    if (allComplete) {
      title = "TOUTES LES NOTATIONS TERMINEES";
      description =
        "Vous avez note tous vos produits assignes. Excellente contribution.";
    } else if (allCategoryComplete) {
      title = "CATEGORIE TERMINEE";
      description =
        "Toutes vos notations pour cette categorie sont enregistrees.";
    } else {
      title = "NOTATION SOUMISE";
      description = "Votre notation a bien ete enregistree et verrouillee.";
    }
  } else {
    title = "BROUILLON ENREGISTRE";
    description =
      "Votre progression est sauvegardee. Vous pouvez reprendre plus tard.";
  }

  const showNextProduct =
    mode === "submitted" && !!nextProductId && !allComplete;
  const showDashboard =
    mode === "submitted" && (allComplete || allCategoryComplete);

  const goCategory = () => {
    onClose();
    router.push(`/jury/cups/${cupId}/category/${categoryId}`);
  };
  const goNextProduct = () => {
    if (!nextProductId) return;
    onClose();
    router.push(`/jury/rate/${cupId}/product/${nextProductId}`);
  };
  const goDashboard = () => {
    onClose();
    router.push("/jury/dashboard");
  };

  const dotColor = mode === "submitted" ? TOKENS.success : TOKENS.warning;
  const labelText = mode === "submitted" ? "SOUMIS" : "BROUILLON";

  const labelStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: "10.5px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: dotColor,
    fontWeight: 500,
  };

  return (
    <>
      {/* Keyframes registered globally — outside the portal so they remain
          available even after the dialog unmounts. */}
      <style>{`
        @keyframes nModalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes nModalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-slot-post-rating-content],
          [data-slot-post-rating-overlay] {
            animation: none !important;
          }
        }
      `}</style>
      <DialogPrimitive.Root open={open}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-slot-post-rating-overlay=""
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              backgroundColor: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              animation: "nModalFadeIn 180ms ease-out both",
            }}
          />

          <DialogPrimitive.Content
            data-slot-post-rating-content=""
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
              maxWidth: "480px",
              backgroundColor: TOKENS.surface,
              border: `1px solid ${TOKENS.borderVisible}`,
              borderRadius: "16px",
              padding: "32px",
              outline: "none",
              animation:
                "nModalIn 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            {/* Title MUST be the first child so Radix's accessibility check
                finds it on the first render walk. Status (success/warning)
                is encoded by the small colored mono label directly underneath
                the title — keeps type doing the hierarchy work. */}
            <DialogPrimitive.Title
              id="post-rating-title"
              style={{
                fontFamily: MONO,
                fontSize: "18px",
                fontWeight: 700,
                color: TOKENS.textDisplay,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                margin: 0,
                marginBottom: "8px",
                lineHeight: 1.25,
              }}
            >
              {title}
            </DialogPrimitive.Title>

            {/* Status sub-label — colored mono caption */}
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
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: dotColor,
                  boxShadow: `0 0 6px ${dotColor}`,
                  flexShrink: 0,
                }}
              />
              <span style={labelStyle}>{labelText}</span>
            </div>

          {/* Description */}
          <DialogPrimitive.Description
            id="post-rating-desc"
            style={{
              fontFamily: SANS,
              fontSize: "14px",
              color: TOKENS.textSecondary,
              lineHeight: 1.55,
              margin: 0,
              marginBottom: "32px",
            }}
          >
            {description}
          </DialogPrimitive.Description>

          {/* Actions — stacked, primary on top */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {showNextProduct && nextProductId && (
              <PrimaryBtn onClick={goNextProduct}>PRODUIT SUIVANT</PrimaryBtn>
            )}
            {showDashboard && (
              <PrimaryBtn onClick={goDashboard}>
                VOIR LE TABLEAU DE BORD
              </PrimaryBtn>
            )}
            <SecondaryBtn onClick={goCategory}>
              RETOUR A LA CATEGORIE
            </SecondaryBtn>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  );
}

const baseBtnStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "13px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "12px 24px",
  minHeight: "44px",
  borderRadius: "999px",
  cursor: "pointer",
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out",
};

function PrimaryBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...baseBtnStyle,
        background: TOKENS.textDisplay,
        color: TOKENS.black,
        border: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#E8E8E8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = TOKENS.textDisplay;
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...baseBtnStyle,
        background: "transparent",
        color: TOKENS.textPrimary,
        border: `1px solid ${TOKENS.borderVisible}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = TOKENS.textPrimary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = TOKENS.borderVisible;
      }}
    >
      {children}
    </button>
  );
}
