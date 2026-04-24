import type { Metadata } from "next";
import { db } from "~/server/db";
import { eq, inArray, count, ne } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { cupSponsors, cups } from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PortalSponsorsList } from "~/components/portal/portal-sponsors-list";
import { BecomeSponsorSection } from "~/components/portal/become-sponsor-section";

export const metadata: Metadata = {
  title: "Devenir Partenaire",
  description: "Associez votre marque à l'excellence et rejoignez nos partenaires.",
};

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

/**
 * Global stats for the "become sponsor" section.
 */
async function getOrganizationStats() {
  const [cupsResult] = await db
    .select({ count: count() })
    .from(schema.cups)
    .where(ne(schema.cups.status, "draft"));

  const [productsResult] = await db
    .select({ count: count() })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    );

  const [participantsResult] = await db
    .select({ count: count() })
    .from(schema.registrations);

  return {
    totalCups: cupsResult?.count ?? 0,
    totalProducts: productsResult?.count ?? 0,
    totalParticipants: participantsResult?.count ?? 0,
  };
}

/**
 * All sponsors with their highest tier across cups (single-tenant).
 */
async function getOrganizationSponsors(): Promise<SponsorWithTier[]> {
  const orgSponsors = await db.query.sponsors.findMany({});

  if (orgSponsors.length === 0) return [];

  const sponsorIds = orgSponsors.map((s) => s.id);
  const associations = await db
    .select({
      sponsorId: cupSponsors.sponsorId,
      tier: cupSponsors.tier,
      cupId: cupSponsors.cupId,
      cupName: cups.name,
    })
    .from(cupSponsors)
    .innerJoin(cups, eq(cupSponsors.cupId, cups.id))
    .where(inArray(cupSponsors.sponsorId, sponsorIds));

  const tierPriority: Record<SponsorTier, number> = {
    platinum: 4,
    gold: 3,
    silver: 2,
    bronze: 1,
  };

  return orgSponsors.map((sponsor) => {
    const sponsorAssociations = associations.filter((a) => a.sponsorId === sponsor.id);

    let highestTier: SponsorTier = "bronze";
    const cupNames: string[] = [];

    for (const assoc of sponsorAssociations) {
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
      tier: sponsorAssociations.length > 0 ? highestTier : "bronze",
      cupNames,
    };
  });
}

export default async function PortalSponsorsPage() {
  const [sponsorsList, stats] = await Promise.all([
    getOrganizationSponsors(),
    getOrganizationStats(),
  ]);

  return (
    <>
      <PortalHeader />
      <main className="container mx-auto py-8 md:py-12 min-h-[60vh] px-4 sm:px-6 lg:px-8">
        <BecomeSponsorSection stats={stats} />

        {sponsorsList.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6 text-center">Ils nous font confiance</h2>
            <PortalSponsorsList sponsors={sponsorsList} />
          </section>
        )}
      </main>
      <PortalFooter />
    </>
  );
}
