"use client";

import { List, Printer, QrCode } from "lucide-react";

import { plural, type CategoryCoverage } from "./shared";

interface CategoryQrCardProps {
  category: CategoryCoverage;
  /** Lieux de distribution des codes de la catégorie. */
  destinations: string[];
  onGenerate: () => void;
  onPrint: () => void;
  onShowCodes: () => void;
}

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors hover:border-[var(--n-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

function MeterRow({
  label,
  value,
  max,
  display,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tone?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,118px)_1fr_auto] items-center gap-2.5">
      <span className="n-label truncate" style={{ fontSize: 10, color: tone ?? "var(--n-text-secondary)" }}>
        {label}
      </span>
      <div
        className="h-1.5 rounded-full"
        style={{ background: "var(--n-surface-raised)" }}
        role="presentation"
      >
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: tone ?? "var(--n-text-primary)" }}
        />
      </div>
      <span className="n-font-data text-right text-xs" style={{ color: "var(--n-text-primary)", minWidth: 44 }}>
        {display}
      </span>
    </div>
  );
}

export function CategoryQrCard({
  category,
  destinations,
  onGenerate,
  onPrint,
  onShowCodes,
}: CategoryQrCardProps) {
  const { codes, activeCount, samplesReceivedCount, ratings } = category.public;
  const target = category.targets.public;
  const ratingPct = ratings.expected > 0 ? Math.round((ratings.submitted / ratings.expected) * 100) : 0;
  const missingSamples = activeCount - samplesReceivedCount;

  let headline: { text: string; color: string };
  if (codes.generated === 0 && activeCount === 0) {
    headline = { text: "Aucun QR", color: "var(--n-accent)" };
  } else if (target !== null) {
    headline =
      activeCount >= target
        ? { text: `Objectif ${target} atteint`, color: "var(--n-success)" }
        : { text: `${activeCount} / ${target} jurés`, color: "var(--n-text-secondary)" };
  } else {
    headline = {
      text: `${activeCount} ${plural(activeCount, "juré actif", "jurés actifs")}`,
      color: activeCount > 0 ? "var(--n-text-secondary)" : "var(--n-accent)",
    };
  }

  return (
    <article className="n-card flex flex-col gap-3" style={{ padding: 20 }}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold" style={{ color: "var(--n-text-display)" }}>
            {category.name}
          </h3>
          <p className="n-label mt-0.5" style={{ color: "var(--n-text-disabled)" }}>
            {category.productsCount} {plural(category.productsCount, "produit")} à noter
          </p>
        </div>
        <span className="n-label shrink-0 text-right" style={{ color: headline.color }}>
          {headline.text}
        </span>
      </header>

      {codes.generated === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center"
          style={{ borderColor: "var(--n-border-visible)" }}
        >
          <QrCode className="mb-1 h-7 w-7" style={{ color: "var(--n-text-disabled)" }} aria-hidden="true" />
          <p className="text-sm" style={{ color: "var(--n-text-primary)" }}>
            Pas encore de QR pour cette catégorie.
          </p>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            Générez un lot à glisser dans les box.
          </p>
          <button type="button" onClick={onGenerate} className="n-btn-primary mt-3" style={{ minHeight: 34, padding: "6px 16px", fontSize: 12 }}>
            Générer des QR
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <MeterRow label="Générés" value={codes.generated} max={codes.generated} display={String(codes.generated)} />
            <MeterRow label="En attente" value={codes.pending} max={codes.generated} display={String(codes.pending)} />
            <MeterRow label="Activés" value={codes.activated} max={codes.generated} display={String(codes.activated)} />
            <MeterRow
              label="Échantillons reçus"
              value={samplesReceivedCount}
              max={activeCount}
              display={`${samplesReceivedCount} / ${activeCount}`}
              tone={missingSamples > 0 ? "var(--n-warning)" : undefined}
            />
            <MeterRow
              label="Avancement"
              value={ratings.submitted}
              max={ratings.expected}
              display={ratings.expected > 0 ? `${ratingPct} %` : "—"}
            />
          </div>

          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--n-text-secondary)" }}>
            <div className="flex gap-1">
              <dt>Jurés actifs</dt>
              <dd className="n-font-data" style={{ color: "var(--n-text-primary)" }}>{activeCount}</dd>
            </div>
            {codes.revoked > 0 && (
              <div className="flex gap-1">
                <dt>Révoqués</dt>
                <dd className="n-font-data" style={{ color: "var(--n-text-primary)" }}>{codes.revoked}</dd>
              </div>
            )}
            {codes.expired > 0 && (
              <div className="flex gap-1">
                <dt>Expirés</dt>
                <dd className="n-font-data" style={{ color: "var(--n-text-primary)" }}>{codes.expired}</dd>
              </div>
            )}
            {codes.samplesIncluded > 0 && (
              <div className="flex gap-1">
                <dt>Avec box</dt>
                <dd className="n-font-data" style={{ color: "var(--n-text-primary)" }}>{codes.samplesIncluded}</dd>
              </div>
            )}
          </dl>

          {destinations.length > 0 && (
            <p className="truncate text-xs" style={{ color: "var(--n-text-secondary)" }} title={destinations.join(" · ")}>
              Lieux : {destinations.join(" · ")}
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onGenerate} className={btn} style={{ borderColor: "var(--n-border-visible)", color: "var(--n-text-display)" }}>
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Générer
            </button>
            <button
              type="button"
              onClick={onPrint}
              disabled={codes.pending === 0}
              className={btn}
              style={{ borderColor: "var(--n-border-visible)", color: "var(--n-text-display)" }}
              title={codes.pending === 0 ? "Aucun QR en attente à imprimer" : undefined}
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Imprimer la planche{codes.pending > 0 ? ` (${codes.pending})` : ""}
            </button>
            <button
              type="button"
              onClick={onShowCodes}
              className={`${btn} sm:ml-auto`}
              style={{ borderColor: "var(--n-border-visible)", color: "var(--n-text-secondary)" }}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              Voir les codes
            </button>
          </div>
        </>
      )}
    </article>
  );
}
