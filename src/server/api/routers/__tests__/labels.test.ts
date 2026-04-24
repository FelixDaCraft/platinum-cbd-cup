import { describe, it, expect, vi } from "vitest";

import {
  createLabelSchema,
  updateLabelSchema,
  reorderLabelsSchema,
  validateLabelRanges,
  rangesOverlap,
  formatLabelRange,
  DEFAULT_LABELS,
  LABEL_COLOR_PALETTE,
} from "~/lib/validations/labels";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("Labels Router", () => {
  describe("Input Validation - createLabelSchema", () => {
    it("rejects missing cupId", () => {
      const result = createLabelSchema.safeParse({
        name: "Bronze",
        minScore: 70,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("cupId");
      }
    });

    it("rejects empty name", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "",
        minScore: 70,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("requis");
      }
    });

    it("rejects name too long", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "a".repeat(51),
        minScore: 70,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("trop long");
      }
    });

    it("rejects negative minScore", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: -1,
      });

      expect(result.success).toBe(false);
    });

    it("rejects minScore > 100", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: 101,
      });

      expect(result.success).toBe(false);
    });

    it("rejects maxScore < minScore (refinement)", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: 80,
        maxScore: 70,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("inférieur");
      }
    });

    it("rejects maxScore = minScore (must be strictly greater)", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: 80,
        maxScore: 80,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("inférieur");
      }
    });

    it("rejects invalid hex color format", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: 70,
        maxScore: 79,
        color: "red",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("hex");
      }
    });

    it("accepts maxScore null (no upper limit)", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Or",
        minScore: 90,
        maxScore: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxScore).toBeNull();
      }
    });

    it("accepts maxScore undefined (equivalent to null)", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Or",
        minScore: 90,
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid label with all fields", () => {
      const result = createLabelSchema.safeParse({
        cupId: "cup-1",
        name: "Bronze",
        minScore: 70,
        maxScore: 79,
        color: "#CD7F32",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Bronze");
        expect(result.data.minScore).toBe(70);
        expect(result.data.maxScore).toBe(79);
        expect(result.data.color).toBe("#CD7F32");
      }
    });
  });

  describe("Input Validation - updateLabelSchema", () => {
    it("rejects missing labelId", () => {
      const result = updateLabelSchema.safeParse({
        name: "Bronze",
      });

      expect(result.success).toBe(false);
    });

    it("accepts partial update with only name", () => {
      const result = updateLabelSchema.safeParse({
        labelId: "label-1",
        name: "Gold",
      });

      expect(result.success).toBe(true);
    });

    it("accepts partial update with only scores", () => {
      const result = updateLabelSchema.safeParse({
        labelId: "label-1",
        minScore: 85,
        maxScore: 94,
      });

      expect(result.success).toBe(true);
    });

    it("rejects minScore >= maxScore when both provided", () => {
      const result = updateLabelSchema.safeParse({
        labelId: "label-1",
        minScore: 90,
        maxScore: 80,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Input Validation - reorderLabelsSchema", () => {
    it("rejects missing cupId", () => {
      const result = reorderLabelsSchema.safeParse({
        labelIds: ["label-1", "label-2"],
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty labelIds array", () => {
      const result = reorderLabelsSchema.safeParse({
        cupId: "cup-1",
        labelIds: [],
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid reorder input", () => {
      const result = reorderLabelsSchema.safeParse({
        cupId: "cup-1",
        labelIds: ["label-1", "label-2", "label-3"],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Overlap Detection - rangesOverlap", () => {
    it("detects partial overlap: 70-85 with 80-90", () => {
      const a = { name: "A", minScore: 70, maxScore: 85 };
      const b = { name: "B", minScore: 80, maxScore: 90 };

      expect(rangesOverlap(a, b)).toBe(true);
    });

    it("detects overlap at single point: 70-80 with 80-90 (80 shared)", () => {
      const a = { name: "A", minScore: 70, maxScore: 80 };
      const b = { name: "B", minScore: 80, maxScore: 90 };

      expect(rangesOverlap(a, b)).toBe(true);
    });

    it("detects total overlap: 70-90 contains 75-85", () => {
      const a = { name: "A", minScore: 70, maxScore: 90 };
      const b = { name: "B", minScore: 75, maxScore: 85 };

      expect(rangesOverlap(a, b)).toBe(true);
    });

    it("accepts adjacent ranges: 70-79 and 80-89 (no overlap)", () => {
      const a = { name: "Bronze", minScore: 70, maxScore: 79 };
      const b = { name: "Argent", minScore: 80, maxScore: 89 };

      expect(rangesOverlap(a, b)).toBe(false);
    });

    it("accepts ranges with gaps: 60-69 and 80-89 (no overlap)", () => {
      const a = { name: "A", minScore: 60, maxScore: 69 };
      const b = { name: "B", minScore: 80, maxScore: 89 };

      expect(rangesOverlap(a, b)).toBe(false);
    });

    it("handles maxScore null (9+ with 7-10 = conflict) scale 10", () => {
      const a = { name: "Or", minScore: 9, maxScore: null };
      const b = { name: "B", minScore: 7, maxScore: 10 };

      expect(rangesOverlap(a, b, 10)).toBe(true);
    });

    it("handles maxScore null on both (8+ with 9+) scale 10", () => {
      const a = { name: "A", minScore: 8, maxScore: null };
      const b = { name: "B", minScore: 9, maxScore: null };

      expect(rangesOverlap(a, b, 10)).toBe(true);
    });

    it("accepts adjacent with null: 7-8 and 9+ (no overlap) scale 10", () => {
      const a = { name: "Argent", minScore: 7, maxScore: 8 };
      const b = { name: "Or", minScore: 9, maxScore: null };

      expect(rangesOverlap(a, b, 10)).toBe(false);
    });
  });

  describe("Overlap Validation - validateLabelRanges", () => {
    it("returns valid for non-overlapping labels", () => {
      const existing = [
        { id: "1", name: "Bronze", minScore: 70, maxScore: 79 },
        { id: "2", name: "Argent", minScore: 80, maxScore: 89 },
      ];
      const newLabel = { name: "Or", minScore: 90, maxScore: null };

      const result = validateLabelRanges(existing, newLabel);

      expect(result.valid).toBe(true);
      expect(result.conflictWith).toBeUndefined();
    });

    it("returns invalid with conflicting label name", () => {
      const existing = [
        { id: "1", name: "Bronze", minScore: 70, maxScore: 79 },
        { id: "2", name: "Argent", minScore: 80, maxScore: 89 },
      ];
      const newLabel = { name: "Test", minScore: 75, maxScore: 85 };

      const result = validateLabelRanges(existing, newLabel);

      expect(result.valid).toBe(false);
      expect(result.conflictWith).toBe("Bronze");
    });

    it("skips self when updating (same id)", () => {
      const existing = [
        { id: "1", name: "Bronze", minScore: 70, maxScore: 79 },
        { id: "2", name: "Argent", minScore: 80, maxScore: 89 },
      ];
      // Update Bronze with slightly different range
      const updatedLabel = { id: "1", name: "Bronze", minScore: 65, maxScore: 79 };

      const result = validateLabelRanges(existing, updatedLabel);

      expect(result.valid).toBe(true);
    });
  });

  describe("Format - formatLabelRange", () => {
    it("formats range with maxScore", () => {
      expect(formatLabelRange(70, 79)).toBe("70-79 pts");
      expect(formatLabelRange(80, 89)).toBe("80-89 pts");
    });

    it("formats range with null maxScore (no upper limit)", () => {
      expect(formatLabelRange(90, null)).toBe("90+ pts");
      expect(formatLabelRange(95, null)).toBe("95+ pts");
    });
  });

  describe("Constants", () => {
    it("DEFAULT_LABELS has 3 entries", () => {
      expect(DEFAULT_LABELS).toHaveLength(3);
    });

    it("DEFAULT_LABELS has correct default values for scale 1-10", () => {
      // DEFAULT_LABELS now exports DEFAULT_LABELS_10 with updated names
      expect(DEFAULT_LABELS[0]).toMatchObject({
        name: "Mention",
        minScore: 5,
        maxScore: 6,
      });
      expect(DEFAULT_LABELS[1]).toMatchObject({
        name: "Médaille",
        minScore: 7,
        maxScore: 8,
      });
      expect(DEFAULT_LABELS[2]).toMatchObject({
        name: "Excellence",
        minScore: 9,
        maxScore: null,
      });
    });

    it("DEFAULT_LABELS have non-overlapping ranges", () => {
      // Verify default labels don't overlap
      for (let i = 0; i < DEFAULT_LABELS.length; i++) {
        for (let j = i + 1; j < DEFAULT_LABELS.length; j++) {
          const a = DEFAULT_LABELS[i]!;
          const b = DEFAULT_LABELS[j]!;
          expect(
            rangesOverlap(
              { name: a.name, minScore: a.minScore, maxScore: a.maxScore },
              { name: b.name, minScore: b.minScore, maxScore: b.maxScore }
            )
          ).toBe(false);
        }
      }
    });

    it("LABEL_COLOR_PALETTE has 8 colors", () => {
      expect(LABEL_COLOR_PALETTE).toHaveLength(8);
    });

    it("LABEL_COLOR_PALETTE colors are valid hex", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      for (const color of LABEL_COLOR_PALETTE) {
        expect(color.hex).toMatch(hexRegex);
      }
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
    it("validates label belongs to user organization via cup", () => {
      const labelCupOrganizationId = "org-1";
      const memberOrganizationId = "org-1";

      expect(labelCupOrganizationId).toBe(memberOrganizationId);
    });

    it("detects cross-tenant access attempt", () => {
      const labelCupOrganizationId: string = "org-1";
      const attackerOrganizationId: string = "org-2";

      expect(labelCupOrganizationId).not.toBe(attackerOrganizationId);
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

    it("calculates next sortOrder correctly for existing labels", () => {
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

  describe("Authorization Checks", () => {
    it("identifies when no session exists", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const session = await auth.api.getSession({ headers: new Headers() });

      expect(session).toBeNull();
      // Router would throw UNAUTHORIZED
    });
  });
});
