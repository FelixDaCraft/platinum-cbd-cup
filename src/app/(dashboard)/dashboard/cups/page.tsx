"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { CupCreateForm } from "~/components/features/cups/cup-create-form";
import { getStatusLabel } from "~/lib/validations/cup";

/**
 * Cups list page — Nothing design system
 * Route: /dashboard/cups
 */
export default function CupsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: cups, isLoading } = api.cup.list.useQuery();
  const { data: historicalCups, isLoading: historicalLoading } =
    api.historicalImport.list.useQuery();

  if (isLoading || historicalLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
        }}
      >
        <span
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: "12px",
            letterSpacing: "0.08em",
            color: "var(--n-text-secondary)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  const isEmpty =
    (cups?.length ?? 0) === 0 && (historicalCups?.length ?? 0) === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            className="n-font-display"
            style={{
              fontSize: "28px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--n-text-display)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            MES CUPS
          </h1>
          <p
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              marginTop: "4px",
            }}
          >
            Gérez vos compétitions de dégustation
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link href="/dashboard/cups/import-history">
            <button className="n-btn-secondary">IMPORTER HISTORIQUE</button>
          </Link>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="n-btn-primary">+ NOUVELLE CUP</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle
                  className="n-font-display"
                  style={{ color: "var(--n-text-display)" }}
                >
                  CRÉER UNE NOUVELLE CUP
                </DialogTitle>
                <DialogDescription
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "14px",
                    color: "var(--n-text-secondary)",
                  }}
                >
                  Définissez les informations de base de votre compétition.
                </DialogDescription>
              </DialogHeader>
              <CupCreateForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty State */}
      {isEmpty ? (
        <div
          className="n-card"
          style={{
            padding: "64px 32px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <p
            className="n-font-body"
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "var(--n-text-disabled)",
              textTransform: "uppercase",
            }}
          >
            AUCUNE CUP
          </p>
          <p
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              maxWidth: "360px",
              lineHeight: 1.5,
            }}
          >
            Créez votre première compétition pour commencer à organiser des
            dégustations professionnelles.
          </p>
          <div
            style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}
          >
            <button
              className="n-btn-primary"
              onClick={() => setDialogOpen(true)}
            >
              CRÉER MA PREMIÈRE CUP
            </button>
            <Link href="/dashboard/cups/import-history">
              <button className="n-btn-secondary">IMPORTER UN HISTORIQUE</button>
            </Link>
          </div>
        </div>
      ) : (
        /* Cups Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {cups?.map((cup) => {
            const statusInfo = getStatusLabel(cup.status);
            const tagStyle = getStatusTagStyle(cup.status);

            return (
              <Link
                key={cup.id}
                href={`/dashboard/cups/${cup.id}`}
                style={{ display: "block", textDecoration: "none" }}
              >
                <div
                  className="n-card"
                  style={{
                    padding: "20px",
                    height: "100%",
                    cursor: "pointer",
                    transition: "border-color 150ms ease-out",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "var(--n-border-visible)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "var(--n-border)";
                  }}
                >
                  {/* Card top row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <h3
                      className="n-font-display"
                      style={{
                        fontSize: "16px",
                        fontWeight: 500,
                        color: "var(--n-text-display)",
                        margin: 0,
                        lineHeight: 1.2,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cup.name}
                    </h3>
                    <span
                      className="n-tag"
                      style={{
                        flexShrink: 0,
                        ...tagStyle,
                      }}
                    >
                      {statusInfo.label.toUpperCase()}
                    </span>
                  </div>

                  {/* Cup type */}
                  <p
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.08em",
                      color: "var(--n-text-disabled)",
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {cup.type === "public" ? "PUBLIQUE" : "PRO"}
                  </p>

                  {/* Description */}
                  {cup.description && (
                    <p
                      className="n-font-body"
                      style={{
                        fontSize: "13px",
                        color: "var(--n-text-secondary)",
                        margin: 0,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {cup.description}
                    </p>
                  )}

                  {/* Footer */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--n-border)",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        letterSpacing: "0.06em",
                        color: "var(--n-text-disabled)",
                        textTransform: "uppercase",
                      }}
                    >
                      CONFIGURER &gt;
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Add new cup card */}
          <button
            onClick={() => setDialogOpen(true)}
            style={{
              background: "transparent",
              border: "1px dashed var(--n-border-visible)",
              borderRadius: "12px",
              padding: "20px",
              minHeight: "160px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "border-color 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--n-text-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--n-border-visible)";
            }}
          >
            <span
              style={{
                fontSize: "20px",
                color: "var(--n-text-disabled)",
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "var(--n-text-disabled)",
                textTransform: "uppercase",
              }}
            >
              AJOUTER UNE CUP
            </span>
          </button>
        </div>
      )}

      {/* Historical Cups Section */}
      {historicalCups && historicalCups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Section header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingBottom: "12px",
              borderBottom: "1px solid var(--n-border)",
            }}
          >
            <span
              style={{
                fontFamily: '"Doto", "Space Mono", monospace',
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "var(--n-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              ÉDITIONS HISTORIQUES
            </span>
            <span
              className="n-tag"
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: "var(--n-text-disabled)",
                border: "1px solid var(--n-border-visible)",
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              {historicalCups.length}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {historicalCups.map((cup) => (
              <div
                key={cup.id}
                className="n-card"
                style={{
                  padding: "20px",
                  border: "1px dashed var(--n-border-visible)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {/* Top row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <h3
                    className="n-font-display"
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "var(--n-text-primary)",
                      margin: 0,
                      lineHeight: 1.2,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cup.name}
                  </h3>
                  <span
                    className="n-tag"
                    style={{
                      flexShrink: 0,
                      fontFamily: '"Space Mono", monospace',
                      fontSize: "10px",
                      letterSpacing: "0.06em",
                      color: "var(--n-text-disabled)",
                      border: "1px solid var(--n-border-visible)",
                      borderRadius: "4px",
                      padding: "3px 8px",
                    }}
                  >
                    HISTORIQUE
                  </span>
                </div>

                {/* Year & edition */}
                <p
                  style={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    color: "var(--n-text-disabled)",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {cup.year}
                  {cup.edition ? ` — ${cup.edition}` : ""}
                </p>

                {/* Description */}
                {cup.description && (
                  <p
                    className="n-font-body"
                    style={{
                      fontSize: "13px",
                      color: "var(--n-text-secondary)",
                      margin: 0,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {cup.description}
                  </p>
                )}

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--n-border)",
                  }}
                >
                  <StatItem label="PRODUITS" value={cup.productsCount ?? 0} />
                  <StatItem
                    label="PRODUCTEURS"
                    value={cup.producersCount ?? 0}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper: small stat display */
function StatItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span
        style={{
          fontSize: "10px",
          letterSpacing: "0.08em",
          color: "var(--n-text-disabled)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: "14px",
          color: "var(--n-text-primary)",
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* Helper: derive n-tag border/text color from cup status */
function getStatusTagStyle(status: string): React.CSSProperties {
  switch (status) {
    case "active":
    case "registration":
      return {
        color: "var(--n-success)",
        border: "1px solid var(--n-success)",
        borderRadius: "999px",
        padding: "3px 10px",
        fontFamily: '"Space Mono", monospace',
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      };
    case "rating":
      return {
        color: "var(--n-warning)",
        border: "1px solid var(--n-warning)",
        borderRadius: "999px",
        padding: "3px 10px",
        fontFamily: '"Space Mono", monospace',
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      };
    case "completed":
    case "published":
      return {
        color: "var(--n-text-secondary)",
        border: "1px solid var(--n-border-visible)",
        borderRadius: "999px",
        padding: "3px 10px",
        fontFamily: '"Space Mono", monospace',
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      };
    case "draft":
    default:
      return {
        color: "var(--n-text-disabled)",
        border: "1px solid var(--n-border-visible)",
        borderRadius: "999px",
        padding: "3px 10px",
        fontFamily: '"Space Mono", monospace',
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      };
  }
}
