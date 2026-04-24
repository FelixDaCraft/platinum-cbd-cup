import type { Metadata } from "next";
import { db } from "~/server/db";
import { count, eq, ne, min, asc, desc } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PressPage } from "~/components/portal/press-page";

export const metadata: Metadata = {
  title: "Espace Presse",
  description: "Kit média, chiffres clés et contacts presse pour les journalistes.",
};

/**
 * Global stats for the press section (single-tenant).
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

  const [juriesResult] = await db
    .select({ count: count() })
    .from(schema.cupJuries);

  const [oldestCupResult] = await db
    .select({ minDate: min(schema.cups.createdAt) })
    .from(schema.cups)
    .where(ne(schema.cups.status, "draft"));

  let yearsActive: number | undefined;
  if (oldestCupResult?.minDate) {
    const oldestYear = new Date(oldestCupResult.minDate).getFullYear();
    const currentYear = new Date().getFullYear();
    yearsActive = currentYear - oldestYear + 1;
  }

  return {
    totalCups: cupsResult?.count ?? 0,
    totalProducts: productsResult?.count ?? 0,
    totalParticipants: participantsResult?.count ?? 0,
    totalJuries: juriesResult?.count ?? 0,
    yearsActive,
  };
}

export default async function PortalPressPage() {
  const stats = await getOrganizationStats();

  const [pressSettingsResult, pressReleasesResult, galleryImagesResult] = await Promise.all([
    db.query.pressSettings.findFirst({}),
    db.query.pressReleases.findMany({
      where: (pr, { eq }) => eq(pr.status, "published"),
      orderBy: [asc(schema.pressReleases.displayOrder), desc(schema.pressReleases.publishedAt)],
    }),
    db.query.galleryImages.findMany({
      orderBy: [asc(schema.galleryImages.displayOrder), desc(schema.galleryImages.createdAt)],
    }),
  ]);

  const pressReleases = pressReleasesResult.map((release) => ({
    id: release.id,
    title: release.title,
    date: release.publishedAt ?? release.createdAt,
    summary: release.excerpt ?? "",
    pdfUrl: release.pdfUrl ?? undefined,
  }));

  const galleryImages = galleryImagesResult.map((image) => ({
    id: image.id,
    url: image.imageUrl,
    caption: image.title,
    alt: image.alt ?? undefined,
  }));

  const mediaKitUrl = pressSettingsResult?.mediaKitUrl ?? undefined;
  const showPressReleases = pressSettingsResult?.showPressReleases !== "false";
  const showGallery = pressSettingsResult?.showGallery !== "false";
  const showMediaKit = pressSettingsResult?.showMediaKit !== "false";

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <PressPage
          stats={stats}
          pressReleases={showPressReleases ? pressReleases : []}
          galleryImages={showGallery ? galleryImages : []}
          mediaKitUrl={showMediaKit ? mediaKitUrl : undefined}
        />
      </main>
      <PortalFooter />
    </>
  );
}
