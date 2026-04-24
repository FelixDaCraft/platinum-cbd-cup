"use client";

import { useState, useEffect } from "react";
import { Loader2, Tag } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  formatPrice,
  formatPriceForInput,
  parsePriceInput,
  currencySymbols,
  type Currency,
} from "~/lib/validations/pricing";

interface CategoryPrice {
  categoryId: string;
  name: string;
  priceOverride: number | null;
}

interface CategoryPriceEditDialogProps {
  category: CategoryPrice | null;
  defaultPrice: number | null;
  currency: Currency;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (categoryId: string, priceOverride: number | null) => void;
  isSubmitting: boolean;
}

export function CategoryPriceEditDialog({
  category,
  defaultPrice,
  currency,
  open,
  onOpenChange,
  onSave,
  isSubmitting,
}: CategoryPriceEditDialogProps) {
  const [useDefault, setUseDefault] = useState(true);
  const [priceInput, setPriceInput] = useState("");

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      const hasOverride = category.priceOverride !== null;
      setUseDefault(!hasOverride);
      setPriceInput(hasOverride ? formatPriceForInput(category.priceOverride) : "");
    }
  }, [category]);

  const handleSave = () => {
    if (!category) return;

    if (useDefault) {
      onSave(category.categoryId, null);
    } else {
      const priceInCents = parsePriceInput(priceInput);
      onSave(category.categoryId, priceInCents);
    }
  };

  if (!category) return null;

  const symbol = currencySymbols[currency];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            Modifier le prix
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-medium text-foreground">{category.name}</span>
            <span className="text-muted-foreground">-</span>
            <span>Définissez un prix spécifique ou utilisez le prix par défaut</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={useDefault ? "default" : "custom"}
            onValueChange={(value) => setUseDefault(value === "default")}
            className="space-y-3"
          >
            <div
              className="flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer"
              style={{
                borderColor: useDefault ? "var(--n-border-visible)" : "var(--n-border)",
                background: useDefault ? "var(--n-surface-raised)" : "transparent",
              }}
              onClick={() => setUseDefault(true)}
            >
              <RadioGroupItem value="default" id="default" />
              <Label htmlFor="default" className="cursor-pointer flex-1">
                <span className="block font-medium">Prix par défaut</span>
                <span className="text-sm text-muted-foreground">
                  {formatPrice(defaultPrice, currency)}
                </span>
              </Label>
            </div>
            <div
              className="flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer"
              style={{
                borderColor: !useDefault ? "var(--n-border-visible)" : "var(--n-border)",
                background: !useDefault ? "var(--n-surface-raised)" : "transparent",
              }}
              onClick={() => setUseDefault(false)}
            >
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="cursor-pointer flex-1">
                <span className="block font-medium">Prix personnalisé</span>
                <span className="text-sm text-muted-foreground">
                  Définir un montant spécifique pour cette catégorie
                </span>
              </Label>
            </div>
          </RadioGroup>

          {!useDefault && (
            <div className="space-y-2 pl-3 pt-2">
              <Label htmlFor="customPrice">Montant</Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="customPrice"
                  type="text"
                  placeholder="0,00"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {symbol}
                </span>
              </div>
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
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
