"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Heart,
  History,
  Image as ImageIcon,
  Target,
  Star,
  Calendar,
  Trophy,
  UserCheck,
  Quote,
  ChevronLeft,
  ChevronRight,
  X,
  Linkedin,
  Twitter,
} from "lucide-react";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import type { TeamMember } from "~/server/db/schema/organization-about";
import type {
  HeroStyle,
  MissionStyle,
  ValuesDisplay,
  TeamCardSize,
  GalleryColumns,
  SectionStyle,
} from "~/server/db/schema/portal-about-settings";

// Extended team member type with optional social links
interface ExtendedTeamMember extends TeamMember {
  linkedin?: string | null;
  twitter?: string | null;
}

interface AboutSettings {
  heroStyle: HeroStyle;
  heroTagline: string | null;
  missionStyle: MissionStyle;
  valuesDisplay: ValuesDisplay;
  teamCardSize: TeamCardSize;
  showTeamSocialLinks: boolean;
  galleryColumns: GalleryColumns;
  enableGalleryLightbox: boolean;
  sectionStyle: SectionStyle;
  enableAnimations: boolean;
  showStats: boolean;
  statsYearFounded: string | null;
  statsCupsOrganized: string | null;
  statsJudgesCount: string | null;
  statsCustomLabel1: string | null;
  statsCustomValue1: string | null;
  statsCustomLabel2: string | null;
  statsCustomValue2: string | null;
}

interface AboutContentProps {
  history: string | null;
  mission: string | null;
  values: string | null;
  galleryImages: string[];
  teamMembers: TeamMember[];
  settings?: Partial<AboutSettings>;
}

// Default settings
const defaultSettings: AboutSettings = {
  heroStyle: "banner",
  heroTagline: null,
  missionStyle: "quote",
  valuesDisplay: "cards",
  teamCardSize: "large",
  showTeamSocialLinks: true,
  galleryColumns: "3",
  enableGalleryLightbox: true,
  sectionStyle: "alternating",
  enableAnimations: true,
  showStats: false,
  statsYearFounded: null,
  statsCupsOrganized: null,
  statsJudgesCount: null,
  statsCustomLabel1: null,
  statsCustomValue1: null,
  statsCustomLabel2: null,
  statsCustomValue2: null,
};

// Animation wrapper component
function AnimatedSection({
  children,
  enabled,
  delay = 0,
}: {
  children: React.ReactNode;
  enabled: boolean;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [enabled, delay]);

  if (!enabled) return <>{children}</>;

  return (
    <div
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {children}
    </div>
  );
}

// Hero Section Component
function HeroSection({
  style,
  tagline,
  enableAnimations,
}: {
  style: HeroStyle;
  tagline: string | null;
  enableAnimations: boolean;
}) {
  const { organization, theme } = usePortal();

  if (style === "none") return null;

  if (style === "minimal") {
    return (
      <AnimatedSection enabled={enableAnimations}>
        <div className="container mx-auto pt-8 pb-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight">{organization.name}</h1>
          {tagline && (
            <p className="mt-2 text-xl text-muted-foreground">{tagline}</p>
          )}
        </div>
      </AnimatedSection>
    );
  }

  // Banner style (default)
  return (
    <AnimatedSection enabled={enableAnimations}>
      <div
        className="relative py-16 md:py-24"
        style={{
          background: theme.bannerUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${theme.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          {organization.logo && (
            <img
              src={organization.logo}
              alt={organization.name}
              className="mx-auto h-20 w-20 rounded-full bg-white/10 p-2 mb-6 object-contain"
            />
          )}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {organization.name}
          </h1>
          {tagline && (
            <p className="mt-4 text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              {tagline}
            </p>
          )}
        </div>
      </div>
    </AnimatedSection>
  );
}

// Stats Section Component
function StatsSection({
  settings,
  enableAnimations,
}: {
  settings: AboutSettings;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();

  if (!settings.showStats) return null;

  const stats = [
    settings.statsYearFounded && {
      icon: Calendar,
      value: settings.statsYearFounded,
      label: "Fondée en",
    },
    settings.statsCupsOrganized && {
      icon: Trophy,
      value: settings.statsCupsOrganized,
      label: "Cups organisées",
    },
    settings.statsJudgesCount && {
      icon: UserCheck,
      value: settings.statsJudgesCount,
      label: "Jurés",
    },
    settings.statsCustomLabel1 &&
      settings.statsCustomValue1 && {
        icon: Star,
        value: settings.statsCustomValue1,
        label: settings.statsCustomLabel1,
      },
    settings.statsCustomLabel2 &&
      settings.statsCustomValue2 && {
        icon: Star,
        value: settings.statsCustomValue2,
        label: settings.statsCustomLabel2,
      },
  ].filter(Boolean) as Array<{
    icon: typeof Calendar;
    value: string;
    label: string;
  }>;

  if (stats.length === 0) return null;

  return (
    <AnimatedSection enabled={enableAnimations} delay={100}>
      <div
        className="py-8 border-y"
        style={{ borderColor: `${theme.primaryColor}20` }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <stat.icon
                  className="mx-auto h-8 w-8 mb-2"
                  style={{ color: theme.primaryColor }}
                />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// Mission Section Component
function MissionSection({
  content,
  style,
  sectionStyle,
  sectionIndex,
  enableAnimations,
}: {
  content: string;
  style: MissionStyle;
  sectionStyle: SectionStyle;
  sectionIndex: number;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();
  const isAlternating = sectionStyle === "alternating" && sectionIndex % 2 === 1;

  const sectionBg = isAlternating
    ? { backgroundColor: `${theme.primaryColor}05` }
    : {};

  if (style === "simple") {
    return (
      <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
        <section className="py-12" style={sectionBg}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold">Notre Mission</h2>
            </div>
            <p className="whitespace-pre-wrap text-muted-foreground max-w-4xl">
              {content}
            </p>
          </div>
        </section>
      </AnimatedSection>
    );
  }

  if (style === "card") {
    return (
      <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
        <section className="py-12" style={sectionBg}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="rounded-xl p-8 md:p-12 border"
              style={{
                borderColor: `${theme.primaryColor}30`,
                backgroundColor: `${theme.primaryColor}05`,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Target className="h-6 w-6" style={{ color: theme.primaryColor }} />
                <h2 className="text-2xl font-bold">Notre Mission</h2>
              </div>
              <p className="whitespace-pre-wrap text-lg text-muted-foreground">
                {content}
              </p>
            </div>
          </div>
        </section>
      </AnimatedSection>
    );
  }

  // Quote style (default)
  return (
    <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
      <section className="py-16" style={sectionBg}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Quote
              className="mx-auto h-12 w-12 mb-6 opacity-30"
              style={{ color: theme.primaryColor }}
            />
            <blockquote className="text-2xl md:text-3xl font-medium italic leading-relaxed">
              &ldquo;{content}&rdquo;
            </blockquote>
            <div
              className="mt-6 h-1 w-24 mx-auto rounded"
              style={{ backgroundColor: theme.primaryColor }}
            />
          </div>
        </div>
      </section>
    </AnimatedSection>
  );
}

// History Section Component
function HistorySection({
  content,
  sectionStyle,
  sectionIndex,
  enableAnimations,
}: {
  content: string;
  sectionStyle: SectionStyle;
  sectionIndex: number;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();
  const isAlternating = sectionStyle === "alternating" && sectionIndex % 2 === 1;

  const sectionBg = isAlternating
    ? { backgroundColor: `${theme.primaryColor}05` }
    : {};

  return (
    <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
      <section className="py-12" style={sectionBg}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <History className="h-5 w-5" style={{ color: theme.primaryColor }} />
            </div>
            <h2 className="text-2xl font-bold">Notre Histoire</h2>
          </div>
          <div className="prose prose-gray dark:prose-invert max-w-4xl">
            <p className="whitespace-pre-wrap text-muted-foreground">{content}</p>
          </div>
        </div>
      </section>
    </AnimatedSection>
  );
}

// Values Section Component
function ValuesSection({
  content,
  display,
  sectionStyle,
  sectionIndex,
  enableAnimations,
}: {
  content: string;
  display: ValuesDisplay;
  sectionStyle: SectionStyle;
  sectionIndex: number;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();
  const isAlternating = sectionStyle === "alternating" && sectionIndex % 2 === 1;

  const sectionBg = isAlternating
    ? { backgroundColor: `${theme.primaryColor}05` }
    : {};

  // Parse values from content (split by newlines or bullet points)
  const valueItems = content
    .split(/\n|•|•/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const valueIcons = [Star, Heart, Target, Users, Trophy] as const;

  if (display === "list") {
    return (
      <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
        <section className="py-12" style={sectionBg}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Heart className="h-5 w-5" style={{ color: theme.primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold">Nos Valeurs</h2>
            </div>
            <ul className="space-y-3 max-w-2xl">
              {valueItems.map((value, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Star
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: theme.primaryColor }}
                  />
                  <span className="text-muted-foreground">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </AnimatedSection>
    );
  }

  if (display === "grid") {
    return (
      <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
        <section className="py-12" style={sectionBg}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Heart className="h-5 w-5" style={{ color: theme.primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold">Nos Valeurs</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {valueItems.slice(0, 10).map((value, index) => {
                const IconComponent = valueIcons[index % valueIcons.length] ?? Star;
                return (
                  <div
                    key={index}
                    className="text-center p-4 rounded-lg"
                    style={{ backgroundColor: `${theme.primaryColor}10` }}
                  >
                    <IconComponent
                      className="mx-auto h-8 w-8 mb-2"
                      style={{ color: theme.primaryColor }}
                    />
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </AnimatedSection>
    );
  }

  // Cards display (default)
  return (
    <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
      <section className="py-12" style={sectionBg}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Heart className="h-5 w-5" style={{ color: theme.primaryColor }} />
            </div>
            <h2 className="text-2xl font-bold">Nos Valeurs</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {valueItems.slice(0, 6).map((value, index) => {
              const IconComponent = valueIcons[index % valueIcons.length] ?? Star;
              return (
                <div
                  key={index}
                  className="p-6 rounded-xl border transition-shadow hover:shadow-md"
                  style={{ borderColor: `${theme.primaryColor}20` }}
                >
                  <IconComponent
                    className="h-8 w-8 mb-4"
                    style={{ color: theme.primaryColor }}
                  />
                  <p className="font-medium">{value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AnimatedSection>
  );
}

// Team Section Component
function TeamSection({
  members,
  cardSize,
  showSocialLinks,
  sectionStyle,
  sectionIndex,
  enableAnimations,
}: {
  members: TeamMember[];
  cardSize: TeamCardSize;
  showSocialLinks: boolean;
  sectionStyle: SectionStyle;
  sectionIndex: number;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();
  const isAlternating = sectionStyle === "alternating" && sectionIndex % 2 === 1;

  const sectionBg = isAlternating
    ? { backgroundColor: `${theme.primaryColor}05` }
    : {};

  const isLarge = cardSize === "large";

  return (
    <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
      <section className="py-12" style={sectionBg}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
            </div>
            <h2 className="text-2xl font-bold">Notre Équipe</h2>
          </div>
          <div
            className={cn(
              "grid gap-6",
              isLarge
                ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                : "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            )}
          >
            {members.map((member, index) => (
              <TeamMemberCard
                key={member.id}
                member={member as ExtendedTeamMember}
                isLarge={isLarge}
                showSocialLinks={showSocialLinks}
                primaryColor={theme.primaryColor}
                delay={enableAnimations ? index * 50 : 0}
              />
            ))}
          </div>
        </div>
      </section>
    </AnimatedSection>
  );
}

// Team Member Card Component
function TeamMemberCard({
  member,
  isLarge,
  showSocialLinks,
  primaryColor,
  delay,
}: {
  member: ExtendedTeamMember;
  isLarge: boolean;
  showSocialLinks: boolean;
  primaryColor: string;
  delay: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center p-4 rounded-xl bg-muted/50 transition-all duration-300",
        isHovered && "shadow-lg -translate-y-1"
      )}
      style={isHovered ? { borderColor: primaryColor } : {}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {member.photo ? (
        <img
          src={member.photo}
          alt={member.name}
          className={cn(
            "rounded-full object-cover mb-4 transition-transform duration-300",
            isLarge ? "h-32 w-32" : "h-20 w-20",
            isHovered && "scale-105"
          )}
          style={{
            boxShadow: isHovered ? `0 0 0 3px ${primaryColor}30` : undefined,
          }}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center text-white font-bold mb-4 transition-transform duration-300",
            isLarge ? "h-32 w-32 text-3xl" : "h-20 w-20 text-xl",
            isHovered && "scale-105"
          )}
          style={{ backgroundColor: primaryColor }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
      )}
      <h3 className={cn("font-semibold", isLarge ? "text-lg" : "text-sm")}>
        {member.name}
      </h3>
      <p
        className={cn(
          "text-muted-foreground",
          isLarge ? "text-sm" : "text-xs"
        )}
      >
        {member.role}
      </p>
      {isLarge && member.bio && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
          {member.bio}
        </p>
      )}
      {showSocialLinks && (member.linkedin || member.twitter) && (
        <div className="flex gap-2 mt-3">
          {member.linkedin && (
            <a
              href={member.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          )}
          {member.twitter && (
            <a
              href={member.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Gallery Section Component
function GallerySection({
  images,
  columns,
  enableLightbox,
  sectionStyle,
  sectionIndex,
  enableAnimations,
}: {
  images: string[];
  columns: GalleryColumns;
  enableLightbox: boolean;
  sectionStyle: SectionStyle;
  sectionIndex: number;
  enableAnimations: boolean;
}) {
  const { theme } = usePortal();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isAlternating = sectionStyle === "alternating" && sectionIndex % 2 === 1;
  const sectionBg = isAlternating
    ? { backgroundColor: `${theme.primaryColor}05` }
    : {};

  const columnsClass = {
    "2": "sm:grid-cols-2",
    "3": "sm:grid-cols-2 md:grid-cols-3",
    "4": "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  }[columns];

  const openLightbox = (index: number) => {
    if (!enableLightbox) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const prevImage = () => {
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          prevImage();
          break;
        case "ArrowRight":
          nextImage();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  return (
    <>
      <AnimatedSection enabled={enableAnimations} delay={sectionIndex * 100}>
        <section className="py-12" style={sectionBg}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <ImageIcon
                  className="h-5 w-5"
                  style={{ color: theme.primaryColor }}
                />
              </div>
              <h2 className="text-2xl font-bold">Galerie</h2>
            </div>
            <div className={cn("grid gap-4", columnsClass)}>
              {images.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => openLightbox(index)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-lg bg-muted group relative",
                    enableLightbox && "cursor-pointer"
                  )}
                  disabled={!enableLightbox}
                >
                  <img
                    src={imageUrl}
                    alt={`Image ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {enableLightbox && (
                    <div
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
                      style={{ color: theme.primaryColor }}
                    >
                      <ImageIcon className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Lightbox */}
      {lightboxOpen && enableLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={closeLightbox}
          >
            <X className="h-8 w-8" />
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white hover:text-gray-300 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
              >
                <ChevronLeft className="h-12 w-12" />
              </button>
              <button
                className="absolute right-4 text-white hover:text-gray-300 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
              >
                <ChevronRight className="h-12 w-12" />
              </button>
            </>
          )}

          <img
            src={images[lightboxIndex]}
            alt={`Image ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 text-white text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}

// Main Component
export function PortalAboutContent({
  history,
  mission,
  values,
  galleryImages,
  teamMembers,
  settings: providedSettings,
}: AboutContentProps) {
  const { organization } = usePortal();
  const settings = { ...defaultSettings, ...providedSettings };

  const hasContent =
    history ||
    mission ||
    values ||
    galleryImages.length > 0 ||
    teamMembers.length > 0;

  if (!hasContent) {
    return (
      <div className="container mx-auto py-16 text-center px-4 sm:px-6 lg:px-8">
        <Users className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h2 className="mt-4 text-2xl font-bold">À propos de {organization.name}</h2>
        <p className="mt-2 text-muted-foreground">
          Contenu en cours de rédaction. Revenez bientôt pour en savoir plus sur
          notre organisation.
        </p>
      </div>
    );
  }

  // Track section index for alternating backgrounds
  let sectionIndex = 0;

  return (
    <div className="pb-8">
      {/* Hero Section */}
      <HeroSection
        style={settings.heroStyle}
        tagline={settings.heroTagline}
        enableAnimations={settings.enableAnimations}
      />

      {/* Stats Section */}
      <StatsSection
        settings={settings}
        enableAnimations={settings.enableAnimations}
      />

      {/* Mission Section */}
      {mission && (
        <MissionSection
          content={mission}
          style={settings.missionStyle}
          sectionStyle={settings.sectionStyle}
          sectionIndex={sectionIndex++}
          enableAnimations={settings.enableAnimations}
        />
      )}

      {/* History Section */}
      {history && (
        <HistorySection
          content={history}
          sectionStyle={settings.sectionStyle}
          sectionIndex={sectionIndex++}
          enableAnimations={settings.enableAnimations}
        />
      )}

      {/* Values Section */}
      {values && (
        <ValuesSection
          content={values}
          display={settings.valuesDisplay}
          sectionStyle={settings.sectionStyle}
          sectionIndex={sectionIndex++}
          enableAnimations={settings.enableAnimations}
        />
      )}

      {/* Team Section */}
      {teamMembers.length > 0 && (
        <TeamSection
          members={teamMembers}
          cardSize={settings.teamCardSize}
          showSocialLinks={settings.showTeamSocialLinks}
          sectionStyle={settings.sectionStyle}
          sectionIndex={sectionIndex++}
          enableAnimations={settings.enableAnimations}
        />
      )}

      {/* Gallery Section */}
      {galleryImages.length > 0 && (
        <GallerySection
          images={galleryImages}
          columns={settings.galleryColumns}
          enableLightbox={settings.enableGalleryLightbox}
          sectionStyle={settings.sectionStyle}
          sectionIndex={sectionIndex++}
          enableAnimations={settings.enableAnimations}
        />
      )}
    </div>
  );
}
