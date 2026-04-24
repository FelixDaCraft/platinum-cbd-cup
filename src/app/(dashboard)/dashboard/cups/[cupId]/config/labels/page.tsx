"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trophy, Award, BarChart2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  LabelsList,
  LabelFormDialog,
  LabelRangePreview,
} from "~/components/features/labels";
import { api } from "~/trpc/react";
import { getMaxScoreForScale } from "~/lib/validations/labels";

interface LabelData {
  id?: string;
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
  icon: string | null;
  condition: string | null;
  isPublic: boolean;
}

export default function LabelsPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [editingLabel, setEditingLabel] = useState<LabelData | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const utils = api.useUtils();

  const { data, isLoading, error } = api.labels.getCupLabels.useQuery(
    { cupId },
    { enabled: !!cupId }
  );

  const { data: cup } = api.cup.getById.useQuery({ id: cupId });

  const initializeLabels = api.labels.initializeDefaultLabels.useMutation({
    onSuccess: () => {
      void utils.labels.getCupLabels.invalidate({ cupId });
      toast.success("Labels par défaut créés");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createLabel = api.labels.create.useMutation({
    onSuccess: () => {
      void utils.labels.getCupLabels.invalidate({ cupId });
      void utils.labels.count.invalidate({ cupId });
      setEditingLabel(null);
      setIsCreateMode(false);
      toast.success("Label créé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateLabel = api.labels.update.useMutation({
    onSuccess: () => {
      void utils.labels.getCupLabels.invalidate({ cupId });
      setEditingLabel(null);
      toast.success("Label modifié");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteLabel = api.labels.delete.useMutation({
    onSuccess: () => {
      void utils.labels.getCupLabels.invalidate({ cupId });
      void utils.labels.count.invalidate({ cupId });
      toast.success("Label supprimé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reorderLabels = api.labels.reorder.useMutation({
    onSuccess: () => {
      void utils.labels.getCupLabels.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInitializeLabels = () => {
    initializeLabels.mutate({ cupId });
  };

  const handleOpenCreate = () => {
    setEditingLabel(null);
    setIsCreateMode(true);
  };

  const handleEdit = (label: LabelData) => {
    setEditingLabel(label);
    setIsCreateMode(false);
  };

  const handleDelete = (labelId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce label ?")) {
      deleteLabel.mutate({ labelId });
    }
  };

  const handleMoveUp = (labelId: string) => {
    if (!data?.labels) return;
    const labels = [...data.labels];
    const index = labels.findIndex((l) => l.id === labelId);
    if (index <= 0) return;
    [labels[index - 1], labels[index]] = [labels[index]!, labels[index - 1]!];
    const newOrder = labels.map((l) => l.id);
    reorderLabels.mutate({ cupId, labelIds: newOrder });
  };

  const handleMoveDown = (labelId: string) => {
    if (!data?.labels) return;
    const labels = [...data.labels];
    const index = labels.findIndex((l) => l.id === labelId);
    if (index < 0 || index >= labels.length - 1) return;
    [labels[index], labels[index + 1]] = [labels[index + 1]!, labels[index]!];
    const newOrder = labels.map((l) => l.id);
    reorderLabels.mutate({ cupId, labelIds: newOrder });
  };

  const handleSaveLabel = (labelData: {
    labelId?: string;
    name: string;
    minScore: number;
    maxScore: number | null;
    color: string | null;
    icon: string | null;
    condition: string | null;
    isPublic: boolean;
  }) => {
    if (isCreateMode) {
      createLabel.mutate({
        cupId,
        name: labelData.name,
        minScore: labelData.minScore,
        maxScore: labelData.maxScore,
        color: labelData.color ?? undefined,
        icon: labelData.icon,
        condition: labelData.condition,
        isPublic: labelData.isPublic,
      });
    } else if (labelData.labelId) {
      updateLabel.mutate({
        labelId: labelData.labelId,
        name: labelData.name,
        minScore: labelData.minScore,
        maxScore: labelData.maxScore,
        color: labelData.color,
        icon: labelData.icon,
        condition: labelData.condition,
        isPublic: labelData.isPublic,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-label">[LOADING...]</span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { labels, canEdit } = data;
  const scaleMax = cup ? getMaxScoreForScale(cup.ratingScale) : 10;
  const publicLabels = labels.filter((l) => l.isPublic).length;
  const privateLabels = labels.length - publicLabels;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
            Labels & Récompenses
          </h1>
          <p className="n-label mt-1">Récompenses attribuées selon les scores</p>
        </div>
        {labels.length > 0 && canEdit && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un label
          </Button>
        )}
      </div>

      {/* Edit blocked warning */}
      {!canEdit && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{
            background: "rgba(212,168,67,0.08)",
            border: "1px solid rgba(212,168,67,0.25)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--n-warning)" }} />
          <p className="text-sm" style={{ color: "var(--n-warning)" }}>
            Les labels ne peuvent pas être modifiés pendant ou après la phase de notation.
          </p>
        </div>
      )}

      {/* Stats */}
      {labels.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center gap-3">
              <Award className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                  {labels.length}
                </p>
                <p className="n-label">Label{labels.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4" style={{ color: "var(--n-success)" }} />
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                  {publicLabels}
                </p>
                <p className="n-label">Public{publicLabels !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center gap-3">
              <EyeOff className="h-4 w-4" style={{ color: "var(--n-warning)" }} />
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                  {privateLabels}
                </p>
                <p className="n-label">Privé{privateLabels !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center gap-3">
              <BarChart2 className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                  0–{scaleMax}
                </p>
                <p className="n-label">Échelle</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {labels.length === 0 && (
        <div className="n-card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 mb-4" style={{ color: "var(--n-text-disabled)" }} />
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-primary)", marginBottom: "8px" }}>
              Aucun label configuré
            </h3>
            <p className="text-sm mb-6 max-w-md" style={{ color: "var(--n-text-secondary)" }}>
              Les labels permettent d&apos;attribuer automatiquement des récompenses selon les scores obtenus.
            </p>
            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleInitializeLabels}
                  disabled={initializeLabels.isPending}
                >
                  {initializeLabels.isPending ? "[...]" : "Initialiser les labels par défaut"}
                </Button>
                <Button variant="outline" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un label personnalisé
                </Button>
              </div>
            )}
            <p className="n-label mt-6">Les labels par défaut incluent Or, Argent et Bronze</p>
          </div>
        </div>
      )}

      {/* Labels configuration */}
      {labels.length > 0 && (
        <>
          {/* Range preview */}
          <div className="n-card" style={{ padding: "0" }}>
            <div
              className="flex items-center gap-2 px-6 py-4"
              style={{ borderBottom: "1px solid var(--n-border)" }}
            >
              <BarChart2 className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div>
                <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
                  Aperçu des plages
                </span>
                <p className="n-label mt-0.5">Visualisation des plages de scores couvertes</p>
              </div>
            </div>
            <div className="p-6">
              <LabelRangePreview labels={labels} scaleMax={scaleMax} />
            </div>
          </div>

          {/* Labels list */}
          <div className="n-card" style={{ padding: "0" }}>
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--n-border)" }}
            >
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
                  Configuration des labels
                </span>
              </div>
              <span className="n-tag">
                {labels.length} label{labels.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-6">
              <LabelsList
                labels={labels}
                canEdit={canEdit}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            </div>
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <LabelFormDialog
        label={editingLabel}
        open={isCreateMode || !!editingLabel}
        onOpenChange={(open) => {
          if (!open) {
            setEditingLabel(null);
            setIsCreateMode(false);
          }
        }}
        onSave={handleSaveLabel}
        isSubmitting={createLabel.isPending || updateLabel.isPending}
        mode={isCreateMode ? "create" : "edit"}
        scaleMax={scaleMax}
        existingLabels={data?.labels ?? []}
      />
    </div>
  );
}
