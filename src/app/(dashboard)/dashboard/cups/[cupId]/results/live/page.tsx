"use client";

import { useParams } from "next/navigation";

import { api } from "~/trpc/react";
import {
  GlobalProgress,
  CategoryProgress,
  JuryProgress,
  LiveLeaderboard,
} from "~/components/features/cups/scoring";

export default function LiveTrackingPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const { data: cup, isLoading } = api.cup.getById.useQuery({ id: cupId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            letterSpacing: "0.08em",
            color: "var(--n-text-disabled)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  const isRatingPhase = cup.status === "rating" || cup.status === "completed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: "'Doto', 'Space Mono', monospace",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--n-text-display)",
            marginBottom: "4px",
          }}
        >
          SUIVI EN DIRECT
        </h1>
        <p className="n-label">Progression de la notation en temps réel</p>
      </div>

      {!isRatingPhase ? (
        <div
          className="n-card"
          style={{ textAlign: "center", padding: "48px 24px" }}
        >
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-secondary)",
              marginBottom: "8px",
            }}
          >
            [NOTATION NON DÉMARRÉE]
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--n-text-disabled)",
              maxWidth: "480px",
              margin: "0 auto",
            }}
          >
            Le suivi en direct sera disponible une fois la phase de notation
            lancée. Configurez les dates dans la section Configuration ou
            changez manuellement le statut de la cup.
          </p>
        </div>
      ) : (
        <>
          {/* Global Progress */}
          <GlobalProgress cupId={cupId} />

          {/* Category & Jury Progress - Grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryProgress cupId={cupId} />
            <JuryProgress cupId={cupId} />
          </div>

          {/* Live Leaderboard */}
          <LiveLeaderboard cupId={cupId} />
        </>
      )}
    </div>
  );
}
