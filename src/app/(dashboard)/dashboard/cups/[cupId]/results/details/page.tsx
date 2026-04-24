"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

import { api } from "~/trpc/react";
import { getMaxScoreForScale } from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ProductRadarChart, JuryScoresTable } from "~/components/features/results";

export default function ResultsDetailsPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: results, isLoading } = api.results.getDetailedResults.useQuery(
    {
      cupId,
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    },
    { enabled: !!cupId }
  );

  const { data: juryScores, isLoading: loadingJuryScores } =
    api.results.getAnonymizedJuryScores.useQuery(
      { productId: selectedProductId! },
      { enabled: !!selectedProductId }
    );

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

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

  if (!results) {
    return null;
  }

  const scaleMax = getMaxScoreForScale((results.ratingScale ?? "0-20") as RatingScale);

  const totalProducts = results.categories.reduce((sum, cat) => sum + cat.totalProducts, 0);
  const productsWithLabels = results.categories.reduce(
    (sum, cat) => sum + cat.products.filter((p) => p.label).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            RÉSULTATS DÉTAILLÉS
          </h1>
          <p className="n-label">Analyse complète des notes et performances</p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-3">
          <span className="n-label">Filtrer :</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {results.categories.map((cat) => (
                <SelectItem key={cat.category.id} value={cat.category.id}>
                  {cat.category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Catégories", value: results.categories.length },
          { label: "Produits", value: totalProducts },
          { label: "Labels attribués", value: productsWithLabels },
          { label: "Échelle", value: results.ratingScale },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p
              className="n-font-data"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--n-text-display)",
                lineHeight: 1,
                marginBottom: "6px",
              }}
            >
              {stat.value}
            </p>
            <p className="n-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Categories and Products */}
      <div className="space-y-4">
        {results.categories.map((categoryData) => (
          <div
            key={categoryData.category.id}
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {/* Category Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    style={{
                      fontFamily: "'Doto', 'Space Mono', monospace",
                      fontSize: "13px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--n-text-display)",
                      marginBottom: "2px",
                    }}
                  >
                    {categoryData.category.name}
                  </p>
                  <p className="n-label">
                    {categoryData.totalProducts} produit
                    {categoryData.totalProducts > 1 ? "s" : ""} —{" "}
                    {categoryData.category.criteriaCount} critère
                    {categoryData.category.criteriaCount > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Products List */}
            <div>
              {categoryData.products.map((product, prodIndex) => {
                const isExpanded = expandedProducts.has(product.id);
                const isFirst = prodIndex === 0;

                return (
                  <Collapsible
                    key={product.id}
                    open={isExpanded}
                    onOpenChange={() => toggleProduct(product.id)}
                  >
                    <div
                      style={{
                        borderTop: isFirst ? "none" : "1px solid var(--n-border)",
                        padding: "14px 20px",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Rank Badge */}
                          <div
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: "18px",
                              fontWeight: 700,
                              color:
                                product.categoryRank === 1
                                  ? "var(--n-warning)"
                                  : product.categoryRank === 2
                                    ? "var(--n-text-secondary)"
                                    : product.categoryRank === 3
                                      ? "#C07A3A"
                                      : "var(--n-text-disabled)",
                              width: "32px",
                              textAlign: "center",
                              flexShrink: 0,
                            }}
                          >
                            {product.categoryRank ?? "—"}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  color: "var(--n-text-primary)",
                                }}
                              >
                                {product.name}
                              </span>
                              {product.anonymousCode && (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {product.anonymousCode}
                                </Badge>
                              )}
                              {product.label && (
                                <Badge
                                  style={{
                                    backgroundColor: product.label.color ?? undefined,
                                    color: "#fff",
                                    fontSize: "11px",
                                  }}
                                >
                                  {product.label.name}
                                </Badge>
                              )}
                            </div>
                            <p
                              style={{
                                fontSize: "12px",
                                color: "var(--n-text-disabled)",
                                marginTop: "2px",
                              }}
                            >
                              {product.producer.name}
                              {product.producer.brand && ` — ${product.producer.brand}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Score */}
                          <div style={{ textAlign: "right" }}>
                            <p
                              className="n-font-data"
                              style={{
                                fontFamily: "'Space Mono', monospace",
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "var(--n-text-display)",
                                lineHeight: 1,
                              }}
                            >
                              {product.finalScore?.toFixed(2) ?? "N/A"}
                            </p>
                            <p className="n-label">
                              Top {100 - (product.percentile ?? 0)}%
                            </p>
                          </div>

                          {/* View Jury Scores Button */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedProductId(product.id)}
                              >
                                Feuilles jury
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Notes des jurys — {product.name}
                                </DialogTitle>
                              </DialogHeader>
                              {loadingJuryScores ? (
                                <div className="flex items-center justify-center py-12">
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
                              ) : juryScores ? (
                                <JuryScoresTable
                                  juryScores={juryScores.juryScores}
                                  stats={juryScores.stats}
                                  ratingScale={juryScores.ratingScale}
                                />
                              ) : null}
                            </DialogContent>
                          </Dialog>

                          {/* Expand Button */}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div
                        style={{
                          padding: "0 20px 20px",
                          borderTop: "1px solid var(--n-border)",
                          background: "var(--n-black)",
                        }}
                      >
                        <Tabs defaultValue="radar" className="w-full mt-4">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="radar">Graphique Radar</TabsTrigger>
                            <TabsTrigger value="details">Détail par critère</TabsTrigger>
                          </TabsList>

                          <TabsContent value="radar" className="mt-4">
                            <div className="flex justify-center">
                              <ProductRadarChart
                                criteriaScores={product.criteriaScores}
                                productName={product.name}
                                className="w-full max-w-lg"
                              />
                            </div>
                          </TabsContent>

                          <TabsContent value="details" className="mt-4">
                            <div className="space-y-2">
                              {product.criteriaScores.map((criterion) => {
                                const diff =
                                  criterion.productScore !== null &&
                                  criterion.categoryAverage !== null
                                    ? criterion.productScore - criterion.categoryAverage
                                    : null;

                                return (
                                  <div
                                    key={criterion.criterionId}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "12px",
                                      background: "var(--n-surface)",
                                      border: "1px solid var(--n-border)",
                                      borderRadius: "6px",
                                    }}
                                  >
                                    <div>
                                      <span
                                        style={{
                                          fontSize: "13px",
                                          color: "var(--n-text-primary)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {criterion.criterionName}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          color: "var(--n-text-disabled)",
                                          marginLeft: "8px",
                                          fontFamily: "'Space Mono', monospace",
                                        }}
                                      >
                                        coef. {criterion.coefficient}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div style={{ textAlign: "right" }}>
                                        <p className="n-label">Moy. Cat.</p>
                                        <p
                                          style={{
                                            fontFamily: "'Space Mono', monospace",
                                            fontSize: "13px",
                                            color: "var(--n-text-secondary)",
                                          }}
                                        >
                                          {criterion.categoryAverage?.toFixed(2) ?? "N/A"}/{scaleMax}
                                        </p>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <p className="n-label">Produit</p>
                                        <p
                                          style={{
                                            fontFamily: "'Space Mono', monospace",
                                            fontSize: "16px",
                                            fontWeight: 700,
                                            color: "var(--n-text-display)",
                                          }}
                                        >
                                          {criterion.productScore?.toFixed(2) ?? "N/A"}/{scaleMax}
                                        </p>
                                      </div>
                                      <div
                                        style={{
                                          padding: "4px 10px",
                                          borderRadius: "4px",
                                          fontFamily: "'Space Mono', monospace",
                                          fontSize: "12px",
                                          fontWeight: 700,
                                          background:
                                            diff !== null && diff > 0
                                              ? "rgba(74,158,92,0.15)"
                                              : diff !== null && diff < 0
                                                ? "rgba(215,25,33,0.12)"
                                                : "var(--n-border)",
                                          color:
                                            diff !== null && diff > 0
                                              ? "var(--n-success)"
                                              : diff !== null && diff < 0
                                                ? "var(--n-accent)"
                                                : "var(--n-text-disabled)",
                                        }}
                                      >
                                        {diff !== null
                                          ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`
                                          : "—"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
