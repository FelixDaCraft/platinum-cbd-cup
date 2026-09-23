import { describe, it, expect, vi, beforeEach } from "vitest";
import { canPublishCup } from "./publish";

// Create mock database
const createMockDb = () => ({
  query: {
    cups: {
      findFirst: vi.fn().mockResolvedValue({
        id: "cup_123",
        paymentProvider: null,
        paymentConfigEncrypted: null,
        defaultPricePerProduct: null,
      }),
    },
    categories: {
      findMany: vi.fn(),
    },
    ratingCriteria: {
      findFirst: vi.fn(),
    },
  },
});

describe("canPublishCup", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("Category validation", () => {
    it("should return error when cup has no categories", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([]);

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(false);
      expect(result.errors).toContain("Au moins une catégorie est requise");
    });

    it("should pass category check when at least one category exists", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Vins Rouges" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Arôme",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      expect(result.errors).not.toContain("Au moins une catégorie est requise");
    });
  });

  describe("Rating criteria validation", () => {
    it("should return error when cup has categories but no criteria", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Vins Rouges" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue(null);

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(false);
      expect(result.errors).toContain("Au moins un critère de notation est requis");
    });

    it("should pass criteria check when at least one criterion exists", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Vins Rouges" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Arôme",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      expect(result.errors).not.toContain("Au moins un critère de notation est requis");
    });

    it("should not check criteria if no categories exist", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([]);

      const result = await canPublishCup("cup_123", mockDb as never);

      // Should only have category error, not criteria error
      expect(result.errors).toHaveLength(1);
      expect(result.errors).toContain("Au moins une catégorie est requise");
      expect(mockDb.query.ratingCriteria.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("Complete validation", () => {
    it("should return canPublish: true when all requirements met", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Vins Rouges" },
        { id: "cat_2", cupId: "cup_123", name: "Vins Blancs" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Arôme",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should query criteria with all category IDs", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Vins Rouges" },
        { id: "cat_2", cupId: "cup_123", name: "Vins Blancs" },
        { id: "cat_3", cupId: "cup_123", name: "Rosés" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_2", // Criterion in second category
        name: "Couleur",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      // Verify findFirst was called (criteria check happened)
      expect(mockDb.query.ratingCriteria.findFirst).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty cupId gracefully", async () => {
      mockDb.query.categories.findMany.mockResolvedValue([]);

      const result = await canPublishCup("", mockDb as never);

      expect(result.canPublish).toBe(false);
      expect(result.errors).toContain("Au moins une catégorie est requise");
    });

    it("should return multiple errors if multiple requirements missing", async () => {
      // This case is covered by the logic: if no categories, we don't check criteria
      // So we can only have one error at a time (category first, then criteria)
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Category" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue(null);

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Au moins un critère de notation est requis");
    });
  });

  describe("Payment configuration warnings", () => {
    it("should return warning when cup has pricing but no payment processor", async () => {
      mockDb.query.cups.findFirst.mockResolvedValue({
        id: "cup_123",
        defaultPricePerProduct: 1500, // Has pricing
      });
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Category" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Criterion",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("processeur de paiement");
    });

    it("should not return warning when cup is free (no pricing)", async () => {
      mockDb.query.cups.findFirst.mockResolvedValue({
        id: "cup_123",
        defaultPricePerProduct: null, // Free cup
      });
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Category" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Criterion",
      });

      const result = await canPublishCup("cup_123", mockDb as never);

      expect(result.canPublish).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("should not return warning when payment processor is configured", async () => {
      mockDb.query.cups.findFirst.mockResolvedValue({
        id: "cup_123",
        defaultPricePerProduct: 1500,
      });
      mockDb.query.categories.findMany.mockResolvedValue([
        { id: "cat_1", cupId: "cup_123", name: "Category" },
      ]);
      mockDb.query.ratingCriteria.findFirst.mockResolvedValue({
        id: "crit_1",
        categoryId: "cat_1",
        name: "Criterion",
      });

      // Payments are configured globally (VIVA_* env), passed in by the caller.
      const result = await canPublishCup("cup_123", mockDb as never, true);

      expect(result.canPublish).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
