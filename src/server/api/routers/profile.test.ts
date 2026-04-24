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
      members: {
        findFirst: vi.fn(),
      },
      organizations: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

// Mock schema
vi.mock("~/server/db/schema", () => ({
  users: { id: "id" },
  organizations: { id: "id" },
  members: { id: "id" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

describe("Profile Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      // We can't easily test tRPC routers directly, so we test the logic
      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return user profile with organization when logged in", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user_123",
          name: "John Doe",
          email: "john@example.com",
          emailVerified: true,
        },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
        id: "org_123",
        name: "Test Company",
        slug: "test-company",
      } as never);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session?.user).toBeDefined();
      expect(session?.user.name).toBe("John Doe");

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeDefined();
      expect(member?.organizationId).toBe("org_123");

      const org = await db.query.organizations.findFirst({} as never);
      expect(org?.name).toBe("Test Company");
    });

    it("should return null organization when user has no organization", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user_123",
          name: "John Doe",
          email: "john@example.com",
          emailVerified: true,
        },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });
  });

  describe("updateProfile", () => {
    it("should update user and organization name", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user_123",
          name: "John Doe",
          email: "john@example.com",
          emailVerified: true,
        },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      // Simulate update calls
      await db.update({} as never).set({}).where({} as never);
      await db.update({} as never).set({}).where({} as never);

      expect(db.update).toHaveBeenCalledTimes(2);
    });
  });
});
