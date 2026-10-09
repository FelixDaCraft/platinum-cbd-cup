import type { RouterOutputs } from "~/trpc/react";

export type QrCodeRow = RouterOutputs["juryCodes"]["list"][number];
export type CategoryCoverage = RouterOutputs["jury"]["getCoverage"]["categories"][number];
export type CodeStatus = "pending" | "activated" | "revoked" | "expired";

/** Ce qu'il faut pour imprimer un QR : le code et les catégories qu'il ouvre. */
export interface PrintableCode {
  code: string;
  categories: string[];
}

export const STATUS_META: Record<CodeStatus, { label: string; color: string }> = {
  pending: { label: "En attente", color: "var(--n-warning)" },
  activated: { label: "Activé", color: "var(--n-success)" },
  revoked: { label: "Révoqué", color: "var(--n-accent)" },
  expired: { label: "Expiré", color: "var(--n-text-disabled)" },
};

/** Le QR encode le lien d'activation : le code est aussi lisible en clair dessous. */
export function getActivationUrl(code: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return `${baseUrl}/activate?code=${encodeURIComponent(code)}`;
}

export function formatDate(value: Date | string | null | undefined, long = false): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(
    "fr-FR",
    long ? { day: "numeric", month: "long", year: "numeric" } : undefined
  );
}

export const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
  n === 1 ? singular : pluralForm;
