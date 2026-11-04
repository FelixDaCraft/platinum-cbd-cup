"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useServerError } from "~/i18n/server-error";
import { Link } from "~/i18n/navigation";
import { toast } from "sonner";
import { formatPanelCodes } from "~/lib/panel-codes";

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
import { CoaControl } from "~/components/features/products/coa-control";
import { ParcelShipmentPanel } from "~/components/producer/parcel-shipment-panel";
import {
  sameParcelRegistrations,
  shipmentCandidates,
  type RegistrationParcelFacts,
} from "~/lib/parcel-shipment";
import {
  convertScoreToScale,
} from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";
import { formatDate as formatLocaleDate, intlLocale, type Locale } from "~/i18n/locales";

// Product status configuration
const productStatusConfig = {
  pending: {
    labelKey: "statusPending",
    tagClass: "warning",
    tagStyle: { borderColor: "var(--n-warning)", color: "var(--n-warning)" },
  },
  received: {
    labelKey: "statusReceived",
    tagClass: "active",
    tagStyle: { borderColor: "var(--n-interactive)", color: "var(--n-interactive)" },
  },
  rating: {
    labelKey: "statusRating",
    tagClass: "",
    tagStyle: { borderColor: "var(--n-text-secondary)", color: "var(--n-text-secondary)" },
  },
  rated: {
    labelKey: "statusRated",
    tagClass: "success",
    tagStyle: undefined,
  },
} as const;

/**
 * Libellé d'un statut produit. Un produit encore « à envoyer » dont le colis
 * est déclaré expédié s'affiche « expédié » : il n'y a plus rien à faire.
 */
function statusLabelKey(
  status: keyof typeof productStatusConfig,
  shipped: boolean
): string {
  return status === "pending" && shipped ? "statusShipped" : productStatusConfig[status].labelKey;
}

function formatCurrency(amountInCents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
}

function formatDate(date: Date | string | null | undefined, locale: Locale): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return formatLocaleDate(dateObj, locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Une inscription vue du colis commun : payée, de la même cup, rien de reçu. */
function parcelFactsOf(reg: {
  id: string;
  status: string;
  createdAt: Date | string;
  shipmentGroupId: string | null;
  cup: { id: string };
  products: { status: string }[];
}): RegistrationParcelFacts & { productCount: number } {
  return {
    id: reg.id,
    // Toutes les inscriptions de la page sont celles du producteur connecté.
    producerId: "self",
    cupId: reg.cup.id,
    competing: reg.status === "confirmed",
    productStatuses: reg.products.map((p) => p.status),
    shipmentGroupId: reg.shipmentGroupId,
    createdAt: reg.createdAt,
    productCount: reg.products.length,
  };
}

const linkedOf = (r: { id: string; createdAt: Date | string; productCount: number }) => ({
  id: r.id,
  createdAt: r.createdAt,
  productCount: r.productCount,
});

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
  const t = useTranslations("producerRegistrations");
  const tc = useTranslations("producerSpace");
  const serverError = useServerError();
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  const {
    data: registrations,
    isLoading,
    isError,
    refetch,
  } = api.registration.listMyRegistrations.useQuery();
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
      toast.success(t("pdfDownloaded"));
      setDownloadingPdf(null);
    },
    onError: (error) => {
      toast.error(serverError(error));
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
    // Un colis déclaré expédié n'est plus « à envoyer ».
    const productsToSend = activeCompetitions.reduce((count, reg) => {
      if (reg.shippedAt) return count;
      return count + reg.products.filter((p) => p.status === "pending").length;
    }, 0);
    const resultsAvailable = registrations.filter(
      (r) =>
        r.cup.resultsPublishedAt &&
        r.products.some((p) => p.finalScorePro ?? p.finalScorePublic)
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
        <span className="n-font-data text-sm tracking-widest">{tc("loading")}</span>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une liste vide :
  // « vous n'avez rien » est plausible et masquerait l'incident.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-font-data text-sm tracking-widest" style={{ color: "var(--n-text-secondary)" }}>
          {t("error")}
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          {tc("retry")}
        </button>
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
              {t("eyebrow")}
            </div>
            <h1
              className="n-font-data text-2xl font-bold"
              style={{ color: "var(--n-text-display)" }}
            >
              {t("title")}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
              {t("subtitle")}
            </p>
          </div>

          {filter && (
            <Link href="/producer/registrations">
              <span
                className="n-tag"
                style={{ cursor: "pointer" }}
              >
                {t("filter", { filter: filter === "active" ? t("filterActive") : filter.toUpperCase() })}
              </span>
            </Link>
          )}
        </div>

        {/* ── Actions requises ── */}
        <section>
          <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
            {t("actionsRequired")}
          </div>
          <div
            className="grid grid-cols-1 gap-px sm:grid-cols-3"
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
                {t("toSend")}
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
                  ? t("toSendYes")
                  : t("toSendNo")}
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
                  {t("results")}
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
                    ? t("resultsYes")
                    : t("resultsNo")}
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
                {t("payments")}
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
                  ? t("paymentsYes")
                  : t("paymentsNo")}
              </p>
            </div>
          </div>
        </section>

        {/* ── Pending Payments ── */}
        {pendingPayments.length > 0 && (
          <section>
            <div className="n-label mb-4" style={{ color: "var(--n-accent)" }}>
              {t("pendingPayments")}
            </div>
            <div className="space-y-3">
              {pendingPayments.map((registration) => (
                <div
                  key={registration.id}
                  className="n-card"
                  style={{ borderColor: "var(--n-accent)" }}
                >
                  {/* En colonne sur mobile : sur une seule ligne, le prix et le
                      bouton (non compressibles) écrasaient le texte à 0 px. */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p
                        className="font-semibold break-words sm:truncate"
                        style={{ color: "var(--n-text-display)" }}
                      >
                        {registration.cup.name}
                      </p>
                      <p className="n-label mt-1" style={{ color: "var(--n-text-disabled)" }}>
                        Platinum CBD Cup ·{" "}
                        {t("products", { count: registration.products.length })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-4">
                      <div className="sm:text-right">
                        <p
                          className="n-font-data font-bold text-lg"
                          style={{ color: "var(--n-text-display)" }}
                        >
                          {formatCurrency(
                            registration.totalAmount,
                            registration.currency ?? "EUR",
                            locale
                          )}
                        </p>
                      </div>
                      <Link href={`/cups/${registration.cup.id}/register`} className="n-btn-primary text-xs">
                        {t("finishPayment")}
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
              {t("ongoing")}
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
                {t("noActive")}
              </div>
              <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
                {t("noActiveText")}
              </p>
              <Link href="/cups" className="n-btn-secondary text-xs">{t("discover")}</Link>
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
                                    {t(statusLabelKey(overallStatus as keyof typeof productStatusConfig, !!registration.shippedAt))}
                                  </span>
                                )}
                              </div>
                              <div
                                className="n-label"
                                style={{ color: "var(--n-text-disabled)" }}
                              >
                                Platinum CBD Cup ·{" "}
                                {t("products", { count: registration.products.length })} ·{" "}
                                {formatDate(registration.createdAt, locale)}
                              </div>
                              {/* Inscription réglée, cup encore ouverte : un autre
                                  produit passe par une commande complémentaire. */}
                              {registration.cup.status === "published" && (
                                <Link
                                  href={`/cups/${registration.cup.id}/register`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="n-btn-secondary text-xs inline-block mt-3"
                                >
                                  {t("addProduct")}
                                </Link>
                              )}
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
                                {t("progress")}
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
                                  {count} {t(statusLabelKey(status as keyof typeof productStatusConfig, !!registration.shippedAt))}
                                </span>
                              );
                            })}
                            <span
                              className="n-font-data text-xs ml-auto"
                              style={{ color: "var(--n-text-disabled)" }}
                            >
                              {isExpanded ? t("collapse") : t("expand")}
                            </span>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {/* Hors du déclencheur : toujours visible, et un clic
                          dans le formulaire ne replie pas la carte. */}
                      <ParcelShipmentPanel
                        registrationId={registration.id}
                        shippedAt={registration.shippedAt}
                        carrier={registration.shippingCarrier}
                        trackingNumber={registration.trackingNumber}
                        productStatuses={registration.products.map((p) => p.status)}
                        samplesDeadline={registration.cup.samplesDeadline}
                        candidates={shipmentCandidates(parcelFactsOf(registration), (registrations ?? []).map(parcelFactsOf)).map(linkedOf)}
                        sameParcel={sameParcelRegistrations(parcelFactsOf(registration), (registrations ?? []).map(parcelFactsOf)).map(linkedOf)}
                        onChanged={() => void refetch()}
                      />

                      <CollapsibleContent>
                        <div
                          className="mt-4 pt-4 space-y-2"
                          style={{ borderTop: "1px solid var(--n-border)" }}
                        >
                          <div
                            className="n-label mb-3"
                            style={{ color: "var(--n-text-disabled)" }}
                          >
                            {t("productDetail")}
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
                                    {product.category?.name ?? t("noCategory")}
                                    {product.receivedAt && (
                                      <> · {t("receivedOn", { date: formatDate(product.receivedAt, locale) })}</>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {/* Certificat d'analyse, facultatif : vu par l'organisation seule */}
                                  <CoaControl
                                    productId={product.id}
                                    coaFile={product.coaFile}
                                    onChanged={() => void refetch()}
                                  />
                                  {product.status === "pending" && (
                                    <QRCodeDisplay
                                      productId={product.id}
                                      productName={product.name}
                                      anonymousCode={
                                        registration.cup.resultsPublishedAt
                                          ? formatPanelCodes(
                                              product.anonymousCodePro,
                                              product.anonymousCodePublic
                                            )
                                          : null
                                      }
                                    />
                                  )}
                                  {pConf && (
                                    <span className="n-tag" style={pConf.tagStyle}>
                                      {t(statusLabelKey(product.status as keyof typeof productStatusConfig, !!registration.shippedAt))}
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
                {t("history")}
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
              {/* Table header — masqué sur mobile, où chaque ligne passe en
                  colonne (nom, puis actions) au lieu de tronquer le nom. */}
              <div
                className="hidden md:grid md:grid-cols-[1fr_auto_auto_auto_auto] px-6 py-3"
                style={{
                  borderBottom: "1px solid var(--n-border-visible)",
                  gap: "16px",
                }}
              >
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  {t("colCompetition")}
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  {t("colProducts")}
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  {t("colAmount")}
                </span>
                <span
                  className="n-label hidden md:block"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  {t("colDate")}
                </span>
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  {t("colActions")}
                </span>
              </div>

              {completedCompetitions.map((registration, idx) => {
                const hasResults =
                  registration.cup.resultsPublishedAt &&
                  registration.products.some((p) => p.finalScorePro ?? p.finalScorePublic);
                const labelsCount = registration.products.filter((p) => p.label).length;

                return (
                  <div
                    key={registration.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] px-6 py-4 md:items-center"
                    style={{
                      borderBottom:
                        idx < completedCompetitions.length - 1
                          ? "1px solid var(--n-border)"
                          : undefined,
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
                          {t("labelsCount", { count: labelsCount })}
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
                        registration.currency ?? "EUR",
                        locale
                      )}
                    </span>
                    <span
                      className="n-font-data text-xs hidden md:block"
                      style={{ color: "var(--n-text-secondary)" }}
                    >
                      {formatDate(registration.createdAt, locale)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasResults && (
                        <>
                          <Link href="/producer/results" className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
                            {t("results")}
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
                          {t("invoice")}
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
              {t("empty")}
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--n-text-disabled)" }}>
              {t("emptyText")}
            </p>
            <Link href="/cups" className="n-btn-secondary text-xs">{t("discover")}</Link>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
