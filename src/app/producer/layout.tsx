import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { auth } from "~/lib/auth";
import { getUserPortalAccess } from "~/lib/portal/server-auth";
import { NothingProducerLayout } from "~/components/portal/nothing-producer-layout";

export const metadata: Metadata = {
  title: "CupMetrics Producer",
  description: "Espace producteur - Gérez vos inscriptions et labels",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Producer",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Portal Producer Layout
 * Protected layout for producer space on organization portal
 * Access allowed for: producers and organizers
 */
export default async function PortalProducerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect("/login?callbackUrl=/producer");
  }

  // Check role - only producers and organizers can access
  const access = await getUserPortalAccess();

  if (!access.hasAccess) {
    // User is logged in but has no profile for this organization
    redirect("/login");
  }

  if (access.role !== "producer" && access.role !== "organizer") {
    // User has access but wrong role - redirect to their area
    if (access.role === "jury") {
      redirect("/jury");
    }
    // Fallback
    redirect("/");
  }

  return <NothingProducerLayout>{children}</NothingProducerLayout>;
}
