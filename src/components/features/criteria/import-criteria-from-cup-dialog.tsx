"use client";

import { useState, useEffect } from "react";
import { Download, Check, ChevronRight, ChevronLeft } from "lucide-react";

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
import { Checkbox } from "~/components/ui/checkbox";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatCoefficient } from "~/lib/validations/criteria";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface CriterionOption {
  id: string;
  name: string;
  description: string | null;
  coefficient: number;
}

interface CategoryOption {
  id: string;
  name: string;
  criteria: CriterionOption[];
}

interface CupOption {
  id: string;
  name: string;
  categories: CategoryOption[];
}

interface ImportCriteriaFromCupDialogProps {
  cupId: string;
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (criteriaIds: string[]) => void;
  isSubmitting: boolean;
}

type Step = "cup" | "category" | "criteria";

export function ImportCriteriaFromCupDialog({
  cupId,
  categoryId,
  open,
  onOpenChange,
  onImport,
  isSubmitting,
}: ImportCriteriaFromCupDialogProps) {
  const [step, setStep] = useState<Step>("cup");
  const [selectedCupId, setSelectedCupId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<Set<string>>(
    new Set()
  );

  const { data: cups, isLoading: isLoadingCups } =
    api.criteria.getImportableCupsWithCategories.useQuery(
      { currentCupId: cupId },
      { enabled: open }
    );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("cup");
      setSelectedCupId("");
      setSelectedCategoryId("");
      setSelectedCriteriaIds(new Set());
    }
  }, [open]);

  const selectedCup = cups?.find((c) => c.id === selectedCupId);
  const selectedCategory = selectedCup?.categories.find(
    (c) => c.id === selectedCategoryId
  );

  const handleSelectCup = (id: string) => {
    setSelectedCupId(id);
    setSelectedCategoryId("");
    setSelectedCriteriaIds(new Set());
    setStep("category");
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    const category = selectedCup?.categories.find((c) => c.id === id);
    if (category) {
      setSelectedCriteriaIds(new Set(category.criteria.map((c) => c.id)));
    }
    setStep("criteria");
  };

  const handleToggleCriterion = (criterionId: string) => {
    setSelectedCriteriaIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(criterionId)) {
        newSet.delete(criterionId);
      } else {
        newSet.add(criterionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCategory) {
      setSelectedCriteriaIds(new Set(selectedCategory.criteria.map((c) => c.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedCriteriaIds(new Set());
  };

  const handleBack = () => {
    if (step === "criteria") {
      setStep("category");
      setSelectedCriteriaIds(new Set());
    } else if (step === "category") {
      setStep("cup");
      setSelectedCategoryId("");
    }
  };

  const handleImport = () => {
    if (selectedCriteriaIds.size > 0) {
      onImport(Array.from(selectedCriteriaIds));
    }
  };

  // Step indicator dot styles
  const stepDotStyle = (active: boolean, past: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    fontSize: "13px",
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    background: active
      ? "var(--n-text-display)"
      : past
      ? "var(--n-surface-raised)"
      : "var(--n-surface-raised)",
    color: active
      ? "var(--n-black)"
      : past
      ? "var(--n-text-primary)"
      : "var(--n-text-disabled)",
    border: active
      ? "none"
      : past
      ? "1px solid var(--n-border-visible)"
      : "1px solid var(--n-border)",
  });

  const listItemStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    borderRadius: "8px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background 150ms ease",
    color: "var(--n-text-primary)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importer depuis une autre Cup
          </DialogTitle>
          <DialogDescription>
            {step === "cup" && "Sélectionnez la Cup source contenant les critères à importer."}
            {step === "category" && `Sélectionnez une catégorie de "${selectedCup?.name}".`}
            {step === "criteria" && `Sélectionnez les critères à importer depuis "${selectedCategory?.name}".`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-w-0">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div style={stepDotStyle(step === "cup", false)}>1</div>
            <ChevronRight className="h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
            <div style={stepDotStyle(step === "category", step === "criteria")}>2</div>
            <ChevronRight className="h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
            <div style={stepDotStyle(step === "criteria", false)}>3</div>
          </div>

          {/* Step 1: Cup selection */}
          {step === "cup" && (
            <div className="space-y-2">
              <Label className="n-label">Cup source</Label>
              {isLoadingCups ? (
                <div
                  className="flex items-center justify-center py-8"
                  style={{ color: "var(--n-text-disabled)" }}
                >
                  <span className="n-label">[LOADING...]</span>
                </div>
              ) : cups && cups.length > 0 ? (
                <ScrollArea
                  className="h-[280px] overflow-hidden"
                  style={{
                    border: "1px solid var(--n-border)",
                    borderRadius: "8px",
                    background: "var(--n-surface-raised)",
                  }}
                >
                  <div className="p-2 space-y-1">
                    {cups.map((cup) => {
                      const totalCriteria = cup.categories.reduce(
                        (sum, cat) => sum + cat.criteria.length,
                        0
                      );
                      return (
                        <button
                          key={cup.id}
                          onClick={() => handleSelectCup(cup.id)}
                          style={listItemStyle}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--n-surface)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }}
                        >
                          <div>
                            <p
                              className="n-font-body font-medium"
                              style={{ color: "var(--n-text-primary)" }}
                            >
                              {cup.name}
                            </p>
                            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                              {cup.categories.length} catégorie
                              {cup.categories.length > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border)" }}>
                              {totalCriteria} critère{totalCriteria > 1 ? "s" : ""}
                            </span>
                            <ChevronRight
                              className="h-4 w-4"
                              style={{ color: "var(--n-text-disabled)" }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div
                  className="py-8 text-center"
                  style={{
                    border: "1px solid var(--n-border)",
                    borderRadius: "8px",
                    background: "var(--n-surface-raised)",
                  }}
                >
                  <p style={{ color: "var(--n-text-secondary)" }}>
                    Aucune autre Cup avec des critères disponible.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Category selection */}
          {step === "category" && selectedCup && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="n-label">Catégorie source</Label>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                  {selectedCup.name}
                </span>
              </div>
              <ScrollArea
                className="h-[280px]"
                style={{
                  border: "1px solid var(--n-border)",
                  borderRadius: "8px",
                  background: "var(--n-surface-raised)",
                }}
              >
                <div className="p-2 space-y-1">
                  {selectedCup.categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleSelectCategory(category.id)}
                      style={listItemStyle}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--n-surface)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <p
                        className="n-font-body font-medium"
                        style={{ color: "var(--n-text-primary)" }}
                      >
                        {category.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border)" }}>
                          {category.criteria.length} critère
                          {category.criteria.length > 1 ? "s" : ""}
                        </span>
                        <ChevronRight
                          className="h-4 w-4"
                          style={{ color: "var(--n-text-disabled)" }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Criteria selection */}
          {step === "criteria" && selectedCategory && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="n-label">Critères à importer</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-7 text-xs"
                  >
                    Tout sélectionner
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="h-7 text-xs"
                  >
                    Tout désélectionner
                  </Button>
                </div>
              </div>
              <div
                className="h-[240px] overflow-y-auto overflow-x-hidden"
                style={{
                  border: "1px solid var(--n-border)",
                  borderRadius: "8px",
                  background: "var(--n-surface-raised)",
                }}
              >
                <div className="p-2 space-y-1">
                  {selectedCategory.criteria.map((criterion) => (
                    <label
                      key={criterion.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer overflow-hidden transition-colors"
                      )}
                      style={{
                        background: selectedCriteriaIds.has(criterion.id)
                          ? "var(--n-surface)"
                          : "transparent",
                      }}
                    >
                      <Checkbox
                        checked={selectedCriteriaIds.has(criterion.id)}
                        onCheckedChange={() => handleToggleCriterion(criterion.id)}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="n-font-body font-medium truncate"
                          style={{ color: "var(--n-text-primary)" }}
                        >
                          {criterion.name}
                        </p>
                        {criterion.description && (
                          <p
                            className="text-sm truncate"
                            style={{ color: "var(--n-text-secondary)" }}
                          >
                            {criterion.description}
                          </p>
                        )}
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)", flexShrink: 0, marginLeft: "auto" }}>
                        {formatCoefficient(criterion.coefficient)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {selectedCriteriaIds.size} critère
                {selectedCriteriaIds.size > 1 ? "s" : ""} sélectionné
                {selectedCriteriaIds.size > 1 ? "s" : ""} sur{" "}
                {selectedCategory.criteria.length}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step !== "cup" && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          {step === "criteria" && (
            <Button
              onClick={handleImport}
              disabled={isSubmitting || selectedCriteriaIds.size === 0}
            >
              {isSubmitting ? (
                <span className="mr-2 text-xs">[...]</span>
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Importer {selectedCriteriaIds.size > 0 ? `(${selectedCriteriaIds.size})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
