"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

// Types for rating status
type RatingStatus = "not_started" | "active" | "ending_soon" | "closed";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

// Calculate time remaining until a date
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

// Determine the rating status of a cup
function getRatingStatus(
  status: string,
  ratingStartAt: Date | null,
  ratingEndAt: Date | null,
  ratingsLockedAt: Date | null
): RatingStatus {
  const now = new Date();

  // If ratings are locked or cup is completed
  if (ratingsLockedAt || status === "completed") {
    return "closed";
  }

  // If cup is in rating phase
  if (status === "rating") {
    // Check if ending soon (less than 3 days)
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

  // Check dates for other statuses
  if (ratingStartAt && now < new Date(ratingStartAt)) {
    return "not_started";
  }

  if (ratingEndAt && now > new Date(ratingEndAt)) {
    return "closed";
  }

  // If we have a start date and we're past it
  if (ratingStartAt && now >= new Date(ratingStartAt)) {
    if (ratingEndAt) {
      const timeLeft = calculateTimeLeft(ratingEndAt);
      if (timeLeft.days < 3 && timeLeft.totalMs > 0) {
        return "ending_soon";
      }
    }
    return "active";
  }

  // Default: not started for draft/published/registration_closed
  if (["draft", "published", "registration_closed"].includes(status)) {
    return "not_started";
  }

  return "active";
}

// Urgency level based on time remaining
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

// Mechanical inline countdown component
function MechanicalCountdown({
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

  if (timeLeft.totalMs <= 0) {
    return null;
  }

  const urgency = type === "closing" ? getUrgencyLevel(timeLeft) : "calm";
  const isUrgent = urgency === "critical" || urgency === "warning";

  const formatSegment = (value: number, unit: string) =>
    `${String(value).padStart(2, "0")}${unit}`;

  const timeString =
    timeLeft.days > 0
      ? `${formatSegment(timeLeft.days, "J")} ${formatSegment(timeLeft.hours, "H")} ${formatSegment(timeLeft.minutes, "M")}`
      : timeLeft.hours > 0
        ? `${formatSegment(timeLeft.hours, "H")} ${formatSegment(timeLeft.minutes, "M")} ${formatSegment(timeLeft.seconds, "S")}`
        : `${formatSegment(timeLeft.minutes, "M")} ${formatSegment(timeLeft.seconds, "S")}`;

  const label = type === "opening" ? "OUVERTURE DANS" : urgency === "critical" ? "FERMETURE DANS" : urgency === "warning" ? "FIN DANS" : "TEMPS RESTANT";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        border: "1px solid",
        borderColor: isUrgent && type === "closing" ? "var(--n-accent)" : "var(--n-border-visible)",
        borderRadius: "8px",
        backgroundColor: "var(--n-surface)",
      }}
    >
      <span
        className="n-label"
        style={{
          color: "var(--n-text-disabled)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="n-font-data"
        style={{
          fontSize: "20px",
          letterSpacing: "0.05em",
          color: isUrgent && type === "closing" ? "var(--n-accent)" : "var(--n-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {timeString}
      </span>
    </div>
  );
}

// Cup rating status tag
function CupStatusTag({
  status,
  ratingStartAt,
  ratingEndAt,
}: {
  status: RatingStatus;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
}) {
  if (status === "closed") {
    return <span className="n-tag">FERME</span>;
  }

  if (status === "not_started") {
    return <span className="n-tag">NON OUVERT</span>;
  }

  if (status === "ending_soon" && ratingEndAt) {
    const timeLeft = calculateTimeLeft(new Date(ratingEndAt));
    const label =
      timeLeft.days > 0
        ? `FIN DANS ${timeLeft.days}J`
        : timeLeft.hours > 0
          ? `FIN DANS ${timeLeft.hours}H`
          : `FIN DANS ${timeLeft.minutes}M`;
    return (
      <span className="n-tag" style={{ borderColor: "var(--n-accent)", color: "var(--n-accent)" }}>
        {label}
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="n-tag" style={{ borderColor: "var(--n-success)", color: "var(--n-success)" }}>
        ACTIF
      </span>
    );
  }

  return <span className="n-tag">ACTIF</span>;
}

/**
 * Jury Assignments Page (renamed to "Noter")
 * Shows all products assigned to the jury for rating, grouped by cup and category
 */
export default function JuryAssignmentsPage() {
  // Get all jury cups
  const { data: juryCups, isLoading, error } = api.jury.getMyJuryCups.useQuery();

  // Single-tenant: no org filter
  const orgCups = juryCups ?? [];

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
        }}
      >
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="n-card"
        style={{
          maxWidth: "480px",
          margin: "32px auto",
          textAlign: "center",
          padding: "32px 24px",
        }}
      >
        <p
          className="n-label"
          style={{ color: "var(--n-accent)", marginBottom: "8px" }}
        >
          ERREUR
        </p>
        <p style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
          {error.message}
        </p>
      </div>
    );
  }

  // Calculate totals
  const totalCups = orgCups.length;
  const totalProducts = orgCups.reduce((sum, cup) => sum + cup.progress.total, 0);
  const totalRated = orgCups.reduce((sum, cup) => sum + cup.progress.rated, 0);
  const pendingProducts = totalProducts - totalRated;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

      {/* Header */}
      <div>
        <h1
          className="n-font-display"
          style={{
            fontSize: "32px",
            color: "var(--n-text-display)",
            margin: 0,
            lineHeight: 1,
          }}
        >
          NOTER
        </h1>
        <p
          className="n-font-body"
          style={{
            color: "var(--n-text-secondary)",
            marginTop: "8px",
            fontSize: "14px",
          }}
        >
          Produits assignés pour notation
        </p>
      </div>

      {/* Summary Stats - 4 in a row separated by borders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          border: "1px solid var(--n-border-visible)",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "var(--n-surface)",
        }}
      >
        {[
          { value: totalCups, label: `CUP${totalCups !== 1 ? "S" : ""} ASSIGNEE${totalCups !== 1 ? "S" : ""}` },
          { value: totalProducts, label: "PRODUITS TOTAL" },
          { value: pendingProducts, label: "EN ATTENTE" },
          { value: totalRated, label: "NOTES" },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "24px",
              borderLeft: i > 0 ? "1px solid var(--n-border-visible)" : undefined,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span
              className="n-font-data"
              style={{
                fontSize: "40px",
                lineHeight: 1,
                color: "var(--n-text-display)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {stat.value}
            </span>
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Cups and Categories */}
      {orgCups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {orgCups.map((cup) => {
            const ratingStatus = getRatingStatus(
              cup.status,
              cup.ratingStartAt,
              cup.ratingEndAt,
              cup.ratingsLockedAt
            );
            const isBlocked =
              ratingStatus === "not_started" || ratingStatus === "closed";
            const isUrgent = ratingStatus === "ending_soon";

            // Segmented progress bar
            const totalSegments = Math.max(cup.progress.total, 1);
            const filledSegments = cup.progress.rated;
            const segmentWidth = Math.floor(100 / totalSegments);
            const displaySegments = Math.min(totalSegments, 20);
            const filledDisplaySegments = Math.round(
              (filledSegments / totalSegments) * displaySegments
            );

            return (
              <div
                key={cup.cupId}
                className="n-card"
                style={{
                  opacity: isBlocked ? 0.65 : 1,
                  borderColor: isUrgent ? "var(--n-accent)" : undefined,
                }}
              >
                {/* Cup header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h2
                        className="n-font-body"
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--n-text-primary)",
                          margin: 0,
                        }}
                      >
                        {cup.cupName}
                      </h2>
                      <CupStatusTag
                        status={ratingStatus}
                        ratingStartAt={cup.ratingStartAt}
                        ratingEndAt={cup.ratingEndAt}
                      />
                      {cup.progress.percentage === 100 && (
                        <span
                          className="n-tag"
                          style={{
                            borderColor: "var(--n-success)",
                            color: "var(--n-success)",
                          }}
                        >
                          COMPLETE
                        </span>
                      )}
                    </div>
                    <p
                      className="n-font-data"
                      style={{
                        color: "var(--n-text-secondary)",
                        fontSize: "13px",
                        marginTop: "4px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {cup.progress.rated}/{cup.progress.total} PRODUITS NOTES
                    </p>
                  </div>

                  {/* Percentage */}
                  <span
                    className="n-font-data"
                    style={{
                      fontSize: "24px",
                      color: isUrgent ? "var(--n-accent)" : "var(--n-text-secondary)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {cup.progress.percentage}%
                  </span>
                </div>

                {/* Segmented progress bar */}
                <div className="n-progress-bar" style={{ marginBottom: "16px" }}>
                  {Array.from({ length: displaySegments }).map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "n-progress-segment",
                        idx < filledDisplaySegments && "filled"
                      )}
                      style={
                        isUrgent && idx < filledDisplaySegments
                          ? { backgroundColor: "var(--n-accent)" }
                          : undefined
                      }
                    />
                  ))}
                </div>

                {/* Countdown */}
                {ratingStatus === "not_started" && cup.ratingStartAt && (
                  <div style={{ marginBottom: "16px" }}>
                    <MechanicalCountdown
                      targetDate={new Date(cup.ratingStartAt)}
                      type="opening"
                    />
                  </div>
                )}

                {(ratingStatus === "active" || ratingStatus === "ending_soon") &&
                  cup.ratingEndAt &&
                  cup.progress.percentage < 100 && (
                    <div style={{ marginBottom: "16px" }}>
                      <MechanicalCountdown
                        targetDate={new Date(cup.ratingEndAt)}
                        type="closing"
                      />
                    </div>
                  )}

                {/* Closed message */}
                {ratingStatus === "closed" && cup.progress.percentage < 100 && (
                  <div
                    style={{
                      padding: "12px 16px",
                      border: "1px solid var(--n-border)",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      className="n-label"
                      style={{ color: "var(--n-text-disabled)" }}
                    >
                      LA PERIODE DE NOTATION EST TERMINEE
                    </span>
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "var(--n-border)",
                    margin: "0 0 16px 0",
                  }}
                />

                {/* Categories */}
                {cup.assignedCategories.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {cup.assignedCategories.map((category, idx) => (
                      <div key={category.id}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            gap: "16px",
                          }}
                        >
                          {/* Category info */}
                          <div style={{ flex: 1 }}>
                            <p
                              className="n-font-body"
                              style={{
                                fontSize: "15px",
                                color: isBlocked
                                  ? "var(--n-text-disabled)"
                                  : "var(--n-text-primary)",
                                margin: 0,
                                fontWeight: 500,
                              }}
                            >
                              {category.name}
                            </p>
                            <p
                              className="n-label"
                              style={{
                                color: "var(--n-text-disabled)",
                                marginTop: "2px",
                              }}
                            >
                              {isBlocked
                                ? ratingStatus === "not_started"
                                  ? "NOTATION PAS ENCORE OUVERTE"
                                  : "NOTATION TERMINEE"
                                : "CATEGORIE A EVALUER"}
                            </p>
                          </div>

                          {/* Action */}
                          {isBlocked ? (
                            <span
                              className="n-label"
                              style={{ color: "var(--n-text-disabled)" }}
                            >
                              VERROUILLE
                            </span>
                          ) : (
                            <Link href={`/jury/cups/${cup.cupId}`}>
                              <button
                                className={isUrgent ? "n-btn-primary" : "n-btn-ghost"}
                                style={
                                  isUrgent
                                    ? { backgroundColor: "var(--n-accent)", borderColor: "var(--n-accent)" }
                                    : undefined
                                }
                              >
                                {isUrgent ? "NOTER MAINTENANT" : "VOIR"}
                              </button>
                            </Link>
                          )}
                        </div>

                        {/* Row divider (not after last) */}
                        {idx < cup.assignedCategories.length - 1 && (
                          <div
                            style={{
                              height: "1px",
                              backgroundColor: "var(--n-border)",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className="n-label"
                    style={{
                      color: "var(--n-text-disabled)",
                      textAlign: "center",
                      padding: "16px 0",
                    }}
                  >
                    AUCUNE CATEGORIE ASSIGNEE
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <p
            className="n-label"
            style={{ color: "var(--n-text-secondary)", fontSize: "13px" }}
          >
            AUCUNE EVALUATION
          </p>
          <p
            className="n-font-body"
            style={{
              color: "var(--n-text-disabled)",
              fontSize: "14px",
              maxWidth: "360px",
            }}
          >
            Vous n&apos;avez pas encore de produits assignés pour notation.
            Attendez qu&apos;un organisateur vous assigne à des catégories.
          </p>
        </div>
      )}
    </div>
  );
}
