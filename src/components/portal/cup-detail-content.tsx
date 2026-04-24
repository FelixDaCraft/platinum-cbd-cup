"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Trophy,
  CalendarDays,
  MapPin,
  Mail,
  ExternalLink,
  Euro,
  Star,
  Award,
  Users,
  ClipboardList,
  ArrowRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { useSession } from "~/lib/auth-client";
import { getMaxScoreForScale } from "~/lib/validations/labels";

interface RatingCriterion {
  id: string;
  name: string;
  description: string | null;
  coefficient: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  criteria: RatingCriterion[];
}

interface CupLabel {
  id: string;
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
  icon: string | null;
  condition: string | null;
  isPublic: boolean;
}

interface Cup {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  defaultPricePerProduct: number | null;
  currency: string | null;
  ratingScale: string;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
  bannerUrl: string | null;
  publicPageDescription: string | null;
  eventDate: Date | null;
  eventLocation: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  resultsPublishedAt: Date | null;
  categories: Category[];
  labels: CupLabel[];
}

interface CupDetailContentProps {
  cup: Cup;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatPrice(priceInCents: number | null, currency: string | null): string {
  if (priceInCents === null) return "Gratuit";
  const price = priceInCents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency ?? "EUR",
  }).format(price);
}

function getStatusConfig(status: string) {
  switch (status) {
    case "published":
      return { label: "Inscriptions ouvertes", color: "#22c55e", glow: "rgba(34, 197, 94, 0.3)" };
    case "registration_closed":
      return { label: "Inscriptions fermées", color: "#eab308", glow: "rgba(234, 179, 8, 0.3)" };
    case "rating":
      return { label: "Notation en cours", color: "#3b82f6", glow: "rgba(59, 130, 246, 0.3)" };
    case "completed":
      return { label: "Terminée", color: "#6b7280", glow: "rgba(107, 114, 128, 0.3)" };
    default:
      return { label: status, color: "#6b7280", glow: "rgba(107, 114, 128, 0.3)" };
  }
}

/**
 * Immersive Full-Screen Hero Section
 */
function HeroSection({ cup }: { cup: Cup }) {
  const { theme } = usePortal();
  const statusConfig = getStatusConfig(cup.status);

  return (
    <div className="relative min-h-[70vh] md:min-h-[80vh] overflow-hidden">
      {/* Background with parallax effect */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          background: cup.bannerUrl
            ? `url(${cup.bannerUrl}) center/cover fixed`
            : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />

      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: theme.primaryColor }}
        />
        <div
          className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: theme.secondaryColor }}
        />
      </div>

      {/* Content */}
      <div className="relative min-h-[70vh] md:min-h-[80vh] flex items-end">
        <div className="container mx-auto pb-16 md:pb-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            {/* Status & Type Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border"
                style={{
                  backgroundColor: `${statusConfig.color}20`,
                  borderColor: `${statusConfig.color}40`,
                  boxShadow: `0 0 20px ${statusConfig.glow}`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: statusConfig.color }}
                />
                <span className="text-sm font-medium text-white">{statusConfig.label}</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md bg-white/10 border border-white/20"
              >
                {cup.type === "pro" ? (
                  <>
                    <Award className="h-4 w-4 text-white" />
                    <span className="text-sm font-medium text-white">Jury Professionnel</span>
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 text-white" />
                    <span className="text-sm font-medium text-white">Jury Public</span>
                  </>
                )}
              </motion.div>
            </div>

            {/* Title with glassmorphism card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="p-6 md:p-8 rounded-3xl backdrop-blur-xl border border-white/10"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              }}
            >
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
                {cup.name}
              </h1>
              {cup.publicPageDescription && (
                <p className="text-lg md:text-xl text-white/80 leading-relaxed">
                  {cup.publicPageDescription}
                </p>
              )}
              {cup.description && !cup.publicPageDescription && (
                <p className="text-lg md:text-xl text-white/80 leading-relaxed">
                  {cup.description}
                </p>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-8 h-12 rounded-full border-2 border-white/30 flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-3 rounded-full bg-white/60" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Bento Grid Info Section - Premium asymmetric layout
 */
function BentoInfoSection({ cup, showPricing }: { cup: Cup; showPricing: boolean }) {
  const { theme } = usePortal();

  const infoItems = [
    cup.eventDate && {
      id: "date",
      icon: CalendarDays,
      label: "Date de l'événement",
      value: formatDate(cup.eventDate),
      size: "large",
      color: theme.primaryColor,
    },
    cup.registrationOpenAt && {
      id: "registration",
      icon: ClipboardList,
      label: "Inscriptions",
      value: `Du ${formatDate(cup.registrationOpenAt)}${cup.registrationCloseAt ? ` au ${formatDate(cup.registrationCloseAt)}` : ""}`,
      size: "large",
      color: theme.secondaryColor,
    },
    cup.eventLocation && {
      id: "location",
      icon: MapPin,
      label: "Lieu",
      value: cup.eventLocation,
      size: "medium",
      color: theme.primaryColor,
    },
    showPricing && {
      id: "price",
      icon: Euro,
      label: "Tarif par produit",
      value: formatPrice(cup.defaultPricePerProduct, cup.currency),
      size: "medium",
      color: "#22c55e",
    },
    cup.contactEmail && {
      id: "contact",
      icon: Mail,
      label: "Contact",
      value: cup.contactEmail,
      href: `mailto:${cup.contactEmail}`,
      size: "small",
      color: theme.secondaryColor,
    },
    cup.websiteUrl && {
      id: "website",
      icon: ExternalLink,
      label: "Site web",
      value: "Visiter le site",
      href: cup.websiteUrl,
      external: true,
      size: "small",
      color: theme.primaryColor,
    },
  ].filter(Boolean) as Array<{
    id: string;
    icon: typeof CalendarDays;
    label: string;
    value: string;
    size: string;
    color: string;
    href?: string;
    external?: boolean;
  }>;

  if (infoItems.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${theme.primaryColor}15`,
            boxShadow: `0 0 20px ${theme.primaryColor}20`,
          }}
        >
          <Sparkles className="h-6 w-6" style={{ color: theme.primaryColor }} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Informations</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {infoItems.map((item, index) => {
          const Icon = item.icon;
          const isLarge = item.size === "large";
          const isMedium = item.size === "medium";

          const content = (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`
                relative p-6 rounded-2xl backdrop-blur-md border border-white/10
                transition-all duration-300 hover:scale-[1.02] group cursor-pointer
                ${isLarge ? "col-span-2 row-span-2" : isMedium ? "col-span-2" : "col-span-1"}
              `}
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px ${item.color}20`;
                e.currentTarget.style.borderColor = `${item.color}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }}
            >
              {/* Icon with glow */}
              <div
                className={`flex items-center justify-center rounded-xl mb-4 ${isLarge ? "h-16 w-16" : "h-12 w-12"}`}
                style={{
                  backgroundColor: `${item.color}15`,
                  boxShadow: `0 0 20px ${item.color}20`,
                }}
              >
                <Icon
                  className={isLarge ? "h-8 w-8" : "h-5 w-5"}
                  style={{ color: item.color }}
                />
              </div>

              {/* Label */}
              <p className="text-sm text-muted-foreground mb-1">{item.label}</p>

              {/* Value */}
              <p className={`font-semibold ${isLarge ? "text-xl md:text-2xl" : isMedium ? "text-lg" : "text-base"} group-hover:text-white transition-colors`}>
                {item.value}
              </p>

              {/* Arrow for links */}
              {item.href && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          );

          if (item.href) {
            return (
              <a
                key={item.id}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className={`${isLarge ? "col-span-2 row-span-2" : isMedium ? "col-span-2" : "col-span-1"}`}
              >
                {content}
              </a>
            );
          }

          return <div key={item.id}>{content}</div>;
        })}
      </div>
    </motion.section>
  );
}

/**
 * Category Card with hover preview
 */
function CategoryCard({
  category,
  ratingScale,
  index,
  primaryColor,
}: {
  category: Category;
  ratingScale: string;
  index: number;
  primaryColor: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxScore = getMaxScoreForScale(ratingScale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative p-6 rounded-2xl backdrop-blur-md border border-white/10 transition-all duration-300 cursor-pointer"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
      onMouseEnter={(e) => {
        setIsExpanded(true);
        e.currentTarget.style.boxShadow = `0 8px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px ${primaryColor}20`;
        e.currentTarget.style.borderColor = `${primaryColor}30`;
      }}
      onMouseLeave={(e) => {
        setIsExpanded(false);
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${primaryColor}15`,
            boxShadow: `0 0 15px ${primaryColor}20`,
          }}
        >
          <Users className="h-6 w-6" style={{ color: primaryColor }} />
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${primaryColor}15`,
            color: primaryColor,
          }}
        >
          <Star className="h-3 w-3" />
          <span>{category.criteria.length} critères</span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
      {category.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {category.description}
        </p>
      )}

      {/* Criteria Preview (always visible but collapsed) */}
      {category.criteria.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            />
            <span>Critères de notation (/{maxScore})</span>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2 border-t border-white/10">
                  {category.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" style={{ color: primaryColor }} />
                        <span className="text-sm font-medium">{criterion.name}</span>
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor,
                        }}
                      >
                        Coef. {criterion.coefficient}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {category.criteria.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Critères en cours de définition
        </p>
      )}
    </motion.div>
  );
}

/**
 * Categories Section with preview cards
 */
function CategoriesSection({ categories, ratingScale }: { categories: Category[]; ratingScale: string }) {
  const { theme } = usePortal();

  if (categories.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${theme.primaryColor}15`,
            boxShadow: `0 0 20px ${theme.primaryColor}20`,
          }}
        >
          <Users className="h-6 w-6" style={{ color: theme.primaryColor }} />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Catégories</h2>
          <p className="text-muted-foreground text-sm">{categories.length} catégorie{categories.length > 1 ? "s" : ""} de produits</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            ratingScale={ratingScale}
            index={index}
            primaryColor={theme.primaryColor}
          />
        ))}
      </div>
    </motion.section>
  );
}

/**
 * 3D Label/Medal Card with glow effect
 */
function LabelCard3D({
  label,
  ratingScale,
  index,
}: {
  label: CupLabel;
  ratingScale: string;
  index: number;
}) {
  const maxScore = getMaxScoreForScale(ratingScale);
  const color = label.color ?? "#FFD700";

  const formatScoreDisplay = () => {
    if (label.condition) return label.condition;
    if (label.maxScore === null) return `Score ≥ ${label.minScore}/${maxScore}`;
    return `Score: ${label.minScore}-${label.maxScore}/${maxScore}`;
  };

  const renderIcon = () => {
    if (label.icon) {
      if (label.icon.startsWith("http")) {
        return (
          <img
            src={label.icon}
            alt={label.name}
            className="h-10 w-10 object-contain"
          />
        );
      }
      return <span className="text-3xl">{label.icon}</span>;
    }
    return <Award className="h-10 w-10 text-white" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{
        scale: 1.05,
        rotateY: 5,
        rotateX: -5,
      }}
      className="relative p-6 rounded-2xl backdrop-blur-md border transition-all duration-300 cursor-pointer group"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        borderColor: `${color}30`,
        boxShadow: `0 4px 24px rgba(0, 0, 0, 0.1), 0 0 40px ${color}10`,
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 20px 60px rgba(0, 0, 0, 0.3), 0 0 60px ${color}30, inset 0 1px 0 rgba(255, 255, 255, 0.2)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 24px rgba(0, 0, 0, 0.1), 0 0 40px ${color}10`;
      }}
    >
      {/* Medal/Badge with 3D effect */}
      <div className="flex justify-center mb-6">
        <div
          className="relative h-20 w-20 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${color}90 50%, ${color}70 100%)`,
            boxShadow: `
              0 8px 32px ${color}50,
              inset 0 2px 4px rgba(255,255,255,0.4),
              inset 0 -2px 4px rgba(0,0,0,0.2)
            `,
          }}
        >
          {/* Shine effect */}
          <div
            className="absolute inset-0 rounded-full opacity-50"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, transparent 100%)",
            }}
          />

          {/* Icon */}
          <div className="relative z-10">
            {renderIcon()}
          </div>

          {/* Animated glow ring */}
          <motion.div
            className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100"
            style={{ border: `2px solid ${color}` }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        </div>
      </div>

      {/* Label Info */}
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2" style={{ color }}>
          {label.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatScoreDisplay()}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Labels Section - 3D Showcase
 */
function LabelsSection({ labels, ratingScale }: { labels: CupLabel[]; ratingScale: string }) {
  const { theme } = usePortal();
  const publicLabels = labels.filter((label) => label.isPublic);

  if (publicLabels.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${theme.primaryColor}15`,
            boxShadow: `0 0 20px ${theme.primaryColor}20`,
          }}
        >
          <Award className="h-6 w-6" style={{ color: theme.primaryColor }} />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Labels & Récompenses</h2>
          <p className="text-muted-foreground text-sm">Les distinctions que vos produits peuvent obtenir</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {publicLabels.map((label, index) => (
          <LabelCard3D
            key={label.id}
            label={label}
            ratingScale={ratingScale}
            index={index}
          />
        ))}
      </div>
    </motion.section>
  );
}

/**
 * Results Section - Premium design with link to results page
 */
function ResultsSection({ cup }: { cup: Cup }) {
  const { theme, locale } = usePortal();

  if (cup.status !== "completed" || !cup.resultsPublishedAt) {
    return null;
  }

  const labels = {
    fr: {
      title: "Résultats publiés",
      subtitle: "Découvrez les lauréats et les produits primés",
      published: "Publiés le",
      viewResults: "Voir les résultats",
    },
    en: {
      title: "Results published",
      subtitle: "Discover the winners and awarded products",
      published: "Published on",
      viewResults: "View results",
    },
  };

  const t = labels[locale] ?? labels.fr;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-12"
    >
      <Link href={`/cups/${cup.id}/results`} className="block group">
        <div
          className="relative p-8 md:p-12 rounded-3xl overflow-hidden transition-all duration-300 group-hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            boxShadow: `0 8px 40px ${theme.primaryColor}30`,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl" />
          </div>

          {/* Animated trophy icons in background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
            <Trophy className="absolute top-8 right-8 h-32 w-32 text-white" />
            <Trophy className="absolute bottom-4 left-4 h-24 w-24 text-white rotate-12" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-white text-center md:text-left">
              <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                >
                  <Trophy className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">{t.title}</h2>
                  <p className="text-white/80 text-sm">
                    {t.published} {formatDate(cup.resultsPublishedAt)}
                  </p>
                </div>
              </div>
              <p className="text-white/90 text-lg">{t.subtitle}</p>
            </div>

            <Button
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-semibold shadow-xl px-8 py-6 text-lg group/btn"
            >
              {t.viewResults}
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </div>
        </div>
      </Link>
    </motion.section>
  );
}

/**
 * Registration CTA - Floating premium button
 */
function RegistrationCTA({ cup }: { cup: Cup }) {
  const { theme } = usePortal();

  if (cup.status !== "published") {
    return null;
  }

  return (
    <>
      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl border-t border-white/10 z-50 md:hidden"
        style={{ background: "rgba(0, 0, 0, 0.8)" }}
      >
        <Button
          size="lg"
          className="w-full font-semibold shadow-lg"
          style={{
            backgroundColor: theme.primaryColor,
            boxShadow: `0 4px 20px ${theme.primaryColor}40`,
          }}
          asChild
        >
          <Link href={`/cups/${cup.id}/register`}>
            S&apos;inscrire à cette cup
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>

      {/* Desktop CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="hidden md:block py-12"
      >
        <div
          className="relative p-8 md:p-12 rounded-3xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-white text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">
                Inscriptions ouvertes
              </h3>
              <p className="text-white/80 text-lg">
                {cup.registrationCloseAt
                  ? `Jusqu'au ${formatDate(cup.registrationCloseAt)}`
                  : "Inscrivez-vous dès maintenant"}
              </p>
            </div>
            <Button
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-semibold shadow-xl px-8 py-6 text-lg group"
              asChild
            >
              <Link href={`/cups/${cup.id}/register`}>
                S&apos;inscrire à cette cup
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/**
 * Main Cup Detail Content Component
 */
export function CupDetailContent({ cup }: CupDetailContentProps) {
  const { data: session } = useSession();
  const showResults = cup.status === "completed" && cup.resultsPublishedAt;
  const showPricing = !!session?.user;

  return (
    <div className="pb-24 md:pb-8">
      <HeroSection cup={cup} />

      <div className="container mx-auto py-8 space-y-4 px-4 sm:px-6 lg:px-8">
        {/* Show results banner prominently when results are published */}
        {showResults && <ResultsSection cup={cup} />}

        {/* Cup information */}
        <BentoInfoSection cup={cup} showPricing={showPricing} />
        <CategoriesSection categories={cup.categories} ratingScale={cup.ratingScale} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <RegistrationCTA cup={cup} />
      </div>
    </div>
  );
}
