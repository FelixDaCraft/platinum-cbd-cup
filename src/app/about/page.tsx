import type { Metadata } from "next";
import { db } from "~/server/db";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { PortalAboutContent } from "~/components/portal/portal-about-content";
import type { TeamMember } from "~/server/db/schema/organization-about";

export const metadata: Metadata = {
  title: "À Propos",
  description: "Découvrez notre histoire, notre mission et notre équipe.",
};

/**
 * Single-tenant about content (first / only row).
 */
async function getAboutContent() {
  const aboutContent = await db.query.organizationAbout.findFirst({});

  return {
    history: aboutContent?.history ?? null,
    mission: aboutContent?.mission ?? null,
    values: aboutContent?.values ?? null,
    galleryImages: (aboutContent?.galleryImages ?? []) as string[],
    teamMembers: (aboutContent?.teamMembers ?? []) as TeamMember[],
  };
}

/**
 * Single-tenant about-page settings (first / only row).
 */
async function getAboutSettings() {
  const settings = await db.query.portalAboutSettings.findFirst({});

  if (!settings) {
    return undefined;
  }

  return {
    heroStyle: settings.heroStyle ?? "banner",
    heroTagline: settings.heroTagline,
    missionStyle: settings.missionStyle ?? "quote",
    valuesDisplay: settings.valuesDisplay ?? "cards",
    teamCardSize: settings.teamCardSize ?? "large",
    showTeamSocialLinks: settings.showTeamSocialLinks ?? true,
    galleryColumns: settings.galleryColumns ?? "3",
    enableGalleryLightbox: settings.enableGalleryLightbox ?? true,
    sectionStyle: settings.sectionStyle ?? "alternating",
    enableAnimations: settings.enableAnimations ?? true,
    showStats: settings.showStats ?? false,
    statsYearFounded: settings.statsYearFounded,
    statsCupsOrganized: settings.statsCupsOrganized,
    statsJudgesCount: settings.statsJudgesCount,
    statsCustomLabel1: settings.statsCustomLabel1,
    statsCustomValue1: settings.statsCustomValue1,
    statsCustomLabel2: settings.statsCustomLabel2,
    statsCustomValue2: settings.statsCustomValue2,
  };
}

export default async function PortalAboutPage() {
  const [aboutContent, aboutSettings] = await Promise.all([
    getAboutContent(),
    getAboutSettings(),
  ]);

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <PortalAboutContent {...aboutContent} settings={aboutSettings} />
      </main>
      <PortalFooter />
    </>
  );
}
