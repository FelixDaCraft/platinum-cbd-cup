import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "~/server/db";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { CupDetailContent } from "~/components/portal/cup-detail-content";
import { Button } from "~/components/ui/button";

interface PageProps {
  params: Promise<{ cupId: string }>;
}

/**
 * Fetch a cup (must be non-draft) with its categories and labels.
 */
async function getCupWithDetails(cupId: string) {
  const cup = await db.query.cups.findFirst({
    where: (cups, { eq, and, ne }) =>
      and(
        eq(cups.id, cupId),
        ne(cups.status, "draft")
      ),
    with: {
      categories: {
        with: {
          criteria: true,
        },
      },
      labels: {
        orderBy: (labels, { desc }) => [desc(labels.minScore)],
      },
    },
  });

  return cup;
}

export default async function PortalCupDetailPage({ params }: PageProps) {
  const { cupId } = await params;
  const cup = await getCupWithDetails(cupId);

  if (!cup) {
    notFound();
  }

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <div className="container mx-auto pt-6 px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cups">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux cups
            </Link>
          </Button>
        </div>

        <CupDetailContent cup={cup} />
      </main>
      <PortalFooter />
    </>
  );
}
