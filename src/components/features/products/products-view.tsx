"use client";

import { useMemo, useState } from "react";
import { Grid2X2, List } from "lucide-react";
import { isCompeting, isUnfinished } from "~/lib/registration-checkout";
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

type ProductFilter = "competing" | "unfinished" | "all";

type Product = CategoryProductsSectionProps["products"][number];

const filterOptions: { value: ProductFilter; label: string; title: string }[] = [
  { value: "competing", label: "En lice", title: "Inscriptions payées ou importées" },
  {
    value: "unfinished",
    label: "Non terminées",
    title: "Panier vide ou non validé, paiement abandonné ou refusé",
  },
  { value: "all", label: "Toutes", title: "Tous les produits, annulés compris" },
];

const filterMatches: Record<ProductFilter, (product: Product) => boolean> = {
  // Sans parcours connu, le produit est compté en lice comme auparavant.
  competing: (p) => !p.checkout || isCompeting(p.checkout.state),
  unfinished: (p) => !!p.checkout && isUnfinished(p.checkout.state),
  all: () => true,
};

export function ProductsView({
  cupName,
  totalProducts,
  totalCategories,
  categories,
}: ProductsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filter, setFilter] = useState<ProductFilter>("competing");

  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filterOptions.map((o) => [o.value, allProducts.filter(filterMatches[o.value]).length])
      ) as Record<ProductFilter, number>,
    [allProducts]
  );

  const visibleCategories = useMemo(
    () =>
      categories
        .map((group) => {
          const products = group.products.filter(filterMatches[filter]);
          return { ...group, products, count: products.length };
        })
        .filter((group) => group.count > 0),
    [categories, filter]
  );
  const visibleProducts = counts[filter];

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
      {/* Filtre par parcours d'inscription */}
      <div
        role="tablist"
        aria-label="Filtrer les produits"
        className="flex flex-wrap gap-2"
      >
        {filterOptions.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={active}
              title={option.title}
              onClick={() => setFilter(option.value)}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--n-border)",
                cursor: "pointer",
                background: active ? "var(--n-text-display)" : "var(--n-surface)",
                color: active ? "var(--n-black)" : "var(--n-text-secondary)",
              }}
            >
              {option.label} · {counts[option.value]}
            </button>
          );
        })}
      </div>

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
            {visibleProducts}
          </span>{" "}
          produit{visibleProducts > 1 ? "s" : ""} dans{" "}
          <span
            style={{
              color: "var(--n-text-primary)",
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
            }}
          >
            {visibleCategories.length}
          </span>{" "}
          catégorie{visibleCategories.length > 1 ? "s" : ""}
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
        {visibleCategories.length === 0 && (
          <p className="n-label" style={{ textAlign: "center", padding: "32px 0" }}>
            Aucun produit dans ce filtre.
          </p>
        )}
        {visibleCategories.map((categoryGroup) => (
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
