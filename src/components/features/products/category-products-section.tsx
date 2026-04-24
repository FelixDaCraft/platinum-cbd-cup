"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ProductCard, type ProductCardProps } from "./product-card";
import { ProductListItem } from "./product-list-item";

export interface CategoryProductsSectionProps {
  category: {
    id: string;
    name: string;
    description: string | null;
  };
  products: ProductCardProps[];
  count: number;
  viewMode: "list" | "cards";
  defaultOpen?: boolean;
}

export function CategoryProductsSection({
  category,
  products,
  count,
  viewMode,
  defaultOpen = true,
}: CategoryProductsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Section header trigger */}
      <CollapsibleTrigger asChild>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            padding: "10px 14px",
            border: "1px solid var(--n-border)",
            borderRadius: isOpen ? "8px 8px 0 0" : "8px",
            background: "var(--n-surface)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {isOpen ? (
            <ChevronDown
              style={{
                width: "14px",
                height: "14px",
                color: "var(--n-text-secondary)",
                flexShrink: 0,
              }}
            />
          ) : (
            <ChevronRight
              style={{
                width: "14px",
                height: "14px",
                color: "var(--n-text-secondary)",
                flexShrink: 0,
              }}
            />
          )}

          <span
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-display)",
            }}
          >
            {category.name}
          </span>

          {/* Count badge */}
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--n-text-secondary)",
              background: "var(--n-border)",
              borderRadius: "4px",
              padding: "1px 7px",
              letterSpacing: "0.04em",
            }}
          >
            {count}
          </span>

          {category.description && (
            <span className="n-label" style={{ marginLeft: "4px" }}>
              {category.description}
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {viewMode === "cards" ? (
          <div
            style={{
              border: "1px solid var(--n-border)",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              padding: "12px",
              background: "transparent",
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--n-border)",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              overflow: "hidden",
              background: "var(--n-surface)",
            }}
          >
            {products.map((product) => (
              <ProductListItem key={product.id} {...product} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
