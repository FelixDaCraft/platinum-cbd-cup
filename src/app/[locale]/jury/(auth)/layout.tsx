import { currentLocale, localizedRedirect as redirect } from "~/i18n/server";
import { syncUserLocale } from "~/server/services/user-locale";
import { getPortalSession, getUserPortalAccess } from "~/lib/portal/server-auth";
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
  const session = await getPortalSession();

  if (!session?.user) {
    return redirect("/login?callbackUrl=/jury/dashboard");
  }

  // Langue des e-mails à venir (rappels, résultats) : celle de l'espace consulté.
  await syncUserLocale(
    session.user.id,
    (session.user as { locale?: string | null }).locale,
    await currentLocale()
  );

  // Check roles - only jury and organizers can access
  const access = await getUserPortalAccess();

  if (!access.hasAccess) {
    // Signed in but no role or profile at all. Never send them back to
    // /login: it redirects by role and would bounce them straight here.
    return redirect("/");
  }

  // On teste l'appartenance et non le rôle principal : un producteur qui
  // active un code jury détient les deux profils, et la précédence
  // producteur le renvoyait indéfiniment vers /producer.
  if (!access.roles.includes("jury") && !access.roles.includes("organizer")) {
    // User has access but wrong role - redirect to their area
    if (access.roles.includes("producer")) {
      return redirect("/producer");
    }
    // Fallback
    return redirect("/");
  }

  return <NothingJuryLayout>{children}</NothingJuryLayout>;
}
