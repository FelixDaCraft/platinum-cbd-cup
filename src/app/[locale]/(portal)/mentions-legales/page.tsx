import { getTranslations } from "next-intl/server";

import {
  ASSOCIATION,
  KeyValues,
  LegalPage,
  LegalSection,
  legalRich,
  P,
} from "../_components/legal-page";
import { localizedMetadata } from "../_lib/page-metadata";

export function generateMetadata() {
  return localizedMetadata("/mentions-legales", "legalNotice", {
    robots: { index: true, follow: true },
  });
}

/** Date de la dernière révision du texte (toutes langues). */
const UPDATED_AT = new Date("2026-09-24T12:00:00Z");

export default async function MentionsLegalesPage() {
  const t = await getTranslations("legalNotice");
  const rich = (key: string) => t.rich(key, { ...legalRich, site: ASSOCIATION.site, name: ASSOCIATION.name });

  return (
    <LegalPage title={t("title")} lede={t("lede")} updatedAt={UPDATED_AT}>
      <LegalSection numeral="1" title={t("s1.title")}>
        <P>{rich("s1.p1")}</P>
        <KeyValues
          rows={[
            { k: t("s1.kName"), v: ASSOCIATION.name },
            { k: t("s1.kForm"), v: t("s1.vForm") },
            { k: t("s1.kRna"), v: ASSOCIATION.rna },
            { k: "SIREN", v: ASSOCIATION.siren },
            { k: t("s1.kSiret"), v: ASSOCIATION.siret },
            { k: t("s1.kApe"), v: t("s1.vApe") },
            { k: t("s1.kAddress"), v: ASSOCIATION.address },
            {
              k: t("s1.kContact"),
              v: <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>,
            },
            { k: t("s1.kVat"), v: t("s1.vVat") },
          ]}
        />
        <P>{rich("s1.p2")}</P>
      </LegalSection>

      <LegalSection numeral="2" title={t("s2.title")}>
        <P>{rich("s2.p1")}</P>
      </LegalSection>

      <LegalSection numeral="3" title={t("s3.title")}>
        <P>{rich("s3.p1")}</P>
        <P>{rich("s3.p2")}</P>
      </LegalSection>

      <LegalSection numeral="4" title={t("s4.title")}>
        <P>{rich("s4.p1")}</P>
        <P>{rich("s4.p2")}</P>
        <P>{rich("s4.p3")}</P>
      </LegalSection>

      <LegalSection numeral="5" title={t("s5.title")}>
        <P>{rich("s5.p1")}</P>
      </LegalSection>

      <LegalSection numeral="6" title={t("s6.title")}>
        <P>{rich("s6.p1")}</P>
      </LegalSection>

      <LegalSection numeral="7" title={t("s7.title")}>
        <P>{rich("s7.p1")}</P>
      </LegalSection>
    </LegalPage>
  );
}
