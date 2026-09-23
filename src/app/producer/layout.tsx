import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { auth } from "~/lib/auth";
import { getUserPortalAccess } from "~/lib/portal/server-auth";
import { NothingProducerLayout } from "~/components/portal/nothing-producer-layout";

export const metadata: Metadata = {
  title: "Platinum CBD Cup — Producteur",
  description: "Espace producteur - Gérez vos inscriptions et labels",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Producer",
  },
};

const COMPLETE_PROFILE_PATH = "/producer/complete-profile";

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
    // Signed in but no role or profile at all. Never send them back to
    // /login: it redirects by role and would bounce them straight here.
    redirect("/");
  }

  if (access.role !== "producer" && access.role !== "organizer") {
    // User has access but wrong role - redirect to their area
    if (access.role === "jury") {
      redirect("/jury");
    }
    // Fallback
    redirect("/");
  }

  // Signed up but never completed the producer profile: every page under
  // /producer needs one, so funnel them to the form instead of bouncing
  // them back to /login (which would send them straight back here).
  const pathname = headersList.get("x-pathname") ?? "";
  if (access.needsProducerProfile && pathname !== COMPLETE_PROFILE_PATH) {
    redirect(COMPLETE_PROFILE_PATH);
  }

  return <NothingProducerLayout>{children}</NothingProducerLayout>;
}
