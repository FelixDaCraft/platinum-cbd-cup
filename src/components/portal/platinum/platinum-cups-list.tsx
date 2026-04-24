"use client";

import Link from "next/link";
import { PtEyebrow, PtPill } from "./platinum-shared";

interface Cup {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingEndAt: Date | null;
  status: string;
  createdAt: Date;
}

interface PlatinumCupsListProps {
  cups: Cup[];
}

function getStatusInfo(status: string): { label: string; variant: "accent" | "default" } {
  switch (status) {
    case "published":
      return { label: "INSCRIPTIONS OUVERTES", variant: "accent" };
    case "rating":
      return { label: "NOTATION EN COURS", variant: "accent" };
    case "completed":
      return { label: "TERMINÉE", variant: "default" };
    default:
      return { label: status.toUpperCase(), variant: "default" };
  }
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function PlatinumCupsList({ cups }: PlatinumCupsListProps) {
  if (cups.length === 0) {
    return (
      <div className="pt-page-enter" style={{ padding: "0 var(--pt-pad-x) 60px" }}>
        <section style={{ paddingTop: 40, paddingBottom: 32 }}>
          <PtEyebrow idx={2}>Éditions</PtEyebrow>
          <h1 className="pt-display" style={{ marginTop: 18 }}>
            Cups<em>.</em>
          </h1>
        </section>
        <div className="pt-card" style={{ textAlign: "center", padding: "80px 20px" }}>
          <p className="pt-mono" style={{ fontSize: 13, letterSpacing: ".08em", color: "var(--pt-fg-3)" }}>
            [ AUCUNE ÉDITION POUR LE MOMENT ]
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-page-enter" style={{ padding: "0 var(--pt-pad-x) 60px" }}>
      {/* Header */}
      <section style={{ paddingTop: 40, paddingBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24 }}>
          <div>
            <PtEyebrow idx={2}>Éditions · {String(cups.length).padStart(2, "0")}</PtEyebrow>
            <h1 className="pt-display" style={{ marginTop: 18, marginBottom: 8 }}>
              Cups<em>.</em>
            </h1>
          </div>
        </div>
      </section>

      {/* Cups grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "var(--pt-gap)" }}>
        {cups.map((cup) => {
          const statusInfo = getStatusInfo(cup.status);
          const isOpen = cup.status === "published";

          return (
            <Link key={cup.id} href={`/cups/${cup.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                className="pt-card pt-card-hover"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  transition: "border-color .2s ease, transform .2s ease",
                  cursor: "pointer",
                }}
              >
                {/* Banner */}
                {cup.bannerUrl && (
                  <div style={{
                    height: 160,
                    borderRadius: 10,
                    overflow: "hidden",
                    marginTop: -8,
                    marginLeft: -8,
                    marginRight: -8,
                  }}>
                    <img
                      src={cup.bannerUrl}
                      alt={cup.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}

                {/* Status + Name */}
                <div>
                  <PtPill variant={statusInfo.variant} dot={isOpen}>
                    {statusInfo.label}
                  </PtPill>
                  <h3
                    className="pt-mono"
                    style={{
                      fontSize: 22,
                      marginTop: 14,
                      letterSpacing: "-0.01em",
                      color: "var(--pt-fg)",
                    }}
                  >
                    {cup.name}
                  </h3>
                </div>

                {/* Description */}
                {cup.description && (
                  <p style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--pt-fg-2)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {cup.description}
                  </p>
                )}

                {/* Dates */}
                <div style={{
                  display: "flex",
                  gap: 24,
                  paddingTop: 16,
                  borderTop: "1px solid var(--pt-line)",
                  fontFamily: "var(--pt-mono)",
                  fontSize: 11,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}>
                  <div>
                    <div style={{ color: "var(--pt-fg-3)" }}>Inscriptions</div>
                    <div style={{ color: "var(--pt-fg)", marginTop: 4 }}>
                      {formatDate(cup.registrationOpenAt)} → {formatDate(cup.registrationCloseAt)}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                {isOpen && (
                  <div style={{ marginTop: "auto" }}>
                    <span
                      className="pt-btn accent"
                      style={{ display: "inline-flex", fontSize: 11, padding: "10px 18px" }}
                    >
                      S&apos;inscrire →
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
