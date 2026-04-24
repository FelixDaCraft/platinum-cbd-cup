"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Trophy, Users, Award, Calendar, type LucideIcon } from "lucide-react";
import { usePortal } from "~/lib/portal/context";

interface StatsSectionProps {
  stats: {
    totalCups: number;
    totalProducts: number;
    totalWinners: number;
    yearsActive?: number;
  };
}

// Labels by locale
const sectionLabels = {
  fr: {
    title: "Nos Chiffres Cl\u00e9s",
    subtitle: "L'excellence en chiffres",
    cups: "Concours organis\u00e9s",
    products: "Produits pr\u00e9sent\u00e9s",
    winners: "Produits prim\u00e9s",
    years: "Ann\u00e9es d'exp\u00e9rience",
  },
  en: {
    title: "Key Figures",
    subtitle: "Excellence in numbers",
    cups: "Competitions organized",
    products: "Products presented",
    winners: "Awarded products",
    years: "Years of experience",
  },
} as const;

/**
 * Animated Counter Hook
 */
function useAnimatedCounter(end: number, duration: number = 2000, inView: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, inView]);

  return count;
}

/**
 * Single Stat Card with animated counter
 */
function StatCard({
  value,
  label,
  icon: Icon,
  color,
  index,
  inView,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  color: string;
  index: number;
  inView: boolean;
}) {
  const animatedValue = useAnimatedCounter(value, 2000, inView);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex flex-col items-center text-center p-8 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-105 backdrop-blur-md"
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full mb-5 backdrop-blur-sm"
        style={{
          backgroundColor: `${color}20`,
          boxShadow: `0 0 20px ${color}30`,
        }}
      >
        <Icon className="h-8 w-8" style={{ color }} />
      </div>
      <span className="text-5xl md:text-6xl font-bold mb-3">{animatedValue.toLocaleString()}</span>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </motion.div>
  );
}

/**
 * Stats Section - Story 12.7
 * Animated key statistics with counters
 */
export function StatsSection({ stats }: StatsSectionProps) {
  const { theme, locale } = usePortal();
  const labels = sectionLabels[locale] ?? sectionLabels.fr;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const statItems: Array<{
    value: number;
    label: string;
    icon: LucideIcon;
    color: string;
  }> = [
    {
      value: stats.totalCups,
      label: labels.cups,
      icon: Trophy,
      color: theme.primaryColor,
    },
    {
      value: stats.totalProducts,
      label: labels.products,
      icon: Users,
      color: theme.secondaryColor,
    },
    {
      value: stats.totalWinners,
      label: labels.winners,
      icon: Award,
      color: theme.primaryColor,
    },
  ];

  // Add years if available
  if (stats.yearsActive) {
    statItems.push({
      value: stats.yearsActive,
      label: labels.years,
      icon: Calendar,
      color: theme.secondaryColor,
    });
  }

  return (
    <section ref={ref} className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            {labels.title}
          </h2>
          <p className="text-muted-foreground">{labels.subtitle}</p>
        </motion.div>

        {/* Stats Grid - centered */}
        <div className="flex flex-wrap justify-center gap-6">
          {statItems.map((stat, index) => (
            <div key={stat.label} className="w-full sm:w-[calc(50%-12px)] lg:w-[280px]">
              <StatCard
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
                color={stat.color}
                index={index}
                inView={inView}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
