/**
 * Où en est le parcours d'inscription d'un producteur.
 *
 * Le statut d'une inscription (`pending_payment`, `confirmed`, `cancelled`)
 * ne dit pas pourquoi elle n'a pas abouti. Ce module le déduit des traces de
 * paiement, pour que l'organisation distingue un panier oublié d'une carte
 * refusée. Sans dépendance serveur : partagé par l'API et le dashboard.
 */

export type CheckoutState =
  | "paid"
  | "imported"
  | "cancelled"
  | "empty"
  | "cart"
  | "abandoned"
  | "declined";

export interface CheckoutFacts {
  status: string;
  productCount: number;
  paymentTransactionId: string | null;
  stripePaymentIntentId: string | null;
  invoiceNumber: string | null;
  paymentOrderCode: string | null;
  paymentAttempts: number;
  lastPaymentAttemptAt: Date | null;
  lastPaymentFailureAt: Date | null;
}

export function checkoutState(facts: CheckoutFacts): CheckoutState {
  if (facts.status === "cancelled") return "cancelled";

  if (facts.status === "confirmed") {
    // Confirmée sans aucune trace de paiement ni facture : inscription
    // importée, réglée hors du site.
    const paidOnline =
      facts.paymentTransactionId || facts.stripePaymentIntentId || facts.invoiceNumber;
    return paidOnline ? "paid" : "imported";
  }

  if (facts.productCount === 0) return "empty";

  // Refus postérieur à la dernière ouverture du paiement : c'est l'issue de
  // cette tentative. Un refus plus ancien a été suivi d'un nouvel essai.
  if (
    facts.lastPaymentFailureAt &&
    (!facts.lastPaymentAttemptAt || facts.lastPaymentFailureAt >= facts.lastPaymentAttemptAt)
  ) {
    return "declined";
  }

  // `paymentOrderCode` couvre les inscriptions antérieures au suivi des
  // tentatives.
  if (facts.paymentAttempts > 0 || facts.paymentOrderCode) return "abandoned";

  return "cart";
}

/** En lice : inscription payée ou importée, ses produits concourent. */
export function isCompeting(state: CheckoutState): boolean {
  return state === "paid" || state === "imported";
}

/** Inscription commencée mais pas menée jusqu'au paiement. */
export function isUnfinished(state: CheckoutState): boolean {
  return state === "empty" || state === "cart" || state === "abandoned" || state === "declined";
}

export const checkoutStateConfig: Record<
  CheckoutState,
  { label: string; hint: string; color: string; bg: string }
> = {
  paid: {
    label: "Payée",
    hint: "Paiement en ligne reçu",
    color: "#ffffff",
    bg: "var(--n-success)",
  },
  imported: {
    label: "Hors site",
    hint: "Inscription importée, réglée en dehors du site",
    color: "#ffffff",
    bg: "#6366f1",
  },
  cancelled: {
    label: "Annulée",
    hint: "Inscription annulée",
    color: "var(--n-text-secondary)",
    bg: "var(--n-border)",
  },
  empty: {
    label: "Panier vide",
    hint: "A ouvert le formulaire sans ajouter de produit",
    color: "var(--n-text-secondary)",
    bg: "var(--n-border)",
  },
  cart: {
    label: "Panier non validé",
    hint: "Produits ajoutés, jamais passé au paiement",
    color: "#ffffff",
    bg: "#f59e0b",
  },
  abandoned: {
    label: "Paiement non finalisé",
    hint: "A ouvert la page de paiement puis l'a quittée sans payer",
    color: "#ffffff",
    bg: "#f97316",
  },
  declined: {
    label: "Paiement refusé",
    hint: "La banque a refusé le paiement",
    color: "#ffffff",
    bg: "#ef4444",
  },
};

/**
 * Motifs de refus Viva. Les codes 100xx reprennent les codes de réponse
 * bancaires ISO 8583 (10051 = 51, fonds insuffisants) ; les autres sont
 * affichés tels quels.
 */
const FAILURE_LABELS: Record<string, string> = {
  "10001": "Refusé par la banque",
  "10005": "Refusé par la banque",
  "10014": "Numéro de carte invalide",
  "10041": "Carte déclarée perdue",
  "10043": "Carte déclarée volée",
  "10051": "Fonds insuffisants",
  "10054": "Carte expirée",
  "10057": "Opération non autorisée pour cette carte",
  "10061": "Plafond de la carte dépassé",
};

export function paymentFailureLabel(code: string | null): string | null {
  if (!code) return null;
  return FAILURE_LABELS[code] ?? `Code Viva ${code}`;
}

/** Un EventId Viva de refus : numérique et non nul (0 = succès). */
export function isFailureEventId(value: string | null | undefined): value is string {
  return !!value && /^\d{1,6}$/.test(value) && value !== "0";
}
