"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CreditCard, Layers, Tag } from "lucide-react";
import { toast } from "sonner";

import {
  PricingForm,
  CategoryPriceList,
  CategoryPriceEditDialog,
} from "~/components/features/pricing";
import { api } from "~/trpc/react";
import { formatPrice, type Currency } from "~/lib/validations/pricing";

interface CategoryPrice {
  categoryId: string;
  name: string;
  priceOverride: number | null;
}

export default function PricingPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [editingCategory, setEditingCategory] = useState<CategoryPrice | null>(null);

  const utils = api.useUtils();

  const { data: pricing, isLoading } = api.pricing.getCupPricing.useQuery(
    { cupId },
    { enabled: !!cupId }
  );

  const updateCupPricing = api.pricing.updateCupPricing.useMutation({
    onSuccess: () => {
      void utils.pricing.getCupPricing.invalidate({ cupId });
      toast.success("Tarification mise à jour");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateCategoryPrice = api.pricing.updateCategoryPrice.useMutation({
    onSuccess: () => {
      void utils.pricing.getCupPricing.invalidate({ cupId });
      setEditingCategory(null);
      toast.success("Prix de la catégorie mis à jour");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpdatePricing = (data: {
    defaultPricePerProduct: number | null;
    currency: Currency;
  }) => {
    updateCupPricing.mutate({
      cupId,
      defaultPricePerProduct: data.defaultPricePerProduct,
      currency: data.currency,
    });
  };

  const handleUpdateCategoryPrice = (
    categoryId: string,
    priceOverride: number | null
  ) => {
    updateCategoryPrice.mutate({
      categoryId,
      priceOverride,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-label">[LOADING...]</span>
      </div>
    );
  }

  if (!pricing) {
    return null;
  }

  const categoriesWithOverride = pricing.categoryPrices.filter(
    (c) => c.priceOverride !== null
  ).length;
  const totalCategories = pricing.categoryPrices.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="n-font-body text-2xl font-medium" style={{ color: "var(--n-text-display)" }}>
            Tarification
          </h1>
          <p className="n-label mt-1">Gérez les prix d&apos;inscription par produit</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <Tag className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p className="n-font-data text-xl font-bold" style={{ color: "var(--n-text-display)" }}>
                {formatPrice(pricing.defaultPricePerProduct, pricing.currency as Currency)}
              </p>
              <p className="n-label">Prix par défaut</p>
            </div>
          </div>
        </div>
        <div className="n-card" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-text-display)" }}>
                {totalCategories}
              </p>
              <p className="n-label">Catégorie{totalCategories !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="n-card col-span-2 lg:col-span-1" style={{ padding: "16px" }}>
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-text-display)" }}>
                {categoriesWithOverride}
              </p>
              <p className="n-label">Prix personnalisé{categoriesWithOverride !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Default Pricing Form */}
      <div className="n-card" style={{ padding: "0" }}>
        <div
          className="flex items-center gap-2 px-6 py-4"
          style={{ borderBottom: "1px solid var(--n-border)" }}
        >
          <Tag className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <span className="n-font-body font-medium" style={{ color: "var(--n-text-primary)" }}>
            Prix par défaut
          </span>
        </div>
        <div className="p-6">
          <PricingForm
            defaultPricePerProduct={pricing.defaultPricePerProduct}
            currency={pricing.currency as Currency}
            cupStatus={pricing.cupStatus}
            onSubmit={handleUpdatePricing}
            isSubmitting={updateCupPricing.isPending}
          />
        </div>
      </div>

      {/* Category Prices */}
      <CategoryPriceList
        categories={pricing.categoryPrices}
        defaultPrice={pricing.defaultPricePerProduct}
        currency={pricing.currency as Currency}
        cupId={cupId}
        onEditCategory={setEditingCategory}
      />

      {/* Edit Category Price Dialog */}
      <CategoryPriceEditDialog
        category={editingCategory}
        defaultPrice={pricing.defaultPricePerProduct}
        currency={pricing.currency as Currency}
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        onSave={handleUpdateCategoryPrice}
        isSubmitting={updateCategoryPrice.isPending}
      />
    </div>
  );
}
