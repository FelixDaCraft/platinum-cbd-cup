"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Sparkles, Award } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

interface Winner {
  productId: string;
  productName: string;
  producerName: string;
  cupId: string;
  cupName: string;
  cupRatingScale?: string | null;
  categoryName: string;
  labelName: string;
  labelColor: string | null;
  labelIcon?: string | null;
  score: string | null;
  rank: number;
}

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null | undefined): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface HallOfFameSectionProps {
  winners: Winner[];
}

// Labels by locale
const sectionLabels = {
  fr: {
    title: "Nos Derniers Lauréats",
    subtitle: "Les produits d'exception primés par nos jurys",
    viewAll: "Voir tous les résultats",
    by: "par",
    score: "Score",
    more: "Et {count} autres produits primés...",
  },
  en: {
    title: "Our Latest Winners",
    subtitle: "Exceptional products awarded by our juries",
    viewAll: "View all results",
    by: "by",
    score: "Score",
    more: "And {count} more awarded products...",
  },
} as const;

/**
 * Get medal color based on rank
 */
function getMedalColor(rank: number, labelColor: string | null): string {
  if (labelColor) return labelColor;
  switch (rank) {
    case 1:
      return "#FFD700"; // Gold
    case 2:
      return "#C0C0C0"; // Silver
    case 3:
      return "#CD7F32"; // Bronze
    default:
      return "#FFD700";
  }
}

/**
 * Winner Card Component - Apple/Puffco inspired glassmorphism design
 */
function WinnerCard({ winner, index }: { winner: Winner; index: number }) {
  const { theme } = usePortal();
  const medalColor = getMedalColor(winner.rank, winner.labelColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/cups/${winner.cupId}`} className="block h-full">
        <div
          className="group relative h-full p-6 rounded-2xl backdrop-blur-md border border-white/10 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 8px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px ${medalColor}20`;
            e.currentTarget.style.borderColor = `${medalColor}30`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
          }}
        >
          {/* Medal Badge - Top Right (rank-based, no label name) */}
          <div
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: `${medalColor}20`,
              color: medalColor,
              border: `1px solid ${medalColor}30`,
            }}
          >
            <Award className="h-3.5 w-3.5" />
            <span>
              {winner.rank === 1 ? "1er" : winner.rank === 2 ? "2e" : "3e"}
            </span>
          </div>

          {/* Trophy Icon with Glow */}
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
            style={{
              backgroundColor: `${medalColor}15`,
              boxShadow: `0 0 20px ${medalColor}20`,
            }}
          >
            <Trophy className="h-7 w-7" style={{ color: medalColor }} />
          </div>

          {/* Product Info */}
          <div className="space-y-1 mb-4">
            <h3 className="font-semibold text-xl leading-tight line-clamp-2 group-hover:text-white transition-colors">
              {winner.productName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {sectionLabels.fr.by}{" "}
              <span className="font-medium text-foreground/80">{winner.producerName}</span>
            </p>
          </div>

          {/* Cup & Category */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span className="truncate">{winner.cupName}</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="truncate">{winner.categoryName}</span>
          </div>

          {/* Score - Bottom */}
          {winner.score && (() => {
            const { value, max } = convertScoreToScale(parseFloat(winner.score), winner.cupRatingScale);
            return (
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="text-sm text-muted-foreground">Score</div>
                <div
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: medalColor }}
                >
                  {value.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">/{max}</span>
                </div>
              </div>
            );
          })()}

          {/* Hover Arrow Indicator */}
          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * Hall of Fame Section - Story 12.6
 * Displays latest winners with custom labels and animations
 * Apple/Puffco inspired premium design
 */
export function HallOfFameSection({ winners }: HallOfFameSectionProps) {
  const { theme, locale } = usePortal();
  const labels = sectionLabels[locale] ?? sectionLabels.fr;

  if (winners.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - Centered, minimal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `${theme.primaryColor}15`,
                boxShadow: `0 0 20px ${theme.primaryColor}20`,
              }}
            >
              <Sparkles className="h-6 w-6" style={{ color: theme.primaryColor }} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{labels.title}</h2>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">{labels.subtitle}</p>
        </motion.div>

        {/* Winners Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {winners.slice(0, 6).map((winner, index) => (
            <WinnerCard key={winner.productId} winner={winner} index={index} />
          ))}
        </div>

        {/* View All Button - Centered */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex justify-center mt-12"
        >
          <Link
            href="/palmares"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 backdrop-blur-md border border-white/10"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${theme.primaryColor}50`;
              e.currentTarget.style.boxShadow = `0 0 20px ${theme.primaryColor}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span>{labels.viewAll}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
