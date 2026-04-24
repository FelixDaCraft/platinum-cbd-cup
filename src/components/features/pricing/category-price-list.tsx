"use client";

import { Edit2, Layers, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatPrice, type Currency } from "~/lib/validations/pricing";

interface CategoryPrice {
  categoryId: string;
  name: string;
  priceOverride: number | null;
}

interface CategoryPriceListProps {
  categories: CategoryPrice[];
  defaultPrice: number | null;
  currency: Currency;
  cupId: string;
  onEditCategory: (category: CategoryPrice) => void;
}

export function CategoryPriceList({
  categories,
  defaultPrice,
  currency,
  cupId,
  onEditCategory,
}: CategoryPriceListProps) {
  if (categories.length === 0) {
    return (
      <div className="n-card p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Layers className="h-8 w-8 mb-4" style={{ color: "var(--n-text-secondary)" }} />
          <h3 className="text-lg font-semibold mb-2">Aucune catégorie</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Créez des catégories pour définir des prix spécifiques par type de produit.
          </p>
          <div className="mt-6">
            <Link href={`/dashboard/cups/${cupId}/config/categories`}>
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-2" />
                Gérer les catégories
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Les catégories permettent de personnaliser les prix
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="n-card overflow-hidden" style={{ padding: 0 }}>
      <div className="p-4" style={{ borderBottom: "1px solid var(--n-border)" }}>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <h2 className="font-semibold">Prix par catégorie</h2>
        </div>
      </div>
      <div style={{ borderTop: "none" }}>
        {categories.map((category) => {
          const isOverridden = category.priceOverride !== null;
          const displayPrice = isOverridden
            ? category.priceOverride
            : defaultPrice;

          return (
            <div
              key={category.categoryId}
              className="flex items-center justify-between p-4 transition-colors"
              style={{ borderBottom: "1px solid var(--n-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{category.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {formatPrice(displayPrice, currency)}
                  </span>
                  {isOverridden ? (
                    <Badge variant="secondary">
                      personnalisé
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      défaut
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditCategory(category)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Modifier le prix</span>
                </Button>
                <Link href={`/dashboard/cups/${cupId}/config/categories/${category.categoryId}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Voir la catégorie</span>
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
