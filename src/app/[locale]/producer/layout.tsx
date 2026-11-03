import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { currentLocale, localizedRedirect as redirect } from "~/i18n/server";
import { syncUserLocale } from "~/server/services/user-locale";
import { getPortalSession, getUserPortalAccess } from "~/lib/portal/server-auth";
import { NothingProducerLayout } from "~/components/portal/nothing-producer-layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("producerSpace");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Producer",
    },
  };
}

const COMPLETE_PROFILE_PATH = "/producer/complete-profile";

// Pas de maximumScale ni userScalable: false — le pinch-zoom doit rester
// possible (WCAG 1.4.4), l'espace jury étant utilisé sur tablette pendant les
// dégustations. Le zoom auto d'iOS au focus est évité par des inputs >= 16px.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
  const session = await getPortalSession();

  if (!session?.user) {
    return redirect("/login?callbackUrl=/producer");
  }

  // Langue des e-mails à venir (résultats) : celle de l'espace consulté.
  await syncUserLocale(
    session.user.id,
    (session.user as { locale?: string | null }).locale,
    await currentLocale()
  );

  // Check roles - only producers and organizers can access
  const access = await getUserPortalAccess();

  if (!access.hasAccess) {
    // Signed in but no role or profile at all. Never send them back to
    // /login: it redirects by role and would bounce them straight here.
    return redirect("/");
  }

  const pathname = (await headers()).get("x-pathname") ?? "";

  // Un juré peut aussi concourir : sans profil producteur, il doit pouvoir
  // le créer. Le conflit d'intérêts se contrôle ensuite par catégorie.
  if (
    pathname === COMPLETE_PROFILE_PATH &&
    access.roles.includes("jury") &&
    !access.roles.includes("producer")
  ) {
    return <NothingProducerLayout>{children}</NothingProducerLayout>;
  }

  if (!access.roles.includes("producer") && !access.roles.includes("organizer")) {
    // User has access but wrong role - redirect to their area
    if (access.roles.includes("jury")) {
      return redirect("/jury");
    }
    // Fallback
    return redirect("/");
  }

  // Signed up but never completed the producer profile: every page under
  // /producer needs one, so funnel them to the form instead of bouncing
  // them back to /login (which would send them straight back here).
  if (access.needsProducerProfile && pathname !== COMPLETE_PROFILE_PATH) {
    return redirect(COMPLETE_PROFILE_PATH);
  }

  return <NothingProducerLayout>{children}</NothingProducerLayout>;
}
