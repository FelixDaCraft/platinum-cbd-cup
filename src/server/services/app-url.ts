/**
 * URL publique de l'application, source unique.
 *
 * L'audit avait relevé huit définitions concurrentes avec trois replis
 * différents : selon le canal (email, QR code, sitemap) un même déploiement
 * produisait des liens divergents, et les replis `http://localhost:3000`
 * masquaient la variable manquante au lieu de la signaler.
 */

/**
 * Base URL du portail, sans barre oblique finale.
 *
 * Lue via `process.env` et non via `~/env` : ce module est importé
 * transitivement par des services dont les tests ne fournissent pas
 * d'environnement complet, et importer `~/env` déclencherait sa validation au
 * chargement du module.
 *
 * `BETTER_AUTH_URL` sert de second recours : les deux variables décrivent la
 * même adresse et `env.js` les exige toutes les deux. Aucun repli local : un
 * lien `localhost` dans un email ou sur une étiquette imprimée est
 * irrécupérable, mieux vaut échouer bruyamment.
 */
export function getPortalBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL (ou à défaut BETTER_AUTH_URL) est requis pour construire une URL publique."
    );
  }

  return baseUrl.replace(/\/+$/, "");
}
