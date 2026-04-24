"use client";

import { useState, useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface CriterionData {
  id?: string;
  name: string;
  description: string | null;
  coefficient: number;
}

interface CriterionFormDialogProps {
  criterion: CriterionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    criterionId?: string;
    name: string;
    description: string | null;
    coefficient: number;
  }) => void;
  isSubmitting: boolean;
  mode: "create" | "edit";
}

export function CriterionFormDialog({
  criterion,
  open,
  onOpenChange,
  onSave,
  isSubmitting,
  mode,
}: CriterionFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coefficient, setCoefficient] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Reset form when criterion changes or dialog opens
  useEffect(() => {
    if (open) {
      if (criterion) {
        setName(criterion.name);
        setDescription(criterion.description ?? "");
        setCoefficient(criterion.coefficient);
      } else {
        setName("");
        setDescription("");
        setCoefficient(1);
      }
      setError(null);
    }
  }, [criterion, open]);

  const handleSave = () => {
    if (!name.trim()) {
      setError("Le nom du critère est requis");
      return;
    }

    if (name.length > 100) {
      setError("Le nom du critère est trop long (max 100 caractères)");
      return;
    }

    if (description.length > 500) {
      setError("La description est trop longue (max 500 caractères)");
      return;
    }

    if (coefficient < 1 || coefficient > 10) {
      setError("Le coefficient doit être entre 1 et 10");
      return;
    }

    setError(null);
    onSave({
      criterionId: criterion?.id,
      name: name.trim(),
      description: description.trim() || null,
      coefficient,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Ajouter un critère"
              : `Modifier ${criterion?.name ?? "le critère"}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Créez un nouveau critère d'évaluation pour cette catégorie."
              : "Modifiez les propriétés du critère."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="n-label">
              Nom du critère *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aspect visuel, Arôme..."
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="n-label">
              Description (optionnel)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce que les jurys doivent évaluer..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
              {description.length}/500 caractères
            </p>
          </div>

          {/* Coefficient input */}
          <div className="space-y-2">
            <Label htmlFor="coefficient" className="n-label">
              Coefficient (poids)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="coefficient"
                type="number"
                min={1}
                max={10}
                value={coefficient}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setCoefficient(Math.min(10, Math.max(1, val)));
                }}
                className="w-24"
              />
              <span
                className="n-font-data text-sm font-medium"
                style={{ color: "var(--n-text-primary)" }}
              >
                ×{coefficient}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
              De 1 (faible impact) à 10 (fort impact). Le coefficient multiplie
              l'impact de ce critère sur le score final.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm" style={{ color: "var(--n-accent)" }}>
              {error}
            </p>
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
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <span className="mr-2 text-xs">[...]</span>}
            {mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
