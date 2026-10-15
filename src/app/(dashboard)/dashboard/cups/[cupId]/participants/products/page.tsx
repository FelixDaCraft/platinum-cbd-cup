"use client";

import { useParams } from "next/navigation";

import { ProductsView } from "~/components/features/products/products-view";
import { BatchQRCodesDialog } from "~/components/features/products/batch-qr-codes-dialog";
import { api } from "~/trpc/react";

export default function CupProductsPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const { data, isLoading, error } = api.product.listByCupGroupedByCategory.useQuery({
    cupId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            letterSpacing: "0.08em",
            color: "var(--n-text-disabled)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const uniqueProducers = new Set(
    data.categories.flatMap((cat) => cat.products.map((p) => p.producer?.id))
  ).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--n-text-display)",
              marginBottom: "4px",
            }}
          >
            PRODUITS INSCRITS
          </h1>
          <p className="n-label">Gérez les produits participants à la cup</p>
        </div>

        {/* QR Codes buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <BatchQRCodesDialog
            cupId={cupId}
            cupName={data.cupName}
            totalProducts={data.totalProducts}
            type="reception"
          />
          <BatchQRCodesDialog
            cupId={cupId}
            cupName={data.cupName}
            totalProducts={data.totalProducts}
            type="notation"
            buttonVariant="default"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          style={{
            background: "var(--n-surface)",
            border: "1px solid var(--n-border)",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-secondary)",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            PRODUITS INSCRITS
          </p>
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              lineHeight: 1,
            }}
          >
            {data.totalProducts}
          </p>
        </div>
        <div
          style={{
            background: "var(--n-surface)",
            border: "1px solid var(--n-border)",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-secondary)",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            CATÉGORIES
          </p>
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              lineHeight: 1,
            }}
          >
            {data.totalCategories}
          </p>
        </div>
        <div
          style={{
            background: "var(--n-surface)",
            border: "1px solid var(--n-border)",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-secondary)",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            PRODUCTEURS
          </p>
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              lineHeight: 1,
            }}
          >
            {uniqueProducers}
          </p>
        </div>
      </div>

      {/* Products view */}
      <ProductsView
        cupName={data.cupName}
        totalProducts={data.totalProducts}
        totalCategories={data.totalCategories}
        categories={data.categories}
      />
    </div>
  );
}
