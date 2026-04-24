import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { eq, and, asc, desc, isNotNull } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { CupResultsPage } from "~/components/portal/cup-results-page";

interface PageProps {
  params: Promise<{ cupId: string }>;
}

/**
 * Cup basic info for results page (must be non-draft).
 */
async function getCupForResults(cupId: string) {
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq, and, ne }) =>
      and(
        eq(cups.id, cupId),
        ne(cups.status, "draft")
      ),
  });

  if (!cup) return null;

  return {
    id: cup.id,
    name: cup.name,
    bannerUrl: cup.bannerUrl,
    eventDate: cup.eventDate,
    eventLocation: cup.eventLocation,
    resultsPublishedAt: cup.resultsPublishedAt,
    resultsVisibility: cup.resultsVisibility,
    ratingScale: cup.ratingScale,
  };
}

/**
 * Public cup results (only if published).
 */
async function getPublicCupResults(cupId: string) {
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq, and, ne }) =>
      and(
        eq(cups.id, cupId),
        ne(cups.status, "draft"),
        isNotNull(cups.resultsPublishedAt)
      ),
  });

  if (!cup) {
    return { categories: [], labels: [], allProducts: [] };
  }

  const cupCategories = await db.query.categories.findMany({
    where: eq(schema.categories.cupId, cupId),
    orderBy: [asc(schema.categories.sortOrder)],
  });

  const labels = await db.query.cupLabels.findMany({
    where: and(
      eq(schema.cupLabels.cupId, cupId),
      eq(schema.cupLabels.isPublic, true)
    ),
    orderBy: [desc(schema.cupLabels.minScore)],
  });

  const categoriesWithProducts = [];
  const allProducts = [];

  for (const category of cupCategories) {
    const categoryProducts = await db
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
        producerName: schema.producers.companyName,
        producerBrand: schema.producers.brandName,
        producerWebsite: schema.producers.website,
        producerLogo: schema.producers.logo,
      })
      .from(schema.products)
      .innerJoin(schema.registrations, eq(schema.products.registrationId, schema.registrations.id))
      .innerJoin(schema.producers, eq(schema.registrations.producerId, schema.producers.id))
      .leftJoin(schema.cupLabels, eq(schema.products.labelId, schema.cupLabels.id))
      .where(
        and(
          eq(schema.products.categoryId, category.id),
          eq(schema.registrations.cupId, cupId),
          eq(schema.registrations.status, "confirmed"),
          eq(schema.products.excludedFromResults, false),
          isNotNull(schema.products.finalScore)
        )
      )
      .orderBy(asc(schema.products.categoryRank));

    const visibility = cup.resultsVisibility ?? "labels";
    const showPodium = ["podium", "labels_and_podium", "all"].includes(visibility);
    const showLabels = ["labels", "labels_and_podium", "all"].includes(visibility);

    if (showPodium) {
      const podiumProducts = categoryProducts.slice(0, 3).map((p) => ({
        productId: p.productId,
        productName: p.productName,
        producerName: p.producerName ?? p.producerBrand ?? "Producteur",
        rank: p.categoryRank ?? 0,
        score: p.finalScore,
        cupRatingScale: cup.ratingScale,
        labelId: showLabels ? p.labelId : null,
        labelName: showLabels ? p.labelName : null,
        labelColor: showLabels ? p.labelColor : null,
        labelIcon: showLabels ? p.labelIcon : null,
      }));

      if (podiumProducts.length > 0) {
        categoriesWithProducts.push({
          id: category.id,
          name: category.name,
          products: podiumProducts,
        });
      }
    }

    if (showLabels) {
      for (const p of categoryProducts) {
        if (p.labelId && p.labelName) {
          allProducts.push({
            productId: p.productId,
            productName: p.productName,
            productDescription: p.productDescription,
            productImageUrl: p.producerLogo,
            producerName: p.producerName ?? p.producerBrand ?? "Producteur",
            producerLocation: null,
            producerWebsite: p.producerWebsite,
            producerEmail: null,
            categoryId: category.id,
            categoryName: category.name,
            labelId: p.labelId,
            labelName: p.labelName,
            labelColor: p.labelColor,
            labelIcon: p.labelIcon,
            score: p.finalScore,
            cupRatingScale: cup.ratingScale,
            rank: p.categoryRank,
          });
        }
      }
    }
  }

  return {
    categories: categoriesWithProducts,
    labels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      icon: l.icon,
      minScore: l.minScore,
    })),
    allProducts,
  };
}

export default async function PortalCupResultsPage({ params }: PageProps) {
  const { cupId } = await params;
  const cup = await getCupForResults(cupId);

  if (!cup) {
    notFound();
  }

  const { categories, labels, allProducts } = await getPublicCupResults(cupId);

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <CupResultsPage
          cup={cup}
          categories={categories}
          labels={labels}
          allProducts={allProducts}
        />
      </main>
      <PortalFooter />
    </>
  );
}
