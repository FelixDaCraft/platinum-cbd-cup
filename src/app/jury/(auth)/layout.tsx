import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { getUserPortalAccess } from "~/lib/portal/server-auth";
import { NothingJuryLayout } from "~/components/jury/nothing-layout";

/**
 * Protected Jury Layout
 * Wraps all jury pages that require an existing jury profile.
 * Pages outside this route group (e.g. jury/public/[token]) are accessible
 * without a juryProfile so users can claim their token first.
 */
export default async function ProtectedJuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect("/login?callbackUrl=/jury/dashboard");
  }

  // Check role - only jury and organizers can access
  const access = await getUserPortalAccess();

  if (!access.hasAccess) {
    // User is logged in but has no profile for this organization
    redirect("/login");
  }

  if (access.role !== "jury" && access.role !== "organizer") {
    // User has access but wrong role - redirect to their area
    if (access.role === "producer") {
      redirect("/producer");
    }
    // Fallback
    redirect("/");
  }

  return <NothingJuryLayout>{children}</NothingJuryLayout>;
}
