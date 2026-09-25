import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  updateCupPricingSchema,
  updateCategoryPriceSchema,
  currencyEnum,
  MAX_PRICE_CENTS,
  formatPrice,
  formatPriceForInput,
  parsePriceInput,
} from "~/lib/validations/pricing";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
}));

const { updates } = dbState;

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn() },
      categories: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () => ({ returning: () => Promise.resolve([values]) }),
        };
      },
    }),
  },
}));

beforeEach(() => {
  updates.length = 0;
});

describe("Pricing Router", () => {
  describe("Input Validation - updateCupPricingSchema", () => {
    it("rejects missing cupId", () => {
      const result = updateCupPricingSchema.safeParse({
        defaultPricePerProduct: 1500,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty cupId", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "",
        defaultPricePerProduct: 1500,
      });

      expect(result.success).toBe(false);
    });

    it("rejects negative price", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: -100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("négatif");
      }
    });

    it("rejects price exceeding MAX_PRICE_CENTS", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: MAX_PRICE_CENTS + 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("maximum");
      }
    });

    it("rejects non-integer price", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: 15.5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("entier");
      }
    });

    it("rejects invalid currency", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        currency: "INVALID",
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid price with EUR currency", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: 1500,
        currency: "EUR",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultPricePerProduct).toBe(1500);
        expect(result.data.currency).toBe("EUR");
      }
    });

    it("accepts null price (free)", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultPricePerProduct).toBeNull();
      }
    });

    it("accepts all valid currencies", () => {
      for (const currency of currencyEnum) {
        const result = updateCupPricingSchema.safeParse({
          cupId: "cup-1",
          currency,
        });

        expect(result.success).toBe(true);
      }
    });

    it("accepts MAX_PRICE_CENTS exactly", () => {
      const result = updateCupPricingSchema.safeParse({
        cupId: "cup-1",
        defaultPricePerProduct: MAX_PRICE_CENTS,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - updateCategoryPriceSchema", () => {
    it("rejects missing categoryId", () => {
      const result = updateCategoryPriceSchema.safeParse({
        priceOverride: 1500,
      });

      expect(result.success).toBe(false);
    });

    it("rejects negative price", () => {
      const result = updateCategoryPriceSchema.safeParse({
        categoryId: "cat-1",
        priceOverride: -100,
      });

      expect(result.success).toBe(false);
    });

    it("rejects price exceeding MAX_PRICE_CENTS", () => {
      const result = updateCategoryPriceSchema.safeParse({
        categoryId: "cat-1",
        priceOverride: MAX_PRICE_CENTS + 1,
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid price override", () => {
      const result = updateCategoryPriceSchema.safeParse({
        categoryId: "cat-1",
        priceOverride: 2000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceOverride).toBe(2000);
      }
    });

    it("accepts null price (use default)", () => {
      const result = updateCategoryPriceSchema.safeParse({
        categoryId: "cat-1",
        priceOverride: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceOverride).toBeNull();
      }
    });
  });

  describe("Price Formatting - formatPrice", () => {
    it("formats EUR price correctly", () => {
      expect(formatPrice(1500, "EUR")).toBe("15,00 €");
      expect(formatPrice(999, "EUR")).toBe("9,99 €");
      expect(formatPrice(10000, "EUR")).toBe("100,00 €");
    });

    it("formats USD price correctly", () => {
      expect(formatPrice(1500, "USD")).toBe("$15.00");
      expect(formatPrice(999, "USD")).toBe("$9.99");
    });

    it("formats GBP price correctly", () => {
      expect(formatPrice(1500, "GBP")).toBe("£15.00");
    });

    it("formats CHF price correctly", () => {
      expect(formatPrice(1500, "CHF")).toBe("CHF15.00");
    });

    it("returns 'Gratuit' for null price", () => {
      expect(formatPrice(null, "EUR")).toBe("Gratuit");
    });

    it("returns 'Gratuit' for zero price", () => {
      expect(formatPrice(0, "EUR")).toBe("Gratuit");
    });

    it("returns 'Gratuit' for undefined price", () => {
      expect(formatPrice(undefined, "EUR")).toBe("Gratuit");
    });

    it("defaults to EUR if no currency specified", () => {
      expect(formatPrice(1500)).toBe("15,00 €");
    });
  });

  describe("Price Formatting - formatPriceForInput", () => {
    it("formats price for input correctly", () => {
      expect(formatPriceForInput(1500)).toBe("15,00");
      expect(formatPriceForInput(999)).toBe("9,99");
      expect(formatPriceForInput(10000)).toBe("100,00");
    });

    it("returns empty string for null", () => {
      expect(formatPriceForInput(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(formatPriceForInput(undefined)).toBe("");
    });
  });

  describe("Price Parsing - parsePriceInput", () => {
    it("parses comma decimal correctly", () => {
      expect(parsePriceInput("15,00")).toBe(1500);
      expect(parsePriceInput("9,99")).toBe(999);
      expect(parsePriceInput("100,50")).toBe(10050);
    });

    it("parses dot decimal correctly", () => {
      expect(parsePriceInput("15.00")).toBe(1500);
      expect(parsePriceInput("9.99")).toBe(999);
    });

    it("parses integer correctly", () => {
      expect(parsePriceInput("15")).toBe(1500);
      expect(parsePriceInput("100")).toBe(10000);
    });

    it("returns null for empty string", () => {
      expect(parsePriceInput("")).toBeNull();
      expect(parsePriceInput("   ")).toBeNull();
    });

    it("returns null for negative values", () => {
      expect(parsePriceInput("-15")).toBeNull();
    });

    it("returns null for completely invalid input", () => {
      expect(parsePriceInput("abc")).toBeNull();
      // Note: parseFloat("12abc") returns 12 in JS, so partial numbers are accepted
    });

    it("parses partial numeric input (JS parseFloat behavior)", () => {
      // JavaScript parseFloat is lenient: "12abc" → 12
      expect(parsePriceInput("12abc")).toBe(1200);
    });

    it("rounds to nearest cent", () => {
      expect(parsePriceInput("15,999")).toBe(1600);
      expect(parsePriceInput("15,001")).toBe(1500);
    });
  });

  // ---------------------------------------------------------------------
  // Procédures du routeur
  //
  // Les blocs « Business Logic » et « Multi-tenancy Validation » d'origine
  // recopiaient la règle dans le test (`expect("org-1").toBe("org-1")`) sans
  // jamais importer pricing.ts. Le verrou réel est le triptyque
  // organizerProcedure / assertPricingEditable / verrou de devise hors
  // brouillon : c'est ce qu'on exerce ici.
  // ---------------------------------------------------------------------
  describe("Procédures", () => {
    async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      if (row === null) {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        return;
      }

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { id: "session-1" },
      } as never);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
    }

    const asOrganizer = () => signIn({ isAdmin: false, role: "organizer" });
    const asProducer = () => signIn({ isAdmin: false, role: "producer" });
    const asAnonymous = () => signIn(null);

    async function withCup(
      overrides: { status?: string; currency?: string | null } = {}
    ) {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup-1",
        name: "Test Cup",
        status: overrides.status ?? "draft",
        currency: overrides.currency === undefined ? "EUR" : overrides.currency,
        defaultPricePerProduct: 2500,
      } as never);
    }

    async function createCaller() {
      const { pricingRouter } = await import("../pricing");
      const { db } = await import("~/server/db");

      return pricingRouter.createCaller({ headers: new Headers(), db } as never);
    }

    async function codeOf(fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        return (error as TRPCError).code;
      }
      throw new Error("La procédure aurait dû lever une erreur");
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("refuse un appelant anonyme sur chaque procédure", async () => {
      await asAnonymous();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getCupPricing({ cupId: "cup-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(
        await codeOf(() =>
          caller.updateCupPricing({ cupId: "cup-1", defaultPricePerProduct: 100 })
        )
      ).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() =>
          caller.updateCategoryPrice({ categoryId: "cat-1", priceOverride: 100 })
        )
      ).toBe("UNAUTHORIZED");
    });

    // Le tarif d'engagement est ce que le producteur paie : un producteur ne
    // doit pas pouvoir le lire ni le changer.
    it("refuse un producteur authentifié sur chaque procédure", async () => {
      await asProducer();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getCupPricing({ cupId: "cup-1" }))).toBe(
        "FORBIDDEN"
      );
      expect(
        await codeOf(() =>
          caller.updateCupPricing({ cupId: "cup-1", defaultPricePerProduct: 100 })
        )
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(() =>
          caller.updateCategoryPrice({ categoryId: "cat-1", priceOverride: 0 })
        )
      ).toBe("FORBIDDEN");
      expect(updates).toHaveLength(0);
    });

    it("renvoie NOT_FOUND quand la cup n'existe pas", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.getCupPricing({ cupId: "inconnue" }))).toBe(
        "NOT_FOUND"
      );
    });

    it("expose le prix par défaut et les surcharges par catégorie", async () => {
      await asOrganizer();
      await withCup({ status: "published" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat-1", name: "Indoor", priceOverride: 5000 },
        { id: "cat-2", name: "Outdoor", priceOverride: null },
      ] as never);

      const caller = await createCaller();
      const result = await caller.getCupPricing({ cupId: "cup-1" });

      expect(result.defaultPricePerProduct).toBe(2500);
      expect(result.currency).toBe("EUR");
      expect(result.canEdit).toBe(true);
      expect(result.categoryPrices).toEqual([
        { categoryId: "cat-1", name: "Indoor", priceOverride: 5000 },
        { categoryId: "cat-2", name: "Outdoor", priceOverride: null },
      ]);
    });

    it("replie une devise NULL sur EUR", async () => {
      await asOrganizer();
      await withCup({ currency: null });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      await expect(caller.getCupPricing({ cupId: "cup-1" })).resolves.toMatchObject({
        currency: "EUR",
      });
    });

    it("interdit toute modification tarifaire sur une cup terminée", async () => {
      await asOrganizer();
      await withCup({ status: "completed" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);

      const caller = await createCaller();

      expect(
        await codeOf(() =>
          caller.updateCupPricing({ cupId: "cup-1", defaultPricePerProduct: 100 })
        )
      ).toBe("BAD_REQUEST");
      expect(
        await codeOf(() =>
          caller.updateCategoryPrice({ categoryId: "cat-1", priceOverride: 100 })
        )
      ).toBe("BAD_REQUEST");
      expect(updates).toHaveLength(0);

      // canEdit doit refléter le même verrou côté lecture.
      vi.mocked(db.query.categories.findMany).mockResolvedValue([] as never);
      await expect(caller.getCupPricing({ cupId: "cup-1" })).resolves.toMatchObject({
        canEdit: false,
      });
    });

    // Les montants déjà encaissés ne portent pas leur devise : la changer
    // après publication rendrait factures et totaux incohérents.
    it.each(["published", "registration_closed", "rating"])(
      "refuse un changement de devise quand la cup est en %s",
      async (status) => {
        await asOrganizer();
        await withCup({ status, currency: "EUR" });

        const caller = await createCaller();
        expect(
          await codeOf(() => caller.updateCupPricing({ cupId: "cup-1", currency: "USD" }))
        ).toBe("BAD_REQUEST");
        expect(updates).toHaveLength(0);
      }
    );

    it("laisse changer la devise tant que la cup est en brouillon", async () => {
      await asOrganizer();
      await withCup({ status: "draft", currency: "EUR" });

      const caller = await createCaller();
      await caller.updateCupPricing({ cupId: "cup-1", currency: "CHF" });

      expect(updates[0]).toMatchObject({ currency: "CHF" });
    });

    it("accepte la devise identique sur une cup publiée (ce n'est pas un changement)", async () => {
      await asOrganizer();
      await withCup({ status: "published", currency: "EUR" });

      const caller = await createCaller();
      await caller.updateCupPricing({
        cupId: "cup-1",
        currency: "EUR",
        defaultPricePerProduct: 3000,
      });

      expect(updates[0]).toMatchObject({ defaultPricePerProduct: 3000 });
      expect(updates[0]).not.toHaveProperty("currency");
    });

    it("normalise une devise NULL même sur une cup publiée", async () => {
      await asOrganizer();
      await withCup({ status: "published", currency: null });

      const caller = await createCaller();
      await caller.updateCupPricing({ cupId: "cup-1", currency: "EUR" });

      expect(updates[0]).toMatchObject({ currency: "EUR" });
    });

    it("remet une catégorie sur le prix par défaut avec priceOverride null", async () => {
      await asOrganizer();
      await withCup({ status: "published" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat-1",
        cupId: "cup-1",
      } as never);

      const caller = await createCaller();
      await caller.updateCategoryPrice({ categoryId: "cat-1", priceOverride: null });

      expect(updates[0]).toMatchObject({ priceOverride: null });
    });

    it("renvoie NOT_FOUND pour une catégorie inconnue", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.updateCategoryPrice({ categoryId: "inconnue", priceOverride: 100 })
        )
      ).toBe("NOT_FOUND");
    });
  });
});
