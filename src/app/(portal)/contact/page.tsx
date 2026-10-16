import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./_components/contact-form";
import { canonical } from "../_lib/seo";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/contact") },
  title: "Contact",
  description: "Contactez l'équipe Platinum CBD Cup pour toute question ou demande d'information.",
};

const CONTACT_EMAIL = "contact@platinumcbdcup.eu";

export default function ContactPage() {
  return (
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            Concours
            <Sparkle size={12} />
            Inscriptions
            <Sparkle size={12} />
            Partenariats
          </>
        }
        title="Contact"
        lede="Une question sur le concours, les inscriptions, les résultats ou un partenariat ? Nous lisons chaque message et vous répondons par email."
        seed={12}
      />

      <div className="contact-layout">
        <ContactForm />

        <aside className="pg-tile" aria-labelledby="contact-direct">
          <h2 id="contact-direct" style={{ margin: 0, fontSize: 22 }}>
            Par email
          </h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="pg-link">
              {CONTACT_EMAIL}
            </a>
          </p>
          <h2 style={{ margin: "12px 0 0", fontSize: 22 }}>Presse et partenariats</h2>
          <p>
            Choisissez le sujet « Presse » ou « Partenariat » dans le formulaire.
            Les journalistes trouveront aussi communiqués et kit média dans l&apos;
            <Link href="/press" className="pg-link">
              espace presse
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
