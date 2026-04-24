"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

type SponsorTier = "bronze" | "silver" | "gold" | "platinum";

interface SponsorWithTier {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  tier: SponsorTier;
  cupNames: string[];
}

interface PortalSponsorsListProps {
  sponsors: SponsorWithTier[];
}

const tierConfig: Record<
  SponsorTier,
  { label: string; color: string; bgColor: string; logoSize: string; order: number }
> = {
  platinum: {
    label: "Platine",
    color: "text-cyan-500",
    bgColor: "bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border-cyan-500/30",
    logoSize: "h-32 w-32",
    order: 0,
  },
  gold: {
    label: "Or",
    color: "text-yellow-500",
    bgColor: "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30",
    logoSize: "h-28 w-28",
    order: 1,
  },
  silver: {
    label: "Argent",
    color: "text-gray-400",
    bgColor: "bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30",
    logoSize: "h-24 w-24",
    order: 2,
  },
  bronze: {
    label: "Bronze",
    color: "text-amber-700",
    bgColor: "bg-gradient-to-r from-amber-700/20 to-amber-800/20 border-amber-700/30",
    logoSize: "h-20 w-20",
    order: 3,
  },
};

const tierOrder: SponsorTier[] = ["platinum", "gold", "silver", "bronze"];

export function PortalSponsorsList({ sponsors }: PortalSponsorsListProps) {
  // Group sponsors by tier
  const sponsorsByTier = sponsors.reduce(
    (acc, sponsor) => {
      if (!acc[sponsor.tier]) acc[sponsor.tier] = [];
      acc[sponsor.tier].push(sponsor);
      return acc;
    },
    {} as Record<SponsorTier, SponsorWithTier[]>
  );

  if (sponsors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Aucun partenaire pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {tierOrder.map((tier) => {
        const tierSponsors = sponsorsByTier[tier];
        if (!tierSponsors || tierSponsors.length === 0) return null;

        const config = tierConfig[tier];

        return (
          <section key={tier}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-1 w-8 rounded-full ${tier === "platinum" ? "bg-cyan-500" : tier === "gold" ? "bg-yellow-500" : tier === "silver" ? "bg-gray-400" : "bg-amber-700"}`}
              />
              <h2 className={`text-2xl font-bold ${config.color}`}>
                Partenaires {config.label}
              </h2>
              <Badge variant="secondary">{tierSponsors.length}</Badge>
            </div>

            <div
              className={`grid gap-6 ${
                tier === "platinum"
                  ? "grid-cols-1 md:grid-cols-2"
                  : tier === "gold"
                    ? "grid-cols-2 md:grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              }`}
            >
              {tierSponsors.map((sponsor) => (
                <SponsorCard key={sponsor.id} sponsor={sponsor} tier={tier} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface SponsorCardProps {
  sponsor: SponsorWithTier;
  tier: SponsorTier;
}

function SponsorCard({ sponsor, tier }: SponsorCardProps) {
  const config = tierConfig[tier];
  const hasDetailPage = tier === "platinum" || tier === "gold";

  // For platinum/gold: link to detail page
  // For silver/bronze: link directly to website (if exists)
  const content = (
    <Card
      className={`group relative overflow-hidden border transition-all hover:shadow-lg ${config.bgColor}`}
    >
      <CardContent className="flex flex-col items-center justify-center p-6">
        {sponsor.logo ? (
          <img
            src={sponsor.logo}
            alt={sponsor.name}
            className={`${config.logoSize} object-contain transition-transform group-hover:scale-105`}
          />
        ) : (
          <div
            className={`${config.logoSize} rounded-lg bg-muted flex items-center justify-center`}
          >
            <span className="text-2xl font-bold text-muted-foreground">
              {sponsor.name.charAt(0)}
            </span>
          </div>
        )}

        <h3 className="mt-4 text-center font-semibold">{sponsor.name}</h3>

        {sponsor.cupNames.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground text-center">
            {sponsor.cupNames.slice(0, 2).join(", ")}
            {sponsor.cupNames.length > 2 && ` +${sponsor.cupNames.length - 2}`}
          </p>
        )}

        {!hasDetailPage && sponsor.website && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span>Visiter le site</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (hasDetailPage) {
    return (
      <Link href={`/portal/sponsors/${sponsor.id}`} className="block">
        {content}
      </Link>
    );
  }

  if (sponsor.website) {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
}
