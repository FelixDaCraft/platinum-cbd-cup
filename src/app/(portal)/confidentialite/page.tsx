import type { Metadata } from "next";
import Link from "next/link";

import {
  ASSOCIATION,
  KeyValues,
  LegalPage,
  LegalSection,
  List,
  P,
} from "../_components/legal-page";
import { canonical } from "../_lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: canonical("/confidentialite") },
  title: "Confidentialité",
  description:
    "Quelles données la Platinum CBD Cup collecte, pourquoi, combien de temps, et comment exercer vos droits.",
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      eyebrow="Données personnelles"
      eyebrowIdx={9}
      title="Confidentialité"
      lede="Ce que nous collectons, pourquoi, combien de temps nous le gardons, et comment reprendre la main dessus."
      updatedAt="24 septembre 2026"
    >
      <LegalSection numeral="1" title="Responsable du traitement">
        <P>
          Le responsable du traitement est l&apos;association {ASSOCIATION.name},{" "}
          {ASSOCIATION.address}, joignable à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>.
          L&apos;association n&apos;a pas désigné de délégué à la protection des
          données : les demandes sont traitées directement à cette adresse.
        </P>
      </LegalSection>

      <LegalSection numeral="2" title="Ce que nous collectons, et pourquoi">
        <P>
          Nous ne collectons que ce qui sert au déroulement du concours. Aucune
          donnée n&apos;est vendue, louée, ni transmise à des fins publicitaires.
        </P>

        <P>
          <strong>Tout compte.</strong> Adresse email, nom, mot de passe
          (conservé sous forme d&apos;empreinte chiffrée, jamais en clair), rôle,
          adresse IP et navigateur des sessions ouvertes. Finalité : créer et
          sécuriser l&apos;accès. Base légale : exécution du contrat
          d&apos;inscription, et intérêt légitime pour la sécurité des comptes.
        </P>

        <P>
          <strong>Producteurs participants.</strong> Raison sociale, marque,
          SIRET, adresse, téléphone, site web, logo, et les produits inscrits.
          Finalité : gérer l&apos;inscription, l&apos;anonymisation des
          échantillons et la facturation. Base légale : exécution du contrat, et
          obligation légale pour les pièces comptables.
        </P>

        <P>
          <strong>Jurés.</strong> Nom d&apos;affichage, domaine
          d&apos;expertise, biographie, notes et commentaires rédigés. Finalité :
          constituer les panels et produire les résultats. Base légale :
          exécution du contrat qui nous lie au juré.
        </P>

        <P>
          <strong>Formulaire de contact.</strong> Nom, adresse email, sujet et
          message. Finalité : répondre à votre demande. Base légale : intérêt
          légitime à traiter les sollicitations qui nous sont adressées.
        </P>

        <P>
          <strong>Lettre d&apos;information.</strong> Adresse email et nom.
          Finalité : vous envoyer les actualités du concours. Base légale :
          votre consentement, retirable à tout moment par le lien de
          désinscription présent dans chaque envoi.
        </P>

        <P>
          <strong>Paiements.</strong> Nous conservons le montant, la date, la
          référence de transaction et le numéro de facture.{" "}
          <strong>
            Aucune donnée de carte bancaire ne transite ni n&apos;est stockée sur
            nos serveurs
          </strong>{" "}
          : la saisie se fait intégralement sur la page sécurisée de notre
          prestataire de paiement.
        </P>
      </LegalSection>

      <LegalSection numeral="3" title="Combien de temps">
        <KeyValues
          rows={[
            {
              k: "Compte et profil",
              v: "Durée de la participation, puis 3 ans sans activité",
            },
            {
              k: "Notes et résultats",
              v: "Conservés durablement : ils constituent le palmarès public",
            },
            {
              k: "Factures et pièces comptables",
              v: "10 ans (obligation légale)",
            },
            { k: "Messages de contact", v: "3 ans après le dernier échange" },
            {
              k: "Lettre d'information",
              v: "Jusqu'à désinscription, puis suppression",
            },
            { k: "Journaux de connexion", v: "12 mois" },
          ]}
        />
        <P>
          Les notes et distinctions restent associées au produit et au
          producteur : un palmarès dont on pourrait retirer des lignes
          n&apos;aurait aucune valeur. En cas de suppression de compte, les
          données d&apos;identification sont anonymisées, mais les résultats
          publiés demeurent.
        </P>
      </LegalSection>

      <LegalSection numeral="4" title="Qui d'autre y a accès">
        <P>
          Nos données sont hébergées sur notre propre matériel, en France. Nous
          faisons appel à un petit nombre de sous-traitants, chacun pour une
          fonction précise :
        </P>
        <List>
          <li>
            <strong>Resend</strong> — envoi des emails transactionnels
            (vérification d&apos;adresse, réinitialisation de mot de passe,
            invitations, résultats). Données traitées dans l&apos;Union
            européenne.
          </li>
          <li>
            <strong>Viva.com</strong> — encaissement des frais
            d&apos;inscription. Seul destinataire des données de carte, qu&apos;il
            collecte directement.
          </li>
          <li>
            <strong>Cloudflare</strong> — distribution du site et protection
            contre les attaques. Traite les adresses IP des visiteurs comme
            intermédiaire réseau.
          </li>
        </List>
        <P>
          Aucun autre transfert n&apos;est effectué. Les résultats du concours
          sont en revanche publics par nature : nom du producteur, marque,
          produit et distinction sont publiés sur ce site.
        </P>
      </LegalSection>

      <LegalSection numeral="5" title="Cookies">
        <P>
          Ce site n&apos;utilise <strong>aucun cookie publicitaire ni aucun
          traceur d&apos;audience</strong>. Nous ne déposons que les cookies
          strictement nécessaires à son fonctionnement : le cookie de session
          qui vous maintient connecté, et les jetons de sécurité des
          formulaires. Ils ne requièrent pas votre consentement préalable et
          disparaissent à l&apos;expiration de la session.
        </P>
        <P>
          Les polices de caractères sont chargées depuis Google Fonts, ce qui
          transmet votre adresse IP à Google au moment de l&apos;affichage.
        </P>
      </LegalSection>

      <LegalSection numeral="6" title="Vos droits">
        <P>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation, d&apos;opposition et de portabilité,
          ainsi que du droit de définir des directives sur le sort de vos
          données après votre décès.
        </P>
        <P>
          Depuis votre espace, la page de profil permet d&apos;exporter vos
          données et de demander la suppression de votre compte. Vous pouvez
          aussi écrire à{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a> : nous
          répondons sous un mois.
        </P>
        <P>
          Si notre réponse ne vous satisfait pas, vous pouvez saisir la
          Commission nationale de l&apos;informatique et des libertés, 3 place de
          Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou déposer une plainte sur{" "}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            target="_blank"
            rel="noopener noreferrer"
          >
            cnil.fr
          </a>
          .
        </P>
      </LegalSection>

      <LegalSection numeral="7" title="Sécurité">
        <P>
          Les échanges avec le site sont chiffrés de bout en bout. Les mots de
          passe ne sont jamais stockés en clair. Les identifiants de nos
          prestataires sont chiffrés au repos. Les accès à la base sont
          restreints aux seules personnes qui en ont besoin, et les données font
          l&apos;objet d&apos;une sauvegarde quotidienne.
        </P>
        <P>
          Les produits sont anonymisés avant notation : le panel ne connaît ni
          la marque, ni le producteur. Cette séparation est technique, pas
          seulement organisationnelle.
        </P>
      </LegalSection>

      <LegalSection numeral="8" title="Modifications">
        <P>
          Cette politique peut évoluer. La date de dernière mise à jour figure
          en tête de page. Toute modification substantielle vous sera signalée
          par email si vous disposez d&apos;un compte. Les conditions de
          participation figurent quant à elles dans le{" "}
          <Link href="/reglement">règlement du concours</Link>.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
