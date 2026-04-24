"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";

// ============================================================================
// Types
// ============================================================================

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
    totalMs: difference,
  };
}

type UrgencyLevel = "calm" | "warning" | "critical";

function getUrgencyLevel(timeLeft: TimeLeft): UrgencyLevel {
  if (timeLeft.days < 1 && timeLeft.hours < 12) {
    return "critical";
  }
  if (timeLeft.days < 3) {
    return "warning";
  }
  return "calm";
}

type RatingStatus = "not_started" | "active" | "ending_soon" | "closed";

function getRatingStatus(
  status: string,
  ratingStartAt: Date | null,
  ratingEndAt: Date | null,
  ratingsLockedAt: Date | null
): RatingStatus {
  const now = new Date();

  if (ratingsLockedAt || status === "completed") {
    return "closed";
  }

  if (status === "rating") {
    if (ratingEndAt) {
      const timeLeft = calculateTimeLeft(ratingEndAt);
      if (timeLeft.days < 3 && timeLeft.totalMs > 0) {
        return "ending_soon";
      }
      if (timeLeft.totalMs <= 0) {
        return "closed";
      }
    }
    return "active";
  }

  if (ratingStartAt && now < new Date(ratingStartAt)) {
    return "not_started";
  }

  if (ratingEndAt && now > new Date(ratingEndAt)) {
    return "closed";
  }

  if (ratingStartAt && now >= new Date(ratingStartAt)) {
    if (ratingEndAt) {
      const timeLeft = calculateTimeLeft(ratingEndAt);
      if (timeLeft.days < 3 && timeLeft.totalMs > 0) {
        return "ending_soon";
      }
    }
    return "active";
  }

  if (["draft", "published", "registration_closed"].includes(status)) {
    return "not_started";
  }

  return "active";
}

// ============================================================================
// Nothing Countdown Component — mechanical, tabular-nums, no flames
// ============================================================================

function NothingCountdown({
  targetDate,
  type,
}: {
  targetDate: Date;
  type: "opening" | "closing";
}) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.totalMs <= 0) return null;

  const urgency = type === "closing" ? getUrgencyLevel(timeLeft) : "calm";
  const isCritical = urgency === "critical";
  const isWarning = urgency === "warning";

  const valueColor = isCritical
    ? "var(--n-accent)"
    : isWarning
      ? "var(--n-warning)"
      : "var(--n-text-primary)";

  const label = type === "opening" ? "OUVRE DANS" : isCritical ? "URGENT" : isWarning ? "FIN BIENTOT" : "RESTE";

  return (
    <div
      style={{
        border: "1px solid var(--n-border-visible)",
        background: "var(--n-surface-raised)",
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <p
        className="n-label"
        style={{
          color: isCritical ? "var(--n-accent)" : "var(--n-text-secondary)",
          marginBottom: 8,
          display: "block",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2, fontFamily: "var(--font-space-mono)", fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: "-0.02em" }}>
          {String(timeLeft.days).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 14, color: "var(--n-text-disabled)", margin: "0 2px" }}>j</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: "-0.02em" }}>
          {String(timeLeft.hours).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 14, color: "var(--n-text-disabled)", margin: "0 2px" }}>h</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: "-0.02em" }}>
          {String(timeLeft.minutes).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 14, color: "var(--n-text-disabled)", margin: "0 2px" }}>m</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: "-0.02em" }}>
          {String(timeLeft.seconds).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 14, color: "var(--n-text-disabled)", marginLeft: 2 }}>s</span>
      </div>
    </div>
  );
}

// ============================================================================
// Segmented progress bar (Nothing style — no rounded fill)
// ============================================================================

function SegmentedProgress({ value, segments = 20 }: { value: number; segments?: number }) {
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="n-progress-bar" style={{ gap: 2 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn("n-progress-segment", i < filled ? "filled" : "")}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Stat cell (no colored backgrounds, big number + label)
// ============================================================================

function StatCell({
  value,
  label,
  accent,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRight: "1px solid var(--n-border)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        className="n-font-data"
        style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
          color: accent ? "var(--n-accent)" : "var(--n-text-display)",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </span>
      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function PortalJuryDashboardPage() {
  const organization = useOrganization();
  const theme = usePortalTheme();
  const router = useRouter();
  const utils = api.useUtils();

  const [invitationCode, setInvitationCode] = useState("");

  const { data: juryCups, isLoading } = api.jury.getMyJuryCups.useQuery();
  const { data: cupsWithResults } = api.jury.getCompletedCupsWithResults.useQuery();
  const { data: myStats } = api.jury.getMyStats.useQuery();

  const activateMutation = api.juryCodes.activate.useMutation({
    onSuccess: (result) => {
      toast.success("Code active!", {
        description: `Vous avez maintenant acces a ${result.categoriesCount} categorie${result.categoriesCount !== 1 ? "s" : ""}`,
      });
      setInvitationCode("");
      void utils.jury.getMyJuryCups.invalidate();
      router.push(`/jury/cups/${result.cupId}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleActivateCode = () => {
    const code = invitationCode.trim().toUpperCase();
    if (!code) {
      toast.error("Veuillez entrer un code");
      return;
    }
    activateMutation.mutate({ code });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <span
          className="n-font-data n-label"
          style={{ color: "var(--n-text-secondary)", fontSize: 13 }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  // Single-tenant: all cups belong to this org
  const orgCups = juryCups ?? [];
  const orgCupsWithResults = cupsWithResults ?? [];

  // Global stats
  const totalProducts = orgCups.reduce((acc, c) => acc + c.progress.total, 0);
  const ratedProducts = orgCups.reduce((acc, c) => acc + c.progress.rated, 0);
  const pendingProducts = totalProducts - ratedProducts;
  const globalPercentage = totalProducts > 0 ? Math.round((ratedProducts / totalProducts) * 100) : 0;

  // Separate cups by status
  const activeCups = orgCups.filter((c) => c.progress.percentage < 100);
  const completedCups = orgCups.filter((c) => c.progress.percentage === 100);

  // Pending products list
  const cupsWithPendingProducts = activeCups
    .filter((cup) => cup.progress.total - cup.progress.rated > 0)
    .map((cup) => ({
      cupId: cup.cupId,
      cupName: cup.cupName,
      pendingCount: cup.progress.total - cup.progress.rated,
      categories: cup.assignedCategories.map((cat) => cat.name),
    }))
    .slice(0, 5);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="nothing-jury" style={{ display: "flex", flexDirection: "column", gap: 48 }}>

      {/* ================================================================ */}
      {/* HEADER                                                            */}
      {/* ================================================================ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Org identity */}
        <div>
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt={organization.name}
              style={{ height: 32, width: "auto", objectFit: "contain", marginBottom: 8, filter: "brightness(0) invert(1) opacity(0.6)" }}
            />
          ) : null}
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
            {organization.name}
          </p>
          <h1
            className="n-font-body"
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: "var(--n-text-display)",
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            Espace Jury
          </h1>
        </div>

        {/* Global progress — big number left, segmented bar right */}
        {totalProducts > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                className="n-font-display"
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: "var(--n-text-display)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                }}
              >
                {globalPercentage}
              </span>
              <span
                className="n-font-data"
                style={{ fontSize: 20, color: "var(--n-text-secondary)", fontWeight: 400 }}
              >
                %
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <SegmentedProgress value={globalPercentage} segments={24} />
              <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                {ratedProducts} / {totalProducts} PRODUITS NOTES
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* QUICK STATS GRID                                                  */}
      {/* ================================================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          border: "1px solid var(--n-border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--n-surface)",
        }}
        className="responsive-stats-grid"
      >
        <StatCell
          value={pendingProducts}
          label="A NOTER"
          accent={pendingProducts > 0}
        />
        <StatCell
          value={myStats?.totalRatings ?? ratedProducts}
          label="NOTES SOUMISES"
        />
        <StatCell
          value={activeCups.length}
          label="CUPS ACTIVES"
        />
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className="n-font-data"
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              color: "var(--n-text-display)",
              letterSpacing: "-0.03em",
            }}
          >
            {orgCupsWithResults.length}
          </span>
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
            RESULTATS PUBLIES
          </span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN CONTENT — 2/3 left + 1/3 right                              */}
      {/* ================================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ============================================================== */}
        {/* LEFT COLUMN                                                     */}
        {/* ============================================================== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Pending products list */}
          {cupsWithPendingProducts.length > 0 && (
            <div className="n-card">
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--n-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 2 }}>
                    EVALUATIONS EN ATTENTE
                  </p>
                  <p
                    className="n-font-body"
                    style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
                  >
                    Prochains produits a noter
                  </p>
                </div>
                <span
                  className="n-tag"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--n-accent)",
                    color: "var(--n-accent)",
                  }}
                >
                  {pendingProducts} EN ATTENTE
                </span>
              </div>
              <div style={{ padding: "8px 0" }}>
                {cupsWithPendingProducts.map((item, idx) => (
                  <Link key={item.cupId} href={`/jury/cups/${item.cupId}`} style={{ display: "block", textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 20px",
                        borderBottom: idx < cupsWithPendingProducts.length - 1 ? "1px solid var(--n-border)" : "none",
                        transition: "background 0.15s",
                      }}
                      className="nothing-row-hover"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          className="n-font-data"
                          style={{
                            fontSize: 11,
                            color: "var(--n-text-disabled)",
                            width: 16,
                            textAlign: "right",
                            flexShrink: 0,
                          }}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p
                            className="n-font-body"
                            style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 14, marginBottom: 2 }}
                          >
                            {item.cupName}
                          </p>
                          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                            {item.categories.join(", ")}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          className="n-font-data"
                          style={{
                            fontSize: 13,
                            color: "var(--n-text-secondary)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {item.pendingCount} PRODUIT{item.pendingCount > 1 ? "S" : ""}
                        </span>
                        <span
                          className="n-font-body"
                          style={{ color: "var(--n-text-secondary)", fontSize: 14 }}
                        >
                          &gt;
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Active cups with countdowns */}
          {activeCups.length > 0 && (
            <div className="n-card">
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--n-border)",
                }}
              >
                <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 2 }}>
                  EN COURS
                </p>
                <p
                  className="n-font-body"
                  style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
                >
                  Competitions actives
                </p>
              </div>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {activeCups.map((cup) => {
                  const ratingStatus = getRatingStatus(
                    cup.status,
                    cup.ratingStartAt,
                    cup.ratingEndAt,
                    cup.ratingsLockedAt
                  );
                  const isUrgent = ratingStatus === "ending_soon";
                  const isBlocked = ratingStatus === "not_started";
                  const remaining = cup.progress.total - cup.progress.rated;

                  const cardInner = (
                    <div
                      style={{
                        padding: "16px",
                        border: isUrgent
                          ? "1px solid var(--n-accent)"
                          : "1px solid var(--n-border-visible)",
                        borderRadius: 8,
                        background: "var(--n-surface-raised)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {/* Cup header */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <p
                              className="n-font-body"
                              style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
                            >
                              {cup.cupName}
                            </p>
                            {isBlocked && (
                              <span className="n-tag" style={{ fontSize: 10 }}>
                                PAS ENCORE OUVERT
                              </span>
                            )}
                          </div>
                          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                            {cup.assignedCategories.length} CATEGORIE{cup.assignedCategories.length > 1 ? "S" : ""} ASSIGNEE{cup.assignedCategories.length > 1 ? "S" : ""}
                          </p>
                        </div>
                        {!isBlocked && (
                          <div style={{ textAlign: "right" }}>
                            <span
                              className="n-font-data"
                              style={{
                                fontSize: 24,
                                fontWeight: 700,
                                lineHeight: 1,
                                color: isUrgent ? "var(--n-accent)" : "var(--n-text-display)",
                                letterSpacing: "-0.03em",
                                display: "block",
                              }}
                            >
                              {remaining}
                            </span>
                            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                              A NOTER
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Countdown */}
                      {isBlocked && cup.ratingStartAt && (
                        <NothingCountdown targetDate={new Date(cup.ratingStartAt)} type="opening" />
                      )}
                      {!isBlocked && cup.ratingEndAt && (
                        <NothingCountdown targetDate={new Date(cup.ratingEndAt)} type="closing" />
                      )}

                      {/* Segmented progress */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <SegmentedProgress value={cup.progress.percentage} segments={20} />
                        <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                          {cup.progress.rated} / {cup.progress.total} — {cup.progress.percentage}%
                        </p>
                      </div>

                      {/* Action link */}
                      {!isBlocked && (
                        <p
                          className="n-font-body"
                          style={{
                            fontSize: 13,
                            color: isUrgent ? "var(--n-accent)" : "var(--n-text-secondary)",
                            letterSpacing: "0.04em",
                            fontWeight: 500,
                          }}
                        >
                          CONTINUER &gt;
                        </p>
                      )}
                    </div>
                  );

                  return isBlocked ? (
                    <div key={cup.cupId}>{cardInner}</div>
                  ) : (
                    <Link key={cup.cupId} href={`/jury/cups/${cup.cupId}`} style={{ display: "block", textDecoration: "none" }}>
                      {cardInner}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Published results */}
          {orgCupsWithResults.length > 0 && (
            <div className="n-card">
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--n-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 2 }}>
                    TERMINEES
                  </p>
                  <p
                    className="n-font-body"
                    style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
                  >
                    Resultats publies
                  </p>
                </div>
                <span className="n-tag">
                  {orgCupsWithResults.length} COMPETITION{orgCupsWithResults.length > 1 ? "S" : ""}
                </span>
              </div>
              <div style={{ padding: "8px 0" }}>
                {orgCupsWithResults.map((cup, idx) => (
                  <div
                    key={cup.cupId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 20px",
                      borderBottom: idx < orgCupsWithResults.length - 1 ? "1px solid var(--n-border)" : "none",
                    }}
                  >
                    <div>
                      <p
                        className="n-font-body"
                        style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 14, marginBottom: 3 }}
                      >
                        {cup.cupName}
                      </p>
                      <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                        PUBLIE LE {formatDate(cup.resultsPublishedAt).toUpperCase()} — {cup.totalProducts} PRODUIT{cup.totalProducts > 1 ? "S" : ""}
                      </p>
                    </div>
                    <Link href={`/jury/results/${cup.cupId}`} style={{ textDecoration: "none" }}>
                      <button className="n-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
                        VOIR COMPARAISON &gt;
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed evaluations (no published results) */}
          {completedCups.filter((cup) => !orgCupsWithResults.some((r) => r.cupId === cup.cupId)).length > 0 && (
            <div className="n-card">
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--n-border)",
                }}
              >
                <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 2 }}>
                  COMPLETEES
                </p>
                <p
                  className="n-font-body"
                  style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
                >
                  Evaluations terminees
                </p>
              </div>
              <div style={{ padding: "8px 0" }}>
                {completedCups
                  .filter((cup) => !orgCupsWithResults.some((r) => r.cupId === cup.cupId))
                  .slice(0, 3)
                  .map((cup, idx, arr) => (
                    <Link key={cup.cupId} href={`/jury/cups/${cup.cupId}`} style={{ display: "block", textDecoration: "none" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 20px",
                          borderBottom: idx < arr.length - 1 ? "1px solid var(--n-border)" : "none",
                        }}
                        className="nothing-row-hover"
                      >
                        <p
                          className="n-font-body"
                          style={{ color: "var(--n-text-secondary)", fontWeight: 500, fontSize: 14 }}
                        >
                          {cup.cupName}
                        </p>
                        <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                          {cup.progress.total} PRODUIT{cup.progress.total > 1 ? "S" : ""} — EN ATTENTE RESULTATS
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {orgCups.length === 0 && (
            <div
              className="n-card"
              style={{
                padding: "64px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <p
                className="n-font-data n-label"
                style={{ color: "var(--n-text-secondary)", fontSize: 13, letterSpacing: "0.08em" }}
              >
                AUCUNE EVALUATION
              </p>
              <p
                className="n-font-body"
                style={{ color: "var(--n-text-disabled)", fontSize: 13, textAlign: "center", maxWidth: 320 }}
              >
                Vous n'avez pas encore d'evaluations assignees. Utilisez un code d'invitation pour rejoindre une competition.
              </p>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN                                                    */}
        {/* ============================================================== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Invitation code card */}
          <div
            className="n-card"
            style={{
              border: "1px solid var(--n-border-visible)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--n-border)" }}>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 2 }}>
                REJOINDRE UNE COMPETITION
              </p>
              <p
                className="n-font-body"
                style={{ color: "var(--n-text-primary)", fontWeight: 500, fontSize: 15 }}
              >
                Code d'invitation
              </p>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 6 }}>
                  VOTRE CODE
                </p>
                <input
                  id="invitation-code"
                  className="n-input n-font-data"
                  placeholder="XXX-XXX-XXX"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleActivateCode()}
                  style={{
                    width: "100%",
                    textAlign: "center",
                    fontSize: 18,
                    letterSpacing: "0.12em",
                  }}
                />
              </div>
              <button
                className="n-btn-primary"
                onClick={handleActivateCode}
                disabled={activateMutation.isPending || !invitationCode.trim()}
                style={{ width: "100%" }}
              >
                {activateMutation.isPending ? "[ACTIVATION...]" : "ACTIVER LE CODE"}
              </button>
            </div>
          </div>

          {/* My activity stats */}
          {myStats?.memberSince && (
            <div className="n-card">
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--n-border)" }}>
                <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                  MON ACTIVITE
                </p>
              </div>
              <div style={{ padding: "0" }}>
                {[
                  { label: "MEMBRE DEPUIS", value: formatDate(myStats.memberSince) },
                  { label: "COMPETITIONS", value: String(myStats.cupsParticipated) },
                  { label: "NOTES SOUMISES", value: String(myStats.totalRatings) },
                  ...(myStats.averageScore !== null
                    ? [{ label: "NOTE MOYENNE", value: `${myStats.averageScore}/10` }]
                    : []),
                ].map((row, idx, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 20px",
                      borderBottom: idx < arr.length - 1 ? "1px solid var(--n-border)" : "none",
                    }}
                  >
                    <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                      {row.label}
                    </span>
                    <span
                      className="n-font-data"
                      style={{ fontSize: 13, color: "var(--n-text-primary)", letterSpacing: "0.02em" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="n-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--n-border)" }}>
              <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                ACTIONS RAPIDES
              </p>
            </div>
            <div style={{ padding: "8px 0" }}>
              <Link href="/jury/ratings" style={{ display: "block", textDecoration: "none" }}>
                <div
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--n-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                  className="nothing-row-hover"
                >
                  <span className="n-label" style={{ color: "var(--n-text-primary)", letterSpacing: "0.04em" }}>
                    MES NOTES SOUMISES
                  </span>
                  <span style={{ color: "var(--n-text-secondary)", fontSize: 14 }}>&gt;</span>
                </div>
              </Link>
              <Link href="/jury/profile" style={{ display: "block", textDecoration: "none" }}>
                <div
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                  className="nothing-row-hover"
                >
                  <span className="n-label" style={{ color: "var(--n-text-primary)", letterSpacing: "0.04em" }}>
                    MON PROFIL JURY
                  </span>
                  <span style={{ color: "var(--n-text-secondary)", fontSize: 14 }}>&gt;</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Help card */}
          <div
            style={{
              padding: "14px 16px",
              border: "1px solid var(--n-border)",
              borderRadius: 12,
              background: "var(--n-surface)",
            }}
          >
            <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 6 }}>
              BESOIN D'AIDE ?
            </p>
            <p
              className="n-font-body"
              style={{ fontSize: 13, color: "var(--n-text-disabled)", lineHeight: 1.5 }}
            >
              Contactez l'organisateur si vous avez des questions sur vos evaluations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
