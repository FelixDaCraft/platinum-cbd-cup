import { db } from "~/server/db";
import { eq, and, ne, asc, desc, isNotNull, or, lte } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PalmaresPage } from "~/components/portal/palmares-page";

/**
 * Hardcoded palmares display config (single-tenant).
 * Previously read from portal_themes; now fixed at sensible defaults.
 */
function getPortalConfig() {
  return {
    palmareLayout: "masonry" as const,
    palmareFilterStyle: "chips" as const,
    palmareDisplayStyle: "cards" as const,
    palmareShowScore: true,
    palmareShowCategory: true,
  };
}

/**
 * All cups with published results.
 */
async function getCupsWithResults() {
  const cups = await db.query.cups.findMany({
    where: and(
      ne(schema.cups.status, "draft"),
      isNotNull(schema.cups.resultsPublishedAt)
    ),
    orderBy: [desc(schema.cups.eventDate)],
  });

  return cups.map((cup) => ({
    id: cup.id,
    name: cup.name,
    eventDate: cup.eventDate,
    bannerUrl: cup.bannerUrl,
    resultsVisibility: cup.resultsVisibility ?? "labels",
  }));
}

/**
 * All distinct public labels across cups with published results.
 */
async function getAllLabels() {
  const cups = await db.query.cups.findMany({
    where: isNotNull(schema.cups.resultsPublishedAt),
    columns: { id: true },
  });

  const cupIds = cups.map((c) => c.id);
  if (cupIds.length === 0) return [];

  const labels = await db.query.cupLabels.findMany({
    where: eq(schema.cupLabels.isPublic, true),
    orderBy: [desc(schema.cupLabels.minScore)],
  });

  const uniqueLabels = new Map<string, { id: string; name: string; color: string | null; icon: string | null }>();
  for (const label of labels) {
    if (cupIds.includes(label.cupId) && !uniqueLabels.has(label.name)) {
      uniqueLabels.set(label.name, {
        id: label.id,
        name: label.name,
        color: label.color,
        icon: label.icon,
      });
    }
  }

  return Array.from(uniqueLabels.values());
}

/**
 * All distinct categories across cups with published results.
 */
async function getAllCategories() {
  const cups = await db.query.cups.findMany({
    where: isNotNull(schema.cups.resultsPublishedAt),
    columns: { id: true },
  });

  const cupIds = cups.map((c) => c.id);
  if (cupIds.length === 0) return [];

  const categories = await db.query.categories.findMany({
    orderBy: [asc(schema.categories.name)],
  });

  const uniqueCategories = new Map<string, { id: string; name: string }>();
  for (const category of categories) {
    if (cupIds.includes(category.cupId) && !uniqueCategories.has(category.name)) {
      uniqueCategories.set(category.name, {
        id: category.id,
        name: category.name,
      });
    }
  }

  return Array.from(uniqueCategories.values());
}

/**
 * All winners from all cups with published results.
 */
async function getAllWinners() {
  const cups = await db.query.cups.findMany({
    where: and(
      ne(schema.cups.status, "draft"),
      isNotNull(schema.cups.resultsPublishedAt)
    ),
  });

  const allWinners = [];

  for (const cup of cups) {
    const visibility = cup.resultsVisibility ?? "labels";
    const showPodium = ["podium", "labels_and_podium", "all"].includes(visibility);
    const showLabels = ["labels", "labels_and_podium", "all"].includes(visibility);
    const showAll = visibility === "all";

    if (!showPodium && !showLabels && !showAll) continue;

    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.cupId, cup.id),
    });

    for (const category of categories) {
      const visibilityCondition = showAll
        ? isNotNull(schema.products.finalScore)
        : showPodium && showLabels
          ? or(isNotNull(schema.products.labelId), lte(schema.products.categoryRank, 3))
          : showPodium
            ? lte(schema.products.categoryRank, 3)
            : isNotNull(schema.products.labelId);

      const products = await db
        .select({
          productId: schema.products.id,
          productName: schema.products.name,
          productDescription: schema.products.description,
          finalScore: schema.products.finalScore,
          categoryRank: schema.products.categoryRank,
          labelId: schema.products.labelId,
          labelName: schema.cupLabels.name,
          labelColor: schema.cupLabels.color,
          labelIcon: schema.cupLabels.icon,
          producerId: schema.producers.id,
          producerName: schema.producers.companyName,
          producerBrand: schema.producers.brandName,
          producerLogo: schema.producers.logo,
          producerWebsite: schema.producers.website,
          producerPhone: schema.producers.phone,
          producerAddress: schema.producers.address,
          producerEmail: schema.users.email,
        })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .innerJoin(
          schema.producers,
          eq(schema.registrations.producerId, schema.producers.id)
        )
        .innerJoin(
          schema.users,
          eq(schema.producers.userId, schema.users.id)
        )
        .leftJoin(
          schema.cupLabels,
          eq(schema.products.labelId, schema.cupLabels.id)
        )
        .where(
          and(
            eq(schema.products.categoryId, category.id),
            eq(schema.registrations.cupId, cup.id),
            eq(schema.registrations.status, "confirmed"),
            eq(schema.products.excludedFromResults, false),
            visibilityCondition
          )
        )
        .orderBy(asc(schema.products.categoryRank));

      for (const product of products) {
        const stripLabels = visibility === "podium";

        allWinners.push({
          productId: product.productId,
          productName: product.productName,
          productDescription: product.productDescription,
          producerId: product.producerId,
          producerName: product.producerName ?? product.producerBrand ?? "Producteur",
          producerLogo: product.producerLogo,
          producerWebsite: product.producerWebsite,
          producerPhone: product.producerPhone,
          producerAddress: product.producerAddress,
          producerEmail: product.producerEmail,
          cupId: cup.id,
          cupName: cup.name,
          cupDate: cup.eventDate,
          cupBanner: cup.bannerUrl,
          cupRatingScale: cup.ratingScale,
          categoryId: category.id,
          categoryName: category.name,
          labelId: stripLabels ? null : product.labelId,
          labelName: stripLabels ? null : product.labelName,
          labelColor: stripLabels ? null : product.labelColor,
          labelIcon: stripLabels ? null : product.labelIcon,
          score: product.finalScore,
          rank: product.categoryRank,
          visibility,
        });
      }
    }
  }

  return allWinners;
}

export default async function PortalPalmaresPage() {
  const config = getPortalConfig();
  const [cups, labels, categories, winners] = await Promise.all([
    getCupsWithResults(),
    getAllLabels(),
    getAllCategories(),
    getAllWinners(),
  ]);

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <PalmaresPage
          config={config}
          cups={cups}
          labels={labels}
          categories={categories}
          winners={winners}
        />
      </main>
      <PortalFooter />
    </>
  );
}
