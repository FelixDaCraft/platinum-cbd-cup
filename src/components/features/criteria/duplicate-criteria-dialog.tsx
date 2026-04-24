"use client";

import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatCoefficient } from "~/lib/validations/criteria";
import { api } from "~/trpc/react";

interface DuplicateCriteriaDialogProps {
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (sourceCategoryId: string) => void;
  isSubmitting: boolean;
}

export function DuplicateCriteriaDialog({
  categoryId,
  open,
  onOpenChange,
  onDuplicate,
  isSubmitting,
}: DuplicateCriteriaDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { data: categories, isLoading: isLoadingCategories } =
    api.criteria.getOtherCategoriesInCup.useQuery(
      { categoryId },
      { enabled: open }
    );

  const { data: previewData, isLoading: isLoadingPreview } =
    api.criteria.getCategoryCriteria.useQuery(
      { categoryId: selectedCategoryId },
      { enabled: open && !!selectedCategoryId }
    );

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCategoryId("");
    }
  }, [open]);

  const handleDuplicate = () => {
    if (selectedCategoryId) {
      onDuplicate(selectedCategoryId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dupliquer les critères</DialogTitle>
          <DialogDescription>
            Copiez les critères d'une autre catégorie de cette cup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category selector */}
          <div className="space-y-2">
            <Label className="n-label">Catégorie source</Label>
            {isLoadingCategories ? (
              <div
                className="flex items-center justify-center py-4"
                style={{ color: "var(--n-text-disabled)" }}
              >
                <span className="n-label">[LOADING...]</span>
              </div>
            ) : categories && categories.length > 0 ? (
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span>{category.name}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border)" }}>
                          {category.criteriaCount} critère
                          {category.criteriaCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p
                className="text-sm py-4 text-center"
                style={{ color: "var(--n-text-secondary)" }}
              >
                Aucune autre catégorie disponible dans cette cup.
              </p>
            )}
          </div>

          {/* Preview of criteria to be copied */}
          {selectedCategoryId && (
            <div className="space-y-2">
              <Label className="n-label">Critères qui seront copiés</Label>
              {isLoadingPreview ? (
                <div
                  className="flex items-center justify-center py-4"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  <span className="n-label">[LOADING...]</span>
                </div>
              ) : previewData && previewData.criteria.length > 0 ? (
                <div
                  className="space-y-1 max-h-48 overflow-y-auto p-2"
                  style={{
                    background: "var(--n-surface-raised)",
                    border: "1px solid var(--n-border)",
                    borderRadius: "8px",
                  }}
                >
                  {previewData.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Check
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: "var(--n-success)" }}
                      />
                      <span
                        className="text-sm flex-1 truncate"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {criterion.name}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                        {formatCoefficient(criterion.coefficient)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm py-4 text-center"
                  style={{
                    color: "var(--n-text-secondary)",
                    background: "var(--n-surface-raised)",
                    border: "1px solid var(--n-border)",
                    borderRadius: "8px",
                  }}
                >
                  Cette catégorie n'a pas de critères configurés.
                </p>
              )}

              {previewData && previewData.criteria.length > 0 && (
                <p
                  className="text-sm"
                  style={{ color: "var(--n-text-secondary)" }}
                >
                  {previewData.criteria.length} critère
                  {previewData.criteria.length > 1 ? "s" : ""} seront ajoutés.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={
              isSubmitting ||
              !selectedCategoryId ||
              !previewData ||
              previewData.criteria.length === 0
            }
          >
            {isSubmitting ? (
              <span className="mr-2 text-xs">[...]</span>
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
