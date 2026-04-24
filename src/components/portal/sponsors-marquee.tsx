"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { usePortal } from "~/lib/portal/context";

interface Sponsor {
  id: string;
  name: string;
  logo: string | null;
  tier: string | null;
  website: string | null;
}

interface SponsorsMarqueeProps {
  sponsors: Sponsor[];
}

// Labels by locale
const marqueeLabels = {
  fr: {
    title: "Ils nous font confiance",
    becomePartner: "Devenir partenaire",
  },
  en: {
    title: "They trust us",
    becomePartner: "Become a partner",
  },
} as const;

/**
 * Sponsors Marquee Component - Story 12.5
 * Auto-scrolling banner of sponsor logos - Full width infinite scroll
 */
export function SponsorsMarquee({ sponsors }: SponsorsMarqueeProps) {
  const { theme, locale } = usePortal();
  const labels = marqueeLabels[locale] ?? marqueeLabels.fr;

  // Don't render if no sponsors
  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  // Repeat sponsors to fill the viewport (minimum 8 items for good visual)
  const minItems = 8;
  const repeatCount = Math.ceil(minItems / sponsors.length);
  const repeatedSponsors = Array.from({ length: repeatCount }, () => sponsors).flat();

  // Calculate animation duration based on number of items
  const animationDuration = Math.max(15, repeatedSponsors.length * 3);

  return (
    <section className="py-16 md:py-20">
      {/* Badge Premium Title */}
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border border-white/10"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          }}
        >
          <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
          <span className="text-base font-semibold tracking-wide">
            {labels.title}
          </span>
          <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
        </div>
      </div>

      {/* Full-width Marquee Container */}
      <div className="relative w-full overflow-hidden">
        {/* Left fade gradient */}
        <div
          className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to right, hsl(var(--background)), transparent)`,
          }}
        />

        {/* Right fade gradient */}
        <div
          className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to left, hsl(var(--background)), transparent)`,
          }}
        />

        {/* Infinite scrolling track - two identical sets side by side */}
        <div
          className="flex animate-marquee"
          style={{
            animationDuration: `${animationDuration}s`,
          }}
        >
          {/* First set - fills viewport */}
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {repeatedSponsors.map((sponsor, idx) => (
              <SponsorLogo
                key={`set1-${sponsor.id}-${idx}`}
                sponsor={sponsor}
                theme={theme}
              />
            ))}
          </div>
          {/* Second set - for seamless loop */}
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {repeatedSponsors.map((sponsor, idx) => (
              <SponsorLogo
                key={`set2-${sponsor.id}-${idx}`}
                sponsor={sponsor}
                theme={theme}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Gradient Animated Button */}
      <div className="flex justify-center mt-10">
        <Link
          href="/sponsors"
          className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            boxShadow: `0 4px 20px ${theme.primaryColor}40`,
          }}
        >
          {/* Animated shine effect */}
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
              animation: "shine 1.5s infinite",
            }}
          />
          <span className="relative z-10">{labels.becomePartner}</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

function SponsorLogo({
  sponsor,
  theme,
}: {
  sponsor: Sponsor;
  theme: ReturnType<typeof usePortal>["theme"];
}) {
  const content = sponsor.logo ? (
    <img
      src={sponsor.logo}
      alt={sponsor.name}
      className="h-12 md:h-16 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-60 hover:opacity-100"
    />
  ) : (
    <div
      className="h-12 md:h-16 px-6 flex items-center justify-center rounded-lg text-sm font-semibold opacity-60 hover:opacity-100 transition-all"
      style={{
        backgroundColor: `${theme.primaryColor}15`,
        color: theme.primaryColor,
      }}
    >
      {sponsor.name}
    </div>
  );

  // Always link to internal sponsor detail page
  return (
    <Link href={`/sponsors/${sponsor.id}`} className="flex-shrink-0" title={sponsor.name}>
      {content}
    </Link>
  );
}

/**
 * Alternative: Static Grid of Sponsors (for smaller lists)
 */
export function SponsorsGrid({ sponsors }: SponsorsMarqueeProps) {
  const { theme, locale } = usePortal();
  const labels = marqueeLabels[locale] ?? marqueeLabels.fr;

  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-semibold text-muted-foreground">
            {labels.title}
          </h3>
          <Link
            href="/sponsors"
            className="text-sm font-medium hover:underline"
            style={{ color: theme.primaryColor }}
          >
            {labels.becomePartner}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {sponsors.map((sponsor) => (
            <SponsorLogo key={sponsor.id} sponsor={sponsor} theme={theme} />
          ))}
        </div>
      </div>
    </section>
  );
}
