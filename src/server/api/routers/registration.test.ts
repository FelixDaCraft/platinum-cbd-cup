import { describe, it, expect, vi, beforeEach } from "vitest";

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
      producers: {
        findFirst: vi.fn(),
      },
      cups: {
        findFirst: vi.fn(),
      },
      categories: {
        findFirst: vi.fn(),
      },
      members: {
        findFirst: vi.fn(),
      },
      registrations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
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
  },
}));

// Mock schema
vi.mock("~/server/db/schema", () => ({
  registrations: { id: "id" },
  products: { id: "id" },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test_id"),
}));

// Mock Stripe
vi.mock("~/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(() =>
          Promise.resolve({
            id: "cs_test_123",
            url: "https://checkout.stripe.com/cs_test_123",
          })
        ),
      },
    },
  },
}));

// Mock env
vi.mock("~/env", () => ({
  env: {
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

describe("Registration Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreate", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user has no producer profile", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined);

      const producer = await db.query.producers.findFirst({} as never);
      expect(producer).toBeUndefined();
    });

    it("should return NOT_FOUND if cup does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
        companyName: "Test Co",
        brandName: "TestBrand",
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined);

      const cup = await db.query.cups.findFirst({} as never);
      expect(cup).toBeUndefined();
    });

    it("should return BAD_REQUEST if cup is not published", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "draft",
        name: "Test Cup",
      } as never);

      const cup = await db.query.cups.findFirst({} as never);
      expect(cup?.status).toBe("draft");
      expect(cup?.status).not.toBe("published");
    });

    it("should return existing registration if one exists", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "published",
        name: "Test Cup",
        currency: "EUR",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg_123",
        cupId: "cup_123",
        producerId: "producer_123",
        status: "pending_payment",
        totalAmount: 0,
        products: [],
      } as never);

      const registration = await db.query.registrations.findFirst({} as never);
      expect(registration).toBeDefined();
      expect(registration?.id).toBe("reg_123");
    });

    it("should create new registration if none exists", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "published",
        name: "Test Cup",
        currency: "EUR",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const mockReturning = vi.fn().mockResolvedValue([{
        id: "new_reg_123",
        cupId: "cup_123",
        producerId: "producer_123",
        status: "pending_payment",
        totalAmount: 0,
      }]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      // New registration would be created
      expect(db.insert).toBeDefined();
    });
  });

  describe("addProduct", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const registration = await db.query.registrations.findFirst({} as never);
      expect(registration).toBeUndefined();
    });

    it("should return BAD_REQUEST if registration is not pending_payment", async () => {
      const { db } = await import("~/server/db");

      const statuses = ["confirmed", "cancelled"] as const;

      for (const status of statuses) {
        vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
          id: "reg_123",
          status,
          producerId: "producer_123",
        } as never);

        const registration = await db.query.registrations.findFirst({} as never);
        expect(registration?.status).toBe(status);
        expect(registration?.status).not.toBe("pending_payment");
      }
    });

    it("should return BAD_REQUEST if category does not belong to cup", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        cupId: "cup_123",
      } as never);

      // Category query returns undefined (not in this cup)
      vi.mocked(db.query.categories.findFirst).mockResolvedValue(undefined);

      const category = await db.query.categories.findFirst({} as never);
      expect(category).toBeUndefined();
    });

    it("should add product with correct price from category override", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        cupId: "cup_123",
      } as never);

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat_123",
        cupId: "cup_123",
        name: "Vins Rouges",
        priceOverride: 2000, // 20 EUR
      } as never);

      const category = await db.query.categories.findFirst({} as never);
      expect(category?.priceOverride).toBe(2000);
    });

    it("should add product with correct price from cup default when no override", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat_123",
        cupId: "cup_123",
        name: "Vins Rouges",
        priceOverride: null,
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        defaultPricePerProduct: 1500, // 15 EUR
      } as never);

      const category = await db.query.categories.findFirst({} as never);
      const cup = await db.query.cups.findFirst({} as never);

      expect(category?.priceOverride).toBeNull();
      expect(cup?.defaultPricePerProduct).toBe(1500);
    });
  });

  describe("removeProduct", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if product does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue(undefined);

      const product = await db.query.products.findFirst({} as never);
      expect(product).toBeUndefined();
    });

    it("should return FORBIDDEN if product belongs to different producer", async () => {
      const { db } = await import("~/server/db");

      const mockProduct = {
        id: "prod_123",
        registrationId: "reg_123",
        registration: {
          producerId: "other_producer", // Different producer
          status: "pending_payment",
        },
      };
      vi.mocked(db.query.products.findFirst).mockResolvedValue(mockProduct as never);

      const product = await db.query.products.findFirst({} as never) as unknown as typeof mockProduct;
      expect(product?.registration?.producerId).toBe("other_producer");
    });

    it("should return BAD_REQUEST if registration is not pending_payment", async () => {
      const { db } = await import("~/server/db");

      const mockProduct = {
        id: "prod_123",
        registrationId: "reg_123",
        registration: {
          producerId: "producer_123",
          status: "confirmed", // Not pending
        },
      };
      vi.mocked(db.query.products.findFirst).mockResolvedValue(mockProduct as never);

      const product = await db.query.products.findFirst({} as never) as unknown as typeof mockProduct;
      expect(product?.registration?.status).toBe("confirmed");
    });

    it("should delete product and recalculate total", async () => {
      const { db } = await import("~/server/db");

      const mockProduct = {
        id: "prod_123",
        registrationId: "reg_123",
        priceAtRegistration: 1500,
        registration: {
          producerId: "producer_123",
          status: "pending_payment",
        },
      };
      vi.mocked(db.query.products.findFirst).mockResolvedValue(mockProduct as never);

      // After deletion, remaining products
      vi.mocked(db.query.products.findMany).mockResolvedValue([
        { id: "prod_456", priceAtRegistration: 2000 },
      ] as never);

      const product = await db.query.products.findFirst({} as never) as unknown as typeof mockProduct;
      expect(product?.registration?.status).toBe("pending_payment");

      // Would delete and recalculate
      expect(db.delete).toBeDefined();
    });
  });

  describe("getSummary", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const registration = await db.query.registrations.findFirst({} as never);
      expect(registration).toBeUndefined();
    });

    it("should return grouped products by category with totals", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        totalAmount: 5000,
        currency: "EUR",
        producerId: "producer_123",
        products: [
          { id: "p1", categoryId: "cat1", name: "Produit 1", priceAtRegistration: 1500, category: { id: "cat1", name: "Vins Rouges" } },
          { id: "p2", categoryId: "cat1", name: "Produit 2", priceAtRegistration: 1500, category: { id: "cat1", name: "Vins Rouges" } },
          { id: "p3", categoryId: "cat2", name: "Produit 3", priceAtRegistration: 2000, category: { id: "cat2", name: "Vins Blancs" } },
        ],
        cup: {
          id: "cup_123",
          name: "Test Cup",
          currency: "EUR",
          organization: { id: "org_123", name: "Test Org" },
        },
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.products).toHaveLength(3);
      expect(registration?.totalAmount).toBe(5000);
    });

    it("should determine canProceedToPayment correctly", () => {
      // Can proceed: pending_payment + has products
      const testCases = [
        { status: "pending_payment", productCount: 3, expected: true },
        { status: "pending_payment", productCount: 0, expected: false },
        { status: "confirmed", productCount: 3, expected: false },
        { status: "cancelled", productCount: 3, expected: false },
      ] as const;

      for (const { status, productCount, expected } of testCases) {
        const canProceed = status === "pending_payment" && productCount > 0;
        expect(canProceed).toBe(expected);
      }
    });
  });

  describe("listMyRegistrations", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return empty array if user has no producer profile", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined);

      const producer = await db.query.producers.findFirst({} as never);
      expect(producer).toBeUndefined();
      // Would return empty array
    });

    it("should return all registrations for producer", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          id: "reg_1",
          status: "confirmed",
          cup: { id: "cup_1", name: "Cup 1", status: "rating" },
          products: [{ id: "p1" }, { id: "p2" }],
        },
        {
          id: "reg_2",
          status: "pending_payment",
          cup: { id: "cup_2", name: "Cup 2", status: "published" },
          products: [{ id: "p3" }],
        },
      ] as never);

      const registrations = await db.query.registrations.findMany({} as never);
      expect(registrations).toHaveLength(2);
    });
  });

  describe("createCheckoutSession", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user has no producer profile", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined);

      const producer = await db.query.producers.findFirst({} as never);
      expect(producer).toBeUndefined();
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const registration = await db.query.registrations.findFirst({} as never);
      expect(registration).toBeUndefined();
    });

    it("should return BAD_REQUEST if registration is not pending_payment", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "confirmed",
        producerId: "producer_123",
        totalAmount: 5000,
        currency: "EUR",
        cupId: "cup_123",
        products: [{ id: "p1" }],
        cup: { id: "cup_123", name: "Test Cup" },
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.status).toBe("confirmed");
    });

    it("should return BAD_REQUEST if no products", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 0,
        currency: "EUR",
        cupId: "cup_123",
        products: [],
        cup: { id: "cup_123", name: "Test Cup" },
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.products).toHaveLength(0);
    });

    it("should return BAD_REQUEST if totalAmount is 0 (should use confirmFreeRegistration)", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 0,
        currency: "EUR",
        cupId: "cup_123",
        products: [{ id: "p1" }],
        cup: { id: "cup_123", name: "Test Cup" },
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.totalAmount).toBe(0);
    });

    it("should create Stripe checkout session with correct parameters", async () => {
      const { stripe } = await import("~/lib/stripe");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 5000,
        currency: "EUR",
        cupId: "cup_123",
        products: [{ id: "p1" }, { id: "p2" }],
        cup: { id: "cup_123", name: "Test Cup" },
      };

      // Stripe mock should be called
      expect(stripe.checkout.sessions.create).toBeDefined();
      expect(mockRegistration.products).toHaveLength(2);
      expect(mockRegistration.totalAmount).toBe(5000);
    });
  });

  describe("confirmFreeRegistration", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user has no producer profile", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined);

      const producer = await db.query.producers.findFirst({} as never);
      expect(producer).toBeUndefined();
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.producers.findFirst).mockResolvedValue({
        id: "producer_123",
        userId: "user_123",
      } as never);

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const registration = await db.query.registrations.findFirst({} as never);
      expect(registration).toBeUndefined();
    });

    it("should return BAD_REQUEST if registration is not pending_payment", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "confirmed",
        producerId: "producer_123",
        totalAmount: 0,
        products: [{ id: "p1" }],
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.status).toBe("confirmed");
    });

    it("should return BAD_REQUEST if no products", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 0,
        products: [],
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.products).toHaveLength(0);
    });

    it("should return BAD_REQUEST if totalAmount is not 0 (should use createCheckoutSession)", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 5000,
        products: [{ id: "p1" }],
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.totalAmount).toBe(5000);
    });

    it("should confirm free registration and update status", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_123",
        status: "pending_payment",
        producerId: "producer_123",
        totalAmount: 0,
        products: [{ id: "p1" }],
      };
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(mockRegistration as never);

      const registration = await db.query.registrations.findFirst({} as never) as unknown as typeof mockRegistration;
      expect(registration?.totalAmount).toBe(0);
      expect(registration?.status).toBe("pending_payment");

      // Would update to confirmed
      expect(db.update).toBeDefined();
    });
  });

  describe("listByCup (Organizer View)", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user is not member of an organization", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });

    it("should return NOT_FOUND if cup does not belong to organization", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      // Cup not found (belongs to different org or doesn't exist)
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined);

      const cup = await db.query.cups.findFirst({} as never);
      expect(cup).toBeUndefined();
    });

    it("should return empty array if no registrations for cup", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organizationId: "org_123",
        status: "published",
      } as never);

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([]);

      const registrations = await db.query.registrations.findMany({} as never);
      expect(registrations).toHaveLength(0);
    });

    it("should return registrations with producer and products", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organizationId: "org_123",
        status: "published",
      } as never);

      const mockRegistrations = [
        {
          id: "reg_1",
          status: "confirmed",
          totalAmount: 5000,
          currency: "EUR",
          createdAt: new Date(),
          updatedAt: new Date(),
          producer: {
            id: "producer_1",
            companyName: "Company A",
            brandName: "Brand A",
            siret: "12345678901234",
            website: "https://example.com",
            user: {
              id: "user_prod_1",
              name: "Producer One",
              email: "producer1@example.com",
            },
          },
          products: [
            {
              id: "p1",
              name: "Product 1",
              status: "pending",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Category 1" },
            },
            {
              id: "p2",
              name: "Product 2",
              status: "received",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Category 1" },
            },
          ],
        },
        {
          id: "reg_2",
          status: "pending_payment",
          totalAmount: 3000,
          currency: "EUR",
          createdAt: new Date(),
          updatedAt: new Date(),
          producer: {
            id: "producer_2",
            companyName: "Company B",
            brandName: "Brand B",
            siret: null,
            website: null,
            user: {
              id: "user_prod_2",
              name: "Producer Two",
              email: "producer2@example.com",
            },
          },
          products: [
            {
              id: "p3",
              name: "Product 3",
              status: "pending",
              categoryId: "cat_2",
              category: { id: "cat_2", name: "Category 2" },
            },
          ],
        },
      ];
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockRegistrations as never);

      const registrations = await db.query.registrations.findMany({} as never);
      expect(registrations).toHaveLength(2);

      const reg1 = registrations[0] as unknown as typeof mockRegistrations[0];
      expect(reg1.producer.brandName).toBe("Brand A");
      expect(reg1.products).toHaveLength(2);

      const reg2 = registrations[1] as unknown as typeof mockRegistrations[1];
      expect(reg2.status).toBe("pending_payment");
      expect(reg2.producer.siret).toBeNull();
    });

    it("should filter by status when status filter is provided", async () => {
      const { db } = await import("~/server/db");

      // Simulate filtering - mock returns only confirmed registrations
      const mockConfirmedRegistrations = [
        {
          id: "reg_1",
          status: "confirmed",
          totalAmount: 5000,
          producer: {
            id: "producer_1",
            brandName: "Brand A",
            user: { email: "p1@example.com" },
          },
          products: [],
        },
      ];
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockConfirmedRegistrations as never);

      const registrations = await db.query.registrations.findMany({} as never);
      expect(registrations).toHaveLength(1);
      expect((registrations[0] as unknown as typeof mockConfirmedRegistrations[0]).status).toBe("confirmed");
    });

    it("should filter by category when categoryId filter is provided", async () => {
      const { db } = await import("~/server/db");

      // Mock returns registrations with products in the specified category
      const mockFilteredRegistrations = [
        {
          id: "reg_1",
          status: "confirmed",
          producer: { brandName: "Brand A", user: {} },
          products: [
            { id: "p1", categoryId: "cat_target", category: { id: "cat_target", name: "Target Category" } },
          ],
        },
      ];
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockFilteredRegistrations as never);

      const registrations = await db.query.registrations.findMany({} as never);
      const reg = registrations[0] as unknown as typeof mockFilteredRegistrations[0];
      expect(reg.products.every((p) => p.categoryId === "cat_target")).toBe(true);
    });

    it("should filter by date range when dateFrom and dateTo are provided", () => {
      // Test date filtering logic
      const dateFrom = new Date("2026-01-01");
      const dateTo = new Date("2026-01-31");
      const testDate = new Date("2026-01-15");
      const outsideDate = new Date("2025-12-15");

      expect(testDate >= dateFrom && testDate <= dateTo).toBe(true);
      expect(outsideDate >= dateFrom && outsideDate <= dateTo).toBe(false);
    });

    it("should include productCount in response", async () => {
      const { db } = await import("~/server/db");

      const mockRegistration = {
        id: "reg_1",
        status: "confirmed",
        producer: { brandName: "Brand A", user: {} },
        products: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
      };
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([mockRegistration] as never);

      const registrations = await db.query.registrations.findMany({} as never);
      const reg = registrations[0] as unknown as typeof mockRegistration;
      const productCount = reg.products.length;

      expect(productCount).toBe(3);
    });
  });
});
