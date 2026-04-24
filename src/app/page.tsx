import type { Metadata } from "next";
import { db } from "~/server/db";
import { count, eq, and, sql, isNotNull, desc } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PersonasBar } from "~/components/portal/personas-bar";
import { PortalHero } from "~/components/portal/portal-hero";
import { HomepageSections } from "~/components/portal/homepage-sections";
import { PortalFooter } from "~/components/portal/portal-footer";

/**
 * SEO: Home page uses layout metadata by default
 */
export const metadata: Metadata = {};

/**
 * Get all public (non-draft) cups with extended data.
 * Single-tenant: no organization filter.
 */
async function getPublicCups() {
  const cups = await db.query.cups.findMany({
    where: (cups, { ne }) => ne(cups.status, "draft"),
    orderBy: (cups, { desc }) => [desc(cups.createdAt)],
    limit: 10,
  });

  if (cups.length === 0) {
    return [];
  }

  const cupIds = cups.map((c) => c.id);

  const categoriesCounts = await db
    .select({
      cupId: schema.categories.cupId,
      count: count(),
    })
    .from(schema.categories)
    .where(sql`${schema.categories.cupId} IN (${sql.join(cupIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(schema.categories.cupId);

  const registrationsCounts = await db
    .select({
      cupId: schema.registrations.cupId,
      count: count(),
    })
    .from(schema.registrations)
    .where(sql`${schema.registrations.cupId} IN (${sql.join(cupIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(schema.registrations.cupId);

  const categoriesMap = new Map(categoriesCounts.map((c) => [c.cupId, c.count]));
  const registrationsMap = new Map(registrationsCounts.map((r) => [r.cupId, r.count]));

  return cups.map((cup) => ({
    id: cup.id,
    name: cup.name,
    description: cup.description,
    bannerUrl: cup.bannerUrl,
    registrationOpenAt: cup.registrationOpenAt,
    registrationCloseAt: cup.registrationCloseAt,
    ratingEndAt: cup.ratingEndAt,
    eventDate: cup.eventDate,
    eventLocation: cup.eventLocation,
    status: cup.status,
    categoriesCount: categoriesMap.get(cup.id) ?? 0,
    registrationsCount: registrationsMap.get(cup.id) ?? 0,
  }));
}

/**
 * Global stats for the hero section.
 */
async function getOrganizationStats() {
  const [cupsResult] = await db
    .select({ count: count() })
    .from(schema.cups)
    .where(sql`${schema.cups.status} <> 'draft'`);

  const [productsResult] = await db
    .select({ count: count() })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(schema.cups, eq(schema.registrations.cupId, schema.cups.id));

  const [winnersResult] = await db
    .select({ count: count() })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(schema.cups, eq(schema.registrations.cupId, schema.cups.id))
    .where(
      and(
        isNotNull(schema.cups.resultsPublishedAt),
        eq(schema.products.excludedFromResults, false),
        sql`${schema.products.labelId} IS NOT NULL`
      )
    );

  return {
    totalCups: cupsResult?.count ?? 0,
    totalProducts: productsResult?.count ?? 0,
    totalWinners: winnersResult?.count ?? 0,
  };
}

type PublicCup = Awaited<ReturnType<typeof getPublicCups>>[number];

/**
 * Top 3 products per category from completed published cups (Hall of Fame).
 */
async function getLatestWinners() {
  const podiumProducts = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      finalScore: schema.products.finalScore,
      categoryRank: schema.products.categoryRank,
      cupId: schema.cups.id,
      cupName: schema.cups.name,
      cupEventDate: schema.cups.eventDate,
      cupRatingScale: schema.cups.ratingScale,
      categoryName: schema.categories.name,
      companyName: schema.producers.companyName,
      brandName: schema.producers.brandName,
    })
    .from(schema.products)
    .innerJoin(schema.registrations, eq(schema.products.registrationId, schema.registrations.id))
    .innerJoin(schema.cups, eq(schema.registrations.cupId, schema.cups.id))
    .innerJoin(schema.producers, eq(schema.registrations.producerId, schema.producers.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.cups.status, "completed"),
        isNotNull(schema.cups.resultsPublishedAt),
        eq(schema.products.excludedFromResults, false),
        isNotNull(schema.products.categoryRank),
        sql`${schema.products.categoryRank} <= 3`
      )
    )
    .orderBy(desc(schema.cups.eventDate), sql`${schema.products.categoryRank} ASC`)
    .limit(9);

  const winners = podiumProducts.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    producerName: p.companyName || p.brandName || "Producteur inconnu",
    cupId: p.cupId,
    cupName: p.cupName,
    cupRatingScale: p.cupRatingScale,
    categoryName: p.categoryName,
    labelName: "",
    labelColor: null as string | null,
    score: p.finalScore,
    rank: p.categoryRank ?? 1,
  })).slice(0, 3);

  return winners;
}

/**
 * All sponsors (single-tenant).
 */
async function getSponsors() {
  const sponsorsList = await db.query.sponsors.findMany({
    orderBy: (sponsors, { asc }) => [asc(sponsors.name)],
  });

  return sponsorsList.map((s) => ({
    id: s.id,
    name: s.name,
    logo: s.logo,
    tier: null,
    website: s.website,
  }));
}

/**
 * Flatten testimonials from all sponsors.
 */
async function getTestimonials() {
  const sponsorsList = await db.query.sponsors.findMany({
    columns: {
      testimonials: true,
    },
  });

  const allTestimonials: Array<{
    id: string;
    author: string;
    role: string;
    content: string;
  }> = [];

  for (const sponsor of sponsorsList) {
    if (sponsor.testimonials && Array.isArray(sponsor.testimonials)) {
      for (const t of sponsor.testimonials) {
        allTestimonials.push({
          id: t.id,
          author: t.authorName,
          role: t.authorRole ?? "",
          content: t.text,
        });
      }
    }
  }

  return allTestimonials;
}

/**
 * Pick the next upcoming cup.
 */
function getNextCup(cups: PublicCup[]): PublicCup | null {
  const activeCup = cups.find(
    (cup) => cup.status === "published" || cup.status === "rating"
  );

  if (activeCup) return activeCup;

  return cups[0] ?? null;
}

export default async function PortalHomePage() {
  const [cups, organizationStats, latestWinners, sponsors, testimonials] = await Promise.all([
    getPublicCups(),
    getOrganizationStats(),
    getLatestWinners(),
    getSponsors(),
    getTestimonials(),
  ]);
  const nextCup = getNextCup(cups);

  return (
    <>
      <PortalHeader />
      <PersonasBar />
      <main>
        <PortalHero nextCup={nextCup} organizationStats={organizationStats} />
        <HomepageSections
          nextCup={nextCup}
          organizationStats={organizationStats}
          latestWinners={latestWinners}
          sponsors={sponsors}
          testimonials={testimonials}
          cups={cups}
        />
      </main>
      <PortalFooter />
    </>
  );
}
