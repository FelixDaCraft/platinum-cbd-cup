"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
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

  const utils = api.useUtils();
  const { data: cup, isLoading } = api.cup.getById.useQuery({ id: cupId });

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
                TYPE DE CUP
              </p>
              <span
                className="n-font-body"
                style={{
                  fontSize: "14px",
                  color: "var(--n-text-primary)",
                }}
              >
                {cup.type === "public" ? "Cup Publique" : "Cup Pro"}
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
              {cup.type === "public" ? "PUBLIQUE" : "PRO"}
            </span>
          </div>
        </div>
      </div>

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
