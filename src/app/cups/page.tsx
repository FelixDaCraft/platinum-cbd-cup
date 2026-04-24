import type { Metadata } from "next";
import { db } from "~/server/db";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PortalCupsList } from "~/components/portal/portal-cups-list";

export const metadata: Metadata = {
  title: "Nos Concours",
  description: "Découvrez tous nos concours et compétitions.",
};

/**
 * Get all public (non-draft) cups. Single-tenant: no org filter.
 */
async function getPublicCups() {
  const cups = await db.query.cups.findMany({
    where: (cups, { ne }) => ne(cups.status, "draft"),
    orderBy: (cups, { desc }) => [desc(cups.createdAt)],
    limit: 50,
  });

  return cups.map((cup) => ({
    id: cup.id,
    name: cup.name,
    description: cup.description,
    bannerUrl: cup.bannerUrl,
    registrationOpenAt: cup.registrationOpenAt,
    registrationCloseAt: cup.registrationCloseAt,
    ratingEndAt: cup.ratingEndAt,
    status: cup.status,
    createdAt: cup.createdAt,
  }));
}

export default async function PortalCupsPage() {
  const cups = await getPublicCups();

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <PortalCupsList cups={cups} />
      </main>
      <PortalFooter />
    </>
  );
}
