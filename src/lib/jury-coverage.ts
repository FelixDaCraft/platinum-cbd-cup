/**
 * État de couverture d'une catégorie par les jurys (écran principal du
 * back-office jurés). Fonction pure : partagée entre le serveur et l'UI.
 *
 *   - critical   : aucun juré actif dans l'un des deux panels ;
 *   - incomplete : un panel est sous l'objectif fixé sur la catégorie ;
 *   - ready      : sinon (aucun objectif = pas d'exigence au-delà de 1 juré).
 */

export const coverageStatusEnum = ["critical", "incomplete", "ready"] as const;
export type CoverageStatus = (typeof coverageStatusEnum)[number];

export interface CoverageStatusInput {
  /** Jurés pro actifs assignés à la catégorie. */
  activePro: number;
  /** Jurés publics actifs assignés à la catégorie. */
  activePublic: number;
  /** Objectifs de la catégorie (null = pas d'objectif). */
  targetPro: number | null;
  targetPublic: number | null;
}

export function computeCoverageStatus(input: CoverageStatusInput): CoverageStatus {
  if (input.activePro <= 0 || input.activePublic <= 0) return "critical";

  const belowPro = input.targetPro !== null && input.activePro < input.targetPro;
  const belowPublic = input.targetPublic !== null && input.activePublic < input.targetPublic;
  if (belowPro || belowPublic) return "incomplete";

  return "ready";
}

/** Statut effectif d'un code : un code en attente passé sa date est expiré. */
export function effectiveCodeStatus(
  code: { status: string; expiresAt: Date | null },
  now: Date = new Date()
): "pending" | "activated" | "revoked" | "expired" {
  if (code.status === "pending" && code.expiresAt && code.expiresAt < now) return "expired";
  return code.status as "pending" | "activated" | "revoked" | "expired";
}
