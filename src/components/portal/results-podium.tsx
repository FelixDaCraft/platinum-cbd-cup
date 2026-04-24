"use client";

import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award, Star } from "lucide-react";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

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

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface ResultsPodiumProps {
  winners: PodiumWinner[];
  categoryName?: string;
  showScore?: boolean;
}

// Labels by locale
const podiumLabels = {
  fr: {
    first: "1er",
    second: "2e",
    third: "3e",
    score: "Score",
    by: "par",
  },
  en: {
    first: "1st",
    second: "2nd",
    third: "3rd",
    score: "Score",
    by: "by",
  },
} as const;

/**
 * Medal colors configuration
 */
const medalConfig = {
  1: {
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    glow: "rgba(255, 215, 0, 0.4)",
    icon: Crown,
  },
  2: {
    color: "#C0C0C0",
    gradient: "linear-gradient(135deg, #E8E8E8 0%, #A0A0A0 100%)",
    glow: "rgba(192, 192, 192, 0.4)",
    icon: Medal,
  },
  3: {
    color: "#CD7F32",
    gradient: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
    glow: "rgba(205, 127, 50, 0.4)",
    icon: Award,
  },
} as const;

/**
 * Winner Card Component - Glassmorphism style
 */
function WinnerCard({
  winner,
  position,
  showScore,
  isFirst,
}: {
  winner: PodiumWinner;
  position: 1 | 2 | 3;
  showScore: boolean;
  isFirst: boolean;
}) {
  const { locale } = usePortal();
  const labels = podiumLabels[locale] ?? podiumLabels.fr;
  const config = medalConfig[position];
  const Icon = config.icon;

  const positionLabel =
    position === 1 ? labels.first : position === 2 ? labels.second : labels.third;

  // Render label icon
  const renderLabelIcon = () => {
    if (winner.labelIcon) {
      if (winner.labelIcon.startsWith("http")) {
        return (
          <img src={winner.labelIcon} alt="" className="h-4 w-4 object-contain" />
        );
      }
      return <span className="text-sm">{winner.labelIcon}</span>;
    }
    return <Trophy className="h-3.5 w-3.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: position === 1 ? 0.2 : position === 2 ? 0.3 : 0.4 }}
      className={cn(
        "relative",
        isFirst ? "z-10" : "z-0"
      )}
    >
      <div
        className={cn(
          "relative p-5 rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:scale-105",
          isFirst ? "min-w-[240px] md:min-w-[280px]" : "min-w-[200px] md:min-w-[240px]"
        )}
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderColor: `${config.color}40`,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px ${config.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
        }}
      >
        {/* Position Badge - Top Left */}
        <div
          className="absolute -top-3 -left-3 flex items-center justify-center h-12 w-12 rounded-full shadow-lg"
          style={{
            background: config.gradient,
            boxShadow: `0 4px 20px ${config.glow}`,
          }}
        >
          <Icon className="h-6 w-6 text-white drop-shadow-md" />
        </div>

        {/* Position Label - Top Right */}
        <div
          className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-sm font-bold shadow-lg"
          style={{
            background: config.gradient,
            color: position === 2 ? "#333" : "#fff",
            boxShadow: `0 4px 12px ${config.glow}`,
          }}
        >
          {positionLabel}
        </div>

        {/* Content */}
        <div className="pt-4">
          {/* Product Name */}
          <h4
            className={cn(
              "font-bold text-white leading-tight mb-2",
              isFirst ? "text-xl md:text-2xl" : "text-lg md:text-xl"
            )}
          >
            {winner.productName}
          </h4>

          {/* Producer Name */}
          <p className="text-sm text-white/70 mb-4">
            {labels.by}{" "}
            <span className="font-semibold text-white/90">{winner.producerName}</span>
          </p>

          {/* Score */}
          {showScore && winner.score && (() => {
            const { value, max } = convertScoreToScale(parseFloat(winner.score), winner.cupRatingScale);
            return (
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 mb-3">
                <span className="text-sm text-white/60">{labels.score}</span>
                <span
                  className="text-2xl font-bold"
                  style={{ color: config.color }}
                >
                  {value.toFixed(1)}
                  <span className="text-sm font-normal text-white/50">/{max}</span>
                </span>
              </div>
            );
          })()}

          {/* Label Badge */}
          {winner.labelName && (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${winner.labelColor ?? config.color}25`,
                color: winner.labelColor ?? config.color,
                border: `1px solid ${winner.labelColor ?? config.color}40`,
              }}
            >
              {renderLabelIcon()}
              {winner.labelName}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Podium Base Component
 */
function PodiumBase({ position }: { position: 1 | 2 | 3 }) {
  const config = medalConfig[position];
  const heights = {
    1: "h-32 md:h-40",
    2: "h-24 md:h-28",
    3: "h-16 md:h-20",
  };

  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.5, delay: position === 1 ? 0.5 : position === 2 ? 0.6 : 0.7 }}
      style={{ transformOrigin: "bottom" }}
      className={cn(
        "w-full rounded-t-2xl relative overflow-hidden",
        heights[position]
      )}
    >
      {/* Gradient Background */}
      <div
        className="absolute inset-0"
        style={{ background: config.gradient }}
      />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Position Number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-6xl md:text-7xl font-black"
          style={{
            color: position === 2 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
          }}
        >
          {position}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Results Podium Component - Premium Glassmorphism Design
 */
export function ResultsPodium({
  winners,
  categoryName,
  showScore = true,
}: ResultsPodiumProps) {
  const { theme } = usePortal();

  // Get winners by position
  const first = winners.find((w) => w.rank === 1);
  const second = winners.find((w) => w.rank === 2);
  const third = winners.find((w) => w.rank === 3);

  if (winners.length === 0) {
    return null;
  }

  return (
    <div className="w-full py-8">
      {/* Category Header */}
      {categoryName && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border border-white/10"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              boxShadow: `0 4px 24px rgba(0, 0, 0, 0.1), 0 0 20px ${theme.primaryColor}20`,
            }}
          >
            <Trophy className="h-6 w-6" style={{ color: theme.primaryColor }} />
            <h3 className="text-xl md:text-2xl font-bold">{categoryName}</h3>
          </div>
        </motion.div>
      )}

      {/* Podium Layout */}
      <div className="flex flex-col items-center gap-8">
        {/* Winner Cards Row */}
        <div className="flex items-end justify-center gap-4 md:gap-8 flex-wrap">
          {/* 2nd Place */}
          <div className="order-1 md:order-1">
            {second && (
              <WinnerCard
                winner={second}
                position={2}
                showScore={showScore}
                isFirst={false}
              />
            )}
          </div>

          {/* 1st Place - Elevated */}
          <div className="order-first md:order-2 -mt-8">
            {first && (
              <WinnerCard
                winner={first}
                position={1}
                showScore={showScore}
                isFirst={true}
              />
            )}
          </div>

          {/* 3rd Place */}
          <div className="order-2 md:order-3">
            {third && (
              <WinnerCard
                winner={third}
                position={3}
                showScore={showScore}
                isFirst={false}
              />
            )}
          </div>
        </div>

        {/* Podium Bases */}
        <div className="flex items-end justify-center gap-2 w-full max-w-2xl">
          {/* 2nd Place Base */}
          <div className="flex-1 max-w-[200px]">
            {second && <PodiumBase position={2} />}
          </div>

          {/* 1st Place Base */}
          <div className="flex-1 max-w-[200px]">
            {first && <PodiumBase position={1} />}
          </div>

          {/* 3rd Place Base */}
          <div className="flex-1 max-w-[200px]">
            {third && <PodiumBase position={3} />}
          </div>
        </div>
      </div>

      {/* Decorative Stars */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="flex justify-center mt-8 gap-2"
      >
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -20, opacity: 0, rotate: -20 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: 1 + i * 0.1, duration: 0.4 }}
          >
            <Star
              className="h-5 w-5"
              style={{
                color: i === 2 ? "#FFD700" : i % 2 === 0 ? theme.primaryColor : theme.secondaryColor,
                fill: i === 2 ? "#FFD700" : i % 2 === 0 ? theme.primaryColor : theme.secondaryColor,
              }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Compact Podium for smaller displays - Premium List Style
 */
export function CompactPodium({
  winners,
  categoryName,
}: {
  winners: PodiumWinner[];
  categoryName: string;
}) {
  const { theme, locale } = usePortal();
  const labels = podiumLabels[locale] ?? podiumLabels.fr;

  // Get top 3
  const topThree = winners.filter((w) => w.rank <= 3).slice(0, 3);

  if (topThree.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 rounded-2xl backdrop-blur-md border border-white/10"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${theme.primaryColor}20`,
            boxShadow: `0 0 15px ${theme.primaryColor}20`,
          }}
        >
          <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
        </div>
        <h4 className="text-lg font-bold">{categoryName}</h4>
      </div>

      {/* Winners List */}
      <div className="space-y-4">
        {topThree.map((winner, index) => {
          const config = medalConfig[winner.rank as 1 | 2 | 3] ?? medalConfig[1];
          const Icon = config.icon;
          const positionLabel =
            winner.rank === 1
              ? labels.first
              : winner.rank === 2
                ? labels.second
                : labels.third;

          return (
            <motion.div
              key={winner.productId}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-white/5"
            >
              {/* Medal Icon */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                style={{
                  background: config.gradient,
                  boxShadow: `0 4px 12px ${config.glow}`,
                }}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">
                  {winner.productName}
                </p>
                <p className="text-sm text-white/60 truncate">
                  {labels.by} {winner.producerName}
                </p>
              </div>

              {/* Label */}
              {winner.labelName && (
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={{
                    backgroundColor: `${winner.labelColor ?? config.color}20`,
                    color: winner.labelColor ?? config.color,
                    border: `1px solid ${winner.labelColor ?? config.color}30`,
                  }}
                >
                  {winner.labelName}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
