"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  MapPin,
  Filter,
  Download,
  Share2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePortal } from "~/lib/portal/context";
import { ResultsPodium, CompactPodium } from "./results-podium";
import {
  ResultsLabelsSection,
  LabelsSummary,
} from "./results-labels-section";
import {
  WinnerProductModal,
  WinnerProductCard,
} from "./winner-product-modal";
import type { ReactNode } from "react";

// Re-export types for the page
interface PodiumWinner {
  productId: string;
  productName: string;
  producerName: string;
  rank: number;
  score: string | null;
  cupRatingScale: string | null;
  labelId: string | null;
  labelName: string | null;
  labelColor: string | null;
  labelIcon: string | null;
}

interface LabeledProduct {
  productId: string;
  productName: string;
  productDescription: string | null;
  productImageUrl: string | null;
  producerName: string;
  producerLocation: string | null;
  producerWebsite: string | null;
  producerEmail: string | null;
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

interface CupLabel {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  minScore: number;
}

interface Category {
  id: string;
  name: string;
  products: PodiumWinner[];
}

interface CupResultsPageProps {
  cup: {
    id: string;
    name: string;
    bannerUrl: string | null;
    eventDate: Date | null;
    eventLocation: string | null;
    resultsPublishedAt: Date | null;
    resultsVisibility: string | null;
    ratingScale: string | null;
  };
  categories: Category[];
  labels: CupLabel[];
  allProducts: LabeledProduct[];
}

// Labels by locale
const pageLabels = {
  fr: {
    title: "Résultats",
    published: "Publiés le",
    backToCup: "Retour à la cup",
    podiumTab: "Podiums",
    labelsTab: "Labels",
    allTab: "Tous les résultats",
    filterByCategory: "Filtrer par catégorie",
    allCategories: "Toutes les catégories",
    share: "Partager",
    download: "Télécharger",
    noResults: "Résultats à venir",
    noResultsDesc: "Les résultats de cette compétition ne sont pas encore publiés.",
  },
  en: {
    title: "Results",
    published: "Published on",
    backToCup: "Back to cup",
    podiumTab: "Podiums",
    labelsTab: "Labels",
    allTab: "All results",
    filterByCategory: "Filter by category",
    allCategories: "All categories",
    share: "Share",
    download: "Download",
    noResults: "Results coming soon",
    noResultsDesc: "The results of this competition have not been published yet.",
  },
} as const;

function formatDate(date: Date | null, locale: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Results Hero Section
 */
function ResultsHero({
  cup,
}: {
  cup: CupResultsPageProps["cup"];
}) {
  const { theme, locale } = usePortal();
  const labels = pageLabels[locale] ?? pageLabels.fr;

  return (
    <div
      className="relative h-48 md:h-64 bg-gradient-to-br"
      style={{
        background: cup.bannerUrl
          ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url(${cup.bannerUrl}) center/cover`
          : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
      }}
    >
      <div className="absolute inset-0 flex items-end">
        <div className="container mx-auto pb-8 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Trophy className="h-4 w-4" />
              <span>{labels.title}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              {cup.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm">
              {cup.eventDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(cup.eventDate, locale)}</span>
                </div>
              )}
              {cup.eventLocation && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{cup.eventLocation}</span>
                </div>
              )}
              {cup.resultsPublishedAt && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {labels.published} {formatDate(cup.resultsPublishedAt, locale)}
                </Badge>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * No Results Placeholder
 */
function NoResults() {
  const { theme, locale } = usePortal();
  const labels = pageLabels[locale] ?? pageLabels.fr;

  return (
    <div className="py-24 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <div
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.primaryColor}20` }}
        >
          <Trophy
            className="h-12 w-12"
            style={{ color: theme.primaryColor }}
          />
        </div>
        <h2 className="text-2xl font-bold">{labels.noResults}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {labels.noResultsDesc}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * Cup Results Page Component - Stories 12.11-12.13
 * Complete results display with podiums, labels, and product modals
 */
export function CupResultsPage({
  cup,
  categories,
  labels,
  allProducts,
}: CupResultsPageProps) {
  const { theme, locale } = usePortal();
  const texts = pageLabels[locale] ?? pageLabels.fr;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<LabeledProduct | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine what to show based on visibility
  const visibility = cup.resultsVisibility ?? "labels";
  const showPodium = ["podium", "labels_and_podium", "all"].includes(visibility);
  const showLabels = ["labels", "labels_and_podium", "all"].includes(visibility);
  const showAll = visibility === "all";

  // Filter categories if one is selected
  const displayCategories = selectedCategoryId
    ? categories.filter((c) => c.id === selectedCategoryId)
    : categories;

  // Filter products for labels section
  const displayProducts = selectedCategoryId
    ? allProducts.filter((p) => p.categoryId === selectedCategoryId)
    : allProducts;

  // Handle product click
  const handleProductClick = (product: LabeledProduct) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Handle share
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${texts.title} - ${cup.name}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // Ignore share errors
    }
  };

  // Check if results are published
  const hasResults = cup.resultsPublishedAt && categories.length > 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <ResultsHero cup={cup} />

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button & Actions */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/cups/${cup.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {texts.backToCup}
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {texts.share}
            </Button>
          </div>
        </div>

        {!hasResults ? (
          <NoResults />
        ) : (
          <>
            {/* Labels Summary */}
            {showLabels && labels.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <LabelsSummary labels={labels} products={allProducts} />
              </motion.div>
            )}

            {/* Category Filter */}
            {categories.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 mb-8"
              >
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedCategoryId ?? "all"}
                  onValueChange={(value) =>
                    setSelectedCategoryId(value === "all" ? null : value)
                  }
                >
                  <SelectTrigger className="w-[250px]">
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
              </motion.div>
            )}

            {/* Results Tabs */}
            <Tabs defaultValue={showPodium ? "podium" : "labels"} className="space-y-8">
              <TabsList>
                {showPodium && (
                  <TabsTrigger value="podium">{texts.podiumTab}</TabsTrigger>
                )}
                {showLabels && (
                  <TabsTrigger value="labels">{texts.labelsTab}</TabsTrigger>
                )}
                {showAll && (
                  <TabsTrigger value="all">{texts.allTab}</TabsTrigger>
                )}
              </TabsList>

              {/* Podium Tab */}
              {showPodium && (
                <TabsContent value="podium" className="space-y-12">
                  {displayCategories.map((category) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                    >
                      <ResultsPodium
                        winners={category.products}
                        categoryName={
                          categories.length > 1 ? category.name : undefined
                        }
                        showScore={showAll}
                      />
                    </motion.div>
                  ))}
                </TabsContent>
              )}

              {/* Labels Tab */}
              {showLabels && (
                <TabsContent value="labels">
                  <ResultsLabelsSection
                    products={displayProducts}
                    labels={labels}
                    categories={categories.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                  />
                </TabsContent>
              )}

              {/* All Results Tab */}
              {showAll && (
                <TabsContent value="all" className="space-y-8">
                  {/* Grid of all products */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {displayProducts.map((product) => (
                      <WinnerProductCard
                        key={product.productId}
                        product={{
                          ...product,
                          cupId: cup.id,
                          cupName: cup.name,
                          cupYear: cup.eventDate
                            ? new Date(cup.eventDate).getFullYear()
                            : null,
                        }}
                        onClick={() => handleProductClick(product)}
                      />
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>

      {/* Product Modal */}
      <WinnerProductModal
        product={
          selectedProduct
            ? {
                ...selectedProduct,
                cupId: cup.id,
                cupName: cup.name,
                cupYear: cup.eventDate
                  ? new Date(cup.eventDate).getFullYear()
                  : null,
              }
            : null
        }
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        showDetailedScores={showAll}
      />
    </div>
  );
}
