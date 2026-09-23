"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

type SponsorTier = "bronze" | "silver" | "gold" | "platinum";

interface SponsorSocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
}

interface SponsorDetail {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  socialLinks: SponsorSocialLinks;
  tier: SponsorTier;
  cupNames: string[];
}

interface SponsorDetailContentProps {
  sponsor: SponsorDetail;
}

const tierConfig: Record<SponsorTier, { label: string; color: string; bgColor: string }> = {
  platinum: {
    label: "Partenaire Platine",
    color: "text-cyan-500",
    bgColor: "bg-gradient-to-r from-cyan-500/10 to-cyan-600/10",
  },
  gold: {
    label: "Partenaire Or",
    color: "text-yellow-500",
    bgColor: "bg-gradient-to-r from-yellow-500/10 to-yellow-600/10",
  },
  silver: {
    label: "Partenaire Argent",
    color: "text-gray-400",
    bgColor: "bg-gradient-to-r from-gray-400/10 to-gray-500/10",
  },
  bronze: {
    label: "Partenaire Bronze",
    color: "text-amber-700",
    bgColor: "bg-gradient-to-r from-amber-700/10 to-amber-800/10",
  },
};

const socialIcons: Record<
  keyof SponsorSocialLinks,
  { icon: typeof Facebook; label: string }
> = {
  facebook: { icon: Facebook, label: "Facebook" },
  twitter: { icon: Twitter, label: "Twitter" },
  instagram: { icon: Instagram, label: "Instagram" },
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  youtube: { icon: Youtube, label: "YouTube" },
};

export function SponsorDetailContent({ sponsor }: SponsorDetailContentProps) {
  const config = tierConfig[sponsor.tier];
  const socialEntries = Object.entries(sponsor.socialLinks).filter(
    ([_, url]) => url && url.trim() !== ""
  ) as [keyof SponsorSocialLinks, string][];

  return (
    <>
      {/* Hero Section */}
      <div className={`${config.bgColor} py-12`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/sponsors"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux partenaires
          </Link>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              {sponsor.logo ? (
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="h-48 w-48 object-contain rounded-xl bg-white p-4 shadow-lg"
                />
              ) : (
                <div className="h-48 w-48 rounded-xl bg-muted flex items-center justify-center shadow-lg">
                  <span className="text-5xl font-bold text-muted-foreground">
                    {sponsor.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <Badge className={`${config.color} border-current mb-3`} variant="outline">
                {config.label}
              </Badge>

              <h1 className="text-4xl font-bold mb-4">{sponsor.name}</h1>

              {sponsor.cupNames.length > 0 && (
                <p className="text-muted-foreground mb-4">
                  Partenaire de : {sponsor.cupNames.join(", ")}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                {/* Website link with dofollow */}
                {sponsor.website && (
                  <Button asChild>
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visiter le site
                    </a>
                  </Button>
                )}

                {/* Social links */}
                {socialEntries.map(([key, url]) => {
                  const { icon: Icon, label } = socialIcons[key];
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      size="icon"
                      asChild
                      title={label}
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Description */}
          {sponsor.description && (
            <section>
              <h2 className="text-2xl font-bold mb-4">À propos</h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">
                  {sponsor.description}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
