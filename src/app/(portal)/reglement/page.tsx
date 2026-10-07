import type { Metadata } from "next";
import Link from "next/link";

import {
  ASSOCIATION,
  LegalPage,
  LegalSection,
  List,
  P,
} from "../_components/legal-page";
import { canonical } from "../_lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/reglement") },
  title: "Règlement du concours",
  description:
    "Conditions de participation à la Platinum CBD Cup : inscription, frais, anonymisation, notation à l'aveugle, résultats et usage des distinctions.",
  robots: { index: true, follow: true },
};

export default function ReglementPage() {
  return (
    <LegalPage
      title="Règlement"
      lede="Les conditions de participation à la Platinum CBD Cup. Elles valent conditions générales pour l'inscription des produits."
      updatedAt="24 septembre 2026"
    >
      <LegalSection numeral="1" title="Objet et organisateur">
        <P>
          Le présent règlement fixe les conditions de participation à la
          Platinum CBD Cup, concours d&apos;évaluation sensorielle de produits à
          base de cannabidiol, organisé par l&apos;association{" "}
          {ASSOCIATION.name} ({ASSOCIATION.legalForm}, RNA {ASSOCIATION.rna},
          SIRET {ASSOCIATION.siret}), dont le siège est {ASSOCIATION.address}.
        </P>
        <P>
          Toute inscription vaut acceptation pleine et entière du présent
          règlement dans sa version en ligne au jour de l&apos;inscription.
        </P>
      </LegalSection>

      <LegalSection numeral="2" title="Qui peut participer">
        <P>
          La participation est ouverte aux professionnels — producteurs,
          transformateurs et distributeurs — disposant d&apos;un numéro
          d&apos;identification d&apos;entreprise et commercialisant légalement
          les produits présentés.
        </P>
        <P>
          Les membres du jury, les membres du bureau de l&apos;association et
          les personnes ayant participé à l&apos;organisation de l&apos;édition
          ne peuvent pas y inscrire de produit. Un participant inscrit à une
          édition ne peut pas siéger dans le jury de cette même édition ; cette
          incompatibilité est appliquée automatiquement par la plateforme.
        </P>
      </LegalSection>

      <LegalSection numeral="3" title="Conformité des produits">
        <P>
          Le participant garantit que chaque produit inscrit est conforme à la
          réglementation qui lui est applicable dans son pays de
          commercialisation, notamment quant à la teneur en
          delta-9-tétrahydrocannabinol, à la variété de chanvre employée, à
          l&apos;étiquetage et aux allégations commerciales.
        </P>
        <P>
          L&apos;association n&apos;exerce aucun contrôle réglementaire et ne
          délivre aucune certification de conformité. Une distinction obtenue
          récompense une évaluation sensorielle : elle ne constitue ni une
          autorisation de mise sur le marché, ni une allégation de santé, ni une
          attestation de légalité.
        </P>
        <P>
          L&apos;association se réserve le droit d&apos;écarter à tout moment,
          sans remboursement, un produit dont la conformité serait manifestement
          douteuse ou dont l&apos;analyse ferait apparaître un dépassement des
          seuils applicables.
        </P>
      </LegalSection>

      <LegalSection numeral="4" title="Inscription et frais">
        <P>
          L&apos;inscription s&apos;effectue en ligne, par produit, pendant la
          période d&apos;ouverture indiquée sur la page de l&apos;édition
          concernée. Elle n&apos;est définitive qu&apos;après règlement des
          frais et réception de l&apos;échantillon.
        </P>
        <P>
          Les frais d&apos;inscription sont indiqués avant validation du
          paiement. L&apos;association n&apos;étant pas assujettie à la TVA, les
          montants affichés sont nets et aucune taxe ne s&apos;y ajoute. Une
          facture numérotée est émise à la confirmation du paiement et reste
          disponible depuis l&apos;espace producteur.
        </P>
        <P>
          Le paiement est encaissé par notre prestataire Viva.com. Aucune donnée
          de carte bancaire ne transite par nos serveurs.
        </P>
      </LegalSection>

      <LegalSection numeral="5" title="Annulation et remboursement">
        <P>
          L&apos;inscription porte sur un service lié à un événement à date
          déterminée. À ce titre, et s&apos;agissant d&apos;une relation entre
          professionnels, elle n&apos;ouvre pas de droit de rétractation.
        </P>
        <P>
          Toute demande d&apos;annulation ou de remboursement est néanmoins
          examinée au cas par cas par l&apos;association. Adressez-la à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a> en
          précisant la référence de l&apos;inscription et le motif. Si
          l&apos;association annule une édition de son fait, les frais
          d&apos;inscription sont intégralement remboursés.
        </P>
      </LegalSection>

      <LegalSection numeral="6" title="Échantillons">
        <P>
          Le participant fait parvenir, à ses frais et sous sa responsabilité,
          la quantité d&apos;échantillon demandée pour chaque produit inscrit,
          dans les délais communiqués. Un échantillon parvenu hors délai, en
          quantité insuffisante ou dans un conditionnement dégradé peut être
          écarté de l&apos;évaluation.
        </P>
        <P>
          Les échantillons ne sont pas restitués. Ils sont consommés lors de
          l&apos;évaluation ou détruits à l&apos;issue de l&apos;édition.
        </P>
      </LegalSection>

      <LegalSection numeral="7" title="Anonymisation et évaluation">
        <P>
          Chaque produit reçoit un code anonyme dès la confirmation de son
          inscription. Le jury évalue les produits sous ce seul code : il ne
          connaît ni la marque, ni le producteur, ni le prix. La correspondance
          entre code et producteur n&apos;est accessible qu&apos;à
          l&apos;organisation.
        </P>
        <P>
          L&apos;évaluation est conduite par un panel indépendant, selon les
          critères et les coefficients propres à chaque catégorie, publiés sur
          la page de l&apos;édition. La note finale d&apos;un produit est la
          moyenne pondérée des notes du panel.
        </P>
        <P>
          En cas d&apos;égalité, le classement retient le produit ayant reçu le
          plus grand nombre d&apos;évaluations ; à défaut, le produit inscrit le
          premier. Les décisions du jury sont souveraines et ne sont pas
          motivées individuellement.
        </P>
      </LegalSection>

      <LegalSection numeral="8" title="Résultats et publication">
        <P>
          Les résultats sont publiés sur ce site à la date annoncée pour
          l&apos;édition. Sont rendus publics : le nom du producteur, la marque,
          le nom du produit, sa catégorie, son classement et la distinction
          obtenue. Le détail des notes par critère et les commentaires du jury
          sont communiqués au seul participant concerné.
        </P>
        <P>
          Le palmarès a vocation à rester consultable durablement, y compris
          après la fin d&apos;une édition.
        </P>
      </LegalSection>

      <LegalSection numeral="9" title="Usage des distinctions">
        <P>
          Le lauréat est autorisé à reproduire la distinction obtenue sur ses
          supports de communication et son conditionnement, à titre gratuit et
          sans limitation de durée, aux conditions suivantes :
        </P>
        <List>
          <li>
            la mention doit indiquer l&apos;année de l&apos;édition, la
            catégorie et le produit exact récompensé ;
          </li>
          <li>
            elle ne peut être étendue à un autre produit, ni à une autre
            gamme, ni laisser croire à une récompense plus élevée que celle
            obtenue ;
          </li>
          <li>
            le visuel de la distinction ne peut être ni modifié, ni recoloré, ni
            recomposé.
          </li>
        </List>
        <P>
          Tout usage non conforme peut entraîner le retrait de
          l&apos;autorisation et de la distinction. Le participant autorise
          l&apos;association à citer son nom, sa marque et son produit dans la
          communication relative au concours.
        </P>
      </LegalSection>

      <LegalSection numeral="10" title="Responsabilité">
        <P>
          L&apos;association met en œuvre les moyens nécessaires au bon
          déroulement du concours. Sa responsabilité ne saurait être engagée en
          cas de force majeure, d&apos;interruption du service en ligne, ou de
          perte ou détérioration d&apos;un échantillon lors de son acheminement.
        </P>
        <P>
          Le participant demeure seul responsable de la conformité, de la
          qualité et de la sécurité des produits qu&apos;il présente et
          commercialise.
        </P>
      </LegalSection>

      <LegalSection numeral="11" title="Données personnelles">
        <P>
          Les traitements de données mis en œuvre pour le concours sont décrits
          dans la <Link href="/confidentialite">politique de confidentialité</Link>.
        </P>
      </LegalSection>

      <LegalSection numeral="12" title="Modification du règlement">
        <P>
          L&apos;association peut modifier le présent règlement. La version
          applicable à une inscription est celle en ligne au jour de cette
          inscription. Toute modification substantielle en cours d&apos;édition
          est notifiée par email aux participants.
        </P>
      </LegalSection>

      <LegalSection numeral="13" title="Litiges">
        <P>
          Le présent règlement est soumis au droit français. En cas de
          différend, les parties rechercheront une solution amiable avant toute
          action contentieuse. À défaut d&apos;accord, le litige relève des
          tribunaux compétents.
        </P>
        <P>
          Pour toute question relative au présent règlement, écrivez à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
