"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Tag,
  Trophy,
  Users,
  Award,
  Store,
  Handshake,
  Newspaper,
  Wine,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { StatusBadge } from "./status-badge";
import { CountdownTimer } from "./countdown-timer";

/**
 * Subtle wave pattern for hero backgrounds
 */
function WavePattern() {
  return (
    <div className="absolute inset-0 opacity-10">
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 560"
        fill="none"
      >
        <path
          d="M0 336L48 352C96 368 192 400 288 416C384 432 480 432 576 400C672 368 768 304 864 288C960 272 1056 304 1152 336C1248 368 1344 400 1392 416L1440 432V560H1392C1344 560 1248 560 1152 560C1056 560 960 560 864 560C768 560 672 560 576 560C480 560 384 560 288 560C192 560 96 560 48 560H0V336Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

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

interface OrganizationStats {
  totalCups: number;
  totalProducts: number;
  totalWinners: number;
}

interface PortalHeroProps {
  nextCup?: Cup | null;
  organizationStats?: OrganizationStats;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

// Persona card labels by locale
const personaLabels = {
  fr: {
    title: "Vous \u00eates...",
    producer: "Producteur",
    producerDesc: "Participez \u00e0 nos concours et faites reconna\u00eetre vos produits",
    store: "Magasin",
    storeDesc: "D\u00e9couvrez les produits prim\u00e9s pour votre boutique",
    sponsor: "Sponsor",
    sponsorDesc: "Associez votre marque \u00e0 nos \u00e9v\u00e9nements",
    press: "Presse",
    pressDesc: "Acc\u00e9dez aux communiqu\u00e9s et r\u00e9sultats",
  },
  en: {
    title: "You are...",
    producer: "Producer",
    producerDesc: "Participate in our competitions and get your products recognized",
    store: "Retailer",
    storeDesc: "Discover award-winning products for your store",
    sponsor: "Sponsor",
    sponsorDesc: "Associate your brand with our events",
    press: "Press",
    pressDesc: "Access press releases and results",
  },
} as const;

/**
 * Portal Hero Component - Story 12.2
 * Supports 4 templates: personas, immersive, story-stats, minimalist
 */
export function PortalHero({ nextCup, organizationStats }: PortalHeroProps) {
  const { theme, locale } = usePortal();
  const heroTemplate = theme.heroTemplate ?? "personas";

  // Helper to extract YouTube video ID
  const getYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  // Check if URL is a YouTube video
  const isYouTubeUrl = (url: string): boolean => {
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  // Get background based on configuration
  const getBackground = () => {
    switch (theme.heroMediaType) {
      case "video":
        const videoUrl = theme.heroMediaUrl ?? "";

        // Handle YouTube videos
        if (isYouTubeUrl(videoUrl)) {
          const youtubeId = getYouTubeId(videoUrl);
          if (youtubeId) {
            return (
              <>
                <div className="absolute inset-0 overflow-hidden">
                  <iframe
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] min-w-[100vw] min-h-[100vh] pointer-events-none"
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title="Hero video"
                  />
                </div>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${theme.heroOverlayOpacity})`,
                  }}
                />
              </>
            );
          }
        }

        // Handle direct video files (.mp4, etc.)
        return (
          <>
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${theme.heroOverlayOpacity})`,
              }}
            />
          </>
        );
      case "image":
        if (theme.heroMediaUrl) {
          return (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${theme.heroMediaUrl})` }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${theme.heroOverlayOpacity})`,
                }}
              />
            </>
          );
        }
        // Fallback to gradient
        return (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
              }}
            />
            <WavePattern />
            <div className="absolute inset-0 bg-black/20" />
          </>
        );
      case "color":
      default:
        return (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
              }}
            />
            <WavePattern />
            <div className="absolute inset-0 bg-black/20" />
          </>
        );
    }
  };

  switch (heroTemplate) {
    case "personas":
      return <PersonasHero nextCup={nextCup} organizationStats={organizationStats} getBackground={getBackground} />;
    case "immersive":
      return <ImmersiveHero nextCup={nextCup} organizationStats={organizationStats} getBackground={getBackground} />;
    case "story-stats":
      return <StoryStatsHero organizationStats={organizationStats} getBackground={getBackground} />;
    case "minimalist":
      return <MinimalistHero getBackground={getBackground} />;
    default:
      return <PersonasHero nextCup={nextCup} organizationStats={organizationStats} getBackground={getBackground} />;
  }
}

interface HeroVariantProps {
  nextCup?: Cup | null;
  organizationStats?: OrganizationStats;
  getBackground: () => React.ReactNode;
}

/**
 * Personas Hero: "Vous \u00eates..." with 4 persona cards
 */
function PersonasHero({ nextCup, getBackground }: HeroVariantProps) {
  const { organization, theme, locale } = usePortal();
  const labels = personaLabels[locale] ?? personaLabels.fr;

  const personas = [
    {
      icon: Wine,
      label: labels.producer,
      description: labels.producerDesc,
      href: "/cups",
      color: theme.primaryColor,
    },
    {
      icon: Store,
      label: labels.store,
      description: labels.storeDesc,
      href: "/palmares",
      color: theme.secondaryColor,
    },
    {
      icon: Handshake,
      label: labels.sponsor,
      description: labels.sponsorDesc,
      href: "/sponsors",
      color: theme.primaryColor,
    },
    {
      icon: Newspaper,
      label: labels.press,
      description: labels.pressDesc,
      href: "/press",
      color: theme.secondaryColor,
    },
  ];

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {getBackground()}

      <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-6xl text-center text-white">
          {/* Title from config or default */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl drop-shadow-lg"
          >
            {theme.heroTitle ?? `Bienvenue chez ${organization.name}`}
          </motion.h1>

          {theme.heroSubtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-lg text-white/90 md:text-xl max-w-2xl mx-auto"
            >
              {theme.heroSubtitle}
            </motion.p>
          )}

          {/* Persona Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12"
          >
            <p className="text-2xl font-semibold mb-8">{labels.title}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {personas.map((persona, index) => {
                const Icon = persona.icon;
                return (
                  <motion.div
                    key={persona.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  >
                    <Link href={persona.href}>
                      <div className="group flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm p-6 transition-all hover:bg-white/20 hover:scale-105">
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${persona.color}40` }}
                        >
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <span className="mt-4 text-xl font-bold">{persona.label}</span>
                        <span className="mt-2 text-sm text-white/80 line-clamp-2">
                          {persona.description}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* CTA Button */}
          {theme.heroCtaText && theme.heroCtaUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-12"
            >
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg"
              >
                <Link href={theme.heroCtaUrl}>{theme.heroCtaText}</Link>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Immersive Hero: Full-screen video/image with overlay, cup-focused
 */
function ImmersiveHero({ nextCup, organizationStats, getBackground }: HeroVariantProps) {
  const { organization, theme, locale } = usePortal();

  // Determine background: prioritize configured media over cup banner
  const renderBackground = () => {
    // If user explicitly selected "color" (gradient), use that
    if (theme.heroMediaType === "color") {
      return getBackground();
    }
    // If user configured a video or image with URL, use that
    if (theme.heroMediaUrl && (theme.heroMediaType === "video" || theme.heroMediaType === "image")) {
      return getBackground();
    }
    // Fallback to cup banner if available (only when no explicit choice made)
    if (nextCup?.bannerUrl) {
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${nextCup.bannerUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
        </>
      );
    }
    // Default gradient background
    return getBackground();
  };

  // Check if organizer has configured custom content
  const hasCustomContent = theme.heroTitle || theme.heroSubtitle;

  // If organizer configured custom content, show that instead of cup info
  if (hasCustomContent) {
    return (
      <section className="relative h-[calc(100vh+5rem)] -mt-20 flex items-center overflow-hidden">
        {renderBackground()}

        <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-20 py-16">
          <div className="mx-auto max-w-4xl text-center text-white">
            {/* Custom Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl drop-shadow-lg"
            >
              {theme.heroTitle ?? organization.name}
            </motion.h1>

            {/* Custom Subtitle */}
            {theme.heroSubtitle && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-6 text-xl text-white/90 md:text-2xl max-w-2xl mx-auto"
              >
                {theme.heroSubtitle}
              </motion.p>
            )}

            {/* Custom CTA */}
            {theme.heroCtaText && theme.heroCtaUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-12"
              >
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg px-10 py-6 text-lg"
                >
                  <Link href={theme.heroCtaUrl}>{theme.heroCtaText}</Link>
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // If there's a next cup with open registrations, show cup-focused content
  if (nextCup) {
    const isRegistrationOpen = nextCup.status === "published";
    const hasRegistrationDeadline = nextCup.registrationCloseAt && isRegistrationOpen;

    return (
      <section className="relative h-[calc(100vh+5rem)] -mt-20 flex items-center overflow-hidden">
        {/* Background - Configured media > Cup banner > Gradient */}
        {renderBackground()}

        <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-20 py-16">
          <div className="mx-auto max-w-4xl text-center text-white">
            {/* Status Badge with animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6 flex justify-center"
            >
              <StatusBadge
                status={nextCup.status}
                animate={isRegistrationOpen}
                size="lg"
                className="shadow-lg"
              />
            </motion.div>

            {/* Cup Name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl drop-shadow-lg"
            >
              {nextCup.name}
            </motion.h1>

            {/* Description */}
            {nextCup.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-6 text-lg text-white/90 md:text-xl max-w-2xl mx-auto"
              >
                {nextCup.description}
              </motion.p>
            )}

            {/* Event Info Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              {nextCup.eventDate && (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatDate(nextCup.eventDate)}</span>
                </div>
              )}
              {nextCup.eventLocation && (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{nextCup.eventLocation}</span>
                </div>
              )}
              {nextCup.categoriesCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm">
                  <Tag className="h-4 w-4" />
                  <span>
                    {nextCup.categoriesCount} catégorie{nextCup.categoriesCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Countdown Timer */}
            {hasRegistrationDeadline && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-6 flex justify-center"
              >
                <CountdownTimer
                  targetDate={new Date(nextCup.registrationCloseAt!)}
                  label="Fin des inscriptions"
                  className="shadow-lg"
                />
              </motion.div>
            )}

            {/* Social Proof */}
            {nextCup.registrationsCount > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-6 text-white/80 text-sm"
              >
                <Users className="inline h-4 w-4 mr-1" />
                Rejoignez les{" "}
                <span className="font-semibold text-white">
                  {nextCup.registrationsCount} producteur
                  {nextCup.registrationsCount > 1 ? "s" : ""}
                </span>{" "}
                d\u00e9j\u00e0 inscrit{nextCup.registrationsCount > 1 ? "s" : ""}
              </motion.p>
            )}

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              {isRegistrationOpen ? (
                <>
                  <Button
                    size="lg"
                    asChild
                    className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg px-8"
                  >
                    <Link href={`/cups/${nextCup.id}/register`}>
                      S&apos;inscrire maintenant
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-white text-white hover:bg-white/10"
                  >
                    <Link href={`/cups/${nextCup.id}`}>Voir les d\u00e9tails</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    asChild
                    className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg"
                  >
                    <Link href={`/cups/${nextCup.id}`}>Voir les d\u00e9tails</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-white text-white hover:bg-white/10"
                  >
                    <Link href="/cups">Toutes les cups</Link>
                  </Button>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  // No cup - Show generic immersive hero with custom content
  return (
    <section className="relative h-[calc(100vh+5rem)] -mt-20 flex items-center overflow-hidden">
      {getBackground()}

      <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-20 py-16">
        <div className="mx-auto max-w-4xl text-center text-white">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl drop-shadow-lg"
          >
            {theme.heroTitle ?? organization.name}
          </motion.h1>

          {theme.heroSubtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-xl text-white/90 md:text-2xl max-w-2xl mx-auto"
            >
              {theme.heroSubtitle}
            </motion.p>
          )}

          {theme.heroCtaText && theme.heroCtaUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-12"
            >
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg px-10 py-6 text-lg"
              >
                <Link href={theme.heroCtaUrl}>{theme.heroCtaText}</Link>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Story Stats Hero: Split layout with stats
 */
function StoryStatsHero({ organizationStats, getBackground }: Omit<HeroVariantProps, "nextCup">) {
  const { organization, theme } = usePortal();
  const stats = organizationStats ?? { totalCups: 0, totalProducts: 0, totalWinners: 0 };

  return (
    <section className="relative min-h-[70vh] flex items-center overflow-hidden">
      {getBackground()}

      <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white"
          >
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl drop-shadow-lg">
              {theme.heroTitle ?? `Bienvenue chez ${organization.name}`}
            </h1>

            <p className="mt-6 text-lg text-white/90 md:text-xl">
              {theme.heroSubtitle ??
                "D\u00e9couvrez nos concours, participez \u00e0 nos \u00e9v\u00e9nements et rejoignez notre communaut\u00e9 de passionn\u00e9s."}
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg"
              >
                <Link href={theme.heroCtaUrl ?? "/cups"}>
                  {theme.heroCtaText ?? "D\u00e9couvrir nos cups"}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white text-white hover:bg-white/10"
              >
                <Link href="/palmares">Voir les r\u00e9sultats</Link>
              </Button>
            </div>
          </motion.div>

          {/* Right: Stats Cards */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid gap-6 sm:grid-cols-2"
          >
            <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm p-6 col-span-2 sm:col-span-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="mt-4 text-4xl font-bold text-white"
              >
                {stats.totalCups}
              </motion.span>
              <span className="mt-1 text-sm text-white/80">Concours organis\u00e9s</span>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm p-6 col-span-2 sm:col-span-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <Users className="h-7 w-7 text-white" />
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="mt-4 text-4xl font-bold text-white"
              >
                {stats.totalProducts}
              </motion.span>
              <span className="mt-1 text-sm text-white/80">Produits pr\u00e9sent\u00e9s</span>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm p-6 col-span-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <Award className="h-7 w-7 text-white" />
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.7 }}
                className="mt-4 text-4xl font-bold text-white"
              >
                {stats.totalWinners}
              </motion.span>
              <span className="mt-1 text-sm text-white/80">Produits prim\u00e9s</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Minimalist Hero: Large logo + tagline
 */
function MinimalistHero({ getBackground }: { getBackground: () => React.ReactNode }) {
  const { organization, theme } = usePortal();

  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      {getBackground()}

      <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-2xl text-center text-white">
          {/* Large Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            {theme.logoUrl ? (
              <img
                src={theme.logoUrl}
                alt={organization.name}
                className="h-32 w-auto object-contain md:h-40 drop-shadow-2xl"
              />
            ) : (
              <div
                className="flex h-32 w-32 items-center justify-center rounded-2xl text-white font-bold text-6xl shadow-2xl md:h-40 md:w-40 md:text-7xl"
                style={{ backgroundColor: theme.primaryColor }}
              >
                {organization.name.charAt(0)}
              </div>
            )}
          </motion.div>

          {/* Organization Name */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl drop-shadow-lg"
          >
            {theme.heroTitle ?? organization.name}
          </motion.h1>

          {/* Tagline */}
          {theme.heroSubtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-4 text-lg text-white/90 md:text-xl"
            >
              {theme.heroSubtitle}
            </motion.p>
          )}

          {/* Single CTA */}
          {theme.heroCtaText && theme.heroCtaUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10"
            >
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg"
              >
                <Link href={theme.heroCtaUrl}>{theme.heroCtaText}</Link>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
