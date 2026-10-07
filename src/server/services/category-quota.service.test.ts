import { describe, it, expect, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));

import {
  assertCartWithinQuotas,
  countByCategory,
  PAYMENT_ORDER_TIMEOUT_SECONDS,
  PAYMENT_RESERVATION_MS,
  type CategoryQuota,
} from "./category-quota.service";

const fleurs: CategoryQuota = {
  id: "cat-fleurs",
  name: "Fleurs Indoor",
  maxProducts: 20,
  maxProductsPerProducer: 2,
};

const resines: CategoryQuota = {
  id: "cat-resines",
  name: "Résines",
  maxProducts: null,
  maxProductsPerProducer: null,
};

describe("assertCartWithinQuotas", () => {
  it("accepte un panier qui tient dans les places restantes", () => {
    expect(() =>
      assertCartWithinQuotas(
        [fleurs],
        new Map([["cat-fleurs", 2]]),
        new Map([["cat-fleurs", 18]])
      )
    ).not.toThrow();
  });

  it("refuse la catégorie complète, places réservées comprises", () => {
    expect(() =>
      assertCartWithinQuotas(
        [fleurs],
        new Map([["cat-fleurs", 1]]),
        new Map([["cat-fleurs", 20]])
      )
    ).toThrow("La catégorie « Fleurs Indoor » est complète.");
  });

  it("indique les places restantes quand le panier en demande trop", () => {
    expect(() =>
      assertCartWithinQuotas(
        [fleurs],
        new Map([["cat-fleurs", 2]]),
        new Map([["cat-fleurs", 19]])
      )
    ).toThrow("Il ne reste que 1 place(s)");
  });

  it("applique le maximum par producteur avant le quota global", () => {
    expect(() =>
      assertCartWithinQuotas([fleurs], new Map([["cat-fleurs", 3]]), new Map())
    ).toThrow("Vous ne pouvez inscrire que 2 produit(s)");
  });

  it("compte les produits déjà réglés dans une commande précédente", () => {
    // Un produit payé lors de la première inscription : la commande
    // complémentaire n'en admet plus qu'un dans la catégorie.
    expect(() =>
      assertCartWithinQuotas(
        [fleurs],
        new Map([["cat-fleurs", 1]]),
        new Map(),
        new Map([["cat-fleurs", 1]])
      )
    ).not.toThrow();
    expect(() =>
      assertCartWithinQuotas(
        [fleurs],
        new Map([["cat-fleurs", 2]]),
        new Map(),
        new Map([["cat-fleurs", 1]])
      )
    ).toThrow("et vous en avez déjà 1");
  });

  it("ne limite pas une catégorie sans quota", () => {
    expect(() =>
      assertCartWithinQuotas(
        [resines],
        new Map([["cat-resines", 50]]),
        new Map([["cat-resines", 500]])
      )
    ).not.toThrow();
  });

  it("ignore les catégories absentes du panier, même complètes", () => {
    expect(() =>
      assertCartWithinQuotas(
        [fleurs, resines],
        new Map([["cat-resines", 1]]),
        new Map([["cat-fleurs", 20]])
      )
    ).not.toThrow();
  });
});

describe("countByCategory", () => {
  it("compte les produits par catégorie", () => {
    const cart = countByCategory([
      { categoryId: "a" },
      { categoryId: "b" },
      { categoryId: "a" },
    ]);
    expect(cart.get("a")).toBe(2);
    expect(cart.get("b")).toBe(1);
  });
});

describe("durée de réservation", () => {
  it("survit à la commande Viva, pour qu'aucun paiement n'aboutisse sur une place rendue", () => {
    expect(PAYMENT_RESERVATION_MS).toBeGreaterThan(PAYMENT_ORDER_TIMEOUT_SECONDS * 1000);
  });
});
