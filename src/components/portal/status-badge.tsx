"use client";

import { cn } from "~/lib/utils";

type CupStatus =
  | "draft"
  | "published"
  | "registration_closed"
  | "rating"
  | "completed";

interface StatusBadgeProps {
  status: string;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig: Record<
  CupStatus,
  { label: string; icon: string; bgClass: string; textClass: string }
> = {
  published: {
    label: "Inscriptions ouvertes",
    icon: "🔥",
    bgClass: "bg-green-500/20",
    textClass: "text-green-600 dark:text-green-400",
  },
  registration_closed: {
    label: "Inscriptions fermées",
    icon: "⏸️",
    bgClass: "bg-yellow-500/20",
    textClass: "text-yellow-600 dark:text-yellow-400",
  },
  rating: {
    label: "Notation en cours",
    icon: "⭐",
    bgClass: "bg-blue-500/20",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "Terminée",
    icon: "🏆",
    bgClass: "bg-gray-500/20",
    textClass: "text-gray-600 dark:text-gray-400",
  },
  draft: {
    label: "Brouillon",
    icon: "📝",
    bgClass: "bg-gray-500/20",
    textClass: "text-gray-600 dark:text-gray-400",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function StatusBadge({
  status,
  animate = false,
  size = "md",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status as CupStatus] ?? {
    label: status,
    icon: "📋",
    bgClass: "bg-gray-500/20",
    textClass: "text-gray-600 dark:text-gray-400",
  };

  const shouldAnimate = animate && status === "published";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.bgClass,
        config.textClass,
        sizeClasses[size],
        shouldAnimate && "animate-pulse",
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Minimal version just showing the dot indicator
 */
export function StatusDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const colorClass =
    {
      published: "bg-green-500",
      registration_closed: "bg-yellow-500",
      rating: "bg-blue-500",
      completed: "bg-gray-400",
      draft: "bg-gray-400",
    }[status] ?? "bg-gray-400";

  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", colorClass, className)}
    />
  );
}
