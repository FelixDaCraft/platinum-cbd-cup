/**
 * Où en est le colis d'échantillons d'une inscription.
 *
 * Un colis par inscription : le producteur déclare l'avoir expédié (date,
 * transporteur, numéro de suivi), l'organisation marque ensuite chaque
 * produit reçu au déballage. Ce module croise les deux pour le tableau de
 * bord. Sans dépendance serveur : partagé par l'API et les deux interfaces.
 */

/**
 * Date limite de réception des échantillons de l'édition 2027 : le
 * 9 janvier, fin de journée à Paris. Pas de colonne en base tant qu'il n'y a
 * qu'une édition à suivre.
 */
export const SAMPLES_RECEPTION_DEADLINE = new Date("2027-01-09T23:59:59+01:00");

/** Fenêtre avant l'échéance où un colis non expédié passe « en retard ». */
export const LATE_WARNING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ParcelState = "none" | "shipped" | "received" | "late";

export interface ParcelFacts {
  /** Inscription payée ou importée : ses produits concourent. */
  competing: boolean;
  shippedAt: Date | null;
  productStatuses: string[];
}

/** Dès qu'un produit est reçu, le colis est entre les mains de l'organisation. */
export function isParcelInHands(productStatuses: string[]): boolean {
  return productStatuses.some((status) => status !== "pending");
}

export function parcelState(
  facts: ParcelFacts,
  now: Date = new Date(),
  deadline: Date = SAMPLES_RECEPTION_DEADLINE
): ParcelState {
  if (!facts.competing || facts.productStatuses.length === 0) return "none";

  // Reçu : tous les échantillons sont déballés. Une réception partielle
  // laisse l'état d'expédition, pour que le manque reste visible.
  if (facts.productStatuses.every((status) => status !== "pending")) return "received";

  if (now > deadline) return "late";
  if (!facts.shippedAt && now.getTime() >= deadline.getTime() - LATE_WARNING_DAYS * DAY_MS) {
    return "late";
  }

  return facts.shippedAt ? "shipped" : "none";
}

/** Transporteurs proposés au producteur, avec leur page de suivi. */
export const SHIPPING_CARRIERS = [
  "colissimo",
  "chronopost",
  "dpd",
  "ups",
  "dhl",
  "mondial_relay",
  "gls",
] as const;
export type ShippingCarrier = (typeof SHIPPING_CARRIERS)[number];

const CARRIERS: Record<ShippingCarrier, { label: string; url: (n: string) => string }> = {
  colissimo: {
    label: "La Poste / Colissimo",
    url: (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`,
  },
  chronopost: {
    label: "Chronopost",
    url: (n) => `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${n}`,
  },
  dpd: {
    label: "DPD",
    url: (n) => `https://tracking.dpd.de/status/fr_FR/parcel/${n}`,
  },
  ups: {
    label: "UPS",
    url: (n) => `https://www.ups.com/track?tracknum=${n}`,
  },
  dhl: {
    label: "DHL",
    url: (n) => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${n}&submit=1`,
  },
  mondial_relay: {
    label: "Mondial Relay",
    url: (n) => `https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=${n}`,
  },
  gls: {
    label: "GLS",
    url: (n) => `https://gls-group.com/FR/fr/suivi-colis/?match=${n}`,
  },
};

export function isKnownCarrier(carrier: string | null | undefined): carrier is ShippingCarrier {
  return !!carrier && Object.hasOwn(CARRIERS, carrier);
}

/** Nom affiché : celui du transporteur connu, sinon le texte saisi. */
export function carrierLabel(carrier: string | null | undefined): string | null {
  if (!carrier) return null;
  return isKnownCarrier(carrier) ? CARRIERS[carrier].label : carrier;
}

/** Page de suivi du colis, quand le transporteur est connu. */
export function trackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  if (!trackingNumber || !isKnownCarrier(carrier)) return null;
  return CARRIERS[carrier].url(encodeURIComponent(trackingNumber));
}
