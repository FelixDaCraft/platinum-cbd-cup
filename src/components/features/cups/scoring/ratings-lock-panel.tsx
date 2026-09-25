"use client";

import { useState } from "react";
import { Lock, LockOpen, ShieldAlert, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
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
import { api } from "~/trpc/react";

interface RatingsLockPanelProps {
  cupId: string;
}

/**
 * Commande de verrouillage des notations, pour l'organisateur.
 *
 * `jury.lockRatings` fonctionne en deux temps : un premier appel sans `confirm`
 * ne verrouille rien et renvoie le nombre de notes et de produits concernés,
 * qu'on affiche dans la confirmation ; le second appel avec `confirm: true`
 * verrouille. L'action est irréversible et bascule la cup en « terminée », d'où
 * la confirmation explicite.
 */
export function RatingsLockPanel({ cupId }: RatingsLockPanelProps) {
  const [pendingStats, setPendingStats] = useState<{
    totalProducts: number;
    totalRatings: number;
  } | null>(null);

  const utils = api.useUtils();

  const { data: lockStatus, isLoading } = api.jury.getRatingLockStatus.useQuery({
    cupId,
  });

  const lockMutation = api.jury.lockRatings.useMutation({
    onSuccess: (data) => {
      // Première phase : le serveur réclame une confirmation et renvoie les stats.
      if ("requiresConfirmation" in data && data.requiresConfirmation) {
        setPendingStats(data.stats);
        return;
      }

      setPendingStats(null);

      if ("alreadyLocked" in data && data.alreadyLocked) {
        toast.info("Les notations étaient déjà verrouillées");
      } else {
        toast.success("Notations verrouillées — les résultats sont définitifs");
      }

      void utils.jury.getRatingLockStatus.invalidate({ cupId });
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.scoring.invalidate();
      void utils.results.invalidate();
    },
    onError: (error) => {
      setPendingStats(null);
      toast.error(error.message);
    },
  });

  if (isLoading || !lockStatus) {
    return (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </p>
      </div>
    );
  }

  const { isLocked, isManuallyLocked, isAutoLocked } = lockStatus;

  const formatDateTime = (value: Date | string) =>
    new Date(value).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColor = isLocked ? "var(--n-success)" : "var(--n-warning)";
  const StatusIcon = isLocked ? Lock : LockOpen;

  return (
    <>
      <div
        style={{
          background: "var(--n-surface)",
          border: `1px solid ${isLocked ? "var(--n-border)" : "var(--n-border-visible)"}`,
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <StatusIcon
              className="h-5 w-5 shrink-0 mt-0.5"
              strokeWidth={1.5}
              style={{ color: statusColor }}
            />
            <div>
              <p
                className="n-font-body text-sm font-semibold"
                style={{ color: "var(--n-text-display)" }}
              >
                Verrouillage des notations
              </p>
              <p
                className="n-label mt-0.5"
                style={{ color: statusColor }}
              >
                {isManuallyLocked
                  ? "NOTATIONS VERROUILLÉES"
                  : isAutoLocked
                    ? "VERROUILLÉES (DATE DE FIN DÉPASSÉE)"
                    : "NOTATIONS OUVERTES"}
              </p>

              {isManuallyLocked && lockStatus.ratingsLockedAt && (
                <p
                  className="n-label mt-2"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  Le {formatDateTime(lockStatus.ratingsLockedAt)}
                  {lockStatus.lockedBy
                    ? ` par ${lockStatus.lockedBy.name ?? lockStatus.lockedBy.email}`
                    : ""}
                </p>
              )}

              {!isManuallyLocked && isAutoLocked && lockStatus.ratingEndAt && (
                <p
                  className="n-label mt-2"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  La date de fin de notation est passée (
                  {formatDateTime(lockStatus.ratingEndAt)}). Verrouillez
                  manuellement pour rendre les résultats définitifs.
                </p>
              )}

              {!isLocked && (
                <p
                  className="n-label mt-2"
                  style={{ color: "var(--n-text-disabled)", maxWidth: "460px" }}
                >
                  Les jurys peuvent encore modifier leurs notes. Le
                  verrouillage clôt définitivement la phase de notation et
                  bascule la cup en « terminée ».
                </p>
              )}
            </div>
          </div>

          {!isManuallyLocked && (
            <Button
              size="sm"
              className="n-label shrink-0"
              disabled={lockMutation.isPending}
              onClick={() => lockMutation.mutate({ cupId })}
            >
              {lockMutation.isPending ? (
                "[...]"
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Verrouiller les notations
            </Button>
          )}
        </div>

        {isManuallyLocked && (
          <div
            className="flex items-center gap-2 mt-4 pt-4"
            style={{ borderTop: "1px solid var(--n-border)" }}
          >
            <Timer
              className="h-4 w-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--n-text-disabled)" }}
            />
            <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              Plus aucune note ne peut être soumise ni modifiée.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation — les chiffres viennent du premier appel au serveur */}
      <AlertDialog
        open={!!pendingStats}
        onOpenChange={(open) => {
          if (!open) setPendingStats(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className="n-font-body font-bold flex items-center gap-2"
              style={{ color: "var(--n-text-display)" }}
            >
              <ShieldAlert
                className="h-5 w-5"
                strokeWidth={1.5}
                style={{ color: "var(--n-accent)" }}
              />
              Verrouiller définitivement les notations ?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="n-label"
              style={{ color: "var(--n-text-secondary)" }}
            >
              {pendingStats?.totalRatings ?? 0} notation
              {(pendingStats?.totalRatings ?? 0) !== 1 ? "s" : ""} sur{" "}
              {pendingStats?.totalProducts ?? 0} produit
              {(pendingStats?.totalProducts ?? 0) !== 1 ? "s" : ""} seront
              figées. Les jurys ne pourront plus rien saisir ni corriger, la cup
              passera en statut « terminée » et les résultats deviendront
              définitifs. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="n-label"
              style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
              disabled={lockMutation.isPending}
              onClick={(event) => {
                // La fermeture par défaut masquerait le dialogue avant la réponse.
                event.preventDefault();
                lockMutation.mutate({ cupId, confirm: true });
              }}
            >
              {lockMutation.isPending ? "[...]" : "Verrouiller"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
