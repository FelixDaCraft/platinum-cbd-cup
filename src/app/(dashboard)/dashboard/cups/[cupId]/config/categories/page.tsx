"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Layers, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { CategoryList, CategoryForm } from "~/components/features/categories";
import { api } from "~/trpc/react";
import type { Category } from "~/server/db/schema/categories";

export default function CategoriesPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const utils = api.useUtils();

  const { data: cup, isLoading: cupLoading } = api.cup.getById.useQuery({ id: cupId });

  const { data: categories = [], isLoading: categoriesLoading } = api.category.list.useQuery(
    { cupId },
    { enabled: !!cup }
  );

  const { data: dashboardStats } = api.cup.getDashboardStats.useQuery(
    { cupId },
    { enabled: !!cup }
  );

  const createCategory = api.category.create.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ cupId });
      void utils.category.count.invalidate({ cupId });
      void utils.cup.getDashboardStats.invalidate({ cupId });
      setIsCreateOpen(false);
      toast.success("Catégorie créée");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateCategory = api.category.update.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ cupId });
      setEditingCategory(null);
      toast.success("Catégorie modifiée");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ cupId });
      void utils.category.count.invalidate({ cupId });
      void utils.cup.getDashboardStats.invalidate({ cupId });
      setDeletingCategory(null);
      toast.success("Catégorie supprimée");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reorderCategories = api.category.reorder.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = (data: { name: string; description?: string }) => {
    createCategory.mutate({ cupId, ...data });
  };

  const handleUpdate = (data: { name: string; description?: string }) => {
    if (!editingCategory) return;
    updateCategory.mutate({
      id: editingCategory.id,
      name: data.name,
      description: data.description ?? null,
    });
  };

  const handleDelete = () => {
    if (!deletingCategory) return;
    deleteCategory.mutate({ id: deletingCategory.id });
  };

  const handleReorder = (categoryIds: string[]) => {
    reorderCategories.mutate({ cupId, categoryIds });
  };

  if (cupLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-label">[LOADING...]</span>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  const criteriaCount = dashboardStats?.criteriaCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
            Catégories & Critères
          </h1>
          <p className="n-label mt-1">Organisez les produits et définissez les critères de notation</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                {categories.length}
              </p>
              <p className="n-label">Catégorie{categories.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <ListChecks className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: "var(--n-text-display)" }}>
                {criteriaCount}
              </p>
              <p className="n-label">Critère{criteriaCount !== 1 ? "s" : ""} au total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories list */}
      <div>
        {categoriesLoading ? (
          <div className="n-card flex items-center justify-center" style={{ minHeight: "200px" }}>
            <span className="n-label">[LOADING...]</span>
          </div>
        ) : (
          <CategoryList
            categories={categories}
            cupId={cupId}
            onReorder={handleReorder}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-display)" }}>Nouvelle catégorie</DialogTitle>
            <DialogDescription>
              Créez une catégorie pour organiser les produits de votre cup.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            onSubmit={handleCreate}
            isSubmitting={createCategory.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-display)" }}>Modifier la catégorie</DialogTitle>
            <DialogDescription>
              Modifiez les informations de cette catégorie.
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <CategoryForm
              category={editingCategory}
              onSubmit={handleUpdate}
              isSubmitting={updateCategory.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(open: boolean) => !open && setDeletingCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie &quot;{deletingCategory?.name}&quot; ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
            >
              {deleteCategory.isPending ? "[...]" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
