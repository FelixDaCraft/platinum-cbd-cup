import type { Metadata } from "next";
import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";
import { ContactPage } from "~/components/portal/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez-nous pour toute question ou demande d'information.",
};

/**
 * Single-tenant contact info for Platinum CBD Cup.
 */
function getContactInfo() {
  return {
    email: "contact@platinum-cbd-cup.fr",
    phone: null,
    address: null,
    hours: "Lun-Ven: 9h-18h",
  };
}

export default function PortalContactPage() {
  const contactInfo = getContactInfo();

  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">
        <ContactPage contactInfo={contactInfo} />
      </main>
      <PortalFooter />
    </>
  );
}
