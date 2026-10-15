import { describe, it, expect } from "vitest";

import {
  checkoutState,
  isCompeting,
  isFailureEventId,
  isUnfinished,
  paymentFailureLabel,
  type CheckoutFacts,
} from "./registration-checkout";

const base: CheckoutFacts = {
  status: "pending_payment",
  productCount: 2,
  paymentTransactionId: null,
  stripePaymentIntentId: null,
  invoiceNumber: null,
  paymentOrderCode: null,
  paymentAttempts: 0,
  lastPaymentAttemptAt: null,
  lastPaymentFailureAt: null,
};

const at = (iso: string) => new Date(iso);

describe("checkoutState", () => {
  it("payée : confirmée avec une transaction ou une facture", () => {
    expect(checkoutState({ ...base, status: "confirmed", paymentTransactionId: "trx" })).toBe("paid");
    expect(checkoutState({ ...base, status: "confirmed", invoiceNumber: "INV-1" })).toBe("paid");
  });

  it("hors site : confirmée sans aucune trace de paiement (import)", () => {
    expect(checkoutState({ ...base, status: "confirmed" })).toBe("imported");
  });

  it("panier vide : formulaire ouvert sans produit", () => {
    expect(checkoutState({ ...base, productCount: 0 })).toBe("empty");
  });

  it("panier non validé : produits ajoutés, paiement jamais ouvert", () => {
    expect(checkoutState(base)).toBe("cart");
  });

  it("paiement non finalisé : page de paiement ouverte sans issue connue", () => {
    expect(
      checkoutState({ ...base, paymentAttempts: 1, lastPaymentAttemptAt: at("2026-10-14T10:00:00Z") })
    ).toBe("abandoned");
    // Inscription antérieure au suivi : seule la commande Viva en témoigne.
    expect(checkoutState({ ...base, paymentOrderCode: "123" })).toBe("abandoned");
  });

  it("paiement refusé : refus postérieur à la dernière ouverture", () => {
    expect(
      checkoutState({
        ...base,
        paymentAttempts: 1,
        lastPaymentAttemptAt: at("2026-10-14T10:00:00Z"),
        lastPaymentFailureAt: at("2026-10-14T10:02:00Z"),
      })
    ).toBe("declined");
  });

  it("un refus suivi d'un nouvel essai n'est plus l'issue en cours", () => {
    expect(
      checkoutState({
        ...base,
        paymentAttempts: 2,
        lastPaymentFailureAt: at("2026-10-14T10:02:00Z"),
        lastPaymentAttemptAt: at("2026-10-14T10:05:00Z"),
      })
    ).toBe("abandoned");
  });

  it("annulée prime sur tout le reste", () => {
    expect(checkoutState({ ...base, status: "cancelled", paymentTransactionId: "trx" })).toBe(
      "cancelled"
    );
  });
});

describe("filtres", () => {
  it("en lice : payée ou hors site ; annulée n'est ni en lice ni non terminée", () => {
    expect(isCompeting("paid")).toBe(true);
    expect(isCompeting("imported")).toBe(true);
    expect(isCompeting("cancelled")).toBe(false);
    expect(isUnfinished("cancelled")).toBe(false);
    for (const state of ["empty", "cart", "abandoned", "declined"] as const) {
      expect(isUnfinished(state)).toBe(true);
      expect(isCompeting(state)).toBe(false);
    }
  });
});

describe("motifs de refus", () => {
  it("traduit les codes bancaires connus, affiche les autres tels quels", () => {
    expect(paymentFailureLabel("10051")).toBe("Fonds insuffisants");
    expect(paymentFailureLabel("2061")).toBe("Code Viva 2061");
    expect(paymentFailureLabel(null)).toBeNull();
  });

  it("n'accepte qu'un EventId numérique non nul", () => {
    expect(isFailureEventId("10051")).toBe(true);
    expect(isFailureEventId("0")).toBe(false);
    expect(isFailureEventId("<script>")).toBe(false);
    expect(isFailureEventId(undefined)).toBe(false);
  });
});
