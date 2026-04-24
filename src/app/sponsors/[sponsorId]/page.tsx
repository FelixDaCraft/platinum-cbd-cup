import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { sponsors, cupSponsors, cups } from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { SponsorDetailContent } from "~/components/portal/sponsor-detail-content";

interface PageProps {
  params: Promise<{ sponsorId: string }>;
}

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

/**
 * Sponsor detail with highest tier across cups.
 */
async function getSponsorDetail(sponsorId: string): Promise<SponsorDetail | null> {
  const sponsor = await db.query.sponsors.findFirst({
    where: eq(sponsors.id, sponsorId),
  });

  if (!sponsor) return null;

  const associations = await db
    .select({
      tier: cupSponsors.tier,
      cupName: cups.name,
    })
    .from(cupSponsors)
    .innerJoin(cups, eq(cupSponsors.cupId, cups.id))
    .where(eq(cupSponsors.sponsorId, sponsorId));

  const tierPriority: Record<SponsorTier, number> = {
    platinum: 4,
    gold: 3,
    silver: 2,
    bronze: 1,
  };

  let highestTier: SponsorTier = "bronze";
  const cupNames: string[] = [];

  for (const assoc of associations) {
    const tier = assoc.tier as SponsorTier;
    if (tierPriority[tier] > tierPriority[highestTier]) {
      highestTier = tier;
    }
    if (!cupNames.includes(assoc.cupName)) {
      cupNames.push(assoc.cupName);
    }
  }

  return {
    id: sponsor.id,
    name: sponsor.name,
    logo: sponsor.logo,
    description: sponsor.description,
    website: sponsor.website,
    socialLinks: (sponsor.socialLinks as SponsorSocialLinks) || {},
    tier: associations.length > 0 ? highestTier : "bronze",
    cupNames,
  };
}

export default async function SponsorDetailPage({ params }: PageProps) {
  const { sponsorId } = await params;
  const sponsor = await getSponsorDetail(sponsorId);

  if (!sponsor) {
    notFound();
  }

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <SponsorDetailContent sponsor={sponsor} />
      </main>
      <PortalFooter />
    </>
  );
}
