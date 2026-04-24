"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatinumResultsProps {
  cups: { id: string; name: string; eventDate: Date | null }[];
  categories: { id: string; name: string }[];
  labels: { id: string; name: string; color: string | null; icon: string | null }[];
  winners: {
    productId: string;
    productName: string;
    productDescription: string | null;
    producerId: string;
    producerName: string;
    producerLogo: string | null;
    producerWebsite: string | null;
    producerPhone: string | null;
    producerAddress: string | null;
    producerEmail: string | null;
    cupId: string;
    cupName: string;
    cupRatingScale: string | null;
    categoryId: string;
    categoryName: string;
    labelId: string | null;
    labelName: string | null;
    labelColor: string | null;
    labelIcon: string | null;
    score: string | null;
    rank: number | null;
    visibility: string;
  }[];
  config: {
    palmareShowScore: boolean;
    palmareShowCategory: boolean;
  };
  logoUrl: string | null;
}

type Winner = PlatinumResultsProps["winners"][number];
type Cup = PlatinumResultsProps["cups"][number];

// ---------------------------------------------------------------------------
// PtLabelBadge
// ---------------------------------------------------------------------------

interface PtLabelBadgeProps {
  label: string;
  color?: string | null;
  icon?: string | null;
}

function PtLabelBadge({ label, color, icon }: PtLabelBadgeProps) {
  const style: React.CSSProperties = color
    ? { borderColor: color, color }
    : {};

  return (
    <span
      className="pt-pill"
      style={{
        fontFamily: "var(--pt-mono)",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: ".1em",
        borderRadius: "999px",
        padding: "4px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        borderWidth: "1px",
        borderStyle: "solid",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TrophyWatermark — SVG trophy, decorative background element
// ---------------------------------------------------------------------------

function TrophyWatermark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        right: "-8px",
        bottom: "-12px",
        width: "200px",
        height: "200px",
        opacity: 0.06,
        transform: "rotate(-12deg)",
        pointerEvents: "none",
        color: "var(--pt-accent)",
      }}
    >
      {/* Cup body */}
      <path
        d="M35 10 h50 v40 c0 22-11 36-25 40 v12 h-4 l-6 8 h30 l-6-8 h-4 V90 c-14-4-25-18-25-40 V10z"
        fill="currentColor"
      />
      {/* Handles */}
      <path d="M35 15 Q10 15 10 38 Q10 58 28 62 L35 60" stroke="currentColor" strokeWidth="6" fill="none" />
      <path d="M85 15 Q110 15 110 38 Q110 58 92 62 L85 60" stroke="currentColor" strokeWidth="6" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BestInShowCard — top winner large spotlight card
// ---------------------------------------------------------------------------

interface BestInShowCardProps {
  winner: Winner;
  showScore: boolean;
}

function BestInShowCard({ winner, showScore }: BestInShowCardProps) {
  const scoreNum = winner.score ? parseFloat(winner.score) : null;
  const displayScore = scoreNum !== null ? scoreNum.toFixed(2) : null;

  return (
    <div
      className="pt-card"
      style={{
        position: "relative",
        overflow: "hidden",
        borderColor: "var(--pt-accent)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--pt-accent) 8%, var(--pt-bg-2)) 0%, var(--pt-bg-2) 100%)",
      }}
    >
      <TrophyWatermark />

      {/* Gold top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, var(--pt-accent) 0%, var(--pt-accent-hi) 50%, var(--pt-accent) 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Badge row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <span
            className="pt-pill accent"
            style={{ fontSize: "10px", letterSpacing: ".12em" }}
          >
            <span aria-hidden="true">&#9733;</span>
            Best in Show
          </span>
          {winner.labelName && ["labels", "labels_and_podium", "all"].includes(winner.visibility) && (
            <PtLabelBadge
              label={winner.labelName}
              color={winner.labelColor}
              icon={winner.labelIcon}
            />
          )}
        </div>

        {/* Product name */}
        <div
          style={{
            fontFamily: "var(--pt-display)",
            fontWeight: 700,
            fontStyle: "italic",
            fontSize: "clamp(28px, 5vw, 52px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "var(--pt-fg)",
            marginBottom: "8px",
          }}
        >
          {winner.productName}
        </div>

        {/* Producer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "24px",
          }}
        >
          {winner.producerLogo && (
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
                border: "1px solid var(--pt-line-strong)",
              }}
            >
              <Image
                src={winner.producerLogo}
                alt={winner.producerName}
                fill
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
          <span style={{ fontFamily: "var(--pt-mono)", fontSize: "12px", color: "var(--pt-fg-2)", letterSpacing: ".04em" }}>
            {winner.producerName}
          </span>
          <span style={{ color: "var(--pt-line-strong)" }}>·</span>
          <span style={{ fontFamily: "var(--pt-mono)", fontSize: "11px", color: "var(--pt-fg-3)", letterSpacing: ".04em" }}>
            {winner.cupName}
          </span>
        </div>

        {/* Score + category row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "32px", flexWrap: "wrap" }}>
          {showScore && displayScore && (
            <div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontSize: "10px",
                  color: "var(--pt-fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  marginBottom: "4px",
                }}
              >
                Final Score
              </div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: "clamp(36px, 6vw, 64px)",
                  lineHeight: 1,
                  color: "var(--pt-accent)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                {displayScore}
              </div>
            </div>
          )}

          {winner.categoryName && (
            <div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontSize: "10px",
                  color: "var(--pt-fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  marginBottom: "4px",
                }}
              >
                Category
              </div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontSize: "14px",
                  color: "var(--pt-fg-2)",
                  letterSpacing: ".04em",
                }}
              >
                {winner.categoryName}
              </div>
            </div>
          )}

          {winner.rank !== null && ["podium", "labels_and_podium", "all"].includes(winner.visibility) && (
            <div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontSize: "10px",
                  color: "var(--pt-fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  marginBottom: "4px",
                }}
              >
                Rank
              </div>
              <div
                style={{
                  fontFamily: "var(--pt-mono)",
                  fontSize: "14px",
                  color: "var(--pt-fg)",
                  letterSpacing: ".04em",
                }}
              >
                #{winner.rank}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RankingsTable — tabular ledger of all winners
// ---------------------------------------------------------------------------

interface RankingsTableProps {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
  expandedProducer: string | null;
  setExpandedProducer: (id: string | null) => void;
}

function RankingsTable({ winners, showScore, showCategory, expandedProducer, setExpandedProducer }: RankingsTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Determine which columns to show based on visibility of the displayed winners
  const dominantVisibility = useMemo(() => {
    const vis = winners[0]?.visibility ?? "labels_and_podium";
    return vis;
  }, [winners]);

  const showRankColumn = ["podium", "labels_and_podium", "all"].includes(dominantVisibility);
  const showLabelColumn = ["labels", "labels_and_podium", "all"].includes(dominantVisibility);

  if (winners.length === 0) {
    return (
      <div
        style={{
          padding: "48px 0",
          textAlign: "center",
          fontFamily: "var(--pt-mono)",
          fontSize: "12px",
          color: "var(--pt-fg-3)",
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        No results match the current filters.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--pt-mono)",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--pt-line-strong)",
            }}
          >
            {[
              ...(showRankColumn ? [{ key: "rank", label: "Rk", width: "48px", align: "center" as const }] : []),
              { key: "code", label: "Produit", width: undefined, align: "left" as const },
              { key: "producer", label: "Producteur", width: undefined, align: "left" as const },
              { key: "cup", label: "Cup", width: "140px", align: "left" as const },
              ...(showCategory ? [{ key: "cat", label: "Cat.", width: "120px", align: "left" as const }] : []),
              ...(showScore ? [{ key: "score", label: "Score", width: "70px", align: "right" as const }] : []),
              ...(showLabelColumn ? [{ key: "label", label: "Label", width: "150px", align: "right" as const }] : []),
            ].map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "10px 12px",
                  textAlign: col.align,
                  color: "var(--pt-fg-3)",
                  fontWeight: 400,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  fontSize: "10px",
                  width: col.width,
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {winners.map((winner, idx) => {
            const isFirst = winner.rank === 1;
            const isHovered = hoveredRow === winner.productId;
            const scoreNum = winner.score ? parseFloat(winner.score) : null;

            // Insert separator between podium (rank <= 3) and label products
            const prevWinner = idx > 0 ? winners[idx - 1] : null;
            const prevOnPodium = prevWinner && prevWinner.rank !== null && prevWinner.rank <= 3;
            const currOnPodium = winner.rank !== null && winner.rank <= 3;
            const needsSeparator = prevOnPodium && !currOnPodium && showRankColumn && showLabelColumn;

            // Count total columns for separator
            const colCount = (showRankColumn ? 1 : 0) + 1 + 1 + (showCategory ? 1 : 0) + (showScore ? 1 : 0) + (showLabelColumn ? 1 : 0);

            return (
              <React.Fragment key={winner.productId}>
                {needsSeparator && (
                  <tr>
                    <td colSpan={colCount} style={{ padding: 0 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        background: "var(--pt-accent-dim)",
                      }}>
                        <div style={{ height: "1px", flex: 1, background: "var(--pt-accent)", opacity: 0.3 }} />
                        <span style={{
                          fontFamily: "var(--pt-mono)",
                          fontSize: "9px",
                          letterSpacing: ".15em",
                          textTransform: "uppercase",
                          color: "var(--pt-accent)",
                        }}>
                          Produits labellisés
                        </span>
                        <div style={{ height: "1px", flex: 1, background: "var(--pt-accent)", opacity: 0.3 }} />
                      </div>
                    </td>
                  </tr>
                )}
              <tr
                onMouseEnter={() => setHoveredRow(winner.productId)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  borderBottom: "1px solid var(--pt-line)",
                  background: isHovered
                    ? "color-mix(in srgb, var(--pt-fg) 4%, transparent)"
                    : "transparent",
                  transition: "background .12s ease",
                  cursor: "default",
                }}
              >
                {/* Rank */}
                {showRankColumn && (() => {
                  const medalColor = winner.rank === 1 ? "#FFD700" : winner.rank === 2 ? "#C0C0C0" : winner.rank === 3 ? "#CD7F32" : "var(--pt-fg-3)";
                  const isOnPodium = winner.rank !== null && winner.rank <= 3;
                  return (
                    <td
                      style={{
                        padding: "14px 12px",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {winner.rank !== null ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: isOnPodium ? 28 : "auto",
                          height: isOnPodium ? 28 : "auto",
                          borderRadius: isOnPodium ? "50%" : undefined,
                          background: isOnPodium ? `${medalColor}20` : undefined,
                          border: isOnPodium ? `1px solid ${medalColor}60` : undefined,
                          color: medalColor,
                          fontWeight: isOnPodium ? 600 : 400,
                          fontSize: isOnPodium ? "12px" : "11px",
                        }}>
                          {winner.rank}
                        </span>
                      ) : "—"}
                    </td>
                  );
                })()}

                {/* Product name */}
                <td style={{ padding: "14px 12px" }}>
                  <div
                    style={{
                      color: "var(--pt-fg)",
                      fontWeight: isFirst ? 500 : 400,
                      letterSpacing: ".01em",
                      marginBottom: winner.productDescription ? "3px" : undefined,
                    }}
                  >
                    {winner.productName}
                  </div>
                  {winner.productDescription && (
                    <div
                      style={{
                        color: "var(--pt-fg-3)",
                        fontSize: "11px",
                        letterSpacing: ".02em",
                        maxWidth: "32ch",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {winner.productDescription}
                    </div>
                  )}
                </td>

                {/* Producer — clickable to show contact */}
                <td style={{ padding: "14px 12px", color: "var(--pt-fg-2)" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedProducer(expandedProducer === winner.productId ? null : winner.productId)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      background: "none", border: "none", color: "inherit",
                      font: "inherit", cursor: "pointer", padding: 0,
                    }}
                  >
                    {winner.producerLogo && (
                      <div style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        overflow: "hidden", position: "relative", flexShrink: 0,
                        border: "1px solid var(--pt-line)",
                      }}>
                        <Image src={winner.producerLogo} alt={winner.producerName} fill style={{ objectFit: "cover" }} />
                      </div>
                    )}
                    <span style={{ whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: "var(--pt-line-strong)", textUnderlineOffset: "3px" }}>
                      {winner.producerName}
                    </span>
                  </button>
                </td>

                {/* Cup */}
                <td style={{ padding: "14px 12px", color: "var(--pt-fg-3)", fontSize: "11px", letterSpacing: ".04em" }}>
                  {winner.cupName}
                </td>

                {/* Category */}
                {showCategory && (
                  <td
                    style={{
                      padding: "14px 12px",
                      color: "var(--pt-fg-3)",
                      fontSize: "11px",
                      letterSpacing: ".04em",
                    }}
                  >
                    {winner.categoryName}
                  </td>
                )}

                {/* Score */}
                {showScore && (
                  <td
                    style={{
                      padding: "14px 12px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: scoreNum !== null ? "var(--pt-accent)" : "var(--pt-fg-3)",
                      fontWeight: 500,
                    }}
                  >
                    {scoreNum !== null ? scoreNum.toFixed(2) : "—"}
                  </td>
                )}

                {/* Label badge */}
                {showLabelColumn && (
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    {winner.labelName ? (
                      <PtLabelBadge
                        label={winner.labelName}
                        color={winner.labelColor}
                        icon={winner.labelIcon}
                      />
                    ) : (
                      <span style={{ color: "var(--pt-fg-3)" }}>—</span>
                    )}
                  </td>
                )}
              </tr>
              {expandedProducer === winner.productId && (
                <tr>
                  <td colSpan={colCount} style={{ padding: 0, borderBottom: "1px solid var(--pt-line)" }}>
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: "24px",
                      padding: "14px 24px",
                      background: "var(--pt-bg-2)",
                      borderTop: "1px solid var(--pt-accent-dim)",
                      fontFamily: "var(--pt-mono)", fontSize: "12px",
                    }}>
                      {winner.producerEmail && (
                        <a href={`mailto:${winner.producerEmail}`} style={{ color: "var(--pt-accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10px", color: "var(--pt-fg-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Email</span>
                          {winner.producerEmail}
                        </a>
                      )}
                      {winner.producerPhone && (
                        <a href={`tel:${winner.producerPhone}`} style={{ color: "var(--pt-fg)", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10px", color: "var(--pt-fg-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Tél</span>
                          {winner.producerPhone}
                        </a>
                      )}
                      {winner.producerWebsite && (
                        <a href={winner.producerWebsite.startsWith("http") ? winner.producerWebsite : `https://${winner.producerWebsite}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pt-fg)", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10px", color: "var(--pt-fg-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Web</span>
                          {winner.producerWebsite}
                        </a>
                      )}
                      {winner.producerAddress && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--pt-fg-2)" }}>
                          <span style={{ fontSize: "10px", color: "var(--pt-fg-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Adresse</span>
                          {winner.producerAddress}
                        </div>
                      )}
                      {!winner.producerEmail && !winner.producerPhone && !winner.producerWebsite && !winner.producerAddress && (
                        <span style={{ color: "var(--pt-fg-3)", fontStyle: "italic" }}>Aucune coordonnée renseignée</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryGrouped — renders a section per category with its table
// ---------------------------------------------------------------------------

interface CategoryGroupedProps {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
  expandedProducer: string | null;
  setExpandedProducer: (id: string | null) => void;
}

function CategoryGrouped({ winners, showScore, showCategory, expandedProducer, setExpandedProducer }: CategoryGroupedProps) {
  // Group by category NAME (not ID) to merge same-name categories across cups
  const groups = useMemo(() => {
    const map = new Map<string, { categoryName: string; winners: Winner[] }>();
    for (const w of winners) {
      const existing = map.get(w.categoryName);
      if (existing) {
        existing.winners.push(w);
      } else {
        map.set(w.categoryName, { categoryName: w.categoryName, winners: [w] });
      }
    }
    // Sort within each group: podium first (by rank), then labels (by score desc)
    return Array.from(map.values()).map((g) => ({
      ...g,
      winners: [...g.winners].sort((a, b) => {
        const aOnPodium = a.rank !== null && a.rank <= 3;
        const bOnPodium = b.rank !== null && b.rank <= 3;
        // Podium first
        if (aOnPodium && !bOnPodium) return -1;
        if (!aOnPodium && bOnPodium) return 1;
        // Within podium: sort by rank
        if (aOnPodium && bOnPodium) return (a.rank ?? 999) - (b.rank ?? 999);
        // Within labels: sort by score desc
        const aScore = a.score ? parseFloat(a.score) : 0;
        const bScore = b.score ? parseFloat(b.score) : 0;
        return bScore - aScore;
      }),
    }));
  }, [winners]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {groups.map((group) => (
        <div key={group.categoryName}>
          {/* Category heading */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid var(--pt-line)",
            }}
          >
            <div
              style={{
                width: "3px",
                height: "18px",
                borderRadius: "2px",
                background: "var(--pt-accent)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--pt-mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: ".14em",
                color: "var(--pt-fg-2)",
              }}
            >
              {group.categoryName}
            </span>
            <span
              style={{
                fontFamily: "var(--pt-mono)",
                fontSize: "10px",
                color: "var(--pt-fg-3)",
                marginLeft: "auto",
                letterSpacing: ".06em",
              }}
            >
              {group.winners.length} {group.winners.length === 1 ? "product" : "products"}
            </span>
          </div>

          <RankingsTable
            winners={group.winners}
            showScore={showScore}
            showCategory={false}
            expandedProducer={expandedProducer}
            setExpandedProducer={setExpandedProducer}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MethodologyCards — label scale explanation + public ledger card
// ---------------------------------------------------------------------------

interface MethodologyCardsProps {
  labels: PlatinumResultsProps["labels"];
}

function MethodologyCards({ labels }: MethodologyCardsProps) {
  return (
    <div className="pt-grid pt-g2" style={{ alignItems: "start" }}>
      {/* Label scale card */}
      <div className="pt-card">
        <div
          style={{
            fontFamily: "var(--pt-mono)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: ".14em",
            color: "var(--pt-fg-3)",
            marginBottom: "20px",
          }}
        >
          Label Scale
        </div>

        {labels.length === 0 ? (
          <p style={{ fontFamily: "var(--pt-mono)", fontSize: "12px", color: "var(--pt-fg-3)" }}>
            No labels defined for this competition.
          </p>
        ) : (
          <div>
            {labels.map((label, i) => (
              <div key={label.id} className="pt-kv">
                <div className="pt-kv-k" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {label.icon && <span aria-hidden="true">{label.icon}</span>}
                  <PtLabelBadge label={label.name} color={label.color} />
                </div>
                <div className="pt-kv-v" style={{ color: label.color ?? "var(--pt-fg-2)", fontSize: "11px" }}>
                  Tier {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Public ledger card */}
      <div className="pt-card">
        <div
          style={{
            fontFamily: "var(--pt-mono)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: ".14em",
            color: "var(--pt-fg-3)",
            marginBottom: "20px",
          }}
        >
          Public Ledger
        </div>

        <p style={{ fontFamily: "var(--pt-mono)", fontSize: "12px", color: "var(--pt-fg-2)", lineHeight: 1.6, marginBottom: "28px" }}>
          All results published here reflect the official competition record.
          Scores and attributions are immutable once published.
        </p>

        {/* Download buttons (placeholder) */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="pt-btn ghost"
            style={{ fontSize: "11px", padding: "10px 18px" }}
            type="button"
            aria-label="Download PDF results"
          >
            <DownloadIcon />
            PDF
          </button>
          <button
            className="pt-btn ghost"
            style={{ fontSize: "11px", padding: "10px 18px" }}
            type="button"
            aria-label="Download CSV results"
          >
            <DownloadIcon />
            CSV
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "14px", height: "14px", flexShrink: 0 }}
    >
      <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PlatinumResults({
  cups,
  categories,
  labels,
  winners,
  config,
  logoUrl,
}: PlatinumResultsProps) {
  const [selectedCup, setSelectedCup] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [viewFilter, setViewFilter] = useState<"all" | "podium" | "labels">("all");
  const [expandedProducer, setExpandedProducer] = useState<string | null>(null);

  // Determine if both podium and labels are visible (to show the toggle)
  // Show podium/label toggle when any cup shows both
  const hasBothPodiumAndLabels = useMemo(() => {
    // When a specific cup is selected, check that cup's visibility
    if (selectedCup !== "all") {
      const cupWinners = winners.filter((w) => w.cupId === selectedCup);
      const vis = cupWinners[0]?.visibility ?? "labels";
      return vis === "labels_and_podium" || vis === "all";
    }
    // When "all", check if any winner has both
    const visibilities = new Set(winners.map((w) => w.visibility));
    return visibilities.has("labels_and_podium") || visibilities.has("all");
  }, [winners, selectedCup]);

  // Filter winners based on cup + category + podium/label toggle
  const filteredWinners = useMemo(() => {
    return winners
      .filter((w) => {
        if (selectedCup !== "all" && w.cupId !== selectedCup) return false;
        if (selectedCategory !== "ALL" && w.categoryName !== selectedCategory) return false;
        // Podium/label sub-filter (only when both are shown)
        if (viewFilter === "podium" && (w.rank === null || w.rank > 3)) return false;
        if (viewFilter === "labels" && !w.labelName) return false;
        return true;
      })
      .sort((a, b) => {
        const catCmp = a.categoryName.localeCompare(b.categoryName);
        if (catCmp !== 0) return catCmp;
        return (a.rank ?? 999) - (b.rank ?? 999);
      });
  }, [winners, selectedCup, selectedCategory, viewFilter]);

  // Best-in-show: product with the highest score across filtered results
  const bestInShow = useMemo<Winner | null>(() => {
    if (filteredWinners.length === 0) return null;
    const scored = filteredWinners.filter((w) => w.score !== null);
    if (scored.length === 0) return filteredWinners[0] ?? null;
    return scored.reduce((best, w) => {
      const bestScore = best.score ? parseFloat(best.score) : 0;
      const wScore = w.score ? parseFloat(w.score) : 0;
      return wScore > bestScore ? w : best;
    });
  }, [filteredWinners]);

  // Derive available categories from filtered-by-cup results — deduplicate by NAME
  const availableCategories = useMemo(() => {
    const base = selectedCup === "all" ? winners : winners.filter((w) => w.cupId === selectedCup);
    const seenNames = new Set<string>();
    const result: { name: string }[] = [];
    for (const w of base) {
      if (!seenNames.has(w.categoryName)) {
        seenNames.add(w.categoryName);
        result.push({ name: w.categoryName });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [winners, selectedCup]);

  // When the cup selection changes, reset category if no longer available
  const handleCupChange = (cupId: string) => {
    setSelectedCup(cupId);
    setSelectedCategory("ALL");
  };

  const handleCategoryChange = (catName: string) => {
    setSelectedCategory(catName);
  };

  const totalResults = filteredWinners.length;

  return (
    <div className="pt-page-enter" style={{ padding: "0 var(--pt-pad-x)" }}>
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header style={{ paddingTop: "clamp(48px, 8vh, 96px)", paddingBottom: "clamp(32px, 5vh, 56px)" }}>
        {/* Eyebrow */}
        <p className="pt-eyebrow" style={{ marginBottom: "20px" }}>
          004 · Palmarès · <b>Public ledger</b>
        </p>

        {/* Display title */}
        <h1 className="pt-display" style={{ marginBottom: "36px" }}>
          Results<em>.</em>
        </h1>

        {/* Cup selector */}
        {cups.length > 0 && (
          <div
            role="group"
            aria-label="Filter by cup"
            style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}
          >
            <button
              type="button"
              className={`pt-btn${selectedCup === "all" ? "" : " ghost"}`}
              style={{ fontSize: "11px", padding: "8px 16px" }}
              onClick={() => handleCupChange("all")}
              aria-pressed={selectedCup === "all"}
            >
              All editions
            </button>
            {cups.map((cup) => {
              const isActive = selectedCup === cup.id;
              const year = cup.eventDate ? new Date(cup.eventDate).getFullYear() : null;
              return (
                <button
                  key={cup.id}
                  type="button"
                  className={`pt-btn${isActive ? "" : " ghost"}`}
                  style={{ fontSize: "11px", padding: "8px 16px" }}
                  onClick={() => handleCupChange(cup.id)}
                  aria-pressed={isActive}
                >
                  {cup.name}
                  {year && (
                    <span style={{ opacity: 0.6, fontSize: "10px", marginLeft: "4px" }}>
                      {year}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* BEST IN SHOW                                                        */}
      {/* ------------------------------------------------------------------ */}
      {bestInShow && (
        <section style={{ marginBottom: "48px" }}>
          <BestInShowCard winner={bestInShow} showScore={config.palmareShowScore} />
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CATEGORY FILTERS                                                    */}
      {/* ------------------------------------------------------------------ */}
      {availableCategories.length > 1 && (
        <section style={{ marginBottom: "36px" }}>
          <div
            role="group"
            aria-label="Filter by category"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            <button
              type="button"
              className={`pt-btn${selectedCategory === "ALL" ? "" : " ghost"}`}
              style={{ fontSize: "11px", padding: "7px 14px" }}
              onClick={() => handleCategoryChange("ALL")}
              aria-pressed={selectedCategory === "ALL"}
            >
              All
            </button>
            {availableCategories.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  className={`pt-btn${isActive ? "" : " ghost"}`}
                  style={{ fontSize: "11px", padding: "7px 14px" }}
                  onClick={() => handleCategoryChange(cat.name)}
                  aria-pressed={isActive}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* RANKINGS TABLE                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ marginBottom: "64px" }}>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--pt-line-strong)",
          }}
        >
          <h2 className="pt-section-title" style={{ fontSize: "16px" }}>
            Rankings
          </h2>
          <span
            style={{
              fontFamily: "var(--pt-mono)",
              fontSize: "11px",
              color: "var(--pt-fg-3)",
              letterSpacing: ".08em",
            }}
          >
            {totalResults} {totalResults === 1 ? "result" : "results"}
          </span>
        </div>

        {/* Podium / Labels toggle — only when both are visible */}
        {hasBothPodiumAndLabels && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
            {(["all", "podium", "labels"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`pt-btn${viewFilter === f ? "" : " ghost"}`}
                style={{ fontSize: "10px", padding: "6px 14px", letterSpacing: ".1em" }}
                onClick={() => setViewFilter(f)}
              >
                {f === "all" ? "Tout" : f === "podium" ? "Podium" : "Labels"}
              </button>
            ))}
          </div>
        )}

        {/* Grouped by category or flat */}
        {config.palmareShowCategory && selectedCategory === "ALL" ? (
          <CategoryGrouped
            winners={filteredWinners}
            showScore={config.palmareShowScore}
            showCategory={config.palmareShowCategory}
            expandedProducer={expandedProducer}
            setExpandedProducer={setExpandedProducer}
          />
        ) : (
          <RankingsTable
            winners={filteredWinners}
            showScore={config.palmareShowScore}
            showCategory={config.palmareShowCategory}
            expandedProducer={expandedProducer}
            setExpandedProducer={setExpandedProducer}
          />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* METHODOLOGY                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ marginBottom: "80px" }}>
        <div
          style={{
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--pt-line-strong)",
          }}
        >
          <h2 className="pt-section-title" style={{ fontSize: "16px" }}>
            Methodology
          </h2>
        </div>
        <MethodologyCards labels={labels} />
      </section>
    </div>
  );
}
