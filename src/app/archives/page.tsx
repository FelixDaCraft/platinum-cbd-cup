import { db } from "~/server/db";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PortalArchivesList } from "~/components/portal/portal-archives-list";

/**
 * Get all completed cups (single-tenant).
 */
async function getArchivedCups() {
  const cups = await db.query.cups.findMany({
    where: (cups, { eq }) => eq(cups.status, "completed"),
    with: {
      categories: true,
      labels: true,
      registrations: {
        columns: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: (cups, { desc }) => [desc(cups.ratingEndAt), desc(cups.createdAt)],
  });

  return cups.map((cup) => {
    const confirmedRegistrations = cup.registrations.filter(
      (r) => r.status === "confirmed"
    );

    return {
      id: cup.id,
      name: cup.name,
      description: cup.description,
      bannerUrl: cup.bannerUrl,
      ratingEndAt: cup.ratingEndAt,
      resultsPublishedAt: cup.resultsPublishedAt,
      eventDate: cup.eventDate,
      categoriesCount: cup.categories.length,
      labelsCount: cup.labels.length,
      participantsCount: confirmedRegistrations.length,
      categories: cup.categories.map((c) => ({ id: c.id, name: c.name })),
      labels: cup.labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        icon: l.icon,
        isPublic: l.isPublic,
      })),
    };
  });
}

export default async function PortalArchivesPage() {
  const archivedCups = await getArchivedCups();

  return (
    <>
      <PortalHeader />
      <main className="container py-8 md:py-12 min-h-[60vh]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Archives</h1>
          <p className="mt-2 text-muted-foreground">
            Retrouvez les résultats de toutes nos éditions passées.
          </p>
        </div>

        <PortalArchivesList cups={archivedCups} />
      </main>
      <PortalFooter />
    </>
  );
}
