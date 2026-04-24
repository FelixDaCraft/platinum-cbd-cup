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
} from "~/components/features/criteria";
import { ratingScaleLabels, type RatingScale } from "~/lib/validations/cup";
import { api } from "~/trpc/react";

interface CriterionData {
  id?: string;
  name: string;
  description: string | null;
  coefficient: number;
}

export default function CriteriaPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const categoryId = params.categoryId as string;

  const [editingCriterion, setEditingCriterion] = useState<CriterionData | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isImportFromCupOpen, setIsImportFromCupOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const utils = api.useUtils();

  const { data, isLoading, error } = api.criteria.getCategoryCriteria.useQuery(
    { categoryId },
    { enabled: !!categoryId }
  );

  const initializeCriteria = api.criteria.initializeDefaultCriteria.useMutation({
    onSuccess: (result) => {
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      if (result.created > 0) {
        toast.success(`${result.created} critères par défaut créés`);
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
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      void utils.criteria.count.invalidate({ categoryId });
      setEditingCriterion(null);
      setIsCreateMode(false);
      toast.success("Critère créé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateCriterion = api.criteria.update.useMutation({
    onSuccess: () => {
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      setEditingCriterion(null);
      toast.success("Critère modifié");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteCriterion = api.criteria.delete.useMutation({
    onSuccess: () => {
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      void utils.criteria.count.invalidate({ categoryId });
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
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      void utils.criteria.count.invalidate({ categoryId });
      setIsDuplicateOpen(false);
      if (result.duplicated > 0) {
        toast.success(`${result.duplicated} critères dupliqués`);
      } else {
        toast.info("Aucun critère à dupliquer");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const importFromCup = api.criteria.importCriteriaFromOtherCup.useMutation({
    onSuccess: (result) => {
      void utils.criteria.getCategoryCriteria.invalidate({ categoryId });
      void utils.criteria.count.invalidate({ categoryId });
      setIsImportFromCupOpen(false);
      if (result.imported > 0) {
        toast.success(`${result.imported} critères importés`);
      } else {
        toast.info("Aucun critère importé");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInitializeCriteria = () => {
    initializeCriteria.mutate({ categoryId });
  };

  const handleOpenCreate = () => {
    setEditingCriterion(null);
    setIsCreateMode(true);
  };

  const handleEdit = (criterion: CriterionData) => {
    setEditingCriterion(criterion);
    setIsCreateMode(false);
  };

  const handleDelete = (criterionId: string) => {
    const criterion = data?.criteria.find((c) => c.id === criterionId);
    if (criterion) {
      setDeleteConfirm({ id: criterionId, name: criterion.name });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteCriterion.mutate({ criterionId: deleteConfirm.id });
      setDeleteConfirm(null);
    }
  };

  const handleMoveUp = (criterionId: string) => {
    if (!data?.criteria) return;
    const criteria = [...data.criteria];
    const index = criteria.findIndex((c) => c.id === criterionId);
    if (index <= 0) return;
    [criteria[index - 1], criteria[index]] = [criteria[index]!, criteria[index - 1]!];
    const newOrder = criteria.map((c) => c.id);
    reorderCriteria.mutate({ categoryId, criterionIds: newOrder });
  };

  const handleMoveDown = (criterionId: string) => {
    if (!data?.criteria) return;
    const criteria = [...data.criteria];
    const index = criteria.findIndex((c) => c.id === criterionId);
    if (index < 0 || index >= criteria.length - 1) return;
    [criteria[index], criteria[index + 1]] = [criteria[index + 1]!, criteria[index]!];
    const newOrder = criteria.map((c) => c.id);
    reorderCriteria.mutate({ categoryId, criterionIds: newOrder });
  };

  const handleSaveCriterion = (criterionData: {
    criterionId?: string;
    name: string;
    description: string | null;
    coefficient: number;
  }) => {
    if (isCreateMode) {
      createCriterion.mutate({
        categoryId,
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

  const handleImportFromCup = (criteriaIds: string[]) => {
    importFromCup.mutate({
      targetCategoryId: categoryId,
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
          <Link href={`/dashboard/cups/${cupId}/config/categories`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-accent)" }}>
            Catégorie non trouvée
          </h1>
        </div>
        <p style={{ color: "var(--n-text-secondary)" }}>
          Cette catégorie n&apos;existe pas ou vous n&apos;avez pas accès.
        </p>
      </div>
    );
  }

  const { criteria, canEdit, ratingScale, cupRatingScale, category } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/cups/${cupId}/config/categories`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
              Critères de notation
            </h1>
            <p className="n-label mt-1">{category.name}</p>
          </div>
        </div>
        {criteria.length > 0 && canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportFromCupOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Importer
            </Button>
            <Button variant="outline" onClick={() => setIsDuplicateOpen(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </div>
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

      {/* Empty state */}
      {criteria.length === 0 && (
        <div className="n-card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-10 w-10 mb-4" style={{ color: "var(--n-text-disabled)" }} />
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-primary)", marginBottom: "8px" }}>
              Aucun critère configuré
            </h3>
            <p className="text-sm mb-6 max-w-md" style={{ color: "var(--n-text-secondary)" }}>
              Les critères définissent sur quoi les jurys évaluent les produits de cette catégorie.
            </p>
            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap justify-center">
                <Button
                  onClick={handleInitializeCriteria}
                  disabled={initializeCriteria.isPending}
                >
                  {initializeCriteria.isPending ? "[...]" : "Initialiser les critères par défaut"}
                </Button>
                <Button variant="outline" onClick={handleOpenCreate}>
                  Créer un critère personnalisé
                </Button>
                <Button variant="outline" onClick={() => setIsDuplicateOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Dupliquer depuis une catégorie
                </Button>
                <Button variant="outline" onClick={() => setIsImportFromCupOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Importer depuis une autre Cup
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Criteria configuration */}
      {criteria.length > 0 && (
        <>
          {/* Rating scale info */}
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <div>
                  <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
                    Échelle de notation
                  </p>
                  <p className="n-label mt-0.5">
                    {ratingScaleLabels[cupRatingScale as RatingScale]} — notes de {ratingScale.min} à {ratingScale.max}
                  </p>
                </div>
              </div>
              <Link href={`/dashboard/cups/${cupId}`}>
                <Button variant="ghost" size="sm">
                  Modifier dans la cup
                </Button>
              </Link>
            </div>
          </div>

          {/* Criteria list */}
          <div className="n-card" style={{ padding: "0" }}>
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--n-border)" }}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
                  Critères d&apos;évaluation
                </span>
              </div>
              <span className="n-tag">
                {criteria.length} critère{criteria.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-6">
              <CriteriaList
                criteria={criteria}
                canEdit={canEdit}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            </div>
          </div>

          {/* Coefficient info */}
          <div className="n-card" style={{ padding: "16px" }}>
            <div className="flex items-center gap-3">
              <Info className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Le coefficient multiplie l&apos;impact du critère sur le score final.
                Score = Σ(note × coefficient) / Σ(coefficients)
              </p>
            </div>
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <CriterionFormDialog
        criterion={editingCriterion}
        open={isCreateMode || !!editingCriterion}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCriterion(null);
            setIsCreateMode(false);
          }
        }}
        onSave={handleSaveCriterion}
        isSubmitting={createCriterion.isPending || updateCriterion.isPending}
        mode={isCreateMode ? "create" : "edit"}
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
        open={isImportFromCupOpen}
        onOpenChange={setIsImportFromCupOpen}
        onImport={handleImportFromCup}
        isSubmitting={importFromCup.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce critère ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le critère &quot;{deleteConfirm?.name}&quot; ?
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
