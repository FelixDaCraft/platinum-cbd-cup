import { getTranslations } from "next-intl/server";

import {
  ASSOCIATION,
  KeyValues,
  LegalPage,
  LegalSection,
  legalRich,
  List,
  P,
} from "../_components/legal-page";
import { localizedMetadata } from "../_lib/page-metadata";

export function generateMetadata() {
  return localizedMetadata("/confidentialite", "privacy", {
    robots: { index: true, follow: true },
  });
}

/**
 * Date de la dernière révision : ajout du cookie de langue (NEXT_LOCALE)
 * avec la version multilingue du site.
 */
const UPDATED_AT = new Date("2026-11-03T12:00:00Z");

const RETENTION = ["account", "scores", "invoices", "contact", "newsletter", "logs"] as const;
const PROCESSORS = ["resend", "viva", "cloudflare"] as const;
const COLLECTED = ["account", "producers", "visuals", "jurors", "contact", "newsletter", "payments"] as const;

export default async function ConfidentialitePage() {
  const t = await getTranslations("privacy");
  const rich = (key: string) =>
    t.rich(key, { ...legalRich, name: ASSOCIATION.name, address: ASSOCIATION.address });

  return (
    <LegalPage title={t("title")} lede={t("lede")} updatedAt={UPDATED_AT}>
      <LegalSection numeral="1" title={t("s1.title")}>
        <P>{rich("s1.p1")}</P>
      </LegalSection>

      <LegalSection numeral="2" title={t("s2.title")}>
        <P>{rich("s2.intro")}</P>
        {COLLECTED.map((key) => (
          <P key={key}>{rich(`s2.${key}`)}</P>
        ))}
      </LegalSection>

      <LegalSection numeral="3" title={t("s3.title")}>
        <KeyValues
          rows={RETENTION.map((key) => ({
            k: t(`s3.rows.${key}.k`),
            v: t(`s3.rows.${key}.v`),
          }))}
        />
        <P>{rich("s3.p1")}</P>
      </LegalSection>

      <LegalSection numeral="4" title={t("s4.title")}>
        <P>{rich("s4.intro")}</P>
        <List>
          {PROCESSORS.map((key) => (
            <li key={key}>{rich(`s4.${key}`)}</li>
          ))}
        </List>
        <P>{rich("s4.p1")}</P>
      </LegalSection>

      <LegalSection numeral="5" title={t("s5.title")}>
        <P>{rich("s5.p1")}</P>
        <P>{rich("s5.p2")}</P>
      </LegalSection>

      <LegalSection numeral="6" title={t("s6.title")}>
        <P>{rich("s6.p1")}</P>
        <P>{rich("s6.p2")}</P>
        <P>{rich("s6.p3")}</P>
      </LegalSection>

      <LegalSection numeral="7" title={t("s7.title")}>
        <P>{rich("s7.p1")}</P>
        <P>{rich("s7.p2")}</P>
      </LegalSection>

      <LegalSection numeral="8" title={t("s8.title")}>
        <P>{rich("s8.p1")}</P>
      </LegalSection>
    </LegalPage>
  );
}
