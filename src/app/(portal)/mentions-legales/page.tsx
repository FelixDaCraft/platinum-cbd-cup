import type { Metadata } from "next";
import Link from "next/link";

import {
  ASSOCIATION,
  KeyValues,
  LegalPage,
  LegalSection,
  P,
} from "../_components/legal-page";
import { canonical } from "../_lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/mentions-legales") },
  title: "Mentions légales",
  description:
    "Éditeur, hébergement et propriété intellectuelle du site de la Platinum CBD Cup.",
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      lede="Informations exigées par l'article 6-III de la loi pour la confiance dans l'économie numérique."
      updatedAt="24 septembre 2026"
    >
      <LegalSection numeral="1" title="Éditeur du site">
        <P>
          Le site {ASSOCIATION.site} est édité par l&apos;association{" "}
          {ASSOCIATION.name}, qui organise également le concours Platinum CBD
          Cup.
        </P>
        <KeyValues
          rows={[
            { k: "Dénomination", v: ASSOCIATION.name },
            { k: "Forme juridique", v: ASSOCIATION.legalForm },
            { k: "N° RNA", v: ASSOCIATION.rna },
            { k: "SIREN", v: ASSOCIATION.siren },
            { k: "SIRET (siège)", v: ASSOCIATION.siret },
            { k: "Code APE", v: ASSOCIATION.ape },
            { k: "Siège social", v: ASSOCIATION.address },
            {
              k: "Contact",
              v: (
                <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>
              ),
            },
            { k: "TVA", v: ASSOCIATION.vatMention },
          ]}
        />
        <P>
          L&apos;association ne poursuit aucun but lucratif et n&apos;est pas
          assujettie à la taxe sur la valeur ajoutée.
        </P>
      </LegalSection>

      <LegalSection numeral="2" title="Direction de la publication">
        <P>
          La direction de la publication est assurée par le président de
          l&apos;association, à l&apos;adresse du siège social indiquée ci-dessus.
          Toute demande relative au contenu éditorial peut être adressée à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>.
        </P>
      </LegalSection>

      <LegalSection numeral="3" title="Hébergement">
        <P>
          Le site est hébergé par l&apos;association elle-même, sur son propre
          matériel situé en France, au siège social indiqué à l&apos;article 1.
        </P>
        <P>
          La distribution du site sur Internet et la protection réseau sont
          assurées par Cloudflare, Inc., 101 Townsend Street, San Francisco, CA
          94107, États-Unis. Aucune donnée de la base n&apos;est stockée chez ce
          prestataire, qui intervient comme intermédiaire technique.
        </P>
      </LegalSection>

      <LegalSection numeral="4" title="Propriété intellectuelle">
        <P>
          La structure du site, son identité visuelle, ses textes, le nom
          « Platinum CBD Cup » et les visuels de distinction sont la propriété
          de l&apos;association, sauf mention contraire.
        </P>
        <P>
          Les noms, marques, logos et photographies des producteurs, des
          partenaires et des produits présentés restent la propriété de leurs
          titulaires respectifs. Ils sont reproduits dans le cadre de la
          présentation du concours et de la publication de ses résultats.
        </P>
        <P>
          Les lauréats sont autorisés à reproduire la distinction obtenue dans
          les conditions fixées à l&apos;article 9 du{" "}
          <Link href="/reglement">règlement du concours</Link>.
        </P>
      </LegalSection>

      <LegalSection numeral="5" title="Données personnelles et cookies">
        <P>
          Le traitement des données personnelles est décrit dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>, qui
          précise également les cookies utilisés.
        </P>
      </LegalSection>

      <LegalSection numeral="6" title="Signalement d'un contenu">
        <P>
          Tout contenu que vous estimeriez illicite peut être signalé à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>, en
          précisant l&apos;adresse de la page concernée et le motif du
          signalement. L&apos;association examine chaque signalement et retire
          sans délai tout contenu manifestement illicite porté à sa
          connaissance.
        </P>
      </LegalSection>

      <LegalSection numeral="7" title="Droit applicable">
        <P>
          Le présent site et les présentes mentions sont soumis au droit
          français.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
