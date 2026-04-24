"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  TooltipProvider,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { QRCodeDisplay } from "~/components/features/products/qr-code-display";
import {
  convertScoreToScale,
} from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";

// Product status configuration
const productStatusConfig = {
  pending: {
    label: "A ENVOYER",
    tagClass: "warning",
    tagStyle: { borderColor: "var(--n-warning)", color: "var(--n-warning)" },
  },
  received: {
    label: "RECU",
    tagClass: "active",
    tagStyle: { borderColor: "var(--n-interactive)", color: "var(--n-interactive)" },
  },
  rating: {
    label: "EN NOTATION",
    tagClass: "",
    tagStyle: { borderColor: "var(--n-text-secondary)", color: "var(--n-text-secondary)" },
  },
  rated: {
    label: "NOTE",
    tagClass: "success",
    tagStyle: undefined,
  },
} as const;

function formatCurrency(amountInCents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateObj);
}

function calculateProgress(
  products: Array<{ status: string; finalScore?: string | null }>
): number {
  if (products.length === 0) return 0;
  const weights = { pending: 0, received: 33, rating: 66, rated: 100 };
  const totalProgress = products.reduce((sum, product) => {
    return sum + (weights[product.status as keyof typeof weights] ?? 0);
  }, 0);
  return Math.round(totalProgress / products.length);
}

function getOverallStatus(products: Array<{ status: string }>): string {
  const statusOrder = ["pending", "received", "rating", "rated"];
  let worstIndex = statusOrder.length - 1;
  for (const product of products) {
    const index = statusOrder.indexOf(product.status);
    if (index !== -1 && index < worstIndex) worstIndex = index;
  }
  return statusOrder[worstIndex] ?? "pending";
}

export default function ProducerRegistrationsPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  const { data: registrations, isLoading } = api.registration.listMyRegistrations.useQuery();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const getMyPdf = api.results.getMyPdf.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.base64}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Synthese PDF telechargee");
      setDownloadingPdf(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setDownloadingPdf(null);
    },
  });

  const computedData = useMemo(() => {
    if (!registrations) return null;

    const activeCompetitions = registrations.filter(
      (r) => r.status === "confirmed" && r.cup.status !== "completed"
    );
    const completedCompetitions = registrations.filter(
      (r) =>
        r.status === "confirmed" &&
        (r.cup.status === "completed" || r.cup.resultsPublishedAt)
    );
    const pendingPayments = registrations.filter((r) => r.status === "pending_payment");
    const productsToSend = activeCompetitions.reduce((count, reg) => {
      return count + reg.products.filter((p) => p.status === "pending").length;
    }, 0);
    const resultsAvailable = registrations.filter(
      (r) => r.cup.resultsPublishedAt && r.products.some((p) => p.finalScore)
    ).length;

    return {
      activeCompetitions,
      completedCompetitions,
      pendingPayments,
      productsToSend,
      resultsAvailable,
      totalRegistrations: registrations.length,
    };
  }, [registrations]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadPdf = (registrationId: string) => {
    setDownloadingPdf(registrationId);
    getMyPdf.mutate({ registrationId });
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ color: "var(--n-text-disabled)" }}
      >
        <span className="n-font-data text-sm tracking-widest">[LOADING...]</span>
      </div>
    );
  }

  if (!computedData) return null;

  const {
    activeCompetitions,
    completedCompetitions,
    pendingPayments,
    productsToSend,
    resultsAvailable,
  } = computedData;

  return (
    <TooltipProvider>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              PRODUCTEUR
            </div>
            <h1
              className="n-font-data text-2xl font-bold"
              style={{ color: "var(--n-text-display)" }}
            >
              MES INSCRIPTIONS
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
              Suivez vos inscriptions et le statut de vos produits
            </p>
          </div>

          {filter && (
            <Link href="/producer/registrations">
              <span
                className="n-tag"
                style={{ cursor: "pointer" }}
              >
                FILTRE: {filter === "active" ? "ACTIVES" : filter.toUpperCase()} ×
              </span>
            </Link>
          )}
        </div>

        {/* ── Actions requises ── */}
        <section>
          <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
            ACTIONS REQUISES
          </div>
          <div
            className="grid grid-cols-3 gap-px"
            style={{ backgroundColor: "var(--n-border)" }}
          >
            {/* Products to send */}
            <div
              className="p-6"
              style={{
                backgroundColor: "var(--n-surface)",
                borderBottom: productsToSend > 0 ? "2px solid var(--n-warning)" : undefined,
              }}
            >
              <div className="n-label mb-2" style={{ color: "var(--n-text-disabled)" }}>
                A ENVOYER
              </div>
              <div
                className="n-font-data text-4xl font-bold leading-none mb-2"
                style={{
                  color:
                    productsToSend > 0 ? "var(--n-warning)" : "var(--n-text-disabled)",
                }}
              >
                {productsToSend}
              </div>
              <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                {productsToSend > 0
                  ? "Preparez vos colis avec les QR codes"
                  : "Tous vos echantillons sont envoyes"}
              </p>
            </div>

            {/* Results */}
            <Link href="/producer/results" className="block">
              <div
                className="p-6 h-full transition-colors"
                style={{
                  backgroundColor: "var(--n-surface)",
                  borderBottom:
                    resultsAvailable > 0 ? "2px solid var(--n-success)" : undefined,
                }}
              >
                <div className="n-label mb-2" style={{ color: "var(--n-text-disabled)" }}>
                  RESULTATS
                </div>
                <div
                  className="n-font-data text-4xl font-bold leading-none mb-2"
                  style={{
                    color:
                      resultsAvailable > 0
                        ? "var(--n-success)"
                        : "var(--n-text-disabled)",
                  }}
                >
                  {resultsAvailable}
                </div>
                <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                  {resultsAvailable > 0
                    ? "Consultez vos scores et labels"
                    : "Aucun resultat pour le moment"}
                </p>
              </div>
            </Link>

            {/* Pending payments */}
            <div
              className="p-6"
              style={{
                backgroundColor: "var(--n-surface)",
                borderBottom:
                  pendingPayments.length > 0 ? "2px solid var(--n-accent)" : undefined,
              }}
            >
              <div className="n-label mb-2" style={{ color: "var(--n-text-disabled)" }}>
                PAIEMENTS
              </div>
              <div
                className="n-font-data text-4xl font-bold leading-none mb-2"
                style={{
                  color:
                    pendingPayments.length > 0
                      ? "var(--n-accent)"
                      : "var(--n-text-disabled)",
                }}
              >
                {pendingPayments.length}
              </div>
              <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                {pendingPayments.length > 0
                  ? "Finalisez vos inscriptions"
                  : "Tous les paiements sont a jour"}
              </p>
            </div>
          </div>
        </section>

        {/* ── Pending Payments ── */}
        {pendingPayments.length > 0 && (
          <section>
            <div className="n-label mb-4" style={{ color: "var(--n-accent)" }}>
              PAIEMENTS EN ATTENTE
            </div>
            <div className="space-y-3">
              {pendingPayments.map((registration) => (
                <div
                  key={registration.id}
                  className="n-card"
                  style={{ borderColor: "var(--n-accent)" }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p
                        className="font-semibold truncate"
                        style={{ color: "var(--n-text-display)" }}
                      >
                        {registration.cup.name}
                      </p>
                      <p className="n-label mt-1" style={{ color: "var(--n-text-disabled)" }}>
                        Platinum CBD Cup ·{" "}
                        {registration.products.length} PRODUIT
                        {registration.products.length > 1 ? "S" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p
                          className="n-font-data font-bold text-lg"
                          style={{ color: "var(--n-text-display)" }}
                        >
                          {formatCurrency(
                            registration.totalAmount,
                            registration.currency ?? "EUR"
                          )}
                        </p>
                      </div>
                      <Link href={`/cups/${registration.cup.id}/register`}>
                        <button className="n-btn-primary text-xs">
                          FINALISER LE PAIEMENT
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Active Competitions ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              COMPETITIONS EN COURS
            </span>
            {activeCompetitions.length > 0 && (
              <span
                className="n-tag"
                style={{ borderColor: "var(--n-text-secondary)", color: "var(--n-text-secondary)" }}
              >
                {activeCompetitions.length}
              </span>
            )}
          </div>

          {activeCompetitions.length === 0 ? (
            <div
              className="py-16 text-center"
              style={{ border: "1px dashed var(--n-border-visible)", borderRadius: "12px" }}
            >
              <div className="n-label mb-2" style={{ color: "var(--n-text-secondary)" }}>
                AUCUNE COMPETITION ACTIVE
              </div>
              <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
                Inscrivez-vous a une competition pour commencer.
              </p>
              <Link href="/cups">
                <button className="n-btn-secondary text-xs">
                  DECOUVRIR LES COMPETITIONS
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCompetitions.map((registration) => {
                const isExpanded = expandedCards.has(registration.id);
                const progress = calculateProgress(registration.products);
                const overallStatus = getOverallStatus(registration.products);
                const statusConf =
                  productStatusConfig[overallStatus as keyof typeof productStatusConfig];
                const progressSegments = 10;
                const filledSegments = Math.round((progress / 100) * progressSegments);

                const statusCounts = registration.products.reduce(
                  (acc, p) => {
                    acc[p.status] = (acc[p.status] ?? 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>
                );

                return (
                  <div
                    key={registration.id}
                    className="n-card"
                    style={{
                      borderColor: isExpanded
                        ? "var(--n-border-visible)"
                        : "var(--n-border)",
                    }}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleCard(registration.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="cursor-pointer">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3
                                  className="font-semibold"
                                  style={{ color: "var(--n-text-display)" }}
                                >
                                  {registration.cup.name}
                                </h3>
                                {statusConf && (
                                  <span
                                    className="n-tag"
                                    style={statusConf.tagStyle}
                                  >
                                    {statusConf.label}
                                  </span>
                                )}
                              </div>
                              <div
                                className="n-label"
                                style={{ color: "var(--n-text-disabled)" }}
                              >
                                Platinum CBD Cup ·{" "}
                                {registration.products.length} PRODUIT
                                {registration.products.length > 1 ? "S" : ""} ·{" "}
                                {formatDate(registration.createdAt)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div
                                className="n-font-data text-3xl font-bold leading-none"
                                style={{ color: "var(--n-text-display)" }}
                              >
                                {progress}%
                              </div>
                              <div
                                className="n-label mt-1"
                                style={{ color: "var(--n-text-disabled)" }}
                              >
                                PROGRESSION
                              </div>
                            </div>
                          </div>

                          {/* Segmented progress */}
                          <div className="n-progress-bar mb-3">
                            {Array.from({ length: progressSegments }).map((_, i) => (
                              <div
                                key={i}
                                className={`n-progress-segment ${i < filledSegments ? "filled" : ""}`}
                              />
                            ))}
                          </div>

                          {/* Status counts */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {Object.entries(statusCounts).map(([status, count]) => {
                              const conf =
                                productStatusConfig[
                                  status as keyof typeof productStatusConfig
                                ];
                              if (!conf) return null;
                              return (
                                <span
                                  key={status}
                                  className="n-tag"
                                  style={conf.tagStyle}
                                >
                                  {count} {conf.label}
                                </span>
                              );
                            })}
                            <span
                              className="n-font-data text-xs ml-auto"
                              style={{ color: "var(--n-text-disabled)" }}
                            >
                              {isExpanded ? "REDUIRE ▲" : "DETAIL ▼"}
                            </span>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div
                          className="mt-4 pt-4 space-y-2"
                          style={{ borderTop: "1px solid var(--n-border)" }}
                        >
                          <div
                            className="n-label mb-3"
                            style={{ color: "var(--n-text-disabled)" }}
                          >
                            DETAIL DES PRODUITS
                          </div>
                          {registration.products.map((product) => {
                            const pConf =
                              productStatusConfig[
                                product.status as keyof typeof productStatusConfig
                              ];

                            return (
                              <div
                                key={product.id}
                                className="flex items-center justify-between gap-3 py-3"
                                style={{ borderBottom: "1px solid var(--n-border)" }}
                              >
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="font-medium"
                                    style={{ color: "var(--n-text-primary)" }}
                                  >
                                    {product.name}
                                  </p>
                                  <p
                                    className="n-label mt-0.5"
                                    style={{ color: "var(--n-text-disabled)" }}
                                  >
                                    {product.category?.name ?? "SANS CATEGORIE"}
                                    {product.receivedAt && (
                                      <> · RECU LE {formatDate(product.receivedAt)}</>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {product.status === "pending" && (
                                    <QRCodeDisplay
                                      productId={product.id}
                                      productName={product.name}
                                      anonymousCode={
                                        registration.cup.resultsPublishedAt
                                          ? product.anonymousCode
                                          : null
                                      }
                                    />
                                  )}
                                  {pConf && (
                                    <span className="n-tag" style={pConf.tagStyle}>
                                      {pConf.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── History ── */}
        {completedCompetitions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                HISTORIQUE
              </span>
              <span
                className="n-tag success"
              >
                {completedCompetitions.length}
              </span>
            </div>

            <div
              className="n-card"
              style={{ padding: "0", overflow: "hidden" }}
            >
              {/* Table header */}
              <div
                className="grid gap-0 px-6 py-3"
                style={{
                  borderBottom: "1px solid var(--n-border-visible)",
                  gridTemplateColumns: "1fr auto auto auto auto",
                  gap: "16px",
                }}
              >
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  COMPETITION
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  PRODUITS
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  MONTANT
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  DATE
                </span>
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  ACTIONS
                </span>
              </div>

              {completedCompetitions.map((registration, idx) => {
                const hasResults =
                  registration.cup.resultsPublishedAt &&
                  registration.products.some((p) => p.finalScore);
                const labelsCount = registration.products.filter((p) => p.label).length;

                return (
                  <div
                    key={registration.id}
                    className="grid px-6 py-4 items-center"
                    style={{
                      borderBottom:
                        idx < completedCompetitions.length - 1
                          ? "1px solid var(--n-border)"
                          : undefined,
                      gridTemplateColumns: "1fr auto auto auto auto",
                      gap: "16px",
                    }}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/cups/${registration.cup.id}`}
                        className="font-medium hover:underline truncate block"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {registration.cup.name}
                      </Link>
                      {labelsCount > 0 && (
                        <span
                          className="n-tag mt-1"
                          style={{
                            borderColor: "var(--n-warning)",
                            color: "var(--n-warning)",
                          }}
                        >
                          {labelsCount} LABEL{labelsCount > 1 ? "S" : ""}
                        </span>
                      )}
                    </div>
                    <span
                      className="n-font-data text-sm hidden md:block"
                      style={{ color: "var(--n-text-primary)" }}
                    >
                      {registration.products.length}
                    </span>
                    <span
                      className="n-font-data text-sm hidden md:block"
                      style={{ color: "var(--n-text-primary)" }}
                    >
                      {formatCurrency(
                        registration.totalAmount,
                        registration.currency ?? "EUR"
                      )}
                    </span>
                    <span
                      className="n-font-data text-xs hidden md:block"
                      style={{ color: "var(--n-text-secondary)" }}
                    >
                      {formatDate(registration.createdAt)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasResults && (
                        <>
                          <Link href="/producer/results">
                            <button className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
                              RESULTATS
                            </button>
                          </Link>
                          <button
                            className="n-btn-secondary text-xs"
                            style={{ padding: "8px 16px" }}
                            onClick={() => handleDownloadPdf(registration.id)}
                            disabled={downloadingPdf === registration.id}
                          >
                            {downloadingPdf === registration.id ? "[...]" : "PDF"}
                          </button>
                        </>
                      )}
                      {registration.invoiceNumber && (
                        <a
                          href={`/api/invoices/${registration.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="n-btn-ghost text-xs"
                          style={{ padding: "8px 12px" }}
                        >
                          FACTURE
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {registrations?.length === 0 && (
          <div
            className="py-16 text-center"
            style={{
              border: "1px dashed var(--n-border-visible)",
              borderRadius: "12px",
            }}
          >
            <div className="n-label mb-2" style={{ color: "var(--n-text-secondary)" }}>
              AUCUNE INSCRIPTION
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
              Vous n&apos;avez pas encore participe a une competition.
            </p>
            <Link href="/cups">
              <button className="n-btn-secondary text-xs">
                DECOUVRIR LES COMPETITIONS
              </button>
            </Link>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
