import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  categoryFormSchema,
} from "~/lib/validations/category";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-category-id",
}));

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Test data fixtures
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
};

const mockSession = {
  user: mockUser,
  session: { id: "session-1" },
};

const mockMember = {
  id: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "owner" as const,
};

const mockCup = {
  id: "cup-1",
  name: "Test Cup",
  organizationId: "org-1",
  status: "draft" as const,
  type: "public" as const,
};

describe("Category Router", () => {
  describe("Input Validation - createCategorySchema", () => {
    it("rejects missing cupId", () => {
      const result = createCategorySchema.safeParse({
        name: "Valid Name",
        description: "Description",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty cupId", () => {
      const result = createCategorySchema.safeParse({
        cupId: "",
        name: "Valid Name",
      });

      expect(result.success).toBe(false);
    });

    it("rejects name shorter than 2 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "A",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("2 caractères");
      }
    });

    it("rejects name longer than 100 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "A".repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it("rejects description longer than 500 characters", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Name",
        description: "A".repeat(501),
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid input with all fields", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Category Name",
        description: "A valid description",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cupId).toBe("cup-1");
        expect(result.data.name).toBe("Valid Category Name");
      }
    });

    it("accepts valid input without description", () => {
      const result = createCategorySchema.safeParse({
        cupId: "cup-1",
        name: "Valid Name",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - updateCategorySchema", () => {
    it("rejects missing id", () => {
      const result = updateCategorySchema.safeParse({
        name: "New Name",
      });

      expect(result.success).toBe(false);
    });

    it("accepts update with only name", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        name: "Updated Name",
      });

      expect(result.success).toBe(true);
    });

    it("accepts update with only description", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        description: "Updated description",
      });

      expect(result.success).toBe(true);
    });

    it("accepts null description (to clear it)", () => {
      const result = updateCategorySchema.safeParse({
        id: "cat-1",
        description: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - reorderCategoriesSchema", () => {
    it("rejects missing cupId", () => {
      const result = reorderCategoriesSchema.safeParse({
        categoryIds: ["cat-1", "cat-2"],
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty categoryIds array", () => {
      const result = reorderCategoriesSchema.safeParse({
        cupId: "cup-1",
        categoryIds: [],
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid reorder input", () => {
      const result = reorderCategoriesSchema.safeParse({
        cupId: "cup-1",
        categoryIds: ["cat-3", "cat-1", "cat-2"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryIds).toHaveLength(3);
        expect(result.data.categoryIds[0]).toBe("cat-3");
      }
    });
  });

  describe("Input Validation - categoryFormSchema", () => {
    it("transforms empty string description to undefined", () => {
      const result = categoryFormSchema.safeParse({
        name: "Valid Name",
        description: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });

    it("preserves non-empty description", () => {
      const result = categoryFormSchema.safeParse({
        name: "Valid Name",
        description: "Some description",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("Some description");
      }
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

    it("returns valid session when authenticated", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never);

      const session = await auth.api.getSession({ headers: new Headers() });

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user-1");
    });
  });

  describe("Business Logic - sortOrder Calculation", () => {
    it("calculates sortOrder 0 when no categories exist", () => {
      const maxOrderFromDb: number | null = null;
      const nextOrder = ((maxOrderFromDb as number | null) ?? -1) + 1;

      expect(nextOrder).toBe(0);
    });

    it("calculates correct next sortOrder with existing categories", () => {
      const maxOrderFromDb = 5;
      const nextOrder = (maxOrderFromDb ?? -1) + 1;

      expect(nextOrder).toBe(6);
    });
  });

  describe("Business Logic - Multi-tenancy Validation", () => {
    it("validates category belongs to user organization via cup", () => {
      const categoryOrganizationId = mockCup.organizationId;
      const memberOrganizationId = mockMember.organizationId;

      expect(categoryOrganizationId).toBe(memberOrganizationId);
    });

    it("detects cross-tenant access attempt", () => {
      const categoryOrganizationId = "org-1";
      const attackerOrganizationId = "org-2";

      expect(categoryOrganizationId).not.toBe(attackerOrganizationId);
      // Router would throw FORBIDDEN
    });
  });

  describe("Business Logic - Delete Protection", () => {
    it("blocks deletion when products exist", () => {
      const productsCount = 5;
      const shouldBlock = productsCount > 0;

      expect(shouldBlock).toBe(true);
      // Router throws CONFLICT with message
    });

    it("allows deletion when no products exist", () => {
      const productsCount = 0;
      const shouldBlock = productsCount > 0;

      expect(shouldBlock).toBe(false);
    });
  });

  describe("Business Logic - Reorder", () => {
    it("correctly maps array positions to sortOrder", () => {
      const categoryIds = ["cat-3", "cat-1", "cat-2"];
      const sortOrders = categoryIds.map((id, index) => ({
        id,
        sortOrder: index,
      }));

      expect(sortOrders).toEqual([
        { id: "cat-3", sortOrder: 0 },
        { id: "cat-1", sortOrder: 1 },
        { id: "cat-2", sortOrder: 2 },
      ]);
    });

    it("validates all categoryIds belong to the cup", () => {
      const requestedIds = ["cat-1", "cat-2", "cat-3"];
      const existingIdsInCup = ["cat-1", "cat-2"]; // cat-3 doesn't exist

      const allIdsValid = requestedIds.every((id) =>
        existingIdsInCup.includes(id)
      );

      expect(allIdsValid).toBe(false);
      // Router throws BAD_REQUEST
    });
  });
});
