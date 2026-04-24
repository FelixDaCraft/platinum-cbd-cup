"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

interface LabeledProduct {
  productId: string;
  productName: string;
  producerName: string;
  categoryId: string;
  categoryName: string;
  labelId: string;
  labelName: string;
  labelColor: string | null;
  labelIcon: string | null;
  score: string | null;
  cupRatingScale: string | null;
  rank: number | null;
}

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface CupLabel {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  minScore: number;
}

interface ResultsLabelsSectionProps {
  products: LabeledProduct[];
  labels: CupLabel[];
  categories: Array<{ id: string; name: string }>;
}

// Labels by locale
const sectionLabels = {
  fr: {
    title: "Produits Primés",
    subtitle: "Tous les produits ayant reçu une distinction",
    filterByLabel: "Filtrer par label",
    filterByCategory: "Filtrer par catégorie",
    allLabels: "Tous les labels",
    allCategories: "Toutes les catégories",
    products: "produits",
    score: "Score",
    by: "par",
    showMore: "Voir plus",
    showLess: "Voir moins",
  },
  en: {
    title: "Awarded Products",
    subtitle: "All products that received an award",
    filterByLabel: "Filter by label",
    filterByCategory: "Filter by category",
    allLabels: "All labels",
    allCategories: "All categories",
    products: "products",
    score: "Score",
    by: "by",
    showMore: "Show more",
    showLess: "Show less",
  },
} as const;

/**
 * Label Card with products count
 */
function LabelCard({
  label,
  count,
  isActive,
  onClick,
}: {
  label: CupLabel;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const { theme } = usePortal();

  // Render label icon
  const renderIcon = () => {
    if (label.icon) {
      if (label.icon.startsWith("http")) {
        return (
          <img src={label.icon} alt="" className="h-8 w-8 object-contain" />
        );
      }
      return <span className="text-2xl">{label.icon}</span>;
    }
    return <Award className="h-6 w-6" />;
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
        isActive
          ? "shadow-lg"
          : "border-transparent bg-muted/50 hover:bg-muted"
      )}
      style={
        isActive
          ? {
              borderColor: label.color ?? theme.primaryColor,
              backgroundColor: `${label.color ?? theme.primaryColor}10`,
            }
          : undefined
      }
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: label.color ?? theme.primaryColor }}
      >
        {renderIcon()}
      </div>
      <div className="text-center">
        <p className="font-semibold">{label.name}</p>
        <p className="text-sm text-muted-foreground">{count} produits</p>
      </div>
    </motion.button>
  );
}

/**
 * Product Row Component
 */
function ProductRow({
  product,
  showScore,
  index,
}: {
  product: LabeledProduct;
  showScore: boolean;
  index: number;
}) {
  const { theme, locale } = usePortal();
  const labels = sectionLabels[locale] ?? sectionLabels.fr;

  // Render label icon
  const renderIcon = () => {
    if (product.labelIcon) {
      if (product.labelIcon.startsWith("http")) {
        return (
          <img
            src={product.labelIcon}
            alt=""
            className="h-4 w-4 object-contain"
          />
        );
      }
      return <span className="text-sm">{product.labelIcon}</span>;
    }
    return <Award className="h-4 w-4" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
    >
      {/* Rank Badge */}
      {product.rank && product.rank <= 3 && (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold text-sm shrink-0"
          style={{
            backgroundColor:
              product.rank === 1
                ? "#FFD700"
                : product.rank === 2
                  ? "#C0C0C0"
                  : "#CD7F32",
          }}
        >
          {product.rank}
        </div>
      )}

      {/* Label Badge */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0"
        style={{ backgroundColor: product.labelColor ?? theme.primaryColor }}
      >
        {renderIcon()}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{product.productName}</p>
        <p className="text-sm text-muted-foreground">
          {labels.by} <span className="font-medium">{product.producerName}</span>
          <span className="mx-2">•</span>
          {product.categoryName}
        </p>
      </div>

      {/* Label Name */}
      <Badge
        variant="outline"
        className="shrink-0"
        style={{
          borderColor: product.labelColor ?? undefined,
          color: product.labelColor ?? undefined,
        }}
      >
        {product.labelName}
      </Badge>

      {/* Score */}
      {showScore && product.score && (() => {
        const { value, max } = convertScoreToScale(parseFloat(product.score), product.cupRatingScale);
        return (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{labels.score}</p>
            <p className="font-bold">{value.toFixed(1)}/{max}</p>
          </div>
        );
      })()}
    </motion.div>
  );
}

/**
 * Results Labels Section - Story 12.12
 * Displays all awarded products grouped by label
 */
export function ResultsLabelsSection({
  products,
  labels,
  categories,
}: ResultsLabelsSectionProps) {
  const { theme, locale } = usePortal();
  const texts = sectionLabels[locale] ?? sectionLabels.fr;

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [showAll, setShowAll] = useState(false);

  // Count products per label
  const labelCounts = labels.map((label) => ({
    label,
    count: products.filter((p) => p.labelId === label.id).length,
  }));

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (selectedLabelId && p.labelId !== selectedLabelId) return false;
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    return true;
  });

  // Sort by label priority (highest minScore first), then by score
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const labelA = labels.find((l) => l.id === a.labelId);
    const labelB = labels.find((l) => l.id === b.labelId);
    const priorityDiff = (labelB?.minScore ?? 0) - (labelA?.minScore ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return parseFloat(b.score ?? "0") - parseFloat(a.score ?? "0");
  });

  // Limit display if not showing all
  const displayProducts = showAll ? sortedProducts : sortedProducts.slice(0, 10);
  const hasMore = sortedProducts.length > 10;

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6" style={{ color: theme.primaryColor }} />
            <h2 className="text-2xl md:text-3xl font-bold">{texts.title}</h2>
          </div>
          <p className="text-muted-foreground">{texts.subtitle}</p>
        </motion.div>

        {/* Labels Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-8"
        >
          {labelCounts.map(({ label, count }) => (
            <LabelCard
              key={label.id}
              label={label}
              count={count}
              isActive={selectedLabelId === label.id}
              onClick={() =>
                setSelectedLabelId(
                  selectedLabelId === label.id ? null : label.id
                )
              }
            />
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-4 mb-6"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtres:</span>
          </div>

          {/* Category Filter */}
          <Select
            value={selectedCategoryId ?? "all"}
            onValueChange={(value) =>
              setSelectedCategoryId(value === "all" ? null : value)
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={texts.filterByCategory} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{texts.allCategories}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Results count */}
          <div className="ml-auto">
            <Badge variant="secondary">
              {sortedProducts.length} {texts.products}
            </Badge>
          </div>
        </motion.div>

        {/* Products List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayProducts.map((product, index) => (
              <ProductRow
                key={product.productId}
                product={product}
                showScore={true}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Show More Button */}
        {hasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mt-6"
          >
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  {texts.showLess}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  {texts.showMore} ({sortedProducts.length - 10})
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/**
 * Compact Labels Summary
 * Shows quick overview of labels awarded
 */
export function LabelsSummary({ labels, products }: { labels: CupLabel[]; products: LabeledProduct[] }) {
  const { theme, locale } = usePortal();
  const texts = sectionLabels[locale] ?? sectionLabels.fr;

  // Count products per label
  const labelCounts = labels.map((label) => ({
    label,
    count: products.filter((p) => p.labelId === label.id).length,
  })).filter(({ count }) => count > 0);

  if (labelCounts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-5 w-5" style={{ color: theme.primaryColor }} />
          {texts.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {labelCounts.map(({ label, count }) => {
            const renderIcon = () => {
              if (label.icon) {
                if (label.icon.startsWith("http")) {
                  return (
                    <img
                      src={label.icon}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                  );
                }
                return <span className="text-sm">{label.icon}</span>;
              }
              return <Award className="h-4 w-4" />;
            };

            return (
              <div
                key={label.id}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-white"
                style={{ backgroundColor: label.color ?? theme.primaryColor }}
              >
                {renderIcon()}
                <span className="font-medium">{label.name}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
