"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Tag,
  ArrowRight,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { StatusBadge } from "./status-badge";
import { CountdownTimer } from "./countdown-timer";

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
}

interface CurrentCupSectionProps {
  cup: Cup | null;
}

// Labels by locale
const sectionLabels = {
  fr: {
    title: "Cup en cours",
    subtitle: "Inscrivez-vous d\u00e8s maintenant !",
    register: "S'inscrire",
    details: "Voir les d\u00e9tails",
    participants: "participants",
    categories: "cat\u00e9gories",
    registrationDeadline: "Fin des inscriptions",
    noCup: "Pas de cup active",
    noCupDesc: "Aucun concours n'est actuellement ouvert aux inscriptions. Restez \u00e0 l'\u00e9coute !",
    viewAll: "Voir toutes les cups",
  },
  en: {
    title: "Current Cup",
    subtitle: "Register now!",
    register: "Register",
    details: "View details",
    participants: "participants",
    categories: "categories",
    registrationDeadline: "Registration deadline",
    noCup: "No active cup",
    noCupDesc: "No competition is currently open for registration. Stay tuned!",
    viewAll: "View all cups",
  },
} as const;

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Current Cup Section - Story 12.4
 * Prominently displays the active cup with registration open
 */
export function CurrentCupSection({ cup }: CurrentCupSectionProps) {
  const { theme, locale } = usePortal();
  const labels = sectionLabels[locale] ?? sectionLabels.fr;

  // If no active cup, show a subtle "no cup" message
  if (!cup || cup.status !== "published") {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4"
                style={{ backgroundColor: `${theme.primaryColor}15` }}
              >
                <Clock className="h-8 w-8" style={{ color: theme.primaryColor }} />
              </div>
              <h3 className="text-xl font-semibold text-muted-foreground">
                {labels.noCup}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                {labels.noCupDesc}
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/cups">
                  {labels.viewAll}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  const hasRegistrationDeadline = cup.registrationCloseAt;

  return (
    <section className="py-16 md:py-24 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
            <span
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: theme.primaryColor }}
            >
              {labels.title}
            </span>
            <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            {labels.subtitle}
          </h2>
        </motion.div>

        {/* Featured Cup Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            {/* Background */}
            <div className="relative min-h-[400px] md:min-h-[500px]">
              {cup.bannerUrl ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${cup.bannerUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
                </>
              ) : (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30" />
                </>
              )}

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col md:flex-row items-center justify-between p-8 md:p-12 lg:p-16 gap-8">
                {/* Left: Cup Info */}
                <div className="flex-1 text-white text-center md:text-left">
                  {/* Status Badge */}
                  <div className="mb-4">
                    <StatusBadge status={cup.status} animate size="lg" />
                  </div>

                  {/* Cup Name */}
                  <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 drop-shadow-lg">
                    {cup.name}
                  </h3>

                  {/* Description */}
                  {cup.description && (
                    <p className="text-lg text-white/90 mb-6 max-w-xl line-clamp-2">
                      {cup.description}
                    </p>
                  )}

                  {/* Info Pills */}
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-8">
                    {cup.eventDate && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDate(cup.eventDate)}</span>
                      </div>
                    )}
                    {cup.eventLocation && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{cup.eventLocation}</span>
                      </div>
                    )}
                    {cup.categoriesCount > 0 && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                        <Tag className="h-4 w-4" />
                        <span>
                          {cup.categoriesCount} {labels.categories}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Social Proof */}
                  {cup.registrationsCount > 0 && (
                    <p className="text-white/80 text-sm mb-6">
                      <Users className="inline h-4 w-4 mr-1" />
                      <span className="font-semibold text-white">
                        {cup.registrationsCount}
                      </span>{" "}
                      {labels.participants}
                    </p>
                  )}

                  {/* CTAs */}
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <Button
                      size="lg"
                      asChild
                      className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg px-8"
                    >
                      <Link href={`/cups/${cup.id}/register`}>
                        {labels.register}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      asChild
                      className="border-white/50 text-white hover:bg-white/10"
                    >
                      <Link href={`/cups/${cup.id}`}>{labels.details}</Link>
                    </Button>
                  </div>
                </div>

                {/* Right: Countdown Timer */}
                {hasRegistrationDeadline && (
                  <div className="flex-shrink-0">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 text-center">
                      <p className="text-white/80 text-sm mb-4 font-medium">
                        {labels.registrationDeadline}
                      </p>
                      <CountdownTimer
                        targetDate={new Date(cup.registrationCloseAt!)}
                        className="text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Decorative gradient blur */}
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-30 -z-10"
            style={{ backgroundColor: theme.primaryColor }}
          />
          <div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20 -z-10"
            style={{ backgroundColor: theme.secondaryColor }}
          />
        </motion.div>
      </div>
    </section>
  );
}
