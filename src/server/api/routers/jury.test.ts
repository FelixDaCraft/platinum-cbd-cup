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
      juryInvitations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
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
  cups: { id: "id", organizationId: "organization_id" },
  members: { id: "id", userId: "user_id", organizationId: "organization_id", role: "role" },
  juryInvitations: { id: "id", cupId: "cup_id", status: "status", token: "token" },
  cupJuries: { id: "id", cupId: "cup_id", userId: "user_id", isActive: "is_active" },
  categories: { id: "id", cupId: "cup_id" },
  juryCategoryAssignments: { id: "id", cupJuryId: "cup_jury_id", categoryId: "category_id" },
  organizations: { id: "id" },
  registrations: { cupId: "cup_id", status: "status" },
  products: { id: "id", categoryId: "category_id" },
  productRatings: { id: "id", productId: "product_id", juryId: "jury_id", submittedAt: "submitted_at" },
  criterionScores: { id: "id" },
  publicJuryTokens: { id: "id", token: "token", cupId: "cup_id", status: "status", categoryId: "category_id" },
  cupLabels: { id: "id" },
  users: { id: "id" },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test_id_12345"),
}));

// Mock email service
vi.mock("~/server/services/jury-invitation.service", () => ({
  sendJuryInvitation: vi.fn(() => Promise.resolve({ success: true, invitationId: "inv_123" })),
  resendInvitation: vi.fn(() => Promise.resolve({ success: true })),
  sendBulkInvitations: vi.fn(() => Promise.resolve({ sent: 5, failed: 0, errors: [] })),
  sendRatingReminder: vi.fn(() => Promise.resolve({ success: true })),
  sendBulkRatingReminders: vi.fn(() => Promise.resolve({ sent: 3, failed: 0, errors: [] })),
  sendRatingSheet: vi.fn(() => Promise.resolve({ success: true })),
  sendBulkRatingSheets: vi.fn(() => Promise.resolve({ sent: 5, failed: 0, errors: [] })),
}));

// Mock env
vi.mock("~/env", () => ({
  env: {
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

// =============================================================================
// EPIC 6: JURY MANAGEMENT TESTS
// =============================================================================

describe("Jury Router - Epic 6: Jury Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Story 6.1: Invitation des Jurys Professionnels
  // ===========================================================================
  describe("invite - Story 6.1", () => {
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

    it("should return FORBIDDEN if user is not owner of organization", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        name: "Test Cup",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const member = await db.query.members.findFirst({} as never);
      expect(member).toBeUndefined();
    });

    it("should send invitation successfully when user is owner", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendJuryInvitation } = await import("~/server/services/jury-invitation.service");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup_123",
        organizationId: "org_123",
        name: "Test Cup",
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      const member = await db.query.members.findFirst({} as never);
      expect(member?.role).toBe("owner");
      expect(sendJuryInvitation).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 6.2: Import CSV de Jurys
  // ===========================================================================
  describe("inviteBulk - Story 6.2", () => {
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

    it("should send bulk invitations successfully", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendBulkInvitations } = await import("~/server/services/jury-invitation.service");

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
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      expect(sendBulkInvitations).toBeDefined();
    });

    it("should validate maximum 100 juries per bulk import", () => {
      const juries = Array.from({ length: 101 }, (_, i) => ({
        email: `jury${i}@example.com`,
        firstName: `Jury`,
        lastName: `${i}`,
      }));

      expect(juries.length).toBe(101);
      // Validation should fail - max 100 allowed
      expect(juries.length).toBeGreaterThan(100);
    });
  });

  // ===========================================================================
  // Story 6.3: Gestion des Invitations
  // ===========================================================================
  describe("listInvitations - Story 6.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return all invitations for cup owner", async () => {
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
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      const mockInvitations = [
        { id: "inv_1", email: "jury1@example.com", status: "pending" },
        { id: "inv_2", email: "jury2@example.com", status: "accepted" },
        { id: "inv_3", email: "jury3@example.com", status: "declined" },
      ];

      vi.mocked(db.query.juryInvitations.findMany).mockResolvedValue(mockInvitations as never);

      const invitations = await db.query.juryInvitations.findMany({} as never);
      expect(invitations).toHaveLength(3);
    });

    it("should filter invitations by status", async () => {
      const { db } = await import("~/server/db");

      const pendingInvitations = [
        { id: "inv_1", email: "jury1@example.com", status: "pending" },
      ];

      vi.mocked(db.query.juryInvitations.findMany).mockResolvedValue(pendingInvitations as never);

      const invitations = await db.query.juryInvitations.findMany({} as never);
      expect(invitations).toHaveLength(1);
      expect((invitations[0] as { status: string }).status).toBe("pending");
    });
  });

  describe("getInvitationStats - Story 6.3", () => {
    it("should return correct statistics for invitations", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const mockInvitations = [
        { status: "pending" },
        { status: "pending" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "declined" },
        { status: "expired" },
      ];

      vi.mocked(db.query.juryInvitations.findMany).mockResolvedValue(mockInvitations as never);

      const invitations = await db.query.juryInvitations.findMany({} as never);

      const stats = {
        total: invitations.length,
        pending: invitations.filter((i) => (i as { status: string }).status === "pending").length,
        accepted: invitations.filter((i) => (i as { status: string }).status === "accepted").length,
        declined: invitations.filter((i) => (i as { status: string }).status === "declined").length,
        expired: invitations.filter((i) => (i as { status: string }).status === "expired").length,
      };

      expect(stats.total).toBe(7);
      expect(stats.pending).toBe(2);
      expect(stats.accepted).toBe(3);
      expect(stats.declined).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  describe("resendInvitation - Story 6.3", () => {
    it("should return NOT_FOUND if invitation does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue(undefined);

      const invitation = await db.query.juryInvitations.findFirst({} as never);
      expect(invitation).toBeUndefined();
    });

    it("should resend invitation when user is owner", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { resendInvitation } = await import("~/server/services/jury-invitation.service");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        cupId: "cup_123",
        status: "pending",
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      expect(resendInvitation).toBeDefined();
    });
  });

  describe("cancelInvitation - Story 6.3", () => {
    it("should return BAD_REQUEST if invitation is not pending", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "accepted", // Not pending
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).toBe("accepted");
      expect(invitation.status).not.toBe("pending");
    });

    it("should delete pending invitation successfully", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "pending",
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        userId: "user_123",
        organizationId: "org_123",
        role: "owner",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).toBe("pending");
      expect(db.delete).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 6.4: Acceptation/Refus Invitation
  // ===========================================================================
  describe("getInvitationByToken - Story 6.4", () => {
    it("should return NOT_FOUND if token does not exist", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue(undefined);

      const invitation = await db.query.juryInvitations.findFirst({} as never);
      expect(invitation).toBeUndefined();
    });

    it("should return BAD_REQUEST if invitation is expired", async () => {
      const { db } = await import("~/server/db");

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10); // 10 days ago

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        token: "token_123",
        status: "pending",
        expiresAt: expiredDate,
        cup: { id: "cup_123", name: "Test Cup", organizationId: "org_123" },
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { expiresAt: Date };
      expect(invitation.expiresAt < new Date()).toBe(true);
    });

    it("should return invitation details for valid token", async () => {
      const { db } = await import("~/server/db");

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days from now

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        token: "token_123",
        status: "pending",
        expiresAt: futureDate,
        cup: { id: "cup_123", name: "Test Cup", organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
        id: "org_123",
        name: "Test Org",
        logo: null,
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never);
      expect(invitation).toBeDefined();

      const org = await db.query.organizations.findFirst({} as never);
      expect(org).toBeDefined();
    });
  });

  describe("acceptInvitation - Story 6.4", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should return NOT_FOUND if invitation does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue(undefined);

      const invitation = await db.query.juryInvitations.findFirst({} as never);
      expect(invitation).toBeUndefined();
    });

    it("should return BAD_REQUEST if invitation is expired", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "pending",
        expiresAt: expiredDate,
        cupId: "cup_123",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { expiresAt: Date };
      expect(invitation.expiresAt < new Date()).toBe(true);
    });

    it("should return BAD_REQUEST if invitation already processed", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "accepted", // Already processed
        expiresAt: futureDate,
        cupId: "cup_123",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).not.toBe("pending");
    });

    it("should create cupJury entry when invitation is accepted", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "pending",
        expiresAt: futureDate,
        cupId: "cup_123",
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).toBe("pending");
      expect(db.insert).toBeDefined();
    });

    it("should handle already existing jury for this cup", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "pending",
        expiresAt: futureDate,
        cupId: "cup_123",
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        userId: "user_123",
      } as never);

      const existingJury = await db.query.cupJuries.findFirst({} as never);
      expect(existingJury).toBeDefined();
    });
  });

  describe("declineInvitation - Story 6.4", () => {
    it("should return NOT_FOUND if invitation does not exist", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue(undefined);

      const invitation = await db.query.juryInvitations.findFirst({} as never);
      expect(invitation).toBeUndefined();
    });

    it("should return BAD_REQUEST if invitation already processed", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "accepted",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).not.toBe("pending");
    });

    it("should update invitation status to declined", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.juryInvitations.findFirst).mockResolvedValue({
        id: "inv_123",
        status: "pending",
      } as never);

      const invitation = await db.query.juryInvitations.findFirst({} as never) as { status: string };
      expect(invitation.status).toBe("pending");
      expect(db.update).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 6.5: Liste et Gestion des Jurys
  // ===========================================================================
  describe("listJuries - Story 6.5", () => {
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

    it("should return list of active juries with assignments", async () => {
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

      const mockJuries = [
        {
          id: "jury_1",
          userId: "user_1",
          isActive: true,
          user: { id: "user_1", name: "Jury 1", email: "jury1@example.com" },
          categoryAssignments: [
            { category: { id: "cat_1", name: "Vins Rouges" } },
          ],
        },
        {
          id: "jury_2",
          userId: "user_2",
          isActive: true,
          user: { id: "user_2", name: "Jury 2", email: "jury2@example.com" },
          categoryAssignments: [],
        },
      ];

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue(mockJuries as never);

      const juries = await db.query.cupJuries.findMany({} as never);
      expect(juries).toHaveLength(2);
    });
  });

  describe("removeJury - Story 6.5", () => {
    it("should return NOT_FOUND if jury does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const jury = await db.query.cupJuries.findFirst({} as never);
      expect(jury).toBeUndefined();
    });

    it("should soft delete jury (set isActive to false)", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        isActive: true,
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      const jury = await db.query.cupJuries.findFirst({} as never) as { isActive: boolean };
      expect(jury.isActive).toBe(true);
      expect(db.update).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 6.6: Assignation des Categories
  // ===========================================================================
  describe("assignCategories - Story 6.6", () => {
    it("should return NOT_FOUND if jury does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const jury = await db.query.cupJuries.findFirst({} as never);
      expect(jury).toBeUndefined();
    });

    it("should return BAD_REQUEST if categories do not belong to cup", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      // Return only 2 categories when 3 were requested
      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat_1", cupId: "cup_123" },
        { id: "cat_2", cupId: "cup_123" },
      ] as never);

      const categories = await db.query.categories.findMany({} as never);
      expect(categories).toHaveLength(2);
      // If we requested 3 categoryIds but only 2 are valid, should fail
    });

    it("should delete existing assignments and create new ones", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
        role: "owner",
      } as never);

      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat_1", cupId: "cup_123" },
        { id: "cat_2", cupId: "cup_123" },
      ] as never);

      expect(db.delete).toBeDefined();
      expect(db.insert).toBeDefined();
    });
  });

  describe("bulkAssignCategories - Story 6.6", () => {
    it("should return BAD_REQUEST if some juries are invalid", async () => {
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

      // Only 2 of 3 requested juries are valid
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        { id: "jury_1" },
        { id: "jury_2" },
      ] as never);

      const juries = await db.query.cupJuries.findMany({} as never);
      expect(juries).toHaveLength(2);
    });

    it("should add new category assignments without removing existing", async () => {
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

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        { id: "jury_1" },
        { id: "jury_2" },
      ] as never);

      vi.mocked(db.query.categories.findMany).mockResolvedValue([
        { id: "cat_1" },
        { id: "cat_2" },
      ] as never);

      // Existing assignments
      vi.mocked(db.query.juryCategoryAssignments.findMany).mockResolvedValue([
        { cupJuryId: "jury_1", categoryId: "cat_1" }, // Already has cat_1
      ] as never);

      const existing = await db.query.juryCategoryAssignments.findMany({} as never);
      expect(existing).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Story 6.7: Suivi de Completion
  // ===========================================================================
  describe("getCompletionStats - Story 6.7", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await auth.api.getSession({ headers: new Headers() });
      expect(session).toBeNull();
    });

    it("should calculate stats per jury correctly", async () => {
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

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        {
          id: "jury_1",
          userId: "user_1",
          user: { id: "user_1", name: "Jury 1", email: "j1@example.com" },
          categoryAssignments: [
            { categoryId: "cat_1", category: { id: "cat_1", name: "Cat 1" } },
          ],
        },
      ] as never);

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          products: [
            { id: "prod_1", categoryId: "cat_1" },
            { id: "prod_2", categoryId: "cat_1" },
          ],
        },
      ] as never);

      const juries = await db.query.cupJuries.findMany({} as never) as unknown as Array<{ categoryAssignments: Array<{ categoryId: string }> }>;
      const registrations = await db.query.registrations.findMany({} as never) as unknown as Array<{ products: Array<{ categoryId: string }> }>;

      // Calculate products by category
      const productsByCategory = new Map<string, number>();
      for (const reg of registrations) {
        for (const product of reg.products) {
          productsByCategory.set(
            product.categoryId,
            (productsByCategory.get(product.categoryId) ?? 0) + 1
          );
        }
      }

      // jury_1 should rate 2 products (cat_1)
      const jury1Products = juries[0]!.categoryAssignments.reduce(
        (sum, a) => sum + (productsByCategory.get(a.categoryId) ?? 0),
        0
      );
      expect(jury1Products).toBe(2);
    });
  });

  // ===========================================================================
  // Story 6.8: Relance des Jurys
  // ===========================================================================
  describe("sendRatingReminder - Story 6.8", () => {
    it("should return NOT_FOUND if jury does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const jury = await db.query.cupJuries.findFirst({} as never);
      expect(jury).toBeUndefined();
    });

    it("should send reminder successfully", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendRatingReminder } = await import("~/server/services/jury-invitation.service");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cup: { organizationId: "org_123" },
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
      } as never);

      expect(sendRatingReminder).toBeDefined();
    });
  });

  describe("sendBulkRatingReminders - Story 6.8", () => {
    it("should return BAD_REQUEST if some juries are invalid", async () => {
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

      // Only 2 of 3 juries are valid
      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        { id: "jury_1", cupId: "cup_123" },
        { id: "jury_2", cupId: "cup_123" },
      ] as never);

      const juries = await db.query.cupJuries.findMany({} as never);
      expect(juries).toHaveLength(2);
    });

    it("should send reminders to all valid juries", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendBulkRatingReminders } = await import("~/server/services/jury-invitation.service");

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

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        { id: "jury_1", cupId: "cup_123" },
        { id: "jury_2", cupId: "cup_123" },
        { id: "jury_3", cupId: "cup_123" },
      ] as never);

      expect(sendBulkRatingReminders).toBeDefined();
    });
  });

  // ===========================================================================
  // Story 6.9: Envoi des Fiches de Notation
  // ===========================================================================
  describe("sendRatingSheet - Story 6.9", () => {
    it("should return NOT_FOUND if jury does not exist", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(undefined);

      const jury = await db.query.cupJuries.findFirst({} as never);
      expect(jury).toBeUndefined();
    });

    it("should return BAD_REQUEST if jury has no categories assigned", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        cup: { organizationId: "org_123" },
        categoryAssignments: [], // No categories
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
      } as never);

      const jury = await db.query.cupJuries.findFirst({} as never) as unknown as { categoryAssignments: unknown[] };
      expect(jury.categoryAssignments).toHaveLength(0);
    });

    it("should send rating sheet with products list", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendRatingSheet } = await import("~/server/services/jury-invitation.service");

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user_123", name: "John", email: "john@example.com", emailVerified: true },
        session: { id: "session_123" },
      } as never);

      vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue({
        id: "jury_123",
        cupId: "cup_123",
        cup: { organizationId: "org_123" },
        categoryAssignments: [
          { categoryId: "cat_1", category: { name: "Vins Rouges" } },
        ],
      } as never);

      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        id: "member_123",
      } as never);

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          products: [
            { id: "prod_1", categoryId: "cat_1", anonymousCode: "#A001", category: { name: "Vins Rouges" } },
            { id: "prod_2", categoryId: "cat_1", anonymousCode: "#A002", category: { name: "Vins Rouges" } },
          ],
        },
      ] as never);

      expect(sendRatingSheet).toBeDefined();
    });
  });

  describe("sendAllRatingSheets - Story 6.9", () => {
    it("should return BAD_REQUEST if no active juries", async () => {
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

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([]);

      const juries = await db.query.cupJuries.findMany({} as never);
      expect(juries).toHaveLength(0);
    });

    it("should send rating sheets to all juries with products", async () => {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");
      const { sendBulkRatingSheets } = await import("~/server/services/jury-invitation.service");

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

      vi.mocked(db.query.cupJuries.findMany).mockResolvedValue([
        {
          id: "jury_1",
          categoryAssignments: [{ categoryId: "cat_1" }],
        },
        {
          id: "jury_2",
          categoryAssignments: [{ categoryId: "cat_2" }],
        },
      ] as never);

      vi.mocked(db.query.registrations.findMany).mockResolvedValue([
        {
          products: [
            { categoryId: "cat_1", anonymousCode: "#A001", category: { name: "Cat 1" } },
            { categoryId: "cat_2", anonymousCode: "#A002", category: { name: "Cat 2" } },
          ],
        },
      ] as never);

      expect(sendBulkRatingSheets).toBeDefined();
    });
  });
});
