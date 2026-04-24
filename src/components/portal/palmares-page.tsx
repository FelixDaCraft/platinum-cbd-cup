"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Trophy,
  Award,
  X,
  Calendar,
  ChevronDown,
  Search,
  Sparkles,
  Medal,
  Crown,
  Star,
  Mail,
  Phone,
  Globe,
  MapPin,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

interface Winner {
  productId: string;
  productName: string;
  productDescription: string | null;
  producerId: string;
  producerName: string;
  producerLogo: string | null;
  producerWebsite: string | null;
  producerPhone: string | null;
  producerAddress: string | null;
  producerEmail: string | null;
  cupId: string;
  cupName: string;
  cupDate: Date | null;
  cupBanner: string | null;
  cupRatingScale: string | null;
  categoryId: string;
  categoryName: string;
  labelId: string | null;
  labelName: string | null;
  labelColor: string | null;
  labelIcon: string | null;
  score: string | null;
  rank: number | null;
  visibility: string;
}

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface Cup {
  id: string;
  name: string;
  eventDate: Date | null;
  bannerUrl: string | null;
  resultsVisibility: string;
}

interface Label {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface PalmaresConfig {
  palmareLayout: string;
  palmareFilterStyle: string;
  palmareDisplayStyle: string;
  palmareShowScore: boolean;
  palmareShowCategory: boolean;
}

interface PalmaresPageProps {
  config: PalmaresConfig;
  cups: Cup[];
  labels: Label[];
  categories: Category[];
  winners: Winner[];
}

// Labels by locale
const pageLabels = {
  fr: {
    title: "Palmarès",
    subtitle: "Découvrez l'excellence récompensée",
    filterByCup: "Filtrer par cup",
    filterByLabel: "Filtrer par label",
    filterByCategory: "Filtrer par catégorie",
    filterByRank: "Filtrer par place",
    allCups: "Toutes les cups",
    allLabels: "Tous les labels",
    allCategories: "Toutes les catégories",
    allRanks: "Toutes les places",
    rank1: "1ère place",
    rank2: "2ème place",
    rank3: "3ème place",
    search: "Rechercher un produit ou producteur...",
    noResults: "Aucun résultat trouvé",
    clearFilters: "Effacer les filtres",
    by: "par",
    score: "Score",
    results: "résultats",
    products: "Produits primés",
    cups: "Compétitions",
    categories: "Catégories",
  },
  en: {
    title: "Awards",
    subtitle: "Discover rewarded excellence",
    filterByCup: "Filter by cup",
    filterByLabel: "Filter by label",
    filterByCategory: "Filter by category",
    filterByRank: "Filter by rank",
    allCups: "All cups",
    allLabels: "All labels",
    allCategories: "All categories",
    allRanks: "All ranks",
    rank1: "1st place",
    rank2: "2nd place",
    rank3: "3rd place",
    search: "Search a product or producer...",
    noResults: "No results found",
    clearFilters: "Clear filters",
    by: "by",
    score: "Score",
    results: "results",
    products: "Awarded products",
    cups: "Competitions",
    categories: "Categories",
  },
} as const;

/**
 * Animated Counter Component
 */
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count}</span>;
}

/**
 * Circular Score Gauge Component
 */
function ScoreGauge({
  score,
  maxScore = 100,
  color,
  size = 60
}: {
  score: number;
  maxScore?: number;
  color: string;
  size?: number;
}) {
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const progress = (score / maxScore) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={3}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>
          {score.toFixed(2)}/{maxScore}
        </span>
      </div>
    </div>
  );
}

/**
 * 3D Tilt Card Wrapper
 */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 50 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 50 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Floating Decorative Elements
 */
function FloatingElements({ primaryColor, secondaryColor }: { primaryColor: string; secondaryColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large blurred circles */}
      <motion.div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: primaryColor }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 -left-48 w-80 h-80 rounded-full opacity-15 blur-3xl"
        style={{ background: secondaryColor }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
        style={{ background: primaryColor }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.1, 0.15, 0.1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/**
 * Premium Filter Chip Component
 */
function FilterChip({
  label,
  icon,
  isSelected,
  color,
  onClick,
}: {
  label: string;
  icon?: string | null;
  isSelected: boolean;
  color?: string | null;
  onClick: () => void;
}) {
  const chipColor = color ?? "#f59e0b";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
        "backdrop-blur-md border",
        isSelected
          ? "text-white"
          : "text-white/70 hover:text-white border-white/10 hover:border-white/20"
      )}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${chipColor} 0%, ${chipColor}CC 100%)`
          : "rgba(255, 255, 255, 0.05)",
        borderColor: isSelected ? chipColor : undefined,
        boxShadow: isSelected ? `0 0 20px ${chipColor}40, 0 4px 15px rgba(0,0,0,0.2)` : undefined,
      }}
    >
      {/* Glow effect on selection */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: `radial-gradient(circle, ${chipColor}40 0%, transparent 70%)`,
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </span>
    </motion.button>
  );
}

/**
 * Premium Filter Section
 */
function PremiumFilters({
  cups,
  labels,
  categories,
  availableLabels,
  availableCategories,
  selectedCup,
  selectedLabel,
  selectedCategory,
  selectedRank,
  onCupChange,
  onLabelChange,
  onCategoryChange,
  onRankChange,
  locale,
  filterStyle,
}: {
  cups: Cup[];
  labels: Label[];
  categories: Category[];
  availableLabels: Label[];
  availableCategories: Category[];
  selectedCup: string;
  selectedLabel: string;
  selectedCategory: string;
  selectedRank: string;
  onCupChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRankChange: (value: string) => void;
  locale: "fr" | "en";
  filterStyle: string;
}) {
  const t = pageLabels[locale];

  // Use dynamic filtered lists when a cup is selected, otherwise show all
  const displayLabels = selectedCup === "all" ? labels : availableLabels;
  const displayCategories = selectedCup === "all" ? categories : availableCategories;

  // Determine which filters to show based on selected cup's visibility
  const selectedCupVisibility = selectedCup !== "all"
    ? cups.find((c) => c.id === selectedCup)?.resultsVisibility ?? "labels"
    : null;

  // When a specific cup is selected, adapt available filters
  const showLabelFilter = selectedCupVisibility === null || ["labels", "labels_and_podium", "all"].includes(selectedCupVisibility);
  const showRankFilter = selectedCupVisibility === null || ["podium", "labels_and_podium", "all"].includes(selectedCupVisibility);

  const rankOptions = [
    { value: "1", label: t.rank1, icon: "🥇" },
    { value: "2", label: t.rank2, icon: "🥈" },
    { value: "3", label: t.rank3, icon: "🥉" },
  ];

  if (filterStyle === "dropdown") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <Select value={selectedCup} onValueChange={onCupChange}>
          <SelectTrigger className="w-[200px] bg-white/5 border-white/10 backdrop-blur-md">
            <SelectValue placeholder={t.filterByCup} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCups}</SelectItem>
            {cups.map((cup) => (
              <SelectItem key={cup.id} value={cup.id}>
                {cup.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showLabelFilter && (
          <Select value={selectedLabel} onValueChange={onLabelChange}>
            <SelectTrigger className="w-[200px] bg-white/5 border-white/10 backdrop-blur-md">
              <SelectValue placeholder={t.filterByLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allLabels}</SelectItem>
              {displayLabels.map((label) => (
                <SelectItem key={label.id} value={label.name}>
                  {label.icon && <span className="mr-1">{label.icon}</span>}
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[200px] bg-white/5 border-white/10 backdrop-blur-md">
            <SelectValue placeholder={t.filterByCategory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCategories}</SelectItem>
            {displayCategories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showRankFilter && (
          <Select value={selectedRank} onValueChange={onRankChange}>
            <SelectTrigger className="w-[200px] bg-white/5 border-white/10 backdrop-blur-md">
              <SelectValue placeholder={t.filterByRank} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allRanks}</SelectItem>
              {rankOptions.map((rank) => (
                <SelectItem key={rank.value} value={rank.value}>
                  <span className="mr-1">{rank.icon}</span>
                  {rank.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  // Sidebar style
  if (filterStyle === "sidebar") {
    return (
      <SidebarFilters
        cups={cups}
        displayLabels={displayLabels}
        displayCategories={displayCategories}
        selectedCup={selectedCup}
        selectedLabel={selectedLabel}
        selectedCategory={selectedCategory}
        selectedRank={selectedRank}
        onCupChange={onCupChange}
        onLabelChange={onLabelChange}
        onCategoryChange={onCategoryChange}
        onRankChange={onRankChange}
        showLabelFilter={showLabelFilter}
        showRankFilter={showRankFilter}
        locale={locale}
      />
    );
  }

  // Chips style (default)
  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Cups */}
      <div className="flex flex-wrap justify-center gap-2">
        <FilterChip
          label={t.allCups}
          isSelected={selectedCup === "all"}
          onClick={() => onCupChange("all")}
        />
        {cups.map((cup) => (
          <FilterChip
            key={cup.id}
            label={cup.name}
            icon="📅"
            isSelected={selectedCup === cup.id}
            onClick={() => onCupChange(cup.id)}
          />
        ))}
      </div>

      {/* Ranks (places) - only if visibility allows */}
      {showRankFilter && (
        <div className="flex flex-wrap justify-center gap-2">
          <FilterChip
            label={t.allRanks}
            isSelected={selectedRank === "all"}
            onClick={() => onRankChange("all")}
          />
          {rankOptions.map((rank) => (
            <FilterChip
              key={rank.value}
              label={rank.label}
              icon={rank.icon}
              color={rank.value === "1" ? "#FFD700" : rank.value === "2" ? "#C0C0C0" : "#CD7F32"}
              isSelected={selectedRank === rank.value}
              onClick={() => onRankChange(rank.value)}
            />
          ))}
        </div>
      )}

      {/* Labels - dynamic based on selected cup, only if visibility allows */}
      {showLabelFilter && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`labels-${selectedCup}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap justify-center gap-2"
            suppressHydrationWarning
          >
            <FilterChip
              label={t.allLabels}
              isSelected={selectedLabel === "all"}
              onClick={() => onLabelChange("all")}
            />
            {displayLabels.map((label) => (
              <FilterChip
                key={label.id}
                label={label.name}
                icon={label.icon}
                color={label.color}
                isSelected={selectedLabel === label.name}
                onClick={() => onLabelChange(label.name)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Categories - dynamic based on selected cup */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`categories-${selectedCup}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-wrap justify-center gap-2"
          suppressHydrationWarning
        >
          <FilterChip
            label={t.allCategories}
            isSelected={selectedCategory === "all"}
            onClick={() => onCategoryChange("all")}
          />
          {displayCategories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              isSelected={selectedCategory === category.name}
              onClick={() => onCategoryChange(category.name)}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Sidebar Filters Component
 */
function SidebarFilters({
  cups,
  displayLabels,
  displayCategories,
  selectedCup,
  selectedLabel,
  selectedCategory,
  selectedRank,
  onCupChange,
  onLabelChange,
  onCategoryChange,
  onRankChange,
  showLabelFilter,
  showRankFilter,
  locale,
}: {
  cups: Cup[];
  displayLabels: Label[];
  displayCategories: Category[];
  selectedCup: string;
  selectedLabel: string;
  selectedCategory: string;
  selectedRank: string;
  onCupChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRankChange: (value: string) => void;
  showLabelFilter: boolean;
  showRankFilter: boolean;
  locale: "fr" | "en";
}) {
  const { theme } = usePortal();
  const t = pageLabels[locale];

  const FilterSection = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const FilterButton = ({
    label,
    icon,
    isSelected,
    color,
    onClick,
  }: {
    label: string;
    icon?: string | null;
    isSelected: boolean;
    color?: string | null;
    onClick: () => void;
  }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all",
        isSelected
          ? "text-white font-medium"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
      style={{
        background: isSelected
          ? `linear-gradient(90deg, ${color ?? theme.primaryColor}30 0%, transparent 100%)`
          : undefined,
        borderLeft: isSelected ? `3px solid ${color ?? theme.primaryColor}` : "3px solid transparent",
      }}
    >
      {icon && <span>{icon}</span>}
      <span className="truncate">{label}</span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-auto h-2 w-2 rounded-full"
          style={{ background: color ?? theme.primaryColor }}
        />
      )}
    </motion.button>
  );

  return null; // Sidebar is rendered in the main layout, this returns the content
}

/**
 * Sidebar Filter Content (for use in sidebar layout)
 */
function SidebarFilterContent({
  cups,
  displayLabels,
  displayCategories,
  selectedCup,
  selectedLabel,
  selectedCategory,
  selectedRank,
  onCupChange,
  onLabelChange,
  onCategoryChange,
  onRankChange,
  showLabelFilter = true,
  showRankFilter = true,
  locale,
}: {
  cups: Cup[];
  displayLabels: Label[];
  displayCategories: Category[];
  selectedCup: string;
  selectedLabel: string;
  selectedCategory: string;
  selectedRank: string;
  onCupChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRankChange: (value: string) => void;
  showLabelFilter?: boolean;
  showRankFilter?: boolean;
  locale: "fr" | "en";
}) {
  const { theme } = usePortal();
  const t = pageLabels[locale];

  const rankOptions = [
    { value: "1", label: t.rank1, icon: "🥇", color: "#FFD700" },
    { value: "2", label: t.rank2, icon: "🥈", color: "#C0C0C0" },
    { value: "3", label: t.rank3, icon: "🥉", color: "#CD7F32" },
  ];

  const FilterButton = ({
    label,
    icon,
    isSelected,
    color,
    onClick,
  }: {
    label: string;
    icon?: string | null;
    isSelected: boolean;
    color?: string | null;
    onClick: () => void;
  }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all",
        isSelected
          ? "text-white font-medium"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
      style={{
        background: isSelected
          ? `linear-gradient(90deg, ${color ?? theme.primaryColor}30 0%, transparent 100%)`
          : undefined,
        borderLeft: isSelected ? `3px solid ${color ?? theme.primaryColor}` : "3px solid transparent",
      }}
    >
      {icon && <span>{icon}</span>}
      <span className="truncate">{label}</span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-auto h-2 w-2 rounded-full"
          style={{ background: color ?? theme.primaryColor }}
        />
      )}
    </motion.button>
  );

  return (
    <div className="space-y-8">
      {/* Cups */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-3">
          {t.filterByCup}
        </h4>
        <div className="space-y-1">
          <FilterButton
            label={t.allCups}
            isSelected={selectedCup === "all"}
            onClick={() => onCupChange("all")}
          />
          {cups.map((cup) => (
            <FilterButton
              key={cup.id}
              label={cup.name}
              icon="📅"
              isSelected={selectedCup === cup.id}
              onClick={() => onCupChange(cup.id)}
            />
          ))}
        </div>
      </div>

      {/* Ranks (places) - only if visibility allows */}
      {showRankFilter && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-3">
            {t.filterByRank}
          </h4>
          <div className="space-y-1">
            <FilterButton
              label={t.allRanks}
              isSelected={selectedRank === "all"}
              onClick={() => onRankChange("all")}
            />
            {rankOptions.map((rank) => (
              <FilterButton
                key={rank.value}
                label={rank.label}
                icon={rank.icon}
                color={rank.color}
                isSelected={selectedRank === rank.value}
                onClick={() => onRankChange(rank.value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Labels - only if visibility allows */}
      {showLabelFilter && <AnimatePresence mode="wait">
        <motion.div
          key={`sidebar-labels-${selectedCup}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-3"
          suppressHydrationWarning
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-3">
            {t.filterByLabel}
          </h4>
          <div className="space-y-1">
            <FilterButton
              label={t.allLabels}
              isSelected={selectedLabel === "all"}
              onClick={() => onLabelChange("all")}
            />
            {displayLabels.map((label) => (
              <FilterButton
                key={label.id}
                label={label.name}
                icon={label.icon}
                color={label.color}
                isSelected={selectedLabel === label.name}
                onClick={() => onLabelChange(label.name)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>}

      {/* Categories */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`sidebar-categories-${selectedCup}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-3"
          suppressHydrationWarning
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-3">
            {t.filterByCategory}
          </h4>
          <div className="space-y-1">
            <FilterButton
              label={t.allCategories}
              isSelected={selectedCategory === "all"}
              onClick={() => onCategoryChange("all")}
            />
            {displayCategories.map((category) => (
              <FilterButton
                key={category.id}
                label={category.name}
                isSelected={selectedCategory === category.name}
                onClick={() => onCategoryChange(category.name)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Premium Winner Card Component
 */
function PremiumWinnerCard({
  winner,
  showScore,
  showCategory,
  index,
}: {
  winner: Winner;
  showScore: boolean;
  showCategory: boolean;
  index: number;
}) {
  const { theme, locale } = usePortal();
  const t = pageLabels[locale];
  const [isFlipped, setIsFlipped] = useState(false);
  const isTopThree = winner.rank && winner.rank <= 3;

  // Visibility controls what badges to show
  const showRankBadge = isTopThree && ["podium", "labels_and_podium", "all"].includes(winner.visibility);
  const showLabelBadge = !!winner.labelName && ["labels", "labels_and_podium", "all"].includes(winner.visibility);

  const medalColors = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };

  // Rank badge always uses medal colors, label badge always uses label color
  const rankColor = isTopThree ? medalColors[winner.rank as 1 | 2 | 3] : theme.primaryColor;
  const labelColor = winner.labelColor ?? theme.primaryColor;

  // Card accent color: prefer label color if shown, then rank color, then theme
  const color = showLabelBadge ? labelColor : showRankBadge ? rankColor : theme.primaryColor;

  const MedalIcon = winner.rank === 1 ? Crown : winner.rank === 2 ? Medal : Award;

  const hasContactInfo = winner.producerEmail || winner.producerPhone || winner.producerWebsite;

  const handleFlip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  const cardStyle = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    borderColor: `${color}30`,
    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="h-[280px]"
      style={{ perspective: "1000px" }}
    >
      <motion.div
        className="relative w-full h-full cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{ transformStyle: "preserve-3d" }}
        onClick={handleFlip}
      >
        {/* Front Face - Product Info */}
        <div
          className={cn(
            "absolute inset-0 p-6 rounded-3xl backdrop-blur-xl border transition-all duration-500",
            "hover:border-opacity-100 group"
          )}
          style={{
            ...cardStyle,
            backfaceVisibility: "hidden",
          }}
        >
          {/* Animated border glow on hover */}
          <div
            className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(135deg, ${color}20 0%, transparent 50%, ${color}10 100%)`,
            }}
          />

          {/* Shine effect - cascade animation based on card index */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <motion.div
              className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 8,
                delay: index * 0.3,
                ease: "easeInOut"
              }}
            />
          </div>

          {/* Label Badge - Top Right */}
          {showLabelBadge && (
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: index * 0.05 + 0.3, type: "spring" }}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: `linear-gradient(135deg, ${labelColor} 0%, ${labelColor}CC 100%)`,
                color: "#fff",
                boxShadow: `0 4px 15px ${labelColor}50`,
              }}
            >
              {winner.labelIcon && <span>{winner.labelIcon}</span>}
              {winner.labelName}
            </motion.div>
          )}

          {/* Rank Badge - Top Left */}
          {showRankBadge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 + 0.2, type: "spring", stiffness: 300 }}
              className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg, ${rankColor} 0%, ${rankColor}AA 100%)`,
                boxShadow: `0 4px 20px ${rankColor}60`,
              }}
            >
              <MedalIcon className="h-5 w-5" style={{ color: winner.rank === 2 ? "#333" : "#fff" }} />
            </motion.div>
          )}

          {/* Content */}
          <div className={cn("relative z-10 pt-4", (showRankBadge || showLabelBadge) && "pt-12")}>
            {/* Product Name */}
            <h4 className="font-bold text-xl text-white leading-tight mb-2 line-clamp-2 group-hover:text-white transition-colors">
              {winner.productName}
            </h4>

            {/* Producer with logo */}
            <div className="flex items-center gap-2 mb-4">
              {winner.producerLogo && (
                <div className="relative h-6 w-6 rounded-full overflow-hidden bg-white/10 shrink-0">
                  <Image
                    src={winner.producerLogo}
                    alt={winner.producerName}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <p className="text-sm text-white/60">
                {t.by}{" "}
                <span className="font-semibold text-white/80">{winner.producerName}</span>
              </p>
            </div>

            {/* Cup & Category */}
            <div className="flex items-center gap-2 text-xs text-white/50 mb-5 flex-wrap">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5">
                <Trophy className="h-3 w-3" />
                {winner.cupName}
              </span>
              {showCategory && (
                <span className="px-2 py-1 rounded-full bg-white/5">
                  {winner.categoryName}
                </span>
              )}
            </div>

            {/* Score - simplified display */}
            {showScore && winner.score && (() => {
              const { value, max } = convertScoreToScale(parseFloat(winner.score), winner.cupRatingScale);
              return (
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="text-sm text-white/50">{t.score}</span>
                  <span
                    className="text-lg font-bold"
                    style={{ color }}
                  >
                    {value.toFixed(2)}<span className="text-sm text-white/40">/{max}</span>
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Flip hint - positioned with more spacing */}
          {hasContactInfo && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="text-white/30 text-xs flex items-center gap-1 px-3 py-1 rounded-full bg-white/5">
                <RotateCcw className="h-3 w-3" />
                {locale === "fr" ? "Cliquer pour contacter" : "Click to contact"}
              </span>
            </div>
          )}
        </div>

        {/* Back Face - Producer Contact Info */}
        <div
          className={cn(
            "absolute inset-0 p-6 rounded-3xl backdrop-blur-xl border",
          )}
          style={{
            ...cardStyle,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Producer Logo & Name */}
          <div className="flex flex-col items-center text-center mb-6">
            {winner.producerLogo ? (
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-white/10 mb-3">
                <Image
                  src={winner.producerLogo}
                  alt={winner.producerName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                className="h-20 w-20 rounded-2xl mb-3 flex items-center justify-center text-3xl font-bold"
                style={{ background: `${color}30`, color }}
              >
                {winner.producerName.charAt(0)}
              </div>
            )}
            <h4 className="font-bold text-lg text-white">{winner.producerName}</h4>
            <p className="text-xs text-white/50">{locale === "fr" ? "Producteur" : "Producer"}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            {winner.producerEmail && (
              <a
                href={`mailto:${winner.producerEmail}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 hover:text-white"
              >
                <Mail className="h-4 w-4 shrink-0" style={{ color }} />
                <span className="truncate">{winner.producerEmail}</span>
              </a>
            )}
            {winner.producerPhone && (
              <a
                href={`tel:${winner.producerPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 hover:text-white"
              >
                <Phone className="h-4 w-4 shrink-0" style={{ color }} />
                <span>{winner.producerPhone}</span>
              </a>
            )}
            {winner.producerWebsite && (
              <a
                href={winner.producerWebsite.startsWith("http") ? winner.producerWebsite : `https://${winner.producerWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 hover:text-white"
              >
                <Globe className="h-4 w-4 shrink-0" style={{ color }} />
                <span className="truncate">{winner.producerWebsite.replace(/^https?:\/\//, "")}</span>
              </a>
            )}
            {winner.producerAddress && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 text-sm text-white/60">
                <MapPin className="h-4 w-4 shrink-0" style={{ color }} />
                <span className="truncate">{winner.producerAddress}</span>
              </div>
            )}
          </div>

          {/* Flip back hint */}
          <div className="absolute bottom-4 right-4 text-white/30 text-xs flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            {locale === "fr" ? "Retourner" : "Flip back"}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Premium Winner Row Component
 */
function PremiumWinnerRow({
  winner,
  showScore,
  showCategory,
  index,
}: {
  winner: Winner;
  showScore: boolean;
  showCategory: boolean;
  index: number;
}) {
  const { theme, locale } = usePortal();
  const t = pageLabels[locale];
  const isTopThree = winner.rank && winner.rank <= 3;

  const showRankBadge = isTopThree && ["podium", "labels_and_podium", "all"].includes(winner.visibility);
  const showLabelBadge = !!winner.labelName && ["labels", "labels_and_podium", "all"].includes(winner.visibility);

  const medalColors = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };

  const rankColor = isTopThree ? medalColors[winner.rank as 1 | 2 | 3] : theme.primaryColor;
  const labelColor = winner.labelColor ?? theme.primaryColor;
  const color = showLabelBadge ? labelColor : showRankBadge ? rankColor : theme.primaryColor;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
    >
      <Link href={`/cups/${winner.cupId}`}>
        <div
          className="group flex items-center gap-4 p-4 rounded-2xl backdrop-blur-md border border-white/5 transition-all duration-300 hover:border-white/20"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          }}
        >
          {/* Rank/Medal */}
          {showRankBadge ? (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background: `linear-gradient(135deg, ${rankColor} 0%, ${rankColor}CC 100%)`,
                color: winner.rank === 2 ? "#333" : "#fff",
                boxShadow: `0 4px 15px ${rankColor}40`,
              }}
            >
              {winner.rank}
            </div>
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background: `${color}15`,
                color: color,
              }}
            >
              <Award className="h-5 w-5" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate group-hover:text-white transition-colors">
              {winner.productName}
            </p>
            <p className="text-sm text-white/50 truncate">
              {t.by} {winner.producerName}
              {showCategory && (
                <span className="text-white/30"> • {winner.categoryName}</span>
              )}
            </p>
          </div>

          {/* Cup */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs text-white/60">
            <Trophy className="h-3 w-3" />
            {winner.cupName}
          </div>

          {/* Label */}
          {showLabelBadge && (
            <div
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: `linear-gradient(135deg, ${labelColor} 0%, ${labelColor}CC 100%)`,
                color: "#fff",
                boxShadow: `0 2px 10px ${labelColor}30`,
              }}
            >
              {winner.labelIcon && <span className="mr-1">{winner.labelIcon}</span>}
              {winner.labelName}
            </div>
          )}

          {/* Score */}
          {showScore && winner.score && (() => {
            const { value, max } = convertScoreToScale(parseFloat(winner.score), winner.cupRatingScale);
            return <ScoreGauge score={value} maxScore={max} color={color} size={44} />;
          })()}
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * Group winners by category name, preserving the order of first appearance
 */
function groupByCategory(winners: Winner[]): { categoryName: string; winners: Winner[] }[] {
  const groups: { categoryName: string; winners: Winner[] }[] = [];
  const seen = new Map<string, number>();

  for (const winner of winners) {
    const idx = seen.get(winner.categoryName);
    if (idx !== undefined) {
      groups[idx]!.winners.push(winner);
    } else {
      seen.set(winner.categoryName, groups.length);
      groups.push({ categoryName: winner.categoryName, winners: [winner] });
    }
  }

  return groups;
}

/**
 * Category-grouped card grid used by both Masonry and Grid layouts
 */
function CategoryGroupedGrid({
  winners,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
}) {
  const { theme } = usePortal();
  const groups = useMemo(() => groupByCategory(winners), [winners]);

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <div key={group.categoryName}>
          {/* Category header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-8 w-1 rounded-full"
              style={{ background: theme.primaryColor }}
            />
            <h3 className="text-xl font-bold text-white">{group.categoryName}</h3>
            <span className="text-sm text-white/40">
              {group.winners.length} {group.winners.length > 1 ? "produits" : "produit"}
            </span>
          </div>

          {/* Horizontal grid of cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.winners.map((winner, index) => (
              <PremiumWinnerCard
                key={winner.productId}
                winner={winner}
                showScore={showScore}
                showCategory={showCategory}
                index={index}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Masonry Layout
 */
function MasonryLayout({
  winners,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
}) {
  return (
    <CategoryGroupedGrid
      winners={winners}
      showScore={showScore}
      showCategory={showCategory}
    />
  );
}

/**
 * Grid Layout (for list config)
 */
function GridLayout({
  winners,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
}) {
  return (
    <CategoryGroupedGrid
      winners={winners}
      showScore={showScore}
      showCategory={showCategory}
    />
  );
}

/**
 * List Layout
 */
function ListLayout({
  winners,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
}) {
  return (
    <div className="space-y-3">
      {winners.map((winner, index) => (
        <PremiumWinnerRow
          key={winner.productId}
          winner={winner}
          showScore={showScore}
          showCategory={showCategory}
          index={index}
        />
      ))}
    </div>
  );
}

/**
 * Timeline Layout
 */
function TimelineLayout({
  winners,
  cups,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  cups: Cup[];
  showScore: boolean;
  showCategory: boolean;
}) {
  const { theme, locale } = usePortal();

  // Group winners by cup
  const winnersByCup = useMemo(() => {
    const grouped = new Map<string, Winner[]>();
    for (const winner of winners) {
      const existing = grouped.get(winner.cupId) ?? [];
      grouped.set(winner.cupId, [...existing, winner]);
    }
    return grouped;
  }, [winners]);

  // Sort cups by date (most recent first)
  const sortedCups = useMemo(() => {
    return cups
      .filter((cup) => winnersByCup.has(cup.id))
      .sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
        const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
        return dateB - dateA;
      });
  }, [cups, winnersByCup]);

  return (
    <div className="relative max-w-5xl mx-auto">
      {/* Timeline line */}
      <div
        className="absolute left-6 md:left-10 top-0 bottom-0 w-0.5"
        style={{
          background: `linear-gradient(180deg, ${theme.primaryColor} 0%, ${theme.primaryColor}30 100%)`,
        }}
      />

      {/* Timeline items */}
      <div className="space-y-16">
        {sortedCups.map((cup, cupIndex) => {
          const cupWinners = winnersByCup.get(cup.id) ?? [];
          const year = cup.eventDate
            ? new Date(cup.eventDate).getFullYear()
            : null;

          return (
            <motion.div
              key={cup.id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: cupIndex * 0.15 }}
              className="relative pl-16 md:pl-24"
            >
              {/* Timeline dot with glow */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: cupIndex * 0.15 + 0.2, type: "spring" }}
                className="absolute left-4 md:left-8 top-2 h-5 w-5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  boxShadow: `0 0 20px ${theme.primaryColor}60`,
                }}
              />

              {/* Cup header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-3">
                  {year && (
                    <span
                      className="text-lg font-black px-4 py-1 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${theme.primaryColor}20 0%, ${theme.primaryColor}10 100%)`,
                        color: theme.primaryColor,
                      }}
                    >
                      {year}
                    </span>
                  )}
                  <h3 className="text-2xl font-bold text-white">{cup.name}</h3>
                </div>
                <p className="text-white/50">
                  {cupWinners.length} {locale === "fr" ? "produits primés" : "awarded products"}
                </p>
              </div>

              {/* Cup winners grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cupWinners.slice(0, 6).map((winner, index) => (
                  <PremiumWinnerCard
                    key={winner.productId}
                    winner={winner}
                    showScore={showScore}
                    showCategory={showCategory}
                    index={index}
                  />
                ))}
              </div>

              {/* Show more link if more winners */}
              {cupWinners.length > 6 && (
                <Link
                  href={`/cups/${cup.id}/results`}
                  className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                  style={{
                    background: `${theme.primaryColor}20`,
                    color: theme.primaryColor,
                  }}
                >
                  {locale === "fr"
                    ? `Voir les ${cupWinners.length - 6} autres produits`
                    : `See ${cupWinners.length - 6} more products`}
                  <ChevronDown className="h-4 w-4" />
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hybrid Layout - Cards for top 3, rows for rest
 */
function HybridLayout({
  winners,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  showScore: boolean;
  showCategory: boolean;
}) {
  const topThree = winners.filter((w) => w.rank && w.rank <= 3);
  const rest = winners.filter((w) => !w.rank || w.rank > 3);

  return (
    <div className="space-y-10">
      {/* Top 3 as cards */}
      {topThree.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {topThree.map((winner, index) => (
            <PremiumWinnerCard
              key={winner.productId}
              winner={winner}
              showScore={showScore}
              showCategory={showCategory}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Rest as rows */}
      {rest.length > 0 && (
        <div className="space-y-3">
          {rest.map((winner, index) => (
            <PremiumWinnerRow
              key={winner.productId}
              winner={winner}
              showScore={showScore}
              showCategory={showCategory}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Results Display Component - handles layout + displayStyle combinations
 */
function ResultsDisplay({
  winners,
  cups,
  layout,
  displayStyle,
  showScore,
  showCategory,
}: {
  winners: Winner[];
  cups: Cup[];
  layout: string;
  displayStyle: string;
  showScore: boolean;
  showCategory: boolean;
}) {
  // Timeline layout - always uses its own structure
  if (layout === "timeline") {
    return (
      <TimelineLayout
        winners={winners}
        cups={cups}
        showScore={showScore}
        showCategory={showCategory}
      />
    );
  }

  // For masonry and list layouts, apply displayStyle
  if (displayStyle === "hybrid") {
    return (
      <HybridLayout
        winners={winners}
        showScore={showScore}
        showCategory={showCategory}
      />
    );
  }

  if (displayStyle === "rows") {
    return (
      <ListLayout
        winners={winners}
        showScore={showScore}
        showCategory={showCategory}
      />
    );
  }

  // cards (default)
  if (layout === "masonry") {
    return (
      <MasonryLayout
        winners={winners}
        showScore={showScore}
        showCategory={showCategory}
      />
    );
  }

  // list layout with cards = grid
  return (
    <GridLayout
      winners={winners}
      showScore={showScore}
      showCategory={showCategory}
    />
  );
}

/**
 * Main Palmares Page Component
 */
export function PalmaresPage({
  config,
  cups,
  labels,
  categories,
  winners,
}: PalmaresPageProps) {
  const { theme, locale } = usePortal();
  const t = pageLabels[locale];
  const isSidebarLayout = config.palmareFilterStyle === "sidebar";

  // Filter state
  const [selectedCup, setSelectedCup] = useState("all");
  const [selectedLabel, setSelectedLabel] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRank, setSelectedRank] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Compute dynamic labels and categories based on selected cup
  const availableLabels = useMemo(() => {
    if (selectedCup === "all") return labels;

    // Get unique labels from winners of the selected cup
    const cupWinners = winners.filter((w) => w.cupId === selectedCup);
    const labelNames = new Set(cupWinners.map((w) => w.labelName).filter(Boolean));

    return labels.filter((l) => labelNames.has(l.name));
  }, [selectedCup, winners, labels]);

  const availableCategories = useMemo(() => {
    if (selectedCup === "all") return categories;

    // Get unique categories from winners of the selected cup
    const cupWinners = winners.filter((w) => w.cupId === selectedCup);
    const categoryNames = new Set(cupWinners.map((w) => w.categoryName));

    return categories.filter((c) => categoryNames.has(c.name));
  }, [selectedCup, winners, categories]);

  // Handle cup change - reset label and category filters if they're no longer available
  const handleCupChange = (cupId: string) => {
    setSelectedCup(cupId);

    if (cupId !== "all") {
      const cup = cups.find((c) => c.id === cupId);
      const visibility = cup?.resultsVisibility ?? "labels";
      const cupShowLabels = ["labels", "labels_and_podium", "all"].includes(visibility);
      const cupShowRank = ["podium", "labels_and_podium", "all"].includes(visibility);

      // Reset filters that are no longer relevant for this cup's visibility
      if (!cupShowLabels && selectedLabel !== "all") setSelectedLabel("all");
      if (!cupShowRank && selectedRank !== "all") setSelectedRank("all");

      // Reset label/category if not available in new cup
      const cupWinners = winners.filter((w) => w.cupId === cupId);
      const availableLabelNames = new Set(cupWinners.map((w) => w.labelName).filter(Boolean));
      const availableCategoryNames = new Set(cupWinners.map((w) => w.categoryName));

      if (selectedLabel !== "all" && !availableLabelNames.has(selectedLabel)) {
        setSelectedLabel("all");
      }
      if (selectedCategory !== "all" && !availableCategoryNames.has(selectedCategory)) {
        setSelectedCategory("all");
      }
    }
  };

  // Compute stats
  const stats = useMemo(() => {
    const uniqueLabels = new Set(winners.map((w) => w.labelName).filter(Boolean));
    return {
      totalProducts: winners.length,
      totalCups: cups.length,
      totalCategories: categories.length,
      totalLabels: uniqueLabels.size,
    };
  }, [winners, cups, categories]);

  // Filtered winners - grouped by category, sorted by rank within each category
  const filteredWinners = useMemo(() => {
    const filtered = winners.filter((winner) => {
      if (selectedCup !== "all" && winner.cupId !== selectedCup) return false;
      if (selectedLabel !== "all" && winner.labelName !== selectedLabel) return false;
      if (selectedCategory !== "all" && winner.categoryName !== selectedCategory)
        return false;
      if (selectedRank !== "all" && winner.rank !== parseInt(selectedRank)) return false;
      if (
        searchQuery &&
        !winner.productName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !winner.producerName.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });

    // Sort: group by category name, then by rank within each category
    return filtered.sort((a, b) => {
      const catCompare = a.categoryName.localeCompare(b.categoryName);
      if (catCompare !== 0) return catCompare;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
  }, [winners, selectedCup, selectedLabel, selectedCategory, selectedRank, searchQuery]);

  const hasActiveFilters =
    selectedCup !== "all" ||
    selectedLabel !== "all" ||
    selectedCategory !== "all" ||
    selectedRank !== "all" ||
    searchQuery !== "";

  // Determine which filters to show based on selected cup's visibility
  const selectedCupVisibility = selectedCup !== "all"
    ? cups.find((c) => c.id === selectedCup)?.resultsVisibility ?? "labels"
    : null;
  const showLabelFilter = selectedCupVisibility === null || ["labels", "labels_and_podium", "all"].includes(selectedCupVisibility);
  const showRankFilter = selectedCupVisibility === null || ["podium", "labels_and_podium", "all"].includes(selectedCupVisibility);

  const clearFilters = () => {
    setSelectedCup("all");
    setSelectedLabel("all");
    setSelectedCategory("all");
    setSelectedRank("all");
    setSearchQuery("");
  };

  if (winners.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Trophy className="mx-auto h-20 w-20 text-white/20 mb-6" />
          <h1 className="text-3xl font-bold mb-3">{t.title}</h1>
          <p className="text-white/50">
            {locale === "fr"
              ? "Aucun résultat publié pour le moment."
              : "No results published yet."}
          </p>
        </div>
      </div>
    );
  }

  // Common Hero Section component
  const HeroSection = () => (
    <div className={cn("relative pt-16 pb-12", isSidebarLayout && "pb-8")}>
      <div className="container mx-auto px-4">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center h-20 w-20 rounded-3xl mb-6"
            style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}30 0%, ${theme.primaryColor}10 100%)`,
              boxShadow: `0 0 40px ${theme.primaryColor}30`,
            }}
          >
            <Trophy className="h-10 w-10" style={{ color: theme.primaryColor }} />
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-xl text-white/50 max-w-lg mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-8 md:gap-16 mb-16"
        >
          {[
            { value: stats.totalProducts, label: t.products, icon: Award },
            { value: stats.totalCups, label: t.cups, icon: Trophy },
            { value: stats.totalCategories, label: t.categories, icon: Star },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1, type: "spring" }}
              className="text-center"
            >
              <div
                className="flex items-center justify-center h-14 w-14 rounded-2xl mx-auto mb-3"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}20 0%, transparent 100%)`,
                }}
              >
                <stat.icon className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <div className="text-4xl font-black text-white mb-1">
                <AnimatedCounter value={stat.value} />
              </div>
              <div className="text-sm text-white/40 uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-xl mx-auto mb-10"
        >
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-white/60 transition-colors" />
            <Input
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 pl-14 pr-5 text-lg rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl focus:border-white/30 focus:bg-white/10 transition-all"
            />
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
              style={{
                boxShadow: `0 0 30px ${theme.primaryColor}20`,
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );

  // Common Results Section
  const ResultsSection = ({ className }: { className?: string }) => (
    <AnimatePresence mode="wait">
      {filteredWinners.length === 0 ? (
        <motion.div
          key="no-results"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="text-center py-20"
        >
          <Search className="mx-auto h-16 w-16 text-white/20 mb-6" />
          <p className="text-xl text-white/50 mb-6">{t.noResults}</p>
          <Button
            onClick={clearFilters}
            className="rounded-full px-6"
            style={{
              background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            }}
          >
            {t.clearFilters}
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={className}
        >
          <ResultsDisplay
            winners={filteredWinners}
            cups={cups}
            layout={config.palmareLayout}
            displayStyle={config.palmareDisplayStyle}
            showScore={config.palmareShowScore}
            showCategory={config.palmareShowCategory}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Sidebar Layout
  if (isSidebarLayout) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* Floating background elements */}
        <FloatingElements
          primaryColor={theme.primaryColor}
          secondaryColor={theme.secondaryColor}
        />

        {/* Hero Section */}
        <HeroSection />

        {/* Main Content with Sidebar */}
        <div className="container mx-auto px-4 pb-20">
          <div className="flex gap-8">
            {/* Fixed Sidebar */}
            <motion.aside
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="hidden lg:block w-72 shrink-0"
            >
              <div
                className="sticky top-24 p-6 rounded-2xl backdrop-blur-xl border border-white/10"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              >
                <SidebarFilterContent
                  cups={cups}
                  displayLabels={availableLabels}
                  displayCategories={availableCategories}
                  selectedCup={selectedCup}
                  selectedLabel={selectedLabel}
                  selectedCategory={selectedCategory}
                  selectedRank={selectedRank}
                  onCupChange={handleCupChange}
                  onLabelChange={setSelectedLabel}
                  onCategoryChange={setSelectedCategory}
                  onRankChange={setSelectedRank}
                  showLabelFilter={showLabelFilter}
                  showRankFilter={showRankFilter}
                  locale={locale}
                />

                {/* Active filters count */}
                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 pt-6 border-t border-white/10"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">
                          <span className="font-bold text-white">{filteredWinners.length}</span> {t.results}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="text-white/50 hover:text-white hover:bg-white/10 h-8 px-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>

            {/* Mobile Filters (shown on small screens) */}
            <div className="lg:hidden w-full mb-8">
              <PremiumFilters
                cups={cups}
                labels={labels}
                categories={categories}
                availableLabels={availableLabels}
                availableCategories={availableCategories}
                selectedCup={selectedCup}
                selectedLabel={selectedLabel}
                selectedCategory={selectedCategory}
                selectedRank={selectedRank}
                onCupChange={handleCupChange}
                onLabelChange={setSelectedLabel}
                onCategoryChange={setSelectedCategory}
                onRankChange={setSelectedRank}
                locale={locale}
                filterStyle="chips"
              />
            </div>

            {/* Results */}
            <div className="flex-1 min-w-0">
              <ResultsSection />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default Layout (chips or dropdown filters)
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Floating background elements */}
      <FloatingElements
        primaryColor={theme.primaryColor}
        secondaryColor={theme.secondaryColor}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* Filters (centered) */}
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <PremiumFilters
            cups={cups}
            labels={labels}
            categories={categories}
            availableLabels={availableLabels}
            availableCategories={availableCategories}
            selectedCup={selectedCup}
            selectedLabel={selectedLabel}
            selectedCategory={selectedCategory}
            selectedRank={selectedRank}
            onCupChange={handleCupChange}
            onLabelChange={setSelectedLabel}
            onCategoryChange={setSelectedCategory}
            onRankChange={setSelectedRank}
            locale={locale}
            filterStyle={config.palmareFilterStyle}
          />
        </motion.div>

        {/* Active filters & results count */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center gap-4 mb-8"
            >
              <span className="text-white/50">
                <span className="font-bold text-white">{filteredWinners.length}</span> {t.results}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="mr-1.5 h-4 w-4" />
                {t.clearFilters}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Section */}
      <div className="container mx-auto px-4 pb-20">
        <ResultsSection className="max-w-7xl mx-auto" />
      </div>
    </div>
  );
}
