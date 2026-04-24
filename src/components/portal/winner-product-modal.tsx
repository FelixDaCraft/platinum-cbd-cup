"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Award,
  X,
  MapPin,
  Globe,
  Mail,
  Star,
  Share2,
  Download,
  ExternalLink,
  Wine,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

interface WinnerProduct {
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
  cupId: string;
  cupName: string;
  cupYear: number | null;
  labelId: string | null;
  labelName: string | null;
  labelColor: string | null;
  labelIcon: string | null;
  score: string | null;
  cupRatingScale: string | null;
  rank: number | null;
  criteriaScores?: Array<{
    criterionName: string;
    score: number;
    maxScore: number;
  }>;
}

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 * Returns both value and max for display purposes
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface WinnerProductModalProps {
  product: WinnerProduct | null;
  open: boolean;
  onClose: () => void;
  showDetailedScores?: boolean;
}

// Labels by locale
const modalLabels = {
  fr: {
    category: "Catégorie",
    producer: "Producteur",
    score: "Score global",
    rank: "Classement",
    criteriaScores: "Notes par critère",
    contactProducer: "Contacter le producteur",
    visitWebsite: "Visiter le site",
    share: "Partager",
    download: "Télécharger",
    awardedIn: "Primé dans",
    close: "Fermer",
    first: "1er",
    second: "2e",
    third: "3e",
    position: "e position",
  },
  en: {
    category: "Category",
    producer: "Producer",
    score: "Overall score",
    rank: "Ranking",
    criteriaScores: "Scores by criteria",
    contactProducer: "Contact producer",
    visitWebsite: "Visit website",
    share: "Share",
    download: "Download",
    awardedIn: "Awarded in",
    close: "Close",
    first: "1st",
    second: "2nd",
    third: "3rd",
    position: "th position",
  },
} as const;

/**
 * Rank Badge Component
 */
function RankBadge({ rank }: { rank: number }) {
  const { locale } = usePortal();
  const labels = modalLabels[locale] ?? modalLabels.fr;

  const getRankDisplay = () => {
    switch (rank) {
      case 1:
        return { label: labels.first, color: "#FFD700", icon: "🥇" };
      case 2:
        return { label: labels.second, color: "#C0C0C0", icon: "🥈" };
      case 3:
        return { label: labels.third, color: "#CD7F32", icon: "🥉" };
      default:
        return {
          label: `${rank}${labels.position}`,
          color: "#6B7280",
          icon: null,
        };
    }
  };

  const config = getRankDisplay();

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-bold"
      style={{ backgroundColor: config.color }}
    >
      {config.icon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </div>
  );
}

/**
 * Score Gauge Component
 */
function ScoreGauge({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const { theme } = usePortal();
  const percentage = (score / maxScore) * 100;

  return (
    <div className="relative w-32 h-32">
      {/* Background Circle */}
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <motion.circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke={theme.primaryColor}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDasharray: "0 352" }}
          animate={{
            strokeDasharray: `${(percentage / 100) * 352} 352`,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {/* Score Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score.toFixed(1)}
        </motion.span>
        <span className="text-xs text-muted-foreground">/ {maxScore}</span>
      </div>
    </div>
  );
}

/**
 * Criteria Score Bar
 */
function CriteriaScoreBar({
  name,
  score,
  maxScore,
  index,
}: {
  name: string;
  score: number;
  maxScore: number;
  index: number;
}) {
  const { theme } = usePortal();
  const percentage = (score / maxScore) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-medium">
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: theme.primaryColor }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
        />
      </div>
    </motion.div>
  );
}

/**
 * Winner Product Modal - Story 12.13
 * Detailed product sheet for awarded products
 */
export function WinnerProductModal({
  product,
  open,
  onClose,
  showDetailedScores = true,
}: WinnerProductModalProps) {
  const { theme, locale } = usePortal();
  const labels = modalLabels[locale] ?? modalLabels.fr;

  if (!product) return null;

  // Render label icon
  const renderLabelIcon = () => {
    if (product.labelIcon) {
      if (product.labelIcon.startsWith("http")) {
        return (
          <img
            src={product.labelIcon}
            alt=""
            className="h-8 w-8 object-contain"
          />
        );
      }
      return <span className="text-2xl">{product.labelIcon}</span>;
    }
    return <Award className="h-6 w-6" />;
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.productName,
          text: `${product.productName} - ${product.labelName ?? "Lauréat"} ${product.cupName}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        // Could show a toast here
      }
    } catch {
      // Ignore share errors
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with Label */}
        {product.labelName && (
          <div
            className="px-6 py-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${product.labelColor ?? theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  {renderLabelIcon()}
                </div>
                <div>
                  <p className="text-sm text-white/80">{labels.awardedIn}</p>
                  <p className="font-bold text-lg">{product.cupName}</p>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                {product.labelName}
              </Badge>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Product Info */}
          <div className="flex gap-6">
            {/* Product Image */}
            {product.productImageUrl ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="shrink-0"
              >
                <img
                  src={product.productImageUrl}
                  alt={product.productName}
                  className="w-32 h-32 object-cover rounded-lg shadow-lg"
                />
              </motion.div>
            ) : (
              <div
                className="w-32 h-32 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Wine
                  className="h-12 w-12"
                  style={{ color: theme.primaryColor }}
                />
              </div>
            )}

            {/* Product Details */}
            <div className="flex-1">
              <DialogHeader className="text-left p-0">
                <DialogTitle className="text-2xl">{product.productName}</DialogTitle>
              </DialogHeader>

              {/* Category */}
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Trophy className="h-4 w-4" />
                <span>{product.categoryName}</span>
              </div>

              {/* Rank Badge */}
              {product.rank && (
                <div className="mt-3">
                  <RankBadge rank={product.rank} />
                </div>
              )}

              {/* Description */}
              {product.productDescription && (
                <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                  {product.productDescription}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Score Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Overall Score */}
            {product.score && (() => {
              const { value, max } = convertScoreToScale(parseFloat(product.score), product.cupRatingScale);
              return (
                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <ScoreGauge score={value} maxScore={max} />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {labels.score}
                      </p>
                      <p className="text-3xl font-bold">
                        {value.toFixed(1)}
                        <span className="text-lg text-muted-foreground">
                          /{max}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Criteria Scores */}
            {showDetailedScores && product.criteriaScores && product.criteriaScores.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">
                    {labels.criteriaScores}
                  </p>
                  <div className="space-y-3">
                    {product.criteriaScores.map((criteria, index) => (
                      <CriteriaScoreBar
                        key={criteria.criterionName}
                        name={criteria.criterionName}
                        score={criteria.score}
                        maxScore={criteria.maxScore}
                        index={index}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Producer Section */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {labels.producer}
            </h4>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">
                      {product.producerName}
                    </p>
                    {product.producerLocation && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{product.producerLocation}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {product.producerWebsite && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={product.producerWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="h-4 w-4 mr-1" />
                          {labels.visitWebsite}
                        </a>
                      </Button>
                    )}
                    {product.producerEmail && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`mailto:${product.producerEmail}`}>
                          <Mail className="h-4 w-4 mr-1" />
                          {labels.contactProducer}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              {labels.share}
            </Button>

            <Button variant="ghost" onClick={onClose}>
              {labels.close}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Winner Product Card (clickable to open modal)
 */
export function WinnerProductCard({
  product,
  onClick,
}: {
  product: WinnerProduct;
  onClick: () => void;
}) {
  const { theme, locale } = usePortal();
  const labels = modalLabels[locale] ?? modalLabels.fr;

  // Render label icon
  const renderLabelIcon = () => {
    if (product.labelIcon) {
      if (product.labelIcon.startsWith("http")) {
        return (
          <img
            src={product.labelIcon}
            alt=""
            className="h-5 w-5 object-contain"
          />
        );
      }
      return <span className="text-lg">{product.labelIcon}</span>;
    }
    return <Award className="h-4 w-4" />;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        {/* Label Header */}
        {product.labelName && (
          <div
            className="px-4 py-2 text-white flex items-center justify-between"
            style={{
              backgroundColor: product.labelColor ?? theme.primaryColor,
            }}
          >
            <div className="flex items-center gap-2">
              {renderLabelIcon()}
              <span className="font-medium text-sm">{product.labelName}</span>
            </div>
            {product.rank && product.rank <= 3 && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {product.rank === 1
                  ? labels.first
                  : product.rank === 2
                    ? labels.second
                    : labels.third}
              </span>
            )}
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Product Image */}
            {product.productImageUrl ? (
              <img
                src={product.productImageUrl}
                alt={product.productName}
                className="w-16 h-16 object-cover rounded-lg"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Wine
                  className="h-8 w-8"
                  style={{ color: theme.primaryColor }}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{product.productName}</h4>
              <p className="text-sm text-muted-foreground truncate">
                {product.producerName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {product.categoryName}
                </Badge>
                {product.score && (() => {
                  const { value, max } = convertScoreToScale(parseFloat(product.score), product.cupRatingScale);
                  return (
                    <span className="text-xs text-muted-foreground">
                      {value.toFixed(1)}/{max}
                    </span>
                  );
                })()}
              </div>
            </div>

            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
