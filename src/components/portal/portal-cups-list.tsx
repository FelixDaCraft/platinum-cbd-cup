"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Search,
  Trophy,
  CalendarDays,
  ArrowRight,
  Filter,
  Users,
  Award,
  Clock,
  Sparkles,
  Star,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

interface Cup {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingEndAt: Date | null;
  status: string;
  createdAt: Date;
}

interface PortalCupsListProps {
  cups: Cup[];
}

interface Stats {
  totalCups: number;
  activeCups: number;
  completedCups: number;
}

type StatusFilter = "all" | "published" | "rating" | "completed";

// Labels by locale
const pageLabels = {
  fr: {
    title: "Nos Cups",
    subtitle: "Découvrez l'excellence en compétition",
    search: "Rechercher une cup...",
    all: "Toutes",
    active: "En cours",
    rating: "Notation",
    completed: "Terminées",
    noCups: "Aucune cup trouvée",
    noResults: "Essayez de modifier vos critères de recherche.",
    noCupsYet: "Il n'y a pas encore de cups publiées.",
    resetFilters: "Réinitialiser les filtres",
    cupsFound: "cups trouvées",
    cupFound: "cup trouvée",
    viewDetails: "Voir les détails",
    participate: "Participer",
    viewResults: "Voir les résultats",
    registrationOpen: "Inscriptions ouvertes",
    registrationClosed: "Inscriptions fermées",
    ratingInProgress: "Notation en cours",
    finished: "Terminée",
    registration: "Inscriptions",
    from: "du",
    to: "au",
    featured: "À la une",
    totalCups: "Compétitions",
    activeCups: "En cours",
    completedCups: "Terminées",
    daysLeft: "jours restants",
    dayLeft: "jour restant",
    spots: "places",
    spotsLeft: "places restantes",
  },
  en: {
    title: "Our Cups",
    subtitle: "Discover excellence in competition",
    search: "Search a cup...",
    all: "All",
    active: "Active",
    rating: "Rating",
    completed: "Completed",
    noCups: "No cups found",
    noResults: "Try modifying your search criteria.",
    noCupsYet: "No cups published yet.",
    resetFilters: "Reset filters",
    cupsFound: "cups found",
    cupFound: "cup found",
    viewDetails: "View details",
    participate: "Participate",
    viewResults: "View results",
    registrationOpen: "Registration open",
    registrationClosed: "Registration closed",
    ratingInProgress: "Rating in progress",
    finished: "Finished",
    registration: "Registration",
    from: "from",
    to: "to",
    featured: "Featured",
    totalCups: "Competitions",
    activeCups: "Active",
    completedCups: "Completed",
    daysLeft: "days left",
    dayLeft: "day left",
    spots: "spots",
    spotsLeft: "spots left",
  },
} as const;

/**
 * Animated Counter
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
 * Floating Elements - Full viewport background
 */
function FloatingElements({ primaryColor, secondaryColor }: { primaryColor: string; secondaryColor: string }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
        style={{ background: primaryColor }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{ background: secondaryColor }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-2/3 right-1/4 w-[350px] h-[350px] rounded-full opacity-10 blur-[100px]"
        style={{ background: primaryColor }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.1, 0.15, 0.1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full opacity-10 blur-[100px]"
        style={{ background: secondaryColor }}
        animate={{
          scale: [1, 1.15, 1],
          x: [0, 20, 0],
          opacity: [0.08, 0.15, 0.08],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/**
 * 3D Tilt Card
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
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
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
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Filter Chip
 */
function FilterChip({
  label,
  isSelected,
  onClick,
  primaryColor,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  primaryColor: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
        "backdrop-blur-md border",
        isSelected
          ? "text-white border-transparent"
          : "text-foreground/70 hover:text-foreground border-border hover:border-border bg-muted/50"
      )}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`
          : undefined,
        boxShadow: isSelected ? `0 0 25px ${primaryColor}50, 0 4px 15px rgba(0,0,0,0.2)` : undefined,
      }}
    >
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)`,
          }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

/**
 * Status Badge Premium
 */
function StatusBadge({ status, locale }: { status: string; locale: "fr" | "en" }) {
  const t = pageLabels[locale];

  const configs: Record<string, { label: string; color: string; icon: typeof Trophy; pulse?: boolean }> = {
    published: {
      label: t.registrationOpen,
      color: "#22c55e",
      icon: Sparkles,
      pulse: true,
    },
    registration_closed: {
      label: t.registrationClosed,
      color: "#eab308",
      icon: Clock,
    },
    rating: {
      label: t.ratingInProgress,
      color: "#3b82f6",
      icon: Star,
      pulse: true,
    },
    completed: {
      label: t.finished,
      color: "#6b7280",
      icon: Award,
    },
  };

  const config = configs[status] ?? { label: status, color: "#6b7280", icon: Trophy };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}CC 100%)`,
        color: status === "completed" ? "#fff" : "#fff",
        boxShadow: `0 2px 10px ${config.color}40`,
      }}
    >
      {config.pulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ background: config.color }}
        />
      )}
      <Icon className="h-3 w-3 relative z-10" />
      <span className="relative z-10">{config.label}</span>
    </motion.div>
  );
}

/**
 * Countdown Component
 */
function Countdown({ targetDate, locale }: { targetDate: Date; locale: "fr" | "en" }) {
  const t = pageLabels[locale];
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    const calculateDays = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysLeft(Math.max(0, days));
    };

    calculateDays();
    const interval = setInterval(calculateDays, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (daysLeft <= 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-500/20">
        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="font-bold text-amber-600 dark:text-amber-400">{daysLeft}</span>
        <span className="text-amber-700/70 dark:text-amber-300/70">{daysLeft === 1 ? t.dayLeft : t.daysLeft}</span>
      </div>
    </div>
  );
}

/**
 * Featured Cup Card
 */
function FeaturedCupCard({ cup, locale }: { cup: Cup; locale: "fr" | "en" }) {
  const { theme } = usePortal();
  const t = pageLabels[locale];

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  const isActive = cup.status === "published" || cup.status === "registration_closed";
  const ctaLabel = cup.status === "completed" ? t.viewResults : isActive ? t.participate : t.viewDetails;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative mb-12"
    >
      {/* Featured Label */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}30 0%, ${theme.primaryColor}10 100%)`,
        }}
      >
        <Sparkles className="h-4 w-4" style={{ color: theme.primaryColor }} />
        <span className="text-sm font-semibold" style={{ color: theme.primaryColor }}>
          {t.featured}
        </span>
      </motion.div>

      <TiltCard>
        <div
          className="relative overflow-hidden rounded-3xl backdrop-blur-xl border border-border bg-card"
        >
          {/* Shine Effect */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl">
            <motion.div
              className="absolute -inset-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent skew-x-12"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 3 }}
            />
          </div>

          <div className="relative grid lg:grid-cols-2 gap-0">
            {/* Image Section */}
            <div
              className="relative h-64 lg:h-80 bg-gradient-to-br"
              style={{
                background: cup.bannerUrl
                  ? `url(${cup.bannerUrl}) center/cover`
                  : `linear-gradient(135deg, ${theme.primaryColor}40 0%, ${theme.secondaryColor}40 100%)`,
              }}
            >
              {!cup.bannerUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trophy className="h-20 w-20 text-white/30" />
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-black/60" />

              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                <StatusBadge status={cup.status} locale={locale} />
              </div>
            </div>

            {/* Content Section */}
            <div className="p-8 lg:p-10 flex flex-col justify-center">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
                {cup.name}
              </h2>

              {cup.description && (
                <p className="text-muted-foreground text-lg mb-6 line-clamp-3">
                  {cup.description}
                </p>
              )}

              {/* Dates */}
              {cup.registrationOpenAt && (
                <div className="flex items-center gap-3 mb-6 text-muted-foreground">
                  <CalendarDays className="h-5 w-5" />
                  <span>
                    {t.registration}: {formatDate(cup.registrationOpenAt)}
                    {cup.registrationCloseAt && (
                      <> - {formatDate(cup.registrationCloseAt)}</>
                    )}
                  </span>
                </div>
              )}

              {/* Countdown */}
              {cup.status === "published" && cup.registrationCloseAt && (
                <div className="mb-6">
                  <Countdown targetDate={cup.registrationCloseAt} locale={locale} />
                </div>
              )}

              {/* CTA Button */}
              <Button
                asChild
                size="lg"
                className="w-fit text-lg px-8 rounded-full group"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  boxShadow: `0 4px 20px ${theme.primaryColor}40`,
                }}
              >
                <Link href={cup.status === "completed" ? `/cups/${cup.id}/results` : `/cups/${cup.id}`}>
                  {ctaLabel}
                  <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}

/**
 * Cup Card Premium
 */
function CupCard({ cup, index, locale }: { cup: Cup; index: number; locale: "fr" | "en" }) {
  const { theme } = usePortal();
  const t = pageLabels[locale];

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  const isActive = cup.status === "published" || cup.status === "registration_closed";
  const ctaLabel = cup.status === "completed" ? t.viewResults : isActive ? t.viewDetails : t.viewDetails;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <TiltCard>
        <Link href={`/cups/${cup.id}`} className="block h-full group">
          <div
            className={cn(
              "relative h-full overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-500",
              "hover:border-opacity-100 border-border bg-card"
            )}
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 50%, ${theme.primaryColor}10 100%)`,
              }}
            />

            {/* Shine effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <motion.div
                className="absolute -inset-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent skew-x-12"
                initial={{ x: "-100%" }}
                whileHover={{ x: "200%" }}
                transition={{ duration: 0.8 }}
              />
            </div>

            {/* Banner */}
            <div
              className="relative h-44 bg-gradient-to-br"
              style={{
                background: cup.bannerUrl
                  ? `url(${cup.bannerUrl}) center/cover`
                  : `linear-gradient(135deg, ${theme.primaryColor}30 0%, ${theme.secondaryColor}30 100%)`,
              }}
            >
              {!cup.bannerUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trophy className="h-14 w-14 text-white/20" />
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                <StatusBadge status={cup.status} locale={locale} />
              </div>
            </div>

            {/* Content */}
            <div className="relative p-5">
              <h3 className="font-bold text-lg text-foreground mb-2 line-clamp-2 group-hover:text-foreground transition-colors">
                {cup.name}
              </h3>

              {cup.description && (
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {cup.description}
                </p>
              )}

              {/* Dates */}
              {cup.registrationOpenAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(cup.registrationOpenAt)}
                    {cup.registrationCloseAt && (
                      <> - {formatDate(cup.registrationCloseAt)}</>
                    )}
                  </span>
                </div>
              )}

              {/* Countdown for active cups */}
              {cup.status === "published" && cup.registrationCloseAt && (
                <div className="mb-4">
                  <Countdown targetDate={cup.registrationCloseAt} locale={locale} />
                </div>
              )}

              {/* CTA */}
              <div
                className="flex items-center justify-between pt-4 border-t border-border"
              >
                <span
                  className="text-sm font-medium transition-colors"
                  style={{ color: theme.primaryColor }}
                >
                  {ctaLabel}
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-all group-hover:scale-110"
                  style={{
                    background: `${theme.primaryColor}20`,
                  }}
                >
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    style={{ color: theme.primaryColor }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </TiltCard>
    </motion.div>
  );
}

/**
 * Main Cups List Component
 */
export function PortalCupsList({ cups }: PortalCupsListProps) {
  const { theme, locale } = usePortal();
  const t = pageLabels[locale];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Compute stats
  const stats: Stats = useMemo(() => ({
    totalCups: cups.length,
    activeCups: cups.filter((c) => c.status === "published" || c.status === "registration_closed" || c.status === "rating").length,
    completedCups: cups.filter((c) => c.status === "completed").length,
  }), [cups]);

  // Get featured cup (first active or most recent)
  const featuredCup = useMemo(() => {
    const activeCup = cups.find((c) => c.status === "published");
    return activeCup ?? cups[0];
  }, [cups]);

  // Filter cups
  const filteredCups = useMemo(() => {
    return cups.filter((cup) => {
      // Don't show featured cup in grid if it's displayed separately
      if (featuredCup && cup.id === featuredCup.id && statusFilter === "all" && !searchQuery) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = cup.name.toLowerCase().includes(query);
        const matchesDescription = cup.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "published") {
          return cup.status === "published" || cup.status === "registration_closed";
        }
        return cup.status === statusFilter;
      }

      return true;
    });
  }, [cups, searchQuery, statusFilter, featuredCup]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all";

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t.all },
    { value: "published", label: t.active },
    { value: "rating", label: t.rating },
    { value: "completed", label: t.completed },
  ];

  // Empty state
  if (cups.length === 0) {
    return (
      <div className="relative min-h-[60vh] flex items-center justify-center">
        <FloatingElements primaryColor={theme.primaryColor} secondaryColor={theme.secondaryColor} />
        <div className="relative z-10 text-center">
          <Trophy className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-2">{t.noCups}</h2>
          <p className="text-muted-foreground">{t.noCupsYet}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Floating Elements - Fixed full-screen background */}
      <FloatingElements primaryColor={theme.primaryColor} secondaryColor={theme.secondaryColor} />

      {/* Hero Section */}
      <div className="relative z-10 pt-8 pb-8">
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

            <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4 text-foreground">
              {t.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto">
              {t.subtitle}
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-8 md:gap-16 mb-12"
          >
            {[
              { value: stats.totalCups, label: t.totalCups, icon: Trophy },
              { value: stats.activeCups, label: t.activeCups, icon: Sparkles },
              { value: stats.completedCups, label: t.completedCups, icon: Award },
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
                <div className="text-4xl font-black text-foreground mb-1">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">
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
            className="max-w-xl mx-auto mb-8"
          >
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <Input
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-14 pr-5 text-lg rounded-2xl bg-muted/50 border-border backdrop-blur-xl focus:border-primary focus:bg-muted transition-all"
              />
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
                style={{ boxShadow: `0 0 30px ${theme.primaryColor}20` }}
              />
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            {statusFilters.map((filter) => (
              <FilterChip
                key={filter.value}
                label={filter.label}
                isSelected={statusFilter === filter.value}
                onClick={() => setStatusFilter(filter.value)}
                primaryColor={theme.primaryColor}
              />
            ))}
          </motion.div>

          {/* Active filters indicator */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-4 mb-8"
              >
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground">{filteredCups.length}</span>{" "}
                  {filteredCups.length === 1 ? t.cupFound : t.cupsFound}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t.resetFilters}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Featured Cup (only show when no filters active) */}
          {featuredCup && !hasActiveFilters && (
            <FeaturedCupCard cup={featuredCup} locale={locale} />
          )}

          {/* Cups Grid */}
          <AnimatePresence mode="wait">
            {filteredCups.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-20"
              >
                <Filter className="mx-auto h-16 w-16 text-muted-foreground/30 mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2">{t.noCups}</h3>
                <p className="text-muted-foreground mb-6">{t.noResults}</p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="rounded-full px-6 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  }}
                >
                  {t.resetFilters}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Section title when filters active */}
                {hasActiveFilters && (
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-2xl font-bold text-foreground mb-6"
                  >
                    {filteredCups.length} {filteredCups.length === 1 ? t.cupFound : t.cupsFound}
                  </motion.h2>
                )}

                {/* Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCups.map((cup, index) => (
                    <CupCard key={cup.id} cup={cup} index={index} locale={locale} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
