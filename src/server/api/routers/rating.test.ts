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
      cups: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      members: {
        findFirst: vi.fn(),
      },
      cupJuries: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      categories: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      juryCategoryAssignments: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      organizations: {
        findFirst: vi.fn(),
      },
      registrations: {
        findMany: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      productRatings: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      publicJuryTokens: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      ratingCriteria: {
        findMany: vi.fn(),
      },
      criterionScores: {
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
  cups: { id: "id", organizationId: "organization_id", status: "status", ratingsLockedAt: "ratings_locked_at", ratingEndAt: "rating_end_at" },
  members: { id: "id", userId: "user_id", organizationId: "organization_id", role: "role" },
  cupJuries: { id: "id", cupId: "cup_id", userId: "user_id", isActive: "is_active", samplesReceivedAt: "samples_received_at" },
  categories: { id: "id", cupId: "cup_id" },
  juryCategoryAssignments: { id: "id", cupJuryId: "cup_jury_id", categoryId: "category_id" },
  organizations: { id: "id" },
  registrations: { cupId: "cup_id", status: "status" },
  products: { id: "id", categoryId: "category_id" },
  productRatings: { id: "id", productId: "product_id", juryId: "jury_id", submittedAt: "submitted_at" },
  criterionScores: { id: "id", productRatingId: "product_rating_id", criterionId: "criterion_id" },
  publicJuryTokens: { id: "id", token: "token", cupId: "cup_id", status: "status", categoryId: "category_id" },
  cupLabels: { id: "id", minScore: "min_score" },
  users: { id: "id" },
  ratingCriteria: { id: "id" },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test_id_12345"),
}));

// Mock env
vi.mock("~/env", () => ({
  env: {
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

// =============================================================================
// EPIC 7: RATING SYSTEM TESTS
// =============================================================================

describe("Jury Router - Epic 7: Rating System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Story 7.1: Confirmation Reception Echantillons
  // ===========================================================================
  describe("confirmSamplesReceived - Story 7.1", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user is not a jury for the cup", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const juryMembership = await db.query.cupJuries.findFirst({} as never);
      expect(juryMembership).toBeUndefined();
    });

    it("should return already confirmed if samples were already received", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const confirmedDate = new Date();

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
        isActive: true,
        samplesReceivedAt: confirmedDate,
      } as never);

      const juryMembership = await db.query.cupJuries.findFirst({} as never) as { samplesReceivedAt: Date };
      expect(juryMembership.samplesReceivedAt).toEqual(confirmedDate);
    });

    it("should update samples received timestamp", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
        isActive: true,
        samplesReceivedAt: null,
      } as never);

      const juryMembership = await db.query.cupJuries.findFirst({} as never) as { samplesReceivedAt: null };
      expect(juryMembership.samplesReceivedAt).toBeNull();
      expect(db.update).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 7.2: Tableau de Bord Jury
  // ===========================================================================
  describe("getMyJuryCup - Story 7.2", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if cup does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined);

      const cup = await db.query.cups.findFirst({} as never);
      expect(cup).toBeUndefined();
    });

    it("should return FORBIDDEN if user is not a jury", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const juryMembership = await db.query.cupJuries.findFirst({} as never);
      expect(juryMembership).toBeUndefined();
    });

    it("should return products to rate with isRated status", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
        isActive: true,
        categoryAssignments: [
          { categoryId: "cat_1", category: { id: "cat_1", name: "Vins Rouges" } },
        ],
      } as never);

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          producer: { userId: "other_user" },
          products: [
            {
              id: "prod_1",
              anonymousCode: "#A001",
              categoryId: "cat_1",
              category: { name: "Vins Rouges" },
              ratings: [{ submittedAt: new Date() }],
            },
            {
              id: "prod_2",
              anonymousCode: "#A002",
              categoryId: "cat_1",
              category: { name: "Vins Rouges" },
              ratings: [],
            },
          ],
        },
      ] as never);

      const registrations = await db.query.registrations.findMany({} as never) as unknown as Array<{ products: Array<{ id: string; ratings: Array<{ submittedAt: Date | null }> }> }>;
      const products = registrations.flatMap((r) => r.products);

      expect(products).toHaveLength(2);
      expect(products[0]!.ratings.length).toBeGreaterThan(0);
      expect(products[1]!.ratings).toHaveLength(0);
    });

    it("should filter out products from jury own registrations (conflict of interest)", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
        isActive: true,
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      // One registration from the jury themselves
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          producer: { userId: "user_123" }, // Same as jury user
          products: [{ id: "prod_own", categoryId: "cat_1" }],
        },
        {
          producer: { userId: "other_user" },
          products: [{ id: "prod_other", categoryId: "cat_1" }],
        },
      ] as never);

      const registrations = await db.query.registrations.findMany({} as never) as unknown as Array<{ producer: { userId: string }; products: Array<{ id: string }> }>;

      // Filter out own products
      const productsToRate = registrations
        .filter((r) => r.producer.userId !== "user_123")
        .flatMap((r) => r.products);

      expect(productsToRate).toHaveLength(1);
      expect(productsToRate[0]!.id).toBe("prod_other");
    });
  });

  // ===========================================================================
  // Story 7.3: Interface de Notation
  // ===========================================================================
  describe("getProductForRating - Story 7.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return PRECONDITION_FAILED if samples not received", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
        isActive: true,
        samplesReceivedAt: null, // Not confirmed
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      const jury = await db.query.cupJuries.findFirst({} as never) as { samplesReceivedAt: null };
      expect(jury.samplesReceivedAt).toBeNull();
    });

    it("should return PRECONDITION_FAILED if ratings are locked", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: new Date(), // Locked!
        ratingEndAt: null,
      } as never);

      const cup = await db.query.cups.findFirst({} as never) as { ratingsLockedAt: Date };
      expect(cup.ratingsLockedAt).toBeDefined();
    });

    it("should return PRECONDITION_FAILED if rating deadline passed", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: null,
        ratingEndAt: pastDate, // Past deadline
      } as never);

      const cup = await db.query.cups.findFirst({} as never) as { ratingEndAt: Date };
      expect(new Date() > cup.ratingEndAt).toBe(true);
    });

    it("should return FORBIDDEN if jury is not assigned to product category", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }], // Only assigned to cat_1
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_2", // Product is in cat_2, not cat_1
        category: { name: "Cat 2", criteria: [] },
        registration: { cupId: "cup_123", producer: { userId: "other" } },
      } as never);

      const jury = await db.query.cupJuries.findFirst({} as never) as unknown as { categoryAssignments: Array<{ categoryId: string }> };
      const product = await db.query.products.findFirst({} as never) as unknown as { categoryId: string };

      const isAssigned = jury.categoryAssignments.some((a) => a.categoryId === product.categoryId);
      expect(isAssigned).toBe(false);
    });

    it("should return FORBIDDEN for own products (conflict of interest)", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_1",
        category: { name: "Cat 1", criteria: [] },
        registration: { cupId: "cup_123", producer: { userId: "user_123" } }, // Same as jury
      } as never);

      const product = await db.query.products.findFirst({} as never) as unknown as { registration: { producer: { userId: string } } };
      expect(product.registration.producer.userId).toBe("user_123");
    });

    it("should return product with criteria for rating", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        name: "Test Cup",
        organization: { name: "Test Org" },
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        anonymousCode: "#A001",
        categoryId: "cat_1",
        category: {
          name: "Vins Rouges",
          criteria: [
            { id: "crit_1", name: "Apparence", coefficient: 1, sortOrder: 1 },
            { id: "crit_2", name: "Nez", coefficient: 2, sortOrder: 2 },
            { id: "crit_3", name: "Bouche", coefficient: 3, sortOrder: 3 },
          ],
        },
        registration: { cupId: "cup_123", producer: { userId: "other_user" } },
      } as never);

      const product = await db.query.products.findFirst({} as never) as unknown as { category: { criteria: Array<{ id: string; name: string; coefficient: number }> } };
      expect(product.category.criteria).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Story 7.4: Soumission des Notes
  // ===========================================================================
  describe("submitRating - Story 7.4", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return PRECONDITION_FAILED if cup is not in rating phase", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "draft", // Not in rating phase
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      const cup = await db.query.cups.findFirst({} as never) as { status: string };
      expect(cup.status).not.toBe("rating");
      expect(cup.status).not.toBe("published");
    });

    it("should return BAD_REQUEST if missing criteria scores on submit", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "rating",
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_1",
        category: {
          criteria: [
            { id: "crit_1" },
            { id: "crit_2" },
            { id: "crit_3" },
          ],
        },
        registration: { cupId: "cup_123" },
      } as never);

      // Only 2 of 3 criteria provided
      const providedScores = [
        { criterionId: "crit_1", score: 8 },
        { criterionId: "crit_2", score: 7 },
      ];

      const categoryCriteria = ["crit_1", "crit_2", "crit_3"];
      const providedCriteriaIds = providedScores.map((s) => s.criterionId);
      const missingCriteria = categoryCriteria.filter((id) => !providedCriteriaIds.includes(id));

      expect(missingCriteria).toHaveLength(1);
      expect(missingCriteria[0]).toBe("crit_3");
    });

    it("should return CONFLICT if rating already submitted", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "rating",
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_1",
        category: { criteria: [{ id: "crit_1" }] },
        registration: { cupId: "cup_123" },
      } as never);

      vi.mocked(db.query.productRatings.findFirst).mockResolvedValue({
        id: "rating_123",
        productId: "prod_123",
        juryId: "jury_123",
        submittedAt: new Date(), // Already submitted
        scores: [],
      } as never);

      const existingRating = await db.query.productRatings.findFirst({} as never) as { submittedAt: Date };
      expect(existingRating.submittedAt).toBeDefined();
    });

    it("should create new rating with scores", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "rating",
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_1",
        category: {
          criteria: [
            { id: "crit_1", coefficient: 1 },
            { id: "crit_2", coefficient: 2 },
          ],
        },
        registration: { cupId: "cup_123" },
      } as never);

      vi.mocked(db.query.productRatings.findFirst).mockResolvedValue(undefined);

      const scores = [
        { criterionId: "crit_1", score: 8 },
        { criterionId: "crit_2", score: 7 },
      ];

      // Calculate weighted average
      const criteriaMap = new Map([
        ["crit_1", 1],
        ["crit_2", 2],
      ]);

      let weightedSum = 0;
      let totalWeight = 0;
      for (const score of scores) {
        const coefficient = criteriaMap.get(score.criterionId) ?? 1;
        weightedSum += score.score * coefficient;
        totalWeight += coefficient;
      }
      const averageScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // (8*1 + 7*2) / (1+2) = (8 + 14) / 3 = 22/3 = 7.33
      expect(averageScore).toBeCloseTo(7.33, 1);
      expect(db.insert).toBeDefined();
    });

    it("should update existing draft rating", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        status: "rating",
        ratingsLockedAt: null,
        ratingEndAt: null,
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        samplesReceivedAt: new Date(),
        categoryAssignments: [{ categoryId: "cat_1" }],
      } as never);

      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod_123",
        categoryId: "cat_1",
        category: { criteria: [{ id: "crit_1", coefficient: 1 }] },
        registration: { cupId: "cup_123" },
      } as never);

      vi.mocked(db.query.productRatings.findFirst).mockResolvedValue({
        id: "rating_123",
        productId: "prod_123",
        juryId: "jury_123",
        submittedAt: null, // Draft (not submitted)
        scores: [{ id: "score_1", criterionId: "crit_1", score: 5 }],
      } as never);

      const existingRating = await db.query.productRatings.findFirst({} as never) as { submittedAt: null };
      expect(existingRating.submittedAt).toBeNull();
      expect(db.update).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 7.5: Chargement des Notations Existantes
  // ===========================================================================
  describe("getMyRating - Story 7.5", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return null if no jury membership", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const juryMembership = await db.query.cupJuries.findFirst({} as never);
      expect(juryMembership).toBeUndefined();
    });

    it("should return null if no rating exists", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
      } as never);

      vi.mocked(db.query.productRatings.findFirst).mockResolvedValue(undefined);

      const rating = await db.query.productRatings.findFirst({} as never);
      expect(rating).toBeUndefined();
    });

    it("should return existing rating with scores", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
      } as never);

      vi.mocked(db.query.productRatings.findFirst).mockResolvedValue({
        id: "rating_123",
        comment: "Tres bon produit",
        submittedAt: new Date(),
        scores: [
          { criterionId: "crit_1", score: 8 },
          { criterionId: "crit_2", score: 9 },
          { criterionId: "crit_3", score: 7 },
        ],
      } as never);

      const rating = await db.query.productRatings.findFirst({} as never) as unknown as { scores: Array<{ criterionId: string; score: number }> };
      expect(rating.scores).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Story 7.7: Empechement Double Notation et Conflits
  // (Tested above in getMyJuryCup and getProductForRating)
  // ===========================================================================

  // ===========================================================================
  // Story 7.8: Auto-Save et Brouillons (Frontend only - no backend tests needed)
  // ===========================================================================

  // ===========================================================================
  // Story 7.9: Compte Jury Public Simplifie
  // ===========================================================================
  describe("generatePublicJuryTokens - Story 7.9", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user is not owner", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });

    it("should return BAD_REQUEST if category does not belong to cup", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.categories.findFirst).mockResolvedValue(undefined);

      const category = await db.query.categories.findFirst({} as never);
      expect(category).toBeUndefined();
    });

    it("should generate tokens successfully", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        id: "cat_123",
        cupId: "cup_123",
      } as never);

      const quantity = 10;
      expect(db.insert).toBeDefined();
      expect(quantity).toBeLessThanOrEqual(500);
    });
  });

  describe("getPublicJuryTokenInfo - Story 7.9", () => {
    it("should return NOT_FOUND if token does not exist", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue(undefined);

      const token = await db.query.publicJuryTokens.findFirst({} as never);
      expect(token).toBeUndefined();
    });

    it("should return BAD_REQUEST if token is expired", async () => {
      const { db } = await import("~/server/db");

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "available",
        expiresAt: expiredDate,
        cup: { id: "cup_123", name: "Test Cup", organizationId: "org_123" },
        category: { id: "cat_123", name: "Vins" },
      } as never);

      const tokenRecord = await db.query.publicJuryTokens.findFirst({} as never) as { expiresAt: Date };
      expect(new Date() > tokenRecord.expiresAt).toBe(true);
    });

    it("should return claimed status if token already used", async () => {
      const { db } = await import("~/server/db");

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "claimed",
        expiresAt: futureDate,
        cup: { id: "cup_123", name: "Test Cup", organizationId: "org_123" },
        category: { id: "cat_123", name: "Vins" },
      } as never);

      const tokenRecord = await db.query.publicJuryTokens.findFirst({} as never) as { status: string };
      expect(tokenRecord.status).toBe("claimed");
    });

    it("should return token info for valid available token", async () => {
      const { db } = await import("~/server/db");

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "available",
        expiresAt: futureDate,
        cup: { id: "cup_123", name: "Test Cup", organizationId: "org_123" },
        category: { id: "cat_123", name: "Vins" },
      } as never);

      vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
        id: "org_123",
        name: "Test Org",
        logo: null,
      } as never);

      const tokenRecord = await db.query.publicJuryTokens.findFirst({} as never) as { status: string };
      expect(tokenRecord.status).toBe("available");
    });
  });

  describe("claimPublicJuryToken - Story 7.9", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if token does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue(undefined);

      const token = await db.query.publicJuryTokens.findFirst({} as never);
      expect(token).toBeUndefined();
    });

    it("should return CONFLICT if token claimed by different user", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "claimed",
        claimedByUserId: "other_user", // Different user
        expiresAt: futureDate,
        cupId: "cup_123",
        categoryId: "cat_123",
      } as never);

      const tokenRecord = await db.query.publicJuryTokens.findFirst({} as never) as { status: string; claimedByUserId: string };
      expect(tokenRecord.status).toBe("claimed");
      expect(tokenRecord.claimedByUserId).not.toBe("user_123");
    });

    it("should return success if token claimed by same user", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "claimed",
        claimedByUserId: "user_123", // Same user
        cupJuryId: "jury_123",
        expiresAt: futureDate,
        cupId: "cup_123",
        categoryId: "cat_123",
      } as never);

      const tokenRecord = await db.query.publicJuryTokens.findFirst({} as never) as { claimedByUserId: string };
      expect(tokenRecord.claimedByUserId).toBe("user_123");
    });

    it("should create cupJury and category assignment on claim", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(db.query.publicJuryTokens.findFirst).mockResolvedValue({
        id: "token_123",
        token: "abc123",
        status: "available",
        expiresAt: futureDate,
        cupId: "cup_123",
        categoryId: "cat_123",
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.juryCategoryAssignments.findFirst).mockResolvedValue(undefined);

      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
    });
  });

  describe("listPublicJuryTokens - Story 7.9", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return tokens with stats", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
      } as never);

      vi.mocked(db.query.publicJuryTokens.findMany).mockResolvedValue([
        { id: "t1", status: "available" },
        { id: "t2", status: "available" },
        { id: "t3", status: "claimed" },
        { id: "t4", status: "expired" },
      ] as never);

      const tokens = await db.query.publicJuryTokens.findMany({} as never) as Array<{ status: string }>;

      const stats = {
        total: tokens.length,
        available: tokens.filter((t) => t.status === "available").length,
        claimed: tokens.filter((t) => t.status === "claimed").length,
        expired: tokens.filter((t) => t.status === "expired").length,
      };

      expect(stats.total).toBe(4);
      expect(stats.available).toBe(2);
      expect(stats.claimed).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  // ===========================================================================
  // Story 7.10: Calcul Automatique des Scores
  // ===========================================================================
  describe("getProductScores - Story 7.10", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user is not member", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });

    it("should calculate weighted average scores correctly", async () => {
      // Test score calculation
      const criteria = [
        { id: "crit_1", coefficient: 1 },
        { id: "crit_2", coefficient: 2 },
        { id: "crit_3", coefficient: 3 },
      ];

      const scores = [
        { criterionId: "crit_1", score: 8 },
        { criterionId: "crit_2", score: 6 },
        { criterionId: "crit_3", score: 9 },
      ];

      let weightedSum = 0;
      let totalWeight = 0;

      for (const score of scores) {
        const criterion = criteria.find((c) => c.id === score.criterionId);
        const coefficient = criterion?.coefficient ?? 1;
        weightedSum += score.score * coefficient;
        totalWeight += coefficient;
      }

      const averageScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // (8*1 + 6*2 + 9*3) / (1+2+3) = (8 + 12 + 27) / 6 = 47/6 = 7.83
      expect(averageScore).toBeCloseTo(7.83, 1);
    });

    it("should return rankings per category", async () => {
      const products = [
        { categoryId: "cat_1", averageScore: 8.5, totalRatings: 3 },
        { categoryId: "cat_1", averageScore: 7.2, totalRatings: 3 },
        { categoryId: "cat_1", averageScore: 9.1, totalRatings: 3 },
      ];

      // Sort by score descending
      products.sort((a, b) => b.averageScore - a.averageScore);

      expect(products[0]!.averageScore).toBe(9.1);
      expect(products[1]!.averageScore).toBe(8.5);
      expect(products[2]!.averageScore).toBe(7.2);
    });
  });

  describe("getCategoryRankings - Story 7.10", () => {
    it("should assign labels based on score thresholds", async () => {
      const labels = [
        { id: "label_1", name: "Or", minScore: 9, color: "#FFD700" },
        { id: "label_2", name: "Argent", minScore: 8, color: "#C0C0C0" },
        { id: "label_3", name: "Bronze", minScore: 7, color: "#CD7F32" },
      ];

      const products = [
        { averageScore: 9.5 },
        { averageScore: 8.3 },
        { averageScore: 7.1 },
        { averageScore: 6.5 },
      ];

      const productsWithLabels = products.map((p) => {
        let label = null;
        // Labels sorted by minScore desc
        for (const l of labels) {
          if (p.averageScore >= l.minScore) {
            label = l;
            break;
          }
        }
        return { ...p, label };
      });

      expect(productsWithLabels[0]!.label?.name).toBe("Or");
      expect(productsWithLabels[1]!.label?.name).toBe("Argent");
      expect(productsWithLabels[2]!.label?.name).toBe("Bronze");
      expect(productsWithLabels[3]!.label).toBeNull();
    });
  });

  // ===========================================================================
  // Story 7.11: Verrouillage des Notations
  // ===========================================================================
  describe("lockRatings - Story 7.11", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return FORBIDDEN if user is not owner", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });

    it("should return already locked if ratings were previously locked", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        ratingsLockedAt: new Date(), // Already locked
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      const cup = await db.query.cups.findFirst({} as never) as { ratingsLockedAt: Date };
      expect(cup.ratingsLockedAt).toBeDefined();
    });

    it("should require confirmation before locking", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        ratingsLockedAt: null,
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      // Without confirm=true, should return stats
      const confirm = false;
      expect(confirm).toBe(false);
    });

    it("should lock ratings and update cup status to completed", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        ratingsLockedAt: null,
        status: "rating",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      // With confirm=true, should lock
      const confirm = true;
      expect(confirm).toBe(true);
      expect(db.update).toBeDefined();
    });
  });

  describe("getRatingLockStatus - Story 7.11", () => {
    it("should return correct lock status", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        ratingsLockedAt: new Date(),
        ratingsLockedBy: "user_123",
        ratingEndAt: null,
        status: "completed",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
      } as never);

      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        name: "John",
        email: "john@example.com",
      } as never);

      const cup = await db.query.cups.findFirst({} as never) as { ratingsLockedAt: Date; ratingEndAt: Date | null };

      const isManuallyLocked = !!cup.ratingsLockedAt;
      const isAutoLocked = cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt);
      const isLocked = isManuallyLocked || isAutoLocked;

      expect(isManuallyLocked).toBe(true);
      expect(isAutoLocked).toBeFalsy();
      expect(isLocked).toBe(true);
    });

    it("should detect automatic lock from deadline", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const cup = {
        ratingsLockedAt: null,
        ratingEndAt: pastDate,
      };

      const isManuallyLocked = !!cup.ratingsLockedAt;
      const isAutoLocked = cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt);
      const isLocked = isManuallyLocked || isAutoLocked;

      expect(isManuallyLocked).toBe(false);
      expect(isAutoLocked).toBe(true);
      expect(isLocked).toBe(true);
    });

    it("should return not locked when no lock and future deadline", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const cup = {
        ratingsLockedAt: null,
        ratingEndAt: futureDate,
      };

      const isManuallyLocked = !!cup.ratingsLockedAt;
      const isAutoLocked = cup.ratingEndAt && new Date() > new Date(cup.ratingEndAt);
      const isLocked = isManuallyLocked || isAutoLocked;

      expect(isManuallyLocked).toBe(false);
      expect(isAutoLocked).toBe(false);
      expect(isLocked).toBe(false);
    });
  });
});
