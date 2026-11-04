/**
 * Où en est le colis d'échantillons d'une inscription.
 *
 * Un colis par inscription : le producteur déclare l'avoir expédié (date,
 * transporteur, numéro de suivi), l'organisation marque ensuite chaque
 * produit reçu au déballage. Ce module croise les deux pour le tableau de
 * bord. Sans dépendance serveur : partagé par l'API et les deux interfaces.
 */

const TZ = "Europe/Paris";

/** Décalage de Paris sur l'UTC à cet instant, en minutes (+60 l'hiver, +120 l'été). */
function parisOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Fin de la date limite de réception des échantillons (`cups.samples_deadline`,
 * jour civil « AAAA-MM-JJ ») : 23:59:59 ce jour-là à Paris. Null quand la cup
 * n'en annonce pas, ou que la valeur n'est pas une date réelle : aucune
 * échéance n'est alors inventée.
 */
export function samplesDeadlineEnd(day: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(year, month - 1, date, 23, 59, 59);
  const check = new Date(utc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) return null;
  return new Date(utc - parisOffsetMinutes(check) * 60_000);
}

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

/**
 * `deadline` : fin de la date limite de la cup (`samplesDeadlineEnd`). Sans
 * date limite, un colis n'est jamais « en retard ».
 */
export function parcelState(
  facts: ParcelFacts,
  deadline: Date | null,
  now: Date = new Date()
): ParcelState {
  if (!facts.competing || facts.productStatuses.length === 0) return "none";

  // Reçu : tous les échantillons sont déballés. Une réception partielle
  // laisse l'état d'expédition, pour que le manque reste visible.
  if (facts.productStatuses.every((status) => status !== "pending")) return "received";

  if (deadline) {
    if (now > deadline) return "late";
    if (!facts.shippedAt && now.getTime() >= deadline.getTime() - LATE_WARNING_DAYS * DAY_MS) {
      return "late";
    }
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

/**
 * Un numéro de suivi ne sert à rien sans le transporteur qui l'a émis : dès
 * qu'un numéro est saisi, le transporteur devient obligatoire. Sans numéro,
 * il reste facultatif. Partagé par la validation serveur et les formulaires.
 */
export function isCarrierMissing(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): boolean {
  return !!trackingNumber?.trim() && !carrier?.trim();
}

/**
 * Date limite à rappeler au producteur sur son tableau de bord : inscription
 * payée, colis ni déclaré ni reçu, et date annoncée par la cup. Sinon null.
 */
export function samplesReminder(
  facts: ParcelFacts & { samplesDeadline: string | null }
): string | null {
  if (!facts.competing || facts.productStatuses.length === 0) return null;
  if (facts.shippedAt || isParcelInHands(facts.productStatuses)) return null;
  return samplesDeadlineEnd(facts.samplesDeadline) ? facts.samplesDeadline : null;
}

/** Une inscription vue du suivi des colis, pour le colis commun. */
export interface RegistrationParcelFacts {
  id: string;
  producerId: string;
  cupId: string;
  /** Payée ou importée. */
  competing: boolean;
  productStatuses: string[];
  shipmentGroupId: string | null;
  createdAt: Date | string;
}

/**
 * Inscriptions qu'un colis peut aussi contenir : les autres inscriptions
 * payées du même producteur sur la même cup, avec des produits, dont rien
 * n'est encore reçu.
 */
export function shipmentCandidates<T extends RegistrationParcelFacts>(self: RegistrationParcelFacts, all: T[]): T[] {
  return all.filter(
    (r) =>
      r.id !== self.id &&
      r.producerId === self.producerId &&
      r.cupId === self.cupId &&
      r.competing &&
      r.productStatuses.length > 0 &&
      !isParcelInHands(r.productStatuses)
  );
}

/** Autres inscriptions du même colis commun. */
export function sameParcelRegistrations<T extends RegistrationParcelFacts>(self: RegistrationParcelFacts, all: T[]): T[] {
  if (!self.shipmentGroupId) return [];
  return all.filter((r) => r.id !== self.id && r.shipmentGroupId === self.shipmentGroupId);
}
