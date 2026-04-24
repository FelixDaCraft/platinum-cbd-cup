import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock database
vi.mock("~/server/db", () => ({
  db: {
    query: {
      cups: {
        findFirst: vi.fn(),
      },
      registrations: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe("Product Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listByCupGroupedByCategory", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db: (await import("~/server/db")).db,
      } as never);

      await expect(
        caller.listByCupGroupedByCategory({ cupId: "cup_123" })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.listByCupGroupedByCategory({ cupId: "cup_123" });
      } catch (error) {
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    it("should return NOT_FOUND if cup does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(null as never);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);

      await expect(
        caller.listByCupGroupedByCategory({ cupId: "nonexistent" })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.listByCupGroupedByCategory({ cupId: "nonexistent" });
      } catch (error) {
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    it("should return products grouped by category", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
      } as never);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          id: "reg_1",
          cupId: "cup_123",
          producer: {
            id: "producer_1",
            companyName: "Producer One",
            user: { name: "John Doe" },
          },
          products: [
            {
              id: "prod_1",
              name: "Product A",
              description: "Desc A",
              status: "pending",
              anonymousCode: "#A1",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Category 1", description: "Cat 1 desc" },
            },
            {
              id: "prod_2",
              name: "Product B",
              description: "Desc B",
              status: "received",
              anonymousCode: "#A2",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Category 1", description: "Cat 1 desc" },
            },
          ],
        },
        {
          id: "reg_2",
          cupId: "cup_123",
          producer: {
            id: "producer_2",
            companyName: "Producer Two",
            user: { name: "Jane Smith" },
          },
          products: [
            {
              id: "prod_3",
              name: "Product C",
              description: null,
              status: "pending",
              anonymousCode: null,
              categoryId: "cat_2",
              category: { id: "cat_2", name: "Category 2", description: null },
            },
          ],
        },
      ] as never);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);

      const result = await caller.listByCupGroupedByCategory({ cupId: "cup_123" });

      expect(result.cupId).toBe("cup_123");
      expect(result.cupName).toBe("Test Cup");
      expect(result.totalProducts).toBe(3);
      expect(result.totalCategories).toBe(2);
      expect(result.categories).toHaveLength(2);

      // Categories should be sorted by name
      expect(result.categories[0]!.category.name).toBe("Category 1");
      expect(result.categories[1]!.category.name).toBe("Category 2");

      // Category 1 should have 2 products
      expect(result.categories[0]!.count).toBe(2);
      expect(result.categories[0]!.products).toHaveLength(2);

      // Category 2 should have 1 product
      expect(result.categories[1]!.count).toBe(1);
      expect(result.categories[1]!.products).toHaveLength(1);
    });

    it("should include product details with producer info", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
      } as never);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          id: "reg_1",
          cupId: "cup_123",
          producer: {
            id: "producer_1",
            companyName: "Test Company",
            user: { name: "Test User" },
          },
          products: [
            {
              id: "prod_1",
              name: "Test Product",
              description: "A description",
              status: "received",
              anonymousCode: "#B42",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Test Category", description: null },
            },
          ],
        },
      ] as never);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);

      const result = await caller.listByCupGroupedByCategory({ cupId: "cup_123" });

      const product = result.categories[0]!.products[0]!;
      expect(product.id).toBe("prod_1");
      expect(product.name).toBe("Test Product");
      expect(product.description).toBe("A description");
      expect(product.status).toBe("received");
      expect(product.anonymousCode).toBe("#B42");
      expect(product.producer.companyName).toBe("Test Company");
      expect(product.producer.userName).toBe("Test User");
    });

    it("should return empty categories array when no products exist", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Empty Cup",
      } as never);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([] as never);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);

      const result = await caller.listByCupGroupedByCategory({ cupId: "cup_123" });

      expect(result.totalProducts).toBe(0);
      expect(result.totalCategories).toBe(0);
      expect(result.categories).toEqual([]);
    });

    it("should handle products without anonymousCode", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
      } as never);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          id: "reg_1",
          cupId: "cup_123",
          producer: {
            id: "producer_1",
            companyName: "Producer",
            user: { name: null },
          },
          products: [
            {
              id: "prod_1",
              name: "Unanonymized Product",
              description: null,
              status: "pending",
              anonymousCode: null,
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Cat", description: null },
            },
          ],
        },
      ] as never);

      const { productRouter } = await import("./product");
      const caller = productRouter.createCaller({
        headers: new Headers(),
        db,
      } as never);

      const result = await caller.listByCupGroupedByCategory({ cupId: "cup_123" });

      expect(result.categories[0]!.products[0]!.anonymousCode).toBeNull();
      expect(result.categories[0]!.products[0]!.producer.userName).toBeNull();
    });
  });
});
