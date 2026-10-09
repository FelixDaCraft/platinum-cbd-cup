"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { JURY_PANEL_LABELS } from "~/lib/enums";
import type { CupJuror } from "./shared";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="n-label space-y-2" style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: 12 }}>
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // On garde le dialogue ouvert jusqu'à la réponse du serveur.
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="n-label"
            style={destructive ? { background: "var(--n-accent)", color: "var(--n-text-display)" } : undefined}
          >
            {pending ? "[...]" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Confirmation du changement de jury : les brouillons non soumis sont
 * supprimés, et le serveur refuse dès qu'une note a été soumise.
 */
export function ChangePanelDialog({
  juror,
  submittedCount,
  pending,
  onConfirm,
  onCancel,
}: {
  juror: CupJuror | null;
  /** Notes déjà soumises dans la cup (indicatif ; le serveur tranche). */
  submittedCount: number;
  pending: boolean;
  onConfirm: (panel: "pro" | "public") => void;
  onCancel: () => void;
}) {
  const target = juror?.panel === "pro" ? "public" : "pro";
  const blocked = submittedCount > 0;
  return (
    <AlertDialog open={!!juror} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Changer de jury ?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="n-label space-y-2" style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: 12 }}>
              {juror && (
                <p>
                  <strong className="text-[var(--n-text-primary)]">{juror.user.name ?? juror.user.email}</strong> passe du{" "}
                  {JURY_PANEL_LABELS[juror.panel].toLowerCase()} au{" "}
                  <strong className="text-[var(--n-text-primary)]">{JURY_PANEL_LABELS[target].toLowerCase()}</strong>. Ses
                  catégories sont conservées.
                </p>
              )}
              <p>
                Ses brouillons de notation non soumis seront <strong className="text-[var(--n-text-primary)]">supprimés</strong> :
                ils portent sur la grille de critères de l&apos;autre jury.
              </p>
              <p>Le changement est refusé dès que le juré a soumis au moins une note dans cette cup.</p>
              {blocked && (
                <p role="alert" style={{ color: "var(--n-accent)" }}>
                  Ce juré a déjà soumis {submittedCount} note{submittedCount > 1 ? "s" : ""} : son jury ne peut plus être
                  changé.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm(target);
            }}
            disabled={pending || blocked}
            className="n-label"
          >
            {pending ? "[...]" : `Passer au ${JURY_PANEL_LABELS[target].toLowerCase()}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
