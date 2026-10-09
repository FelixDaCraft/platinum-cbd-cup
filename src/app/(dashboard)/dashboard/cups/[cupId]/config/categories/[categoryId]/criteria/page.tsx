"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, ClipboardList, Copy, Info, Download } from "lucide-react";
import Link from "next/link";
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
import {
  CriteriaList,
  CriterionFormDialog,
  DuplicateCriteriaDialog,
  ImportCriteriaFromCupDialog,
  CRITERIA_PANELS,
  CRITERIA_PANEL_ORDER,
} from "~/components/features/criteria";
import type { JuryPanel } from "~/lib/enums";
import { ratingScaleLabels, type RatingScale } from "~/lib/validations/cup";
import { api } from "~/trpc/react";

interface CriterionData {
  id?: string;
  name: string;
  description: string | null;
  coefficient: number;
}

interface CriterionRow extends CriterionData {
  id: string;
  panel: JuryPanel;
  sortOrder: number;
}

const headingStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "20px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 700,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--n-text-display)",
  fontWeight: 700,
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default function CriteriaPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const categoryId = params.categoryId as string;

  /** Critère en cours d'édition (avec son jury). */
  const [editingCriterion, setEditingCriterion] = useState<CriterionRow | null>(null);
  /** Jury dans lequel on crée un critère (null = pas de création en cours). */
  const [createPanel, setCreatePanel] = useState<JuryPanel | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  /** Jury de destination proposé à l'ouverture de l'import (null = fermé). */
  const [importPanel, setImportPanel] = useState<JuryPanel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    panel: JuryPanel;
  } | null>(null);

  const utils = api.useUtils();

  const { data, isLoading, error } = api.criteria.getCategoryCriteria.useQuery(
    { categoryId },
    { enabled: !!categoryId }
  );

  const invalidate = () => {
    void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
    void utils.criteria.count.invalidate({ categoryId });
  };

  const initializeCriteria = api.criteria.initializeDefaultCriteria.useMutation({
    onSuccess: (result) => {
      invalidate();
      if (result.created > 0) {
        toast.success(`${plural(result.created, "critère")} par défaut créé${result.created > 1 ? "s" : ""}`);
      } else {
        toast.info(result.message ?? "Critères déjà configurés");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createCriterion = api.criteria.create.useMutation({
    onSuccess: () => {
      invalidate();
      setCreatePanel(null);
      toast.success("Critère créé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateCriterion = api.criteria.update.useMutation({
    onSuccess: () => {
      invalidate();
      setEditingCriterion(null);
      toast.success("Critère modifié");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const moveCriterion = api.criteria.update.useMutation({
    onSuccess: (updated) => {
      invalidate();
      if (updated) {
        toast.success(`Critère déplacé vers le ${CRITERIA_PANELS[updated.panel].label.toLowerCase()}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteCriterion = api.criteria.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Critère supprimé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reorderCriteria = api.criteria.reorder.useMutation({
    onSuccess: () => {
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const duplicateCriteria = api.criteria.duplicateFromCategory.useMutation({
    onSuccess: (result) => {
      invalidate();
      setIsDuplicateOpen(false);
      if (result.duplicated > 0) {
        toast.success(`${plural(result.duplicated, "critère")} dupliqué${result.duplicated > 1 ? "s" : ""}`);
      } else {
        toast.info("Aucun critère à dupliquer");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const importFromCup = api.criteria.importCriteriaFromOtherCup.useMutation({
    onSuccess: (result, variables) => {
      invalidate();
      setImportPanel(null);
      if (result.imported > 0) {
        toast.success(
          `${plural(result.imported, "critère")} importé${result.imported > 1 ? "s" : ""} dans le ${CRITERIA_PANELS[variables.panel].label.toLowerCase()}`
        );
      } else {
        toast.info("Aucun critère importé");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const allCriteria: CriterionRow[] = data?.criteria ?? [];
  const criteriaOf = (panel: JuryPanel) =>
    allCriteria
      .filter((c) => c.panel === panel)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleDelete = (criterionId: string) => {
    const criterion = allCriteria.find((c) => c.id === criterionId);
    if (criterion) {
      setDeleteConfirm({ id: criterionId, name: criterion.name, panel: criterion.panel });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteCriterion.mutate({ criterionId: deleteConfirm.id });
      setDeleteConfirm(null);
    }
  };

  /** Déplace un critère d'un cran dans la grille de son jury. */
  const handleMove = (panel: JuryPanel, criterionId: string, delta: -1 | 1) => {
    const list = criteriaOf(panel);
    const index = list.findIndex((c) => c.id === criterionId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    reorderCriteria.mutate({
      categoryId,
      panel,
      criterionIds: list.map((c) => c.id),
    });
  };

  const handleMovePanel = (criterionId: string) => {
    const criterion = allCriteria.find((c) => c.id === criterionId);
    if (!criterion) return;
    moveCriterion.mutate({
      criterionId,
      panel: CRITERIA_PANELS[criterion.panel].other,
    });
  };

  const handleSaveCriterion = (criterionData: {
    criterionId?: string;
    name: string;
    description: string | null;
    coefficient: number;
  }) => {
    if (createPanel) {
      createCriterion.mutate({
        categoryId,
        panel: createPanel,
        name: criterionData.name,
        description: criterionData.description ?? undefined,
        coefficient: criterionData.coefficient,
      });
    } else if (criterionData.criterionId) {
      updateCriterion.mutate({
        criterionId: criterionData.criterionId,
        name: criterionData.name,
        description: criterionData.description,
        coefficient: criterionData.coefficient,
      });
    }
  };

  const handleDuplicate = (sourceCategoryId: string) => {
    duplicateCriteria.mutate({
      sourceCategoryId,
      targetCategoryId: categoryId,
    });
  };

  const handleImportFromCup = (criteriaIds: string[], panel: JuryPanel) => {
    importFromCup.mutate({
      targetCategoryId: categoryId,
      panel,
      criteriaIds,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-label">[LOADING...]</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/dashboard/cups/${cupId}/config/categories`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 style={{ ...headingStyle, color: "var(--n-accent)" }}>
            Catégorie non trouvée
          </h1>
        </div>
        <p style={{ color: "var(--n-text-secondary)" }}>
          Cette catégorie n&apos;existe pas ou vous n&apos;avez pas accès.
        </p>
      </div>
    );
  }

  const { canEdit, ratingScale, cupRatingScale, category } = data;
  const isBusy =
    reorderCriteria.isPending || moveCriterion.isPending || deleteCriterion.isPending;
  const formPanel = createPanel ?? editingCriterion?.panel ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button asChild variant="ghost" size="icon">
            <Link
              href={`/dashboard/cups/${cupId}/config/categories`}
              aria-label="Retour aux catégories"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 style={{ ...headingStyle, color: "var(--n-text-display)" }}>
              Critères de notation
            </h1>
            <p className="n-label mt-1 truncate">{category.name}</p>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setIsDuplicateOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            Dupliquer depuis une catégorie
          </Button>
        )}
      </div>

      {/* Edit blocked warning */}
      {!canEdit && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg"
          style={{
            background: "rgba(212,168,67,0.08)",
            border: "1px solid rgba(212,168,67,0.25)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--n-warning)" }}>
            Les critères ne peuvent pas être modifiés pendant ou après la phase de notation.
          </p>
        </div>
      )}

      {/* Rating scale + principle */}
      <div className="n-card" style={{ padding: "16px" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p style={{ ...sectionTitleStyle, fontSize: "12px" }}>
                Échelle de notation
              </p>
              <p className="n-label mt-0.5">
                {ratingScaleLabels[cupRatingScale as RatingScale]} — notes de {ratingScale.min} à {ratingScale.max}
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--n-text-secondary)" }}>
                Le jury professionnel et le jury public notent chacun sur leur propre grille.
                Chaque jury doit avoir au moins un critère pour publier la cup.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="self-start sm:self-center">
            <Link href={`/dashboard/cups/${cupId}`}>
              Modifier dans la cup
            </Link>
          </Button>
        </div>
      </div>

      {/* One section per jury */}
      {CRITERIA_PANEL_ORDER.map((panel) => {
        const meta = CRITERIA_PANELS[panel];
        const other = CRITERIA_PANELS[meta.other];
        const list = criteriaOf(panel);
        const totalCoefficient = list.reduce((sum, c) => sum + c.coefficient, 0);
        const isInitializing =
          initializeCriteria.isPending && initializeCriteria.variables?.panel === panel;

        return (
          <section
            key={panel}
            aria-labelledby={`criteria-${panel}-title`}
            className="n-card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            {/* Section header */}
            <div
              className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
              style={{ borderBottom: "1px solid var(--n-border)" }}
            >
              {/* Même en-tête que les autres cartes du dashboard : icône, titre
                  Doto, compteur en n-tag — le titre suffit à nommer le jury. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ClipboardList className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <h2 id={`criteria-${panel}-title`} style={sectionTitleStyle}>
                  {meta.label}
                </h2>
                <span className="n-tag">{plural(list.length, "critère")}</span>
                {list.length > 0 && (
                  <span className="n-label">Σ coef. {totalCoefficient}</span>
                )}
              </div>
              {canEdit && list.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Importer des critères dans le ${meta.label.toLowerCase()}`}
                    onClick={() => setImportPanel(panel)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Importer
                  </Button>
                  <Button
                    size="sm"
                    aria-label={`Ajouter un critère au ${meta.label.toLowerCase()}`}
                    onClick={() => {
                      setEditingCriterion(null);
                      setCreatePanel(panel);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              )}
            </div>

            {/* Section body */}
            <div className="p-4 sm:p-6">
              {list.length > 0 ? (
                <CriteriaList
                  criteria={list}
                  canEdit={canEdit}
                  isBusy={isBusy}
                  onEdit={(c) => {
                    setCreatePanel(null);
                    setEditingCriterion({ ...c, panel });
                  }}
                  onDelete={handleDelete}
                  onMoveUp={(id) => handleMove(panel, id, -1)}
                  onMoveDown={(id) => handleMove(panel, id, 1)}
                  onMovePanel={handleMovePanel}
                  otherPanelShort={other.short}
                  otherPanelLabel={other.label}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="h-8 w-8 mb-3" style={{ color: "var(--n-text-disabled)" }} />
                  <p style={{ ...sectionTitleStyle, fontSize: "12px", color: "var(--n-text-primary)" }}>
                    Aucun critère pour le {meta.label.toLowerCase()}
                  </p>
                  <p className="text-sm mt-2 mb-5 max-w-md" style={{ color: "var(--n-warning)" }}>
                    Ce jury ne pourra pas noter tant que sa grille est vide.
                  </p>
                  {canEdit && (
                    <div className="flex flex-col sm:flex-row gap-2 flex-wrap justify-center w-full sm:w-auto">
                      <Button
                        onClick={() => initializeCriteria.mutate({ categoryId, panel })}
                        disabled={initializeCriteria.isPending}
                      >
                        {isInitializing ? "[...]" : "Initialiser les critères par défaut"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingCriterion(null);
                          setCreatePanel(panel);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Créer un critère
                      </Button>
                      <Button variant="outline" onClick={() => setImportPanel(panel)}>
                        <Download className="mr-2 h-4 w-4" />
                        Importer depuis une autre Cup
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Coefficient info */}
      <div className="n-card" style={{ padding: "16px" }}>
        <div className="flex items-center gap-3">
          <Info className="h-4 w-4 shrink-0" style={{ color: "var(--n-text-secondary)" }} />
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Le coefficient multiplie l&apos;impact du critère sur le score final de son jury.
            Score = Σ(note × coefficient) / Σ(coefficients)
          </p>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <CriterionFormDialog
        criterion={editingCriterion}
        open={!!createPanel || !!editingCriterion}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCriterion(null);
            setCreatePanel(null);
          }
        }}
        onSave={handleSaveCriterion}
        isSubmitting={createCriterion.isPending || updateCriterion.isPending}
        mode={createPanel ? "create" : "edit"}
        panelLabel={formPanel ? CRITERIA_PANELS[formPanel].label : undefined}
      />

      {/* Duplicate Dialog */}
      <DuplicateCriteriaDialog
        categoryId={categoryId}
        open={isDuplicateOpen}
        onOpenChange={setIsDuplicateOpen}
        onDuplicate={handleDuplicate}
        isSubmitting={duplicateCriteria.isPending}
      />

      {/* Import from Cup Dialog */}
      <ImportCriteriaFromCupDialog
        cupId={cupId}
        categoryId={categoryId}
        open={!!importPanel}
        initialPanel={importPanel ?? "pro"}
        onOpenChange={(open) => {
          if (!open) setImportPanel(null);
        }}
        onImport={handleImportFromCup}
        isSubmitting={importFromCup.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce critère ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le critère &quot;{deleteConfirm?.name}&quot;
              {deleteConfirm ? ` du ${CRITERIA_PANELS[deleteConfirm.panel].label.toLowerCase()}` : ""} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
