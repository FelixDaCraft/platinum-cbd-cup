"use client";

import { useParams } from "next/navigation";
import { Calendar, Clock, CalendarCheck, CalendarClock, Settings2 } from "lucide-react";

import {
  PhaseTimelinePreview,
  PhaseDatesForm,
} from "~/components/features/phases";
import { api } from "~/trpc/react";

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  published: "Publiée",
  registration_open: "Inscriptions ouvertes",
  registration_closed: "Inscriptions fermées",
  rating: "Notation en cours",
  completed: "Terminée",
  archived: "Archivée",
};

export default function PhasesPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const utils = api.useUtils();

  const { data: cup, isLoading: cupLoading } = api.cup.getById.useQuery(
    { id: cupId },
    { enabled: !!cupId }
  );

  const {
    data: phaseDates,
    isLoading: phasesLoading,
    error,
  } = api.cup.getPhaseDates.useQuery({ cupId }, { enabled: !!cupId });

  const isLoading = cupLoading || phasesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-label">[LOADING...]</span>
      </div>
    );
  }

  if (error || !phaseDates || !cup) {
    return null;
  }

  const handleSuccess = () => {
    void utils.cup.getPhaseDates.invalidate({ cupId });
    void utils.cup.getById.invalidate({ id: cupId });
  };

  const configuredDates = [
    phaseDates.registrationOpenAt,
    phaseDates.registrationCloseAt,
    phaseDates.ratingStartAt,
    phaseDates.ratingEndAt,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
            Phases & Dates
          </h1>
          <p className="n-label mt-1">Configurez les dates de transition automatique</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", fontWeight: 600, color: "var(--n-text-display)" }}>
                {statusLabels[phaseDates.status] ?? phaseDates.status}
              </p>
              <p className="n-label">Statut actuel</p>
            </div>
          </div>
        </div>
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-4 w-4" style={{ color: "var(--n-success)" }} />
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                {configuredDates}
              </p>
              <p className="n-label">Date{configuredDates !== 1 ? "s" : ""} configurée{configuredDates !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="n-card col-span-2 lg:col-span-1" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4" style={{ color: "var(--n-warning)" }} />
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                {4 - configuredDates}
              </p>
              <p className="n-label">
                Transition{4 - configuredDates !== 1 ? "s" : ""} manuelle{4 - configuredDates !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="n-card" style={{ padding: "0" }}>
        <div
          className="flex items-center gap-2 px-6 py-4"
          style={{ borderBottom: "1px solid var(--n-border)" }}
        >
          <Clock className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
              Timeline des phases
            </span>
            <p className="n-label mt-0.5">Visualisation du cycle de vie de la cup</p>
          </div>
        </div>
        <div className="p-6">
          <PhaseTimelinePreview
            currentStatus={phaseDates.status}
            registrationOpenAt={phaseDates.registrationOpenAt}
            registrationCloseAt={phaseDates.registrationCloseAt}
            ratingStartAt={phaseDates.ratingStartAt}
            ratingEndAt={phaseDates.ratingEndAt}
          />
        </div>
      </div>

      {/* Phase Dates Configuration */}
      <div className="n-card" style={{ padding: "0" }}>
        <div
          className="flex items-center gap-2 px-6 py-4"
          style={{ borderBottom: "1px solid var(--n-border)" }}
        >
          <Settings2 className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
              Configuration des dates
            </span>
            <p className="n-label mt-0.5">
              Les transitions sans date définie devront être effectuées manuellement
            </p>
          </div>
        </div>
        <div className="p-6">
          <PhaseDatesForm
            cupId={cupId}
            cupStatus={phaseDates.cupStatus}
            initialData={{
              registrationOpenAt: phaseDates.registrationOpenAt,
              registrationCloseAt: phaseDates.registrationCloseAt,
              ratingStartAt: phaseDates.ratingStartAt,
              ratingEndAt: phaseDates.ratingEndAt,
            }}
            editableDates={phaseDates.editableDates}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}
