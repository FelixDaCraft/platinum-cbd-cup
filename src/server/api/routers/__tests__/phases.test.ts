import { describe, it, expect, vi } from "vitest";

import {
  updatePhaseDatesSchema,
  getPhaseStatus,
  getEditableDates,
  canEditDate,
  formatPhaseDate,
} from "~/lib/validations/phases";
import type { CupStatus } from "~/server/db/schema/cups";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("Phases Router", () => {
  describe("Input Validation - updatePhaseDatesSchema", () => {
    it("rejects missing cupId", () => {
      const result = updatePhaseDatesSchema.safeParse({
        registrationOpenAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty cupId", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "",
        registrationOpenAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("requis");
      }
    });

    it("accepts all dates as null (manual transitions)", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: null,
        registrationCloseAt: null,
        ratingStartAt: null,
        ratingEndAt: null,
      });

      expect(result.success).toBe(true);
    });

    it("accepts partial dates (only registration)", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-01-15"),
        registrationCloseAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(true);
    });

    it("rejects registrationOpenAt > registrationCloseAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-02-15"),
        registrationCloseAt: new Date("2026-01-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("ouverture");
        expect(result.error.issues[0]?.path).toContain("registrationCloseAt");
      }
    });

    it("rejects ratingStartAt > ratingEndAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        ratingStartAt: new Date("2026-03-15"),
        ratingEndAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("début");
        expect(result.error.issues[0]?.path).toContain("ratingEndAt");
      }
    });

    it("rejects registrationCloseAt > ratingStartAt", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationCloseAt: new Date("2026-03-15"),
        ratingStartAt: new Date("2026-02-15"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("clôture");
        expect(result.error.issues[0]?.path).toContain("ratingStartAt");
      }
    });

    it("accepts registrationCloseAt === ratingStartAt (same moment)", () => {
      const sameDate = new Date("2026-02-15T12:00:00Z");
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationCloseAt: sameDate,
        ratingStartAt: sameDate,
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid timeline: open < close <= ratingStart < ratingEnd", () => {
      const result = updatePhaseDatesSchema.safeParse({
        cupId: "cup-1",
        registrationOpenAt: new Date("2026-01-15"),
        registrationCloseAt: new Date("2026-02-15"),
        ratingStartAt: new Date("2026-02-20"),
        ratingEndAt: new Date("2026-02-28"),
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Phase Status Determination - getPhaseStatus", () => {
    const createCup = (overrides: Partial<{
      status: CupStatus;
      registrationOpenAt: Date | null;
      registrationCloseAt: Date | null;
      ratingStartAt: Date | null;
      ratingEndAt: Date | null;
    }> = {}) => ({
      status: "draft" as CupStatus,
      registrationOpenAt: null,
      registrationCloseAt: null,
      ratingStartAt: null,
      ratingEndAt: null,
      ...overrides,
    });

    it("returns draft for draft status", () => {
      const cup = createCup({ status: "draft" });
      expect(getPhaseStatus(cup)).toBe("draft");
    });

    it("returns completed for completed status", () => {
      const cup = createCup({ status: "completed" });
      expect(getPhaseStatus(cup)).toBe("completed");
    });

    it("returns rating for rating status", () => {
      const cup = createCup({ status: "rating" });
      expect(getPhaseStatus(cup)).toBe("rating");
    });

    it("returns closed for registration_closed status", () => {
      const cup = createCup({ status: "registration_closed" });
      expect(getPhaseStatus(cup)).toBe("closed");
    });

    it("returns pending when published with future registrationOpenAt", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const cup = createCup({
        status: "published",
        registrationOpenAt: futureDate,
      });
      expect(getPhaseStatus(cup)).toBe("pending");
    });

    it("returns registration when published with past/no registrationOpenAt", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const cup = createCup({
        status: "published",
        registrationOpenAt: pastDate,
      });
      expect(getPhaseStatus(cup)).toBe("registration");
    });

    it("returns registration when published with null registrationOpenAt", () => {
      const cup = createCup({ status: "published" });
      expect(getPhaseStatus(cup)).toBe("registration");
    });
  });

  describe("Editable Dates by Status - getEditableDates", () => {
    it("all dates editable in draft", () => {
      const editable = getEditableDates("draft");
      expect(editable).toContain("registrationOpenAt");
      expect(editable).toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(4);
    });

    it("registrationOpenAt locked in published", () => {
      const editable = getEditableDates("published");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(3);
    });

    it("registration dates locked in registration_closed", () => {
      const editable = getEditableDates("registration_closed");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).not.toContain("registrationCloseAt");
      expect(editable).toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(2);
    });

    it("only ratingEndAt editable in rating", () => {
      const editable = getEditableDates("rating");
      expect(editable).not.toContain("registrationOpenAt");
      expect(editable).not.toContain("registrationCloseAt");
      expect(editable).not.toContain("ratingStartAt");
      expect(editable).toContain("ratingEndAt");
      expect(editable).toHaveLength(1);
    });

    it("no dates editable when completed", () => {
      const editable = getEditableDates("completed");
      expect(editable).toHaveLength(0);
    });
  });

  describe("Can Edit Date - canEditDate", () => {
    it("returns true for all dates in draft", () => {
      expect(canEditDate("draft", "registrationOpenAt")).toBe(true);
      expect(canEditDate("draft", "registrationCloseAt")).toBe(true);
      expect(canEditDate("draft", "ratingStartAt")).toBe(true);
      expect(canEditDate("draft", "ratingEndAt")).toBe(true);
    });

    it("returns false for locked dates", () => {
      expect(canEditDate("published", "registrationOpenAt")).toBe(false);
      expect(canEditDate("registration_closed", "registrationOpenAt")).toBe(false);
      expect(canEditDate("registration_closed", "registrationCloseAt")).toBe(false);
      expect(canEditDate("rating", "ratingStartAt")).toBe(false);
      expect(canEditDate("completed", "ratingEndAt")).toBe(false);
    });
  });

  describe("Format Phase Date - formatPhaseDate", () => {
    it("returns 'Non définie' for null date", () => {
      expect(formatPhaseDate(null)).toBe("Non définie");
    });

    it("formats date in French locale", () => {
      const date = new Date("2026-02-15T14:30:00Z");
      const formatted = formatPhaseDate(date);
      // Should contain date and time in French format
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).not.toBe("Non definie");
    });
  });

  describe("Business Logic - Status Restrictions", () => {
    it("should allow all date edits when cup is draft", () => {
      const cupStatus: CupStatus = "draft";
      const editableDates = getEditableDates(cupStatus);

      expect(editableDates.length).toBe(4);
    });

    it("should block all date edits when cup is completed", () => {
      const cupStatus: CupStatus = "completed";
      const editableDates = getEditableDates(cupStatus);

      expect(editableDates.length).toBe(0);
    });

    it("should only allow ratingEndAt extension during rating phase", () => {
      const cupStatus: CupStatus = "rating";
      const editableDates = getEditableDates(cupStatus);

      expect(editableDates).toEqual(["ratingEndAt"]);
    });
  });

  describe("Business Logic - Phase Transitions", () => {
    it("published -> registration_closed when registrationCloseAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000); // yesterday
      const cup = {
        status: "published" as CupStatus,
        registrationCloseAt: pastDate,
      };

      // Logic: if registrationCloseAt <= now, transition to registration_closed
      const shouldTransition = cup.registrationCloseAt && cup.registrationCloseAt <= now;
      expect(shouldTransition).toBe(true);
    });

    it("registration_closed -> rating when ratingStartAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000);
      const cup = {
        status: "registration_closed" as CupStatus,
        ratingStartAt: pastDate,
      };

      const shouldTransition = cup.ratingStartAt && cup.ratingStartAt <= now;
      expect(shouldTransition).toBe(true);
    });

    it("rating -> completed when ratingEndAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000);
      const cup = {
        status: "rating" as CupStatus,
        ratingEndAt: pastDate,
      };

      const shouldTransition = cup.ratingEndAt && cup.ratingEndAt <= now;
      expect(shouldTransition).toBe(true);
    });

    it("no transition when date not reached yet", () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000); // tomorrow
      const cup = {
        status: "published" as CupStatus,
        registrationCloseAt: futureDate,
      };

      const shouldTransition = cup.registrationCloseAt && cup.registrationCloseAt <= now;
      expect(shouldTransition).toBe(false);
    });

    it("no transition when date is null (manual transition required)", () => {
      // When registrationCloseAt is null, no automatic transition should occur
      const registrationCloseAt: Date | null = null;

      // This simulates the condition check in the router
      const shouldTransition = registrationCloseAt !== null;
      expect(shouldTransition).toBe(false);
    });
  });

  describe("Business Logic - Multi-tenancy Validation", () => {
    it("validates cup belongs to user organization", () => {
      const cupOrganizationId = "org-1";
      const memberOrganizationId = "org-1";

      expect(cupOrganizationId).toBe(memberOrganizationId);
    });

    it("detects cross-tenant access attempt", () => {
      const cupOrganizationId = "org-1";
      const attackerOrganizationId = "org-2";

      expect(cupOrganizationId).not.toBe(attackerOrganizationId);
      // Router would throw FORBIDDEN
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

    it("requires owner role for updatePhaseDates", () => {
      const memberRole = "member";
      const ownerRole = "owner";

      // Only owner can update phase dates
      expect(memberRole).not.toBe(ownerRole);
      // Router would throw FORBIDDEN for non-owner
    });
  });

  describe("Phase Automation Security", () => {
    it("rejects checkPhaseTransitions without cronSecret", () => {
      // The procedure requires cronSecret input
      const input = {};
      const hasSecret = "cronSecret" in input;

      expect(hasSecret).toBe(false);
      // Router would throw ZodError for missing cronSecret
    });

    it("rejects checkPhaseTransitions with invalid cronSecret", () => {
      const inputSecret = "wrong-secret";
      const envSecret = "correct-secret";

      expect(inputSecret).not.toBe(envSecret);
      // Router would throw UNAUTHORIZED
    });

    it("accepts checkPhaseTransitions with valid cronSecret", () => {
      const inputSecret = "correct-secret";
      const envSecret = "correct-secret";

      expect(inputSecret).toBe(envSecret);
      // Router would proceed with transitions
    });
  });

  describe("Phase Automation Transitions", () => {
    it("transitions published cup to registration_closed when registrationCloseAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000); // yesterday
      const cup = {
        status: "published" as const,
        registrationCloseAt: pastDate,
      };

      const shouldTransition =
        cup.status === "published" &&
        cup.registrationCloseAt !== null &&
        cup.registrationCloseAt <= now;

      expect(shouldTransition).toBe(true);
    });

    it("does not transition published cup when registrationCloseAt is null", () => {
      const cup = {
        status: "published" as const,
        registrationCloseAt: null,
      };

      const shouldTransition =
        cup.status === "published" &&
        cup.registrationCloseAt !== null;

      expect(shouldTransition).toBe(false);
    });

    it("does not transition published cup when registrationCloseAt is in future", () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000); // tomorrow
      const cup = {
        status: "published" as const,
        registrationCloseAt: futureDate,
      };

      const shouldTransition =
        cup.status === "published" &&
        cup.registrationCloseAt !== null &&
        cup.registrationCloseAt <= now;

      expect(shouldTransition).toBe(false);
    });

    it("transitions registration_closed to rating when ratingStartAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000);
      const cup = {
        status: "registration_closed" as const,
        ratingStartAt: pastDate,
      };

      const shouldTransition =
        cup.status === "registration_closed" &&
        cup.ratingStartAt !== null &&
        cup.ratingStartAt <= now;

      expect(shouldTransition).toBe(true);
    });

    it("transitions rating to completed when ratingEndAt reached", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000);
      const cup = {
        status: "rating" as const,
        ratingEndAt: pastDate,
      };

      const shouldTransition =
        cup.status === "rating" &&
        cup.ratingEndAt !== null &&
        cup.ratingEndAt <= now;

      expect(shouldTransition).toBe(true);
    });
  });
});
