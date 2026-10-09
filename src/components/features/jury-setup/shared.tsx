"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";
import type { CoverageStatus } from "~/lib/jury-coverage";
import { api, type RouterOutputs } from "~/trpc/react";

export type JuryCoverageData = RouterOutputs["jury"]["getCoverage"];
export type CategoryCoverageData = JuryCoverageData["categories"][number];
export type CupJuror = RouterOutputs["jury"]["listJuries"][number];
export type JuryPanel = "pro" | "public";

/** Préréglage d'ouverture du tiroir « Ajouter des jurés ». */
export interface AddJurorsPreset {
  panel?: JuryPanel;
  categoryId?: string;
  /** Méthode ouverte d'emblée (sinon : juré existant en pro, QR en public). */
  method?: "email" | "existing" | "qr";
}

export const DOTO_TITLE = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "20px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 700,
  color: "var(--n-text-display)",
} as const;

export const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
  n === 1 || n === 0 ? singular : pluralForm;

export const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export const panelShort = (panel: JuryPanel) => (panel === "pro" ? "PRO" : "PUBLIC");

/** URL de la page des QR codes du jury public. */
export function qrCodesHref(cupId: string, opts: { categoryId?: string; generate?: boolean } = {}) {
  const params = new URLSearchParams();
  if (opts.generate) params.set("generate", "1");
  if (opts.categoryId) params.set("category", opts.categoryId);
  const qs = params.toString();
  return `/dashboard/cups/${cupId}/scoring/invitation-codes${qs ? `?${qs}` : ""}`;
}

/** Invalide tout ce qui dépend de la composition du jury d'une cup. */
export function useInvalidateJury(cupId: string) {
  const utils = api.useUtils();
  return () => {
    void utils.jury.listJuries.invalidate({ cupId });
    void utils.jury.getCoverage.invalidate({ cupId });
    void utils.jury.getInvitationStats.invalidate({ cupId });
    void utils.jury.listInvitations.invalidate({ cupId });
    void utils.jury.getCompletionStats.invalidate({ cupId });
    void utils.jury.listDirectory.invalidate();
  };
}

const STATUS_META: Record<
  CoverageStatus,
  { label: string; color: string; Icon: typeof CheckCircle2 }
> = {
  ready: { label: "PRÊTE", color: "var(--n-success)", Icon: CheckCircle2 },
  incomplete: { label: "À COMPLÉTER", color: "var(--n-warning)", Icon: CircleDot },
  critical: { label: "CRITIQUE", color: "var(--n-accent)", Icon: AlertTriangle },
};

/** Statut de couverture : libellé + icône + couleur (jamais la couleur seule). */
export function CoverageStatusBadge({ status }: { status: CoverageStatus }) {
  const { label, color, Icon } = STATUS_META[status];
  return (
    <span
      className="n-tag"
      style={{ borderColor: color, color, gap: 6, padding: "3px 10px", whiteSpace: "nowrap" }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function TagBadge({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return (
    <span
      className="n-label"
      title={title}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        border: `1px solid ${color}`,
        color,
        fontSize: "11px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Barre d'avancement fine, accessible. */
export function ThinProgress({
  value,
  color = "var(--n-text-display)",
  label,
}: {
  value: number;
  color?: string;
  label: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      style={{ height: 4, background: "var(--n-border)", borderRadius: 2, overflow: "hidden" }}
    >
      <div style={{ width: `${v}%`, height: "100%", background: color, transition: "width 200ms ease-out" }} />
    </div>
  );
}

export function LoadingState({ minHeight = 200 }: { minHeight?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight }}>
      <span className="n-label">[LOADING...]</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center py-12">
      <span role="alert" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
        [ERREUR] {message}
      </span>
      <button type="button" className="n-btn-secondary text-xs" onClick={onRetry}>
        RÉESSAYER
      </button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto mb-3 flex justify-center text-[var(--n-text-disabled)]">{icon}</div>}
      <p className="n-font-body font-medium text-[var(--n-text-secondary)]">{title}</p>
      {hint && <p className="n-label text-[var(--n-text-disabled)] mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
