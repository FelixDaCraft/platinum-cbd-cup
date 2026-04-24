"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

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
import { Checkbox } from "~/components/ui/checkbox";
import { ColorPalettePicker } from "./color-palette-picker";
import { LABEL_COLOR_PALETTE } from "~/lib/validations/labels";

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

interface LabelFormDialogProps {
  label: LabelData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    labelId?: string;
    name: string;
    minScore: number;
    maxScore: number | null;
    color: string | null;
    icon: string | null;
    condition: string | null;
    isPublic: boolean;
  }) => void;
  isSubmitting: boolean;
  mode: "create" | "edit";
  scaleMax?: number;
  existingLabels?: LabelData[];
}

export function LabelFormDialog({
  label,
  open,
  onOpenChange,
  onSave,
  isSubmitting,
  mode,
  scaleMax = 10,
  existingLabels = [],
}: LabelFormDialogProps) {
  const [name, setName] = useState("");
  const [minScore, setMinScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number | null>(null);
  const [noUpperLimit, setNoUpperLimit] = useState(false);
  const [color, setColor] = useState<string>(LABEL_COLOR_PALETTE[0]!.hex);
  const [icon, setIcon] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reset form when label changes or dialog opens
  useEffect(() => {
    if (open) {
      if (label) {
        setName(label.name);
        setMinScore(label.minScore);
        setMaxScore(label.maxScore);
        setNoUpperLimit(label.maxScore === null);
        setColor(label.color ?? LABEL_COLOR_PALETTE[0]!.hex);
        setIcon(label.icon ?? "");
        setCondition(label.condition ?? "");
        setIsPublic(label.isPublic);
      } else {
        // Reset for new label
        setName("");
        setMinScore(0);
        setMaxScore(null);
        setNoUpperLimit(false);
        setColor(LABEL_COLOR_PALETTE[0]!.hex);
        setIcon("");
        setCondition("");
        setIsPublic(true);
      }
      setError(null);
    }
  }, [label, open]);

  const handleSave = () => {
    // Basic validation
    if (!name.trim()) {
      setError("Le nom du label est requis");
      return;
    }

    if (minScore < 0 || minScore > scaleMax) {
      setError(`Le score minimum doit être entre 0 et ${scaleMax}`);
      return;
    }

    const finalMaxScore = noUpperLimit ? null : maxScore;

    if (finalMaxScore !== null) {
      if (finalMaxScore < 0 || finalMaxScore > scaleMax) {
        setError(`Le score maximum doit être entre 0 et ${scaleMax}`);
        return;
      }
      if (minScore >= finalMaxScore) {
        setError("Le score minimum doit être inférieur au score maximum");
        return;
      }
    }

    // Check for overlaps with existing labels
    const otherLabels = existingLabels.filter((l) => l.id !== label?.id);
    for (const other of otherLabels) {
      const otherMax = other.maxScore ?? scaleMax;
      const thisMax = finalMaxScore ?? scaleMax;
      if (minScore <= otherMax && thisMax >= other.minScore) {
        setError(`Chevauchement avec "${other.name}" (${other.minScore}-${otherMax}). Ajustez les plages pour éviter les doublons.`);
        return;
      }
    }

    // Check for gaps with adjacent labels and warn (but don't block)
    setError(null);
    onSave({
      labelId: label?.id,
      name: name.trim(),
      minScore,
      maxScore: finalMaxScore,
      color,
      icon: icon.trim() || null,
      condition: condition.trim() || null,
      isPublic,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter un label" : `Modifier ${label?.name ?? "le label"}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Créez un nouveau label avec une plage de scores."
              : "Modifiez les propriétés du label."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom du label</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Bronze, Argent, Or..."
              maxLength={50}
            />
          </div>

          {/* Score range */}
          <div className="space-y-2">
            <Label>Plage de scores</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="minScore" className="sr-only">
                  Score minimum
                </Label>
                <Input
                  id="minScore"
                  type="number"
                  min={0}
                  max={scaleMax}
                  step={0.01}
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value) || 0)}
                  placeholder="Min"
                />
              </div>
              <span className="text-muted-foreground">à</span>
              <div className="flex-1">
                <Label htmlFor="maxScore" className="sr-only">
                  Score maximum
                </Label>
                <Input
                  id="maxScore"
                  type="number"
                  min={0}
                  max={scaleMax}
                  step={0.01}
                  value={maxScore ?? ""}
                  onChange={(e) =>
                    setMaxScore(e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="Max"
                  disabled={noUpperLimit}
                />
              </div>
              <span className="text-muted-foreground">pts</span>
            </div>

            {/* No upper limit checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="noUpperLimit"
                checked={noUpperLimit}
                onCheckedChange={(checked) => {
                  setNoUpperLimit(checked === true);
                  if (checked) {
                    setMaxScore(null);
                  }
                }}
              />
              <Label
                htmlFor="noUpperLimit"
                className="text-sm font-normal cursor-pointer"
              >
                Sans limite supérieure (ex: 90+)
              </Label>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <ColorPalettePicker value={color} onChange={setColor} />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label htmlFor="icon">Icône (emoji ou URL)</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Ex: 🏆, 🥇, ou URL d'image..."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Emoji (🏆) ou URL vers une image
            </p>
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition">Condition (texte descriptif)</Label>
            <Input
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Ex: Score ≥ 17/20"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Affiché sur le portail public pour expliquer le critère
            </p>
          </div>

          {/* Is Public */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(checked === true)}
            />
            <Label
              htmlFor="isPublic"
              className="text-sm font-normal cursor-pointer"
            >
              Visible sur le portail public
            </Label>
          </div>

          {/* Error message */}
          {error && <p className="text-sm text-destructive">{error}</p>}
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
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
