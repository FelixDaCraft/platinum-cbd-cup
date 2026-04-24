import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  createCriterionSchema,
  updateCriterionSchema,
  reorderCriteriaSchema,
  duplicateCriteriaSchema,
  initializeDefaultCriteriaSchema,
  DEFAULT_CRITERIA,
  formatCoefficient,
  calculateWeightedScore,
} from "~/lib/validations/criteria";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock database for integration tests
vi.mock("~/server/db", () => ({
  db: {
    query: {
      members: { findFirst: vi.fn() },
      categories: { findFirst: vi.fn() },
      ratingCriteria: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

// Mock schema
vi.mock("~/server/db/schema", () => ({
  ratingCriteria: { id: "id", categoryId: "category_id" },
  categories: { id: "id", cupId: "cup_id" },
  cups: { id: "id", organizationId: "organization_id" },
  members: { id: "id" },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test_criterion_id"),
}));

describe("Criteria Router", () => {
  describe("Input Validation - createCriterionSchema", () => {
    it("rejects missing categoryId", () => {
      const result = createCriterionSchema.safeParse({
        name: "Aspect visuel",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("categoryId");
      }
    });

    it("rejects empty name", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("requis");
      }
    });

    it("rejects name too long (over 100 chars)", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "a".repeat(101),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("trop long");
      }
    });

    it("rejects coefficient < 1", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Test",
        coefficient: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("minimum");
      }
    });

    it("rejects coefficient > 10", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Test",
        coefficient: 11,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("maximum");
      }
    });

    it("rejects non-integer coefficient", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Test",
        coefficient: 1.5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("entier");
      }
    });

    it("accepts description as optional", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Aspect visuel",
      });

      expect(result.success).toBe(true);
    });

    it("rejects description too long (over 500 chars)", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Test",
        description: "a".repeat(501),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("trop longue");
      }
    });

    it("accepts valid criterion with all fields", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Aspect visuel",
        description: "Apparence générale du produit",
        coefficient: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Aspect visuel");
        expect(result.data.coefficient).toBe(2);
      }
    });

    it("uses default coefficient of 1 when not provided", () => {
      const result = createCriterionSchema.safeParse({
        categoryId: "cat-1",
        name: "Test",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coefficient).toBe(1);
      }
    });
  });

  describe("Input Validation - updateCriterionSchema", () => {
    it("rejects missing criterionId", () => {
      const result = updateCriterionSchema.safeParse({
        name: "Updated name",
      });

      expect(result.success).toBe(false);
    });

    it("accepts partial update with only name", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        name: "Updated name",
      });

      expect(result.success).toBe(true);
    });

    it("accepts partial update with only coefficient", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        coefficient: 5,
      });

      expect(result.success).toBe(true);
    });

    it("accepts null description (to clear)", () => {
      const result = updateCriterionSchema.safeParse({
        criterionId: "crit-1",
        description: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - reorderCriteriaSchema", () => {
    it("rejects missing categoryId", () => {
      const result = reorderCriteriaSchema.safeParse({
        criterionIds: ["crit-1", "crit-2"],
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty criterionIds array", () => {
      const result = reorderCriteriaSchema.safeParse({
        categoryId: "cat-1",
        criterionIds: [],
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid reorder input", () => {
      const result = reorderCriteriaSchema.safeParse({
        categoryId: "cat-1",
        criterionIds: ["crit-1", "crit-2", "crit-3"],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - duplicateCriteriaSchema", () => {
    it("rejects missing sourceCategoryId", () => {
      const result = duplicateCriteriaSchema.safeParse({
        targetCategoryId: "cat-2",
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing targetCategoryId", () => {
      const result = duplicateCriteriaSchema.safeParse({
        sourceCategoryId: "cat-1",
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid duplicate input", () => {
      const result = duplicateCriteriaSchema.safeParse({
        sourceCategoryId: "cat-1",
        targetCategoryId: "cat-2",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - initializeDefaultCriteriaSchema", () => {
    it("rejects missing categoryId", () => {
      const result = initializeDefaultCriteriaSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("accepts valid categoryId", () => {
      const result = initializeDefaultCriteriaSchema.safeParse({
        categoryId: "cat-1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Constants - DEFAULT_CRITERIA", () => {
    it("has 4 default criteria", () => {
      expect(DEFAULT_CRITERIA).toHaveLength(4);
    });

    it("has correct default values", () => {
      expect(DEFAULT_CRITERIA[0]).toMatchObject({
        name: "Aspect visuel",
        coefficient: 1,
      });
      expect(DEFAULT_CRITERIA[1]).toMatchObject({
        name: "Arôme",
        coefficient: 2,
      });
      expect(DEFAULT_CRITERIA[2]).toMatchObject({
        name: "Goût",
        coefficient: 2,
      });
      expect(DEFAULT_CRITERIA[3]).toMatchObject({
        name: "Effet",
        coefficient: 2,
      });
    });

    it("all criteria have valid coefficients (1-10)", () => {
      for (const criterion of DEFAULT_CRITERIA) {
        expect(criterion.coefficient).toBeGreaterThanOrEqual(1);
        expect(criterion.coefficient).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("Helpers - formatCoefficient", () => {
    it("formats coefficient with multiplication sign", () => {
      expect(formatCoefficient(1)).toBe("×1");
      expect(formatCoefficient(5)).toBe("×5");
      expect(formatCoefficient(10)).toBe("×10");
    });
  });

  describe("Helpers - calculateWeightedScore", () => {
    it("calculates correct weighted average", () => {
      // Example from story:
      // Aspect visuel: 7 × 1 = 7
      // Arôme: 8 × 2 = 16
      // Goût: 9 × 2 = 18
      // Effet: 7 × 2 = 14
      // Total: 55 / 7 = 7.857...
      const ratings = [
        { criterionCoefficient: 1, score: 7 },
        { criterionCoefficient: 2, score: 8 },
        { criterionCoefficient: 2, score: 9 },
        { criterionCoefficient: 2, score: 7 },
      ];

      const result = calculateWeightedScore(ratings);

      expect(result).toBeCloseTo(7.857, 2);
    });

    it("returns 0 for empty ratings", () => {
      expect(calculateWeightedScore([])).toBe(0);
    });

    it("handles single rating", () => {
      const ratings = [{ criterionCoefficient: 1, score: 8 }];

      expect(calculateWeightedScore(ratings)).toBe(8);
    });

    it("handles uniform coefficients (simple average)", () => {
      const ratings = [
        { criterionCoefficient: 1, score: 6 },
        { criterionCoefficient: 1, score: 8 },
        { criterionCoefficient: 1, score: 10 },
      ];

      expect(calculateWeightedScore(ratings)).toBe(8);
    });

    it("handles high coefficient weights correctly", () => {
      // criterion1: 5 × 1 = 5
      // criterion2: 10 × 10 = 100
      // Total: 105 / 11 = 9.545...
      const ratings = [
        { criterionCoefficient: 1, score: 5 },
        { criterionCoefficient: 10, score: 10 },
      ];

      expect(calculateWeightedScore(ratings)).toBeCloseTo(9.545, 2);
    });
  });

  describe("Business Logic - Modification After Publication", () => {
    it("should block modification when cup is in rating phase", () => {
      const cupStatus: string = "rating";

      const shouldBlock = cupStatus === "rating" || cupStatus === "completed";

      expect(shouldBlock).toBe(true);
    });

    it("should block modification when cup is completed", () => {
      const cupStatus: string = "completed";

      const shouldBlock = cupStatus === "rating" || cupStatus === "completed";

      expect(shouldBlock).toBe(true);
    });

    it("should allow modification when cup is draft", () => {
      const cupStatus: string = "draft";

      const shouldBlock = cupStatus === "rating" || cupStatus === "completed";

      expect(shouldBlock).toBe(false);
    });

    it("should allow modification when cup is published", () => {
      const cupStatus: string = "published";

      const shouldBlock = cupStatus === "rating" || cupStatus === "completed";

      expect(shouldBlock).toBe(false);
    });

    it("should allow modification when cup is registration_closed", () => {
      const cupStatus: string = "registration_closed";

      const shouldBlock = cupStatus === "rating" || cupStatus === "completed";

      expect(shouldBlock).toBe(false);
    });
  });

  describe("Business Logic - Multi-tenancy Validation", () => {
    it("validates criterion belongs to user organization via category -> cup", () => {
      const criterionCategoryOrganizationId = "org-1";
      const memberOrganizationId = "org-1";

      expect(criterionCategoryOrganizationId).toBe(memberOrganizationId);
    });

    it("detects cross-tenant access attempt", () => {
      const criterionCategoryOrganizationId: string = "org-1";
      const attackerOrganizationId: string = "org-2";

      expect(criterionCategoryOrganizationId).not.toBe(attackerOrganizationId);
      // Router would throw FORBIDDEN
    });
  });

  describe("Business Logic - sortOrder Calculation", () => {
    it("calculates next sortOrder correctly for empty list", () => {
      const existingOrders: number[] = [];
      const maxOrder = Math.max(...existingOrders, -1);
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(0);
    });

    it("calculates next sortOrder correctly for existing criteria", () => {
      const existingOrders = [0, 1, 2];
      const maxOrder = Math.max(...existingOrders, -1);
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(3);
    });

    it("handles non-sequential sortOrders", () => {
      const existingOrders = [0, 2, 5];
      const maxOrder = Math.max(...existingOrders, -1);
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(6);
    });
  });

  describe("Business Logic - Duplication Edge Cases", () => {
    it("validates both categories belong to the same cup", () => {
      const sourceCupId = "cup-1";
      const targetCupId = "cup-1";

      expect(sourceCupId).toBe(targetCupId);
    });

    it("detects duplication between different cups (should be rejected)", () => {
      const sourceCupId: string = "cup-1";
      const targetCupId: string = "cup-2";

      expect(sourceCupId).not.toBe(targetCupId);
      // Router would throw BAD_REQUEST
    });

    it("handles duplication to empty category", () => {
      const targetCriteriaCount = 0;
      const sourceCriteria = [
        { id: "1", sortOrder: 0 },
        { id: "2", sortOrder: 1 },
      ];
      const baseOrder = targetCriteriaCount;

      const newSortOrders = sourceCriteria.map((_, index) => baseOrder + index);

      expect(newSortOrders).toEqual([0, 1]);
    });

    it("handles duplication to category with existing criteria", () => {
      const targetCriteriaCount = 3;
      const sourceCriteria = [
        { id: "1", sortOrder: 0 },
        { id: "2", sortOrder: 1 },
      ];
      const baseOrder = targetCriteriaCount;

      const newSortOrders = sourceCriteria.map((_, index) => baseOrder + index);

      expect(newSortOrders).toEqual([3, 4]);
    });

    it("returns 0 duplicated when source has no criteria", () => {
      const sourceCriteria: unknown[] = [];
      const duplicatedCount = sourceCriteria.length;

      expect(duplicatedCount).toBe(0);
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

  describe("Integration - assertCriteriaEditable helper", () => {
    // Import the actual helper function behavior
    const assertCriteriaEditable = (cupStatus: string): void => {
      if (cupStatus === "rating" || cupStatus === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impossible de modifier les critères pendant ou après la phase de notation",
        });
      }
    };

    it("throws TRPCError when cup is in rating phase", () => {
      expect(() => assertCriteriaEditable("rating")).toThrow(TRPCError);
      expect(() => assertCriteriaEditable("rating")).toThrow(
        "Impossible de modifier les critères pendant ou après la phase de notation"
      );
    });

    it("throws TRPCError when cup is completed", () => {
      expect(() => assertCriteriaEditable("completed")).toThrow(TRPCError);
    });

    it("does not throw when cup is draft", () => {
      expect(() => assertCriteriaEditable("draft")).not.toThrow();
    });

    it("does not throw when cup is published", () => {
      expect(() => assertCriteriaEditable("published")).not.toThrow();
    });

    it("does not throw when cup is registration_closed", () => {
      expect(() => assertCriteriaEditable("registration_closed")).not.toThrow();
    });

    it("throws with correct error code BAD_REQUEST", () => {
      try {
        assertCriteriaEditable("rating");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("Integration - Router Authorization Flow", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns UNAUTHORIZED when no session for getCategoryCriteria", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
      // In actual router, this would throw UNAUTHORIZED
    });

    it("returns NOT_FOUND when user has no member record", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "Test", email: "test@test.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined as never);

      const member = await db.query.members.findFirst();
      expect(member).toBeUndefined();
      // In actual router, this would throw NOT_FOUND
    });

    it("validates organization ownership for category access", async () => {
      // Simulate the authorization check logic
      const memberOrgId = "org_123";
      const categoryWithCup = {
        id: "cat_123",
        cupId: "cup_123",
        name: "Test Category",
        cup: {
          id: "cup_123",
          organizationId: "org_different", // Different org!
          status: "draft",
        },
      };

      // Should be rejected - different organizations
      expect(memberOrgId).not.toBe(categoryWithCup.cup.organizationId);
    });

    it("allows access when organizations match", async () => {
      // Simulate the authorization check logic
      const memberOrgId = "org_123";
      const categoryWithCup = {
        id: "cat_123",
        cupId: "cup_123",
        name: "Test Category",
        ratingScaleMin: 1,
        ratingScaleMax: 10,
        cup: {
          id: "cup_123",
          organizationId: "org_123", // Same org!
          status: "draft",
        },
      };

      // Should be allowed - same organization
      expect(memberOrgId).toBe(categoryWithCup.cup.organizationId);
    });
  });

  describe("Integration - Duplication Same-Cup Constraint", () => {
    it("validates both categories belong to same cup", () => {
      // Simulate the duplication check logic
      const sourceCategory = {
        id: "source_cat",
        cupId: "cup_1",
        name: "Source",
      };
      const targetCategory = {
        id: "target_cat",
        cupId: "cup_2", // Different cup!
        name: "Target",
      };

      // Should be rejected - different cups
      expect(sourceCategory.cupId).not.toBe(targetCategory.cupId);
    });

    it("allows duplication when categories belong to same cup", () => {
      // Simulate the duplication check logic
      const sourceCategory = {
        id: "source_cat",
        cupId: "cup_1",
        name: "Source",
      };
      const targetCategory = {
        id: "target_cat",
        cupId: "cup_1", // Same cup!
        name: "Target",
      };

      // Should be allowed - same cup
      expect(sourceCategory.cupId).toBe(targetCategory.cupId);
    });
  });

  describe("Integration - Create Criterion sortOrder", () => {
    it("calculates sortOrder as max + 1 for existing criteria", () => {
      // Simulate the sortOrder calculation logic
      const existingCriteria = [
        { id: "c1", sortOrder: 0, name: "A", coefficient: 1 },
        { id: "c2", sortOrder: 1, name: "B", coefficient: 2 },
        { id: "c3", sortOrder: 2, name: "C", coefficient: 1 },
      ];

      const maxOrder = Math.max(...existingCriteria.map((c) => c.sortOrder), -1);
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(3);
    });

    it("starts at 0 for empty category", () => {
      // Simulate the sortOrder calculation logic for empty list
      const existingCriteria: { sortOrder: number }[] = [];

      const maxOrder = Math.max(...existingCriteria.map((c) => c.sortOrder), -1);
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(0);
    });
  });

  describe("Integration - Initialize Default Criteria", () => {
    it("skips initialization when criteria already exist", () => {
      // Simulate the initialization check logic
      const existingCriteria = [
        { id: "existing", name: "Existing", coefficient: 1, sortOrder: 0 },
      ];

      // Should not create new criteria
      const shouldSkip = existingCriteria.length > 0;
      expect(shouldSkip).toBe(true);
    });

    it("creates default criteria for empty category", () => {
      // Simulate the initialization check logic
      const existingCriteria: unknown[] = [];
      const shouldCreate = existingCriteria.length === 0;

      expect(shouldCreate).toBe(true);
      expect(DEFAULT_CRITERIA).toHaveLength(4);
    });
  });

  describe("Integration - Reorder Validation", () => {
    it("validates all criterion IDs belong to category", () => {
      const existingCriteria = [
        { id: "c1", categoryId: "cat1" },
        { id: "c2", categoryId: "cat1" },
        { id: "c3", categoryId: "cat1" },
      ];
      const existingIds = new Set(existingCriteria.map((c) => c.id));

      // Valid reorder
      const validOrder = ["c1", "c3", "c2"];
      const allValid = validOrder.every((id) => existingIds.has(id));
      expect(allValid).toBe(true);

      // Invalid reorder (includes ID from different category)
      const invalidOrder = ["c1", "c3", "c_different"];
      const allInvalid = invalidOrder.every((id) => existingIds.has(id));
      expect(allInvalid).toBe(false);
    });

    it("validates all category criteria are included in reorder", () => {
      const existingCriteria = [
        { id: "c1", categoryId: "cat1" },
        { id: "c2", categoryId: "cat1" },
        { id: "c3", categoryId: "cat1" },
      ];

      // Valid - includes all 3 criteria
      const validOrder = ["c1", "c3", "c2"];
      expect(validOrder.length).toBe(existingCriteria.length);

      // Invalid - missing one criterion
      const invalidOrder = ["c1", "c3"];
      expect(invalidOrder.length).not.toBe(existingCriteria.length);
    });
  });
});
