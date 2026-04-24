"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Tag,
  ArrowRight,
  Users,
  CheckCircle,
  Clock,
  Circle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { usePortal } from "~/lib/portal/context";
import { StatusBadge } from "./status-badge";
import { cn } from "~/lib/utils";

interface Cup {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  eventDate: Date | null;
  eventLocation: string | null;
  status: string;
  categoriesCount: number;
  registrationsCount: number;
  year?: number;
}

interface CupsTimelineProps {
  cups: Cup[];
  showYearHeaders?: boolean;
}

// Labels by locale
const timelineLabels = {
  fr: {
    upcoming: "À venir",
    inProgress: "En cours",
    completed: "Termin\u00e9",
    register: "S'inscrire",
    details: "D\u00e9tails",
    results: "R\u00e9sultats",
    categories: "cat\u00e9gories",
    participants: "participants",
  },
  en: {
    upcoming: "Upcoming",
    inProgress: "In progress",
    completed: "Completed",
    register: "Register",
    details: "Details",
    results: "Results",
    categories: "categories",
    participants: "participants",
  },
} as const;

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatMonth(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
  })
    .format(new Date(date))
    .toUpperCase();
}

function formatDay(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
  }).format(new Date(date));
}

function getTimelineStatus(status: string): "completed" | "active" | "upcoming" {
  switch (status) {
    case "completed":
      return "completed";
    case "published":
    case "rating":
      return "active";
    default:
      return "upcoming";
  }
}

/**
 * Timeline Item Component
 */
function TimelineItem({
  cup,
  index,
  isLast,
}: {
  cup: Cup;
  index: number;
  isLast: boolean;
}) {
  const { theme, locale } = usePortal();
  const labels = timelineLabels[locale] ?? timelineLabels.fr;
  const timelineStatus = getTimelineStatus(cup.status);
  const isActive = timelineStatus === "active";
  const isCompleted = timelineStatus === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative pl-8 md:pl-12"
    >
      {/* Timeline line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-3 md:left-5 top-8 w-0.5 h-full",
            isCompleted || isActive ? "bg-primary" : "bg-muted"
          )}
          style={
            isCompleted || isActive
              ? { backgroundColor: theme.primaryColor }
              : undefined
          }
        />
      )}

      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-0 md:left-2 top-2 flex items-center justify-center w-6 h-6 rounded-full border-2",
          isCompleted && "bg-primary border-primary",
          isActive && "bg-background border-primary",
          !isCompleted && !isActive && "bg-background border-muted"
        )}
        style={
          isCompleted || isActive
            ? { borderColor: theme.primaryColor, backgroundColor: isCompleted ? theme.primaryColor : undefined }
            : undefined
        }
      >
        {isCompleted ? (
          <CheckCircle className="h-4 w-4 text-white" />
        ) : isActive ? (
          <Circle
            className="h-3 w-3"
            style={{ fill: theme.primaryColor, color: theme.primaryColor }}
          />
        ) : (
          <Circle className="h-3 w-3 text-muted" />
        )}
      </div>

      {/* Content Card */}
      <div
        className={cn(
          "rounded-xl border p-4 md:p-6 transition-all hover:shadow-lg",
          isActive && "border-primary shadow-md",
          isCompleted && "bg-muted/30"
        )}
        style={isActive ? { borderColor: theme.primaryColor } : undefined}
      >
        {/* Date Badge */}
        {cup.eventDate && (
          <div className="flex items-start gap-4 mb-4">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-muted-foreground">
                {formatMonth(cup.eventDate)}
              </span>
              <span className="text-2xl font-bold">{formatDay(cup.eventDate)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={cup.status} size="sm" />
                {isActive && (
                  <Badge
                    variant="outline"
                    className="animate-pulse"
                    style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
                  >
                    {labels.inProgress}
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-bold">{cup.name}</h3>
            </div>
          </div>
        )}

        {/* Description */}
        {cup.description && (
          <p className="text-muted-foreground mb-4 line-clamp-2">
            {cup.description}
          </p>
        )}

        {/* Info Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {cup.eventLocation && (
            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{cup.eventLocation}</span>
            </div>
          )}
          {cup.categoriesCount > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              <span>
                {cup.categoriesCount} {labels.categories}
              </span>
            </div>
          )}
          {cup.registrationsCount > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {cup.registrationsCount} {labels.participants}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {isActive && cup.status === "published" && (
            <Button
              size="sm"
              asChild
              style={{ backgroundColor: theme.primaryColor }}
            >
              <Link href={`/cups/${cup.id}/register`}>
                {labels.register}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
          {isCompleted && (
            <Button
              size="sm"
              variant="outline"
              asChild
              style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
            >
              <Link href={`/cups/${cup.id}/results`}>{labels.results}</Link>
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/cups/${cup.id}`}>{labels.details}</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Cups Timeline Component - Story 12.10
 * Timeline view for cups with visual progression
 */
export function CupsTimeline({ cups, showYearHeaders = true }: CupsTimelineProps) {
  const { locale } = usePortal();

  if (cups.length === 0) {
    return null;
  }

  // Group cups by year if showYearHeaders is true
  const groupedCups: Record<number, Cup[]> = showYearHeaders
    ? cups.reduce(
        (acc, cup) => {
          const year = cup.eventDate
            ? new Date(cup.eventDate).getFullYear()
            : new Date().getFullYear();
          if (!acc[year]) {
            acc[year] = [];
          }
          acc[year].push(cup);
          return acc;
        },
        {} as Record<number, Cup[]>
      )
    : { 0: cups };

  const years = Object.keys(groupedCups)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-12">
      {years.map((year) => {
        const yearCups: Cup[] = groupedCups[year] ?? [];
        return (
          <div key={year}>
            {/* Year Header */}
            {showYearHeaders && year !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-6"
              >
                <h3 className="text-2xl font-bold text-muted-foreground">{year}</h3>
              </motion.div>
            )}

            {/* Timeline Items */}
            <div className="space-y-6">
              {yearCups.map((cup: Cup, index: number) => (
                <TimelineItem
                  key={cup.id}
                  cup={cup}
                  index={index}
                  isLast={index === yearCups.length - 1}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
