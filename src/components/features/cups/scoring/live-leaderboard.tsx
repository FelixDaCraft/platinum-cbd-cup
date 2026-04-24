"use client";

import { useState } from "react";
import { Trophy, Medal, ChevronDown, Star, Hash } from "lucide-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { getMaxScoreForScale } from "~/lib/validations/labels";

interface LiveLeaderboardProps {
  cupId: string;
}

function getRankIcon(rank: number | null) {
  if (rank === 1)
    return (
      <Trophy
        className="h-4 w-4"
        strokeWidth={1.5}
        style={{ color: "var(--n-warning)" }}
      />
    );
  if (rank === 2)
    return (
      <Medal
        className="h-4 w-4"
        strokeWidth={1.5}
        style={{ color: "var(--n-text-secondary)" }}
      />
    );
  if (rank === 3)
    return (
      <Medal
        className="h-4 w-4"
        strokeWidth={1.5}
        style={{ color: "var(--n-text-disabled)" }}
      />
    );
  return (
    <span
      className="n-font-data text-xs"
      style={{ color: "var(--n-text-disabled)" }}
    >
      {rank ?? "—"}
    </span>
  );
}

function getRankBorderColor(rank: number | null): string {
  if (rank === 1) return "var(--n-warning)";
  if (rank === 2) return "var(--n-border-visible)";
  if (rank === 3) return "var(--n-border-visible)";
  return "var(--n-border)";
}

export function LiveLeaderboard({ cupId }: LiveLeaderboardProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const { data, isLoading, error } = api.scoring.getLiveScores.useQuery(
    { cupId, limit: 5 },
    {
      refetchInterval: 30000,
    }
  );

  const toggleCategory = (categoryId: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(categoryId)) {
      newSet.delete(categoryId);
    } else {
      newSet.add(categoryId);
    }
    setExpandedCategories(newSet);
  };

  if (isLoading) {
    return (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
        }}
      >
        <div
          className="p-4 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--n-border)" }}
        >
          <Trophy
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p
              className="n-font-body text-sm font-semibold"
              style={{ color: "var(--n-text-display)" }}
            >
              Classement en temps réel
            </p>
            <p className="n-label mt-0.5">[LOADING...]</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>—</p>
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    style={{
                      height: "48px",
                      background: "var(--n-border)",
                      borderRadius: "6px",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (!data.available) {
    return (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
        }}
      >
        <div className="p-4 flex items-center gap-2">
          <Trophy
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p
              className="n-font-body text-sm font-semibold"
              style={{ color: "var(--n-text-display)" }}
            >
              Classement
            </p>
            <p className="n-label mt-0.5" style={{ color: "var(--n-text-disabled)" }}>
              {data.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.categories || data.categories.length === 0) {
    return null;
  }

  const ratingMax = getMaxScoreForScale(data.ratingScale);
  const categories = data.categories as Array<{
    categoryId: string;
    categoryName: string;
    products: Array<{
      id: string;
      anonymousCode: string | null;
      name: string;
      categoryId: string;
      categoryName: string;
      averageScore: number | null;
      ratingsCount: number;
      categoryRank: number | null;
      label: { id: string; name: string } | null;
    }>;
  }>;

  return (
    <div
      style={{
        background: "var(--n-surface)",
        border: "1px solid var(--n-border)",
        borderRadius: "12px",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--n-border)" }}
      >
        <div className="flex items-center gap-2">
          <Trophy
            className="h-4 w-4 shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--n-text-secondary)" }}
          />
          <div>
            <p
              className="n-font-body text-sm font-semibold"
              style={{ color: "var(--n-text-display)" }}
            >
              Classement en temps réel
            </p>
            <p className="n-label mt-0.5">
              TOP 5 PAR CATÉGORIE · ÉCHELLE 1-{ratingMax}
            </p>
          </div>
        </div>
        {data.cupStatus === "rating" && (
          <span
            className="n-label flex items-center gap-1.5"
            style={{ color: "var(--n-success)" }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--n-success)",
                display: "inline-block",
              }}
            />
            EN DIRECT
          </span>
        )}
      </div>

      {/* Categories */}
      <div className="p-4 space-y-3">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.categoryId);
          const hasProducts = category.products.length > 0;

          return (
            <Collapsible
              key={category.categoryId}
              open={isExpanded}
              onOpenChange={() => toggleCategory(category.categoryId)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-3 py-2 h-auto"
                  style={{
                    background: "var(--n-surface-raised)",
                    border: "1px solid var(--n-border)",
                    borderRadius: "6px",
                    color: "var(--n-text-display)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="n-font-body text-sm font-semibold"
                      style={{ color: "var(--n-text-display)" }}
                    >
                      {category.categoryName}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        letterSpacing: "0.04em",
                        background: "var(--n-border)",
                        color: "var(--n-text-secondary)",
                        border: "none",
                      }}
                    >
                      {category.products.length} produits
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.5}
                    style={{ color: "var(--n-text-disabled)" }}
                  />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {hasProducts ? (
                  <div className="space-y-1.5 mt-2 pl-2">
                    {category.products.map((product, index) => {
                      const rank = index + 1;
                      return (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 p-3"
                          style={{
                            borderRadius: "6px",
                            border: "1px solid",
                            borderColor: getRankBorderColor(rank),
                            borderLeftWidth: "2px",
                          }}
                        >
                          {/* Rank */}
                          <div
                            className="w-7 h-7 flex items-center justify-center shrink-0"
                          >
                            {getRankIcon(rank)}
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="n-font-body text-sm font-medium truncate"
                                style={{ color: "var(--n-text-primary)" }}
                              >
                                {product.name}
                              </span>
                              {product.label && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] shrink-0"
                                  style={{
                                    fontFamily: "'Space Mono', monospace",
                                    letterSpacing: "0.04em",
                                    color: "var(--n-warning)",
                                    borderColor: "var(--n-warning)",
                                  }}
                                >
                                  {product.label.name}
                                </Badge>
                              )}
                            </div>
                            <div
                              className="flex items-center gap-2 mt-0.5 n-label"
                              style={{ color: "var(--n-text-disabled)" }}
                            >
                              <Hash className="h-3 w-3" strokeWidth={1.5} />
                              <span>{product.anonymousCode}</span>
                              <span style={{ color: "var(--n-border-visible)" }}>·</span>
                              <span>{product.ratingsCount} notes</span>
                            </div>
                          </div>

                          {/* Score */}
                          <div className="text-right shrink-0">
                            {product.averageScore !== null ? (
                              <div className="flex items-center gap-1">
                                <Star
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.5}
                                  style={{ color: "var(--n-warning)" }}
                                  fill="var(--n-warning)"
                                />
                                <span
                                  className="n-font-data text-base font-bold"
                                  style={{ color: "var(--n-text-display)" }}
                                >
                                  {product.averageScore.toFixed(2)}
                                </span>
                                <span
                                  className="n-font-data text-xs"
                                  style={{ color: "var(--n-text-disabled)" }}
                                >
                                  /{ratingMax}
                                </span>
                              </div>
                            ) : (
                              <span
                                className="n-label"
                                style={{ color: "var(--n-text-disabled)" }}
                              >
                                EN ATTENTE
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    className="n-label text-center py-4"
                    style={{ color: "var(--n-text-disabled)" }}
                  >
                    AUCUN PRODUIT NOTÉ DANS CETTE CATÉGORIE
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
