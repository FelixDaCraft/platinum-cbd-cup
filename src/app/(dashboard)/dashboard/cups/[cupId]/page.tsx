"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { api } from "~/trpc/react";
import {
  ratingScaleLabels,
  ratingScaleEnum,
  type RatingScale,
} from "~/lib/validations/cup";
import {
  PublishCupButton,
  CupDashboardStats,
  CupPhaseTimeline,
  CupConfigAlerts,
} from "~/components/features/cups";
import {
  GlobalProgress,
  CategoryProgress,
  JuryProgress,
  LiveLeaderboard,
} from "~/components/features/cups/scoring";

export default function CupDetailPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const [isScaleDialogOpen, setIsScaleDialogOpen] = useState(false);
  const [selectedScale, setSelectedScale] = useState<RatingScale>("0-20");
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const utils = api.useUtils();
  const {
    data: cup,
    isLoading,
    isError,
    refetch,
  } = api.cup.getById.useQuery({ id: cupId });

  const updateCup = api.cup.update.useMutation({
    onSuccess: () => {
      void utils.cup.getById.invalidate({ id: cupId });
      setIsScaleDialogOpen(false);
      toast.success("Échelle de notation modifiée");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteCup = api.cup.delete.useMutation({
    onSuccess: () => {
      void utils.cup.list.invalidate();
      toast.success("Cup supprimée");
      router.push("/dashboard/cups");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleOpenScaleDialog = () => {
    if (cup) {
      setSelectedScale(cup.ratingScale);
      setIsScaleDialogOpen(true);
    }
  };

  const handleSaveScale = () => {
    updateCup.mutate({ id: cupId, ratingScale: selectedScale });
  };

  const { data: phaseDates } = api.cup.getPhaseDates.useQuery(
    { cupId },
    { enabled: !!cup }
  );
  const { data: dashboardStats, isLoading: isLoadingStats } =
    api.cup.getDashboardStats.useQuery({ cupId }, { enabled: !!cup });

  // Une requête en échec ne doit pas se confondre avec une page vide :
  // un écran « aucune donnée » masquerait l'incident.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          [ERREUR] CETTE CUP N&apos;A PAS PU ÊTRE CHARGÉE
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          RÉESSAYER
        </button>
      </div>
    );
  }

  if (isLoading || !cup) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page header */}
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
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "var(--n-text-disabled)",
              textTransform: "uppercase",
              margin: "0 0 4px 0",
            }}
          >
            VUE D&apos;ENSEMBLE
          </p>
          <h1
            className="n-font-display"
            style={{
              fontSize: "24px",
              fontWeight: 500,
              color: "var(--n-text-display)",
              margin: 0,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Tableau de bord
          </h1>
        </div>
        <PublishCupButton cupId={cupId} status={cup.status} />
      </div>

      {/* Description */}
      {cup.description && (
        <div
          className="n-card"
          style={{ padding: "16px 20px" }}
        >
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "var(--n-text-secondary)",
              textTransform: "uppercase",
              margin: "0 0 8px 0",
            }}
          >
            DESCRIPTION
          </p>
          <p
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-primary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {cup.description}
          </p>
        </div>
      )}

      {/* Config Alerts */}
      {dashboardStats && (
        <CupConfigAlerts
          status={cup.status}
          hasCategories={dashboardStats.hasCategories}
          hasCriteria={dashboardStats.hasCriteria}
          hasPhaseDates={dashboardStats.hasPhaseDates}
        />
      )}

      {/* Dashboard Stats */}
      <CupDashboardStats
        categoriesCount={dashboardStats?.categoriesCount ?? 0}
        criteriaCount={dashboardStats?.criteriaCount ?? 0}
        labelsCount={dashboardStats?.labelsCount ?? 0}
        isLoading={isLoadingStats}
      />

      {/* Phase Timeline */}
      <CupPhaseTimeline
        registrationOpenAt={phaseDates?.registrationOpenAt ?? null}
        registrationCloseAt={phaseDates?.registrationCloseAt ?? null}
        ratingStartAt={phaseDates?.ratingStartAt ?? null}
        ratingEndAt={phaseDates?.ratingEndAt ?? null}
      />

      {/* Scoring Progress — only during/after rating */}
      {(cup.status === "rating" || cup.status === "completed") && (
        <>
          <GlobalProgress cupId={cupId} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            <CategoryProgress cupId={cupId} />
            <JuryProgress cupId={cupId} />
          </div>

          <LiveLeaderboard cupId={cupId} />
        </>
      )}

      {/* Settings card */}
      <div
        className="n-card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--n-border)",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "var(--n-text-secondary)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            PARAMÈTRES
          </p>
          <p
            className="n-font-body"
            style={{
              fontSize: "13px",
              color: "var(--n-text-disabled)",
              margin: "4px 0 0 0",
            }}
          >
            Configuration générale de la compétition
          </p>
        </div>

        {/* Settings rows */}
        <div style={{ padding: "4px 0" }}>
          {/* Rating scale row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid var(--n-border)",
              gap: "16px",
            }}
          >
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "var(--n-text-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 4px 0",
                }}
              >
                ÉCHELLE DE NOTATION
              </p>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  className="n-font-body"
                  style={{
                    fontSize: "14px",
                    color: "var(--n-text-primary)",
                  }}
                >
                  {ratingScaleLabels[cup.ratingScale as RatingScale]}
                </span>
                {cup.status !== "draft" && (
                  <span
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: "10px",
                      letterSpacing: "0.06em",
                      color: "var(--n-text-disabled)",
                      border: "1px solid var(--n-border-visible)",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      textTransform: "uppercase",
                    }}
                  >
                    VERROUILLÉE
                  </span>
                )}
              </div>
            </div>
            <button
              className="n-btn-secondary"
              onClick={handleOpenScaleDialog}
              disabled={cup.status !== "draft"}
              style={{
                opacity: cup.status !== "draft" ? 0.4 : 1,
                cursor: cup.status !== "draft" ? "not-allowed" : "pointer",
                flexShrink: 0,
              }}
            >
              MODIFIER
            </button>
          </div>

          {/* Cup type row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              gap: "16px",
            }}
          >
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "var(--n-text-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 4px 0",
                }}
              >
                JURYS
              </p>
              <span
                className="n-font-body"
                style={{
                  fontSize: "14px",
                  color: "var(--n-text-primary)",
                }}
              >
                Jury pro + jury public
              </span>
            </div>
            <span
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: "var(--n-text-disabled)",
                border: "1px solid var(--n-border-visible)",
                borderRadius: "4px",
                padding: "3px 8px",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              PRO · PUBLIC
            </span>
          </div>
        </div>
      </div>

      {/* Suppression : brouillons uniquement (le serveur refuse aussi une cup
          qui a déjà des inscriptions, même dépubliée). */}
      {cup.status === "draft" && (
        <div
          className="n-card"
          style={{
            borderColor: "var(--n-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "var(--n-accent)",
                textTransform: "uppercase",
                margin: "0 0 4px 0",
              }}
            >
              ZONE DE DANGER
            </p>
            <p
              className="n-font-body"
              style={{ fontSize: "14px", color: "var(--n-text-secondary)", margin: 0 }}
            >
              Supprimer définitivement cette cup en brouillon, avec ses
              catégories, critères, labels et jurys. Impossible si des
              producteurs y sont déjà inscrits.
            </p>
          </div>
          <button
            type="button"
            className="n-btn-secondary"
            onClick={() => {
              setDeleteConfirmName("");
              setIsDeleteDialogOpen(true);
            }}
            style={{ flexShrink: 0, borderColor: "var(--n-accent)", color: "var(--n-accent)" }}
          >
            SUPPRIMER LA CUP
          </button>
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className="n-font-display"
              style={{ color: "var(--n-text-display)" }}
            >
              SUPPRIMER LA CUP
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "14px",
                color: "var(--n-text-secondary)",
              }}
            >
              Cette action est définitive. Pour confirmer, saisissez le nom de
              la cup : <strong style={{ color: "var(--n-text-display)" }}>{cup.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <form
            id="delete-cup-form"
            onSubmit={(e) => {
              e.preventDefault();
              deleteCup.mutate({ cupId, confirmName: deleteConfirmName });
            }}
          >
            <Label htmlFor="delete-cup-confirm" className="sr-only">
              Nom de la cup
            </Label>
            <Input
              id="delete-cup-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={cup.name}
              autoComplete="off"
            />
          </form>

          <DialogFooter style={{ gap: "8px" }}>
            {/* Composants ui partagés : le dialogue est rendu dans un portail,
                hors de .nothing-org, où les classes n-btn-* ne s'appliquent pas. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="delete-cup-form"
              variant="destructive"
              disabled={
                deleteCup.isPending || deleteConfirmName.trim() !== cup.name.trim()
              }
            >
              {deleteCup.isPending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Scale Dialog */}
      <Dialog open={isScaleDialogOpen} onOpenChange={setIsScaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className="n-font-display"
              style={{ color: "var(--n-text-display)" }}
            >
              ÉCHELLE DE NOTATION
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "14px",
                color: "var(--n-text-secondary)",
              }}
            >
              Choisissez l&apos;échelle de notation pour tous les critères de
              cette cup. Cette option ne peut être modifiée qu&apos;en mode
              brouillon.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={selectedScale}
            onValueChange={(value) => setSelectedScale(value as RatingScale)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "8px 0",
            }}
          >
            {ratingScaleEnum.map((scale) => (
              <div
                key={scale}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: `1px solid ${selectedScale === scale ? "var(--n-border-visible)" : "var(--n-border)"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  background:
                    selectedScale === scale
                      ? "var(--n-surface-raised)"
                      : "transparent",
                  transition: "all 150ms ease-out",
                }}
                onClick={() => setSelectedScale(scale)}
              >
                <RadioGroupItem
                  value={scale}
                  id={`dialog-scale-${scale}`}
                />
                <Label
                  htmlFor={`dialog-scale-${scale}`}
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "14px",
                    color:
                      selectedScale === scale
                        ? "var(--n-text-display)"
                        : "var(--n-text-primary)",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  {ratingScaleLabels[scale]}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <DialogFooter style={{ gap: "8px" }}>
            <button
              className="n-btn-ghost"
              onClick={() => setIsScaleDialogOpen(false)}
            >
              ANNULER
            </button>
            <button
              className="n-btn-primary"
              onClick={handleSaveScale}
              disabled={updateCup.isPending}
              style={{
                opacity: updateCup.isPending ? 0.6 : 1,
                cursor: updateCup.isPending ? "not-allowed" : "pointer",
              }}
            >
              {updateCup.isPending ? "[SAVING...]" : "ENREGISTRER"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
