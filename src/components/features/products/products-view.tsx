"use client";

import { useState } from "react";
import { Grid2X2, List } from "lucide-react";
import {
  CategoryProductsSection,
  type CategoryProductsSectionProps,
} from "./category-products-section";

export interface ProductsViewProps {
  cupName: string;
  totalProducts: number;
  totalCategories: number;
  categories: Array<{
    category: {
      id: string;
      name: string;
      description: string | null;
    };
    products: CategoryProductsSectionProps["products"];
    count: number;
  }>;
}

type ViewMode = "list" | "cards";

export function ProductsView({
  cupName,
  totalProducts,
  totalCategories,
  categories,
}: ProductsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  if (totalProducts === 0) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            color: "var(--n-text-disabled)",
            letterSpacing: "0.06em",
          }}
        >
          [AUCUN PRODUIT]
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--n-text-disabled)",
            letterSpacing: "0.04em",
            marginTop: "8px",
          }}
        >
          Il n&apos;y a pas encore de produits inscrits pour cette cup.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats and view toggle */}
      <div className="flex items-center justify-between">
        <p className="n-label">
          <span
            style={{
              color: "var(--n-text-primary)",
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
            }}
          >
            {totalProducts}
          </span>{" "}
          produit{totalProducts > 1 ? "s" : ""} dans{" "}
          <span
            style={{
              color: "var(--n-text-primary)",
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
            }}
          >
            {totalCategories}
          </span>{" "}
          catégorie{totalCategories > 1 ? "s" : ""}
        </p>

        {/* View mode toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            border: "1px solid var(--n-border)",
            borderRadius: "6px",
            padding: "3px",
            background: "var(--n-surface)",
          }}
        >
          <button
            onClick={() => setViewMode("cards")}
            aria-label="Vue en cartes"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: viewMode === "cards" ? "var(--n-border)" : "transparent",
              color: viewMode === "cards" ? "var(--n-text-display)" : "var(--n-text-secondary)",
              transition: "background 0.15s",
            }}
          >
            <Grid2X2 style={{ width: "14px", height: "14px" }} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            aria-label="Vue en liste"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: viewMode === "list" ? "var(--n-border)" : "transparent",
              color: viewMode === "list" ? "var(--n-text-display)" : "var(--n-text-secondary)",
              transition: "background 0.15s",
            }}
          >
            <List style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>

      {/* Categories with products */}
      <div className="space-y-6">
        {categories.map((categoryGroup) => (
          <CategoryProductsSection
            key={categoryGroup.category.id}
            category={categoryGroup.category}
            products={categoryGroup.products}
            count={categoryGroup.count}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}
