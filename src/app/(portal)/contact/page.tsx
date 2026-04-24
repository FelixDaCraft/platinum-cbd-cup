import type { Metadata } from "next";
import { Eyebrow } from "~/components/portal/platinum";
import { ContactForm } from "./_components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe Platinum CBD Cup pour toute question ou demande d'information.",
};

const CONTACT_INFO = {
  email: "contact@platinum-cbd-cup.fr",
  hours: "Lun–Ven · 09h–18h",
  address: "Europe · Indépendant",
};

export default function ContactPage() {
  return (
    <div className="page-enter">
      {/* Hero */}
      <section style={{ paddingTop: 40, paddingBottom: 56 }}>
        <Eyebrow idx={6}>Contact</Eyebrow>
        <h1 className="display" style={{ marginTop: 20, marginBottom: 20 }}>
          Contact<em>.</em>
        </h1>
        <p className="lede" style={{ maxWidth: 520 }}>
          Une question sur la compétition, les inscriptions ou les partenariats ?
          Nous lisons chaque message et répondons sous 48 h ouvrées.
        </p>
      </section>

      {/* Two-column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr .9fr",
          gap: 32,
          alignItems: "start",
          marginBottom: 80,
        }}
        className="contact-grid"
      >
        {/* Left: form */}
        <ContactForm />

        {/* Right: info card */}
        <div className="card">
          <Eyebrow>Coordonnées</Eyebrow>
          <div style={{ marginTop: 20 }}>
            {[
              { k: "Email", v: CONTACT_INFO.email },
              { k: "Horaires", v: CONTACT_INFO.hours },
              { k: "Juridiction", v: CONTACT_INFO.address },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="kv"
                style={{ paddingBlock: 14, borderBottom: "1px solid var(--line)" }}
              >
                <span className="kv-k">{k}</span>
                <span className="kv-v">{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <Eyebrow>Presse &amp; partenariats</Eyebrow>
            <p
              style={{
                color: "var(--fg-2)",
                fontSize: 13,
                lineHeight: 1.6,
                marginTop: 10,
              }}
            >
              Pour les demandes presse, accès média kit ou opportunités de
              partenariat, utilisez le formulaire ci-contre en précisant votre
              sujet.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
