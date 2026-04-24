"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";

// Nothing design tokens (inline since this page has no .nothing-jury parent wrapper)
const N = {
  black: "#000000",
  surface: "#111111",
  surfaceRaised: "#1A1A1A",
  border: "#222222",
  borderVisible: "#333333",
  textDisabled: "#666666",
  textSecondary: "#999999",
  textPrimary: "#E8E8E8",
  textDisplay: "#FFFFFF",
  accent: "#D71921",
  success: "#4A9E5C",
  warning: "#D4A843",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: N.black,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  fontFamily: "'Space Grotesk', sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "480px",
  background: N.surface,
  border: `1px solid ${N.borderVisible}`,
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: N.textSecondary,
};

const statRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: "10px",
  paddingBottom: "10px",
  borderBottom: `1px solid ${N.border}`,
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px 24px",
  background: N.textDisplay,
  color: N.black,
  border: "none",
  borderRadius: "999px",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "center",
  letterSpacing: "0.02em",
};

const btnSecondaryStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 24px",
  background: "transparent",
  color: N.textPrimary,
  border: `1px solid ${N.borderVisible}`,
  borderRadius: "999px",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  textAlign: "center",
};

export default function PublicJuryTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // Check session
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // Get token info
  const { data, isLoading, error } = api.jury.getPublicJuryTokenInfo.useQuery({ token });

  // Claim mutation
  const claimMutation = api.jury.claimPublicJuryToken.useMutation({
    onSuccess: (result) => {
      if (result.alreadyClaimed) {
        toast.info("Token déjà utilisé", {
          description: "Ce token a déjà été associé à votre compte",
        });
      } else {
        toast.success("Bienvenue!", {
          description: result.message,
        });
      }
      router.push(`/jury/cups/${result.cupId}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleClaim = () => {
    claimMutation.mutate({ token });
  };

  // Loading state
  if (isLoading || sessionLoading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ ...labelStyle, color: N.textDisabled }}>
              [CHARGEMENT...]
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const isNotFound = error.data?.code === "NOT_FOUND";
    const isExpired = error.data?.code === "BAD_REQUEST";

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div>
            <p style={{ ...labelStyle, color: N.accent, marginBottom: "8px" }}>
              {isNotFound ? "TOKEN INVALIDE" : isExpired ? "TOKEN EXPIRÉ" : "ERREUR"}
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textDisabled }}>
              {error.message}
            </p>
          </div>
          <Link href="/">
            <button style={btnSecondaryStyle}>
              Retour à l&apos;accueil
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Already claimed
  if (data.alreadyClaimed) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div>
            <p style={{ ...labelStyle, color: N.warning, marginBottom: "8px" }}>
              TOKEN DÉJÀ UTILISÉ
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textDisabled }}>
              Ce token a déjà été associé à un compte.
            </p>
          </div>

          {/* Cup info */}
          <div style={{ borderTop: `1px solid ${N.border}` }}>
            <div style={statRowStyle}>
              <span style={labelStyle}>CUP</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textPrimary }}>
                {data.cup?.name}
              </span>
            </div>
            <div style={{ ...statRowStyle, borderBottom: "none" }}>
              <span style={labelStyle}>CATÉGORIE</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: N.textPrimary }}>
                {data.category?.name}
              </span>
            </div>
          </div>

          {session?.user ? (
            <Link href={`/jury/cups/${data.cup?.id}`}>
              <button style={btnPrimaryStyle}>
                Accéder à ma notation
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button style={btnPrimaryStyle}>
                Se connecter
              </button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const callbackUrl = `/jury/public/${token}`;

  // Token valid - show claim UI
  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: "520px" }}>
        {/* Heading */}
        <div>
          <p style={{ ...labelStyle, color: N.textSecondary, marginBottom: "8px" }}>
            INVITATION JURY
          </p>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            color: N.textDisplay,
            marginBottom: "6px",
            lineHeight: 1.1,
          }}>
            DEVENEZ JURY PUBLIC
          </h1>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textSecondary }}>
            Participez à la notation de{" "}
            <span style={{ color: N.textPrimary, fontWeight: 600 }}>{data.cup?.name}</span>
          </p>
        </div>

        {/* Cup info stat rows */}
        <div>
          <div style={statRowStyle}>
            <span style={labelStyle}>CUP</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textPrimary }}>
              {data.cup?.name}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={labelStyle}>ORGANISATEUR</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: N.textPrimary }}>
              Platinum CBD Cup
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={labelStyle}>CATÉGORIE</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: N.textPrimary }}>
              {data.category?.name}
            </span>
          </div>
          <div style={{ ...statRowStyle, borderBottom: "none" }}>
            <span style={labelStyle}>EXPIRE LE</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: N.textSecondary }}>
              {new Date(data.token.expiresAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).toUpperCase()}
            </span>
          </div>
        </div>

        {/* What you can do */}
        <div style={{ borderTop: `1px solid ${N.border}`, paddingTop: "20px" }}>
          <p style={{ ...labelStyle, marginBottom: "12px" }}>EN UTILISANT CE TOKEN :</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: N.textSecondary }}>
              — Noter les produits de la catégorie{" "}
              <span style={{ color: N.textPrimary }}>{data.category?.name}</span>
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: N.textSecondary }}>
              — Contribuer aux résultats officiels de la cup
            </p>
          </div>
        </div>

        {/* Auth section */}
        {!session?.user ? (
          <div style={{
            border: `1px solid ${N.borderVisible}`,
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}>
            <p style={{ ...labelStyle, color: N.warning }}>
              CONNEXION REQUISE
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: N.textDisabled }}>
              Connectez-vous ou créez un compte pour continuer.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                <button style={btnSecondaryStyle}>
                  Se connecter
                </button>
              </Link>
              <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                <button style={btnPrimaryStyle}>
                  Créer un compte
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            border: `1px solid ${N.border}`,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={labelStyle}>CONNECTÉ</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: N.success }}>
              {session.user.email}
            </span>
          </div>
        )}

        {/* Claim button */}
        {session?.user ? (
          <button
            style={{
              ...btnPrimaryStyle,
              opacity: claimMutation.isPending ? 0.6 : 1,
              cursor: claimMutation.isPending ? "not-allowed" : "pointer",
            }}
            onClick={handleClaim}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? "[TRAITEMENT...]" : "Utiliser ce token et devenir jury"}
          </button>
        ) : (
          <p style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: "11px", color: N.textDisabled }}>
            VEUILLEZ VOUS CONNECTER POUR CONTINUER
          </p>
        )}
      </div>
    </div>
  );
}
