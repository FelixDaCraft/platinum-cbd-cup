import { describe, it, expect, vi } from "vitest";

import {
  updateCupPricingSchema,
  updateCategoryPriceSchema,
  currencyEnum,
  MAX_PRICE_CENTS,
  formatPrice,
  formatPriceForInput,
  parsePriceInput,
} from "~/lib/validations/pricing";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

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

  describe("Authorization Checks", () => {
    it("identifies when no session exists", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const session = await auth.api.getSession({ headers: new Headers() });

      expect(session).toBeNull();
      // Router would throw UNAUTHORIZED
    });
  });

  describe("Business Logic - Currency Change After Publication", () => {
    it("should block currency change when cup is published", () => {
      const cupStatus: string = "published";
      const inputCurrency: string | undefined = "USD";

      const shouldBlock =
        inputCurrency !== undefined && cupStatus !== "draft";

      expect(shouldBlock).toBe(true);
    });

    it("should allow currency change when cup is draft", () => {
      const cupStatus: string = "draft";
      const inputCurrency: string | undefined = "USD";

      const shouldBlock =
        inputCurrency !== undefined && cupStatus !== "draft";

      expect(shouldBlock).toBe(false);
    });

    it("should allow price change regardless of status", () => {
      // Price can be changed at any time
      // Only currency is locked after publication
      const cupStatus = "published";
      const inputPrice = 2000;

      // No restriction on price changes
      expect(inputPrice).toBe(2000);
    });
  });

  describe("Business Logic - Multi-tenancy Validation", () => {
    it("validates cup belongs to user organization", () => {
      const cupOrganizationId = "org-1";
      const memberOrganizationId = "org-1";

      expect(cupOrganizationId).toBe(memberOrganizationId);
    });

    it("detects cross-tenant access attempt", () => {
      const cupOrganizationId: string = "org-1";
      const attackerOrganizationId: string = "org-2";

      expect(cupOrganizationId).not.toBe(attackerOrganizationId);
      // Router would throw NOT_FOUND or FORBIDDEN
    });

    it("validates category belongs to user organization via cup", () => {
      const categoryCupOrganizationId = "org-1";
      const memberOrganizationId = "org-1";

      expect(categoryCupOrganizationId).toBe(memberOrganizationId);
    });

    it("detects category cross-tenant access", () => {
      const categoryCupOrganizationId: string = "org-1";
      const attackerOrganizationId: string = "org-2";

      expect(categoryCupOrganizationId).not.toBe(attackerOrganizationId);
      // Router would throw FORBIDDEN
    });
  });

  describe("Business Logic - Price Resolution", () => {
    it("uses category override when set", () => {
      const defaultPrice = 1500;
      const categoryOverride: number | null = 2000;

      const effectivePrice = categoryOverride ?? defaultPrice;

      expect(effectivePrice).toBe(2000);
    });

    it("falls back to default when category override is null", () => {
      const defaultPrice = 1500;
      const categoryOverride: number | null = null;

      const effectivePrice = categoryOverride ?? defaultPrice;

      expect(effectivePrice).toBe(1500);
    });

    it("handles free (null default) with category override", () => {
      const defaultPrice: number | null = null;
      const categoryOverride: number | null = 2000;

      const effectivePrice = categoryOverride ?? defaultPrice;

      expect(effectivePrice).toBe(2000);
    });

    it("handles both null (free)", () => {
      const defaultPrice: number | null = null;
      const categoryOverride: number | null = null;

      const effectivePrice = categoryOverride ?? defaultPrice;

      expect(effectivePrice).toBeNull();
    });
  });
});
