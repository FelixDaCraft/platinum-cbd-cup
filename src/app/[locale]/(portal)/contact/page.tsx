import { getTranslations } from "next-intl/server";
import { Link } from "~/i18n/navigation";
import { ContactForm } from "./_components/contact-form";
import { localizedMetadata } from "../_lib/page-metadata";
import { PageHead, Sparkle } from "~/components/portal/street/street";

export function generateMetadata() {
  return localizedMetadata("/contact", "contact");
}

const CONTACT_EMAIL = "contact@platinumcbdcup.eu";

export default async function ContactPage() {
  const t = await getTranslations("contact");
  return (
    <div className="pg editorial">
      <PageHead
        edition={
          <>
            {t("barCompetition")}
            <Sparkle size={12} />
            {t("barRegistration")}
            <Sparkle size={12} />
            {t("barPartnerships")}
          </>
        }
        title={t("title")}
        lede={t("lede")}
        seed={12}
      />

      <div className="contact-layout">
        <ContactForm />

        <aside className="pg-tile" aria-labelledby="contact-direct">
          <h2 id="contact-direct" style={{ margin: 0, fontSize: 22 }}>
            {t("byEmail")}
          </h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="pg-link">
              {CONTACT_EMAIL}
            </a>
          </p>
          <h2 style={{ margin: "12px 0 0", fontSize: 22 }}>{t("pressTitle")}</h2>
          <p>
            {t.rich("pressText", {
              link: (chunks) => (
                <Link href="/press" className="pg-link">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </aside>
      </div>
    </div>
  );
}
