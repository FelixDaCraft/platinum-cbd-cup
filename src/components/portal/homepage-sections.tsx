"use client";

import { usePortal } from "~/lib/portal/context";
import { StatsSection } from "./stats-section";
import { CurrentCupSection } from "./current-cup-section";
import { HallOfFameSection } from "./hall-of-fame-section";
import { SponsorsMarquee } from "./sponsors-marquee";
import { TestimonialsSection } from "./testimonials-section";
import { CtaSection } from "./cta-section";
import { PortalCupsSection } from "./portal-cups-section";

/**
 * Section configuration from database
 */
interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

/**
 * Default sections configuration
 * Matches order from sections-manager.tsx AVAILABLE_SECTIONS
 */
const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "current-cup", enabled: true, order: 0 },
  { id: "sponsors-marquee", enabled: true, order: 1 },
  { id: "hall-of-fame", enabled: true, order: 2 },
  { id: "stats", enabled: true, order: 3 },
  { id: "cups", enabled: true, order: 4 },
  { id: "testimonials", enabled: false, order: 5 },
  { id: "cta", enabled: true, order: 6 },
];

interface HomepageSectionsProps {
  // Data props passed from server component
  nextCup: {
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
  } | null;
  organizationStats: {
    totalCups: number;
    totalProducts: number;
    totalWinners: number;
  };
  latestWinners: Array<{
    productId: string;
    productName: string;
    producerName: string;
    cupId: string;
    cupName: string;
    cupRatingScale: string | null;
    categoryName: string;
    labelName: string;
    labelColor: string | null;
    score: string | null;
    rank: number;
  }>;
  sponsors: Array<{
    id: string;
    name: string;
    logo: string | null;
    tier: string | null;
    website: string | null;
  }>;
  testimonials: Array<{
    id: string;
    author: string;
    role: string;
    company?: string;
    content: string;
    rating?: number;
    avatarUrl?: string | null;
  }>;
  cups: Array<{
    id: string;
    name: string;
    description: string | null;
    bannerUrl: string | null;
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
    ratingEndAt: Date | null;
    eventDate: Date | null;
    eventLocation: string | null;
    status: string;
    categoriesCount: number;
    registrationsCount: number;
  }>;
}

/**
 * Homepage Sections Component - Story 12.18
 * Renders homepage sections based on configuration
 */
export function HomepageSections({
  nextCup,
  organizationStats,
  latestWinners,
  sponsors,
  testimonials,
  cups,
}: HomepageSectionsProps) {
  const { theme } = usePortal();

  // Parse sections configuration from theme
  let sections: SectionConfig[] = DEFAULT_SECTIONS;

  if (theme.homepageSections) {
    try {
      const parsed = JSON.parse(theme.homepageSections) as SectionConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        sections = parsed.sort((a, b) => a.order - b.order);
      }
    } catch {
      // Invalid JSON, use defaults
    }
  }

  // Render sections based on configuration
  return (
    <>
      {sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.id) {
            case "current-cup":
              return <CurrentCupSection key={section.id} cup={nextCup} />;
            case "stats":
              return <StatsSection key={section.id} stats={organizationStats} />;
            case "hall-of-fame":
              return <HallOfFameSection key={section.id} winners={latestWinners} />;
            case "sponsors-marquee":
              return <SponsorsMarquee key={section.id} sponsors={sponsors} />;
            case "testimonials":
              return <TestimonialsSection key={section.id} testimonials={testimonials} />;
            case "cups":
              return <PortalCupsSection key={section.id} cups={cups} />;
            case "cta":
              return <CtaSection key={section.id} />;
            default:
              return null;
          }
        })}
    </>
  );
}
