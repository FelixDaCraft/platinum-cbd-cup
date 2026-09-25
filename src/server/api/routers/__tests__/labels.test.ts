import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

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

vi.mock("nanoid", () => ({ nanoid: () => "test-label-id" }));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  deleted: [] as true[],
  inserted: [] as unknown[],
}));

const { updates, deleted, inserted } = dbState;

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn() },
      cupLabels: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: () => ({
      values: (values: unknown) => {
        dbState.inserted.push(values);
        return { returning: () => Promise.resolve([values]) };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve([values]),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve),
          }),
        };
      },
    }),
    delete: () => ({
      where: () => {
        dbState.deleted.push(true);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

beforeEach(() => {
  updates.length = 0;
  deleted.length = 0;
  inserted.length = 0;
});

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

  // ---------------------------------------------------------------------
  // Procédures du routeur
  //
  // Remplace les blocs « Business Logic » et « Multi-tenancy Validation »
  // d'origine, qui réécrivaient la règle dans le test puis la vérifiaient
  // contre elle-même. Le verrou réel est assertLabelsEditable() dans
  // labels.ts : c'est lui qu'on exerce ici, à travers le routeur.
  // ---------------------------------------------------------------------
  describe("Procédures", () => {
    async function signIn(row: { isAdmin?: boolean; role?: string } | null) {
      const { auth } = await import("~/lib/auth");
      const { db } = await import("~/server/db");

      if (row === null) {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        return;
      }

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { id: "session-1" },
      } as never);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
    }

    const asOrganizer = () => signIn({ isAdmin: false, role: "organizer" });
    const asProducer = () => signIn({ isAdmin: false, role: "producer" });
    const asAnonymous = () => signIn(null);

    /** Place une cup dans le mock, avec le statut demandé. */
    async function withCup(status: string, ratingScale = "0-20") {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        id: "cup-1",
        name: "Test Cup",
        status,
        ratingScale,
      } as never);
    }

    async function createCaller() {
      const { labelsRouter } = await import("../labels");
      const { db } = await import("~/server/db");

      return labelsRouter.createCaller({ headers: new Headers(), db } as never);
    }

    async function codeOf(fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        return (error as TRPCError).code;
      }
      throw new Error("La procédure aurait dû lever une erreur");
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("refuse un appelant anonyme sur chaque procédure", async () => {
      await asAnonymous();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getCupLabels({ cupId: "cup-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(
        await codeOf(() => caller.initializeDefaultLabels({ cupId: "cup-1" }))
      ).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.delete({ labelId: "lab-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(
        await codeOf(() => caller.reorder({ cupId: "cup-1", labelIds: ["lab-1"] }))
      ).toBe("UNAUTHORIZED");
    });

    it("refuse un producteur authentifié sur chaque procédure", async () => {
      await asProducer();
      const caller = await createCaller();

      expect(await codeOf(() => caller.getCupLabels({ cupId: "cup-1" }))).toBe(
        "FORBIDDEN"
      );
      expect(await codeOf(() => caller.delete({ labelId: "lab-1" }))).toBe("FORBIDDEN");
      expect(
        await codeOf(() => caller.reorder({ cupId: "cup-1", labelIds: ["lab-1"] }))
      ).toBe("FORBIDDEN");
    });

    it("renvoie NOT_FOUND quand la cup n'existe pas", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.getCupLabels({ cupId: "inconnue" }))).toBe(
        "NOT_FOUND"
      );
    });

    it("expose canEdit=false dès que la notation a commencé", async () => {
      await asOrganizer();
      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();

      await withCup("draft");
      await expect(caller.getCupLabels({ cupId: "cup-1" })).resolves.toMatchObject({
        canEdit: true,
        scaleMax: 20,
      });

      await withCup("rating");
      await expect(caller.getCupLabels({ cupId: "cup-1" })).resolves.toMatchObject({
        canEdit: false,
      });

      await withCup("completed");
      await expect(caller.getCupLabels({ cupId: "cup-1" })).resolves.toMatchObject({
        canEdit: false,
      });
    });

    // Un label modifié en pleine notation change le palmarès sous les pieds
    // des jurés : le routeur doit refuser, pas seulement griser un bouton.
    it.each(["rating", "completed"])(
      "refuse toute modification de label quand la cup est en %s",
      async (status) => {
        await asOrganizer();
        await withCup(status);

        const { db } = await import("~/server/db");
        vi.mocked(db.query.cupLabels.findFirst).mockResolvedValue({
          id: "lab-1",
          cupId: "cup-1",
          minScore: 16,
          maxScore: 18,
          cup: { id: "cup-1", status, ratingScale: "0-20" },
        } as never);

        const caller = await createCaller();

        expect(
          await codeOf(() => caller.initializeDefaultLabels({ cupId: "cup-1" }))
        ).toBe("BAD_REQUEST");
        expect(
          await codeOf(() =>
            caller.create({
              cupId: "cup-1",
              name: "Or",
              minScore: 16,
              maxScore: 20,
              color: "#FFD700",
            })
          )
        ).toBe("BAD_REQUEST");
        expect(await codeOf(() => caller.delete({ labelId: "lab-1" }))).toBe(
          "BAD_REQUEST"
        );
        expect(
          await codeOf(() => caller.reorder({ cupId: "cup-1", labelIds: ["lab-1"] }))
        ).toBe("BAD_REQUEST");

        expect(deleted).toHaveLength(0);
        expect(updates).toHaveLength(0);
      }
    );

    it.each(["draft", "published", "registration_closed"])(
      "autorise la suppression d'un label quand la cup est en %s",
      async (status) => {
        await asOrganizer();
        const { db } = await import("~/server/db");
        vi.mocked(db.query.cupLabels.findFirst).mockResolvedValue({
          id: "lab-1",
          cupId: "cup-1",
          cup: { id: "cup-1", status, ratingScale: "0-20" },
        } as never);

        const caller = await createCaller();
        await expect(caller.delete({ labelId: "lab-1" })).resolves.toEqual({
          success: true,
        });
        expect(deleted).toHaveLength(1);
      }
    );

    it("refuse un réordonnancement contenant un label étranger à la cup", async () => {
      await asOrganizer();
      await withCup("draft");

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue([
        { id: "lab-1" },
        { id: "lab-2" },
      ] as never);

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.reorder({ cupId: "cup-1", labelIds: ["lab-1", "lab-2", "lab-3"] })
        )
      ).toBe("BAD_REQUEST");
      expect(updates).toHaveLength(0);
    });

    it("applique le rang de chaque label selon sa position", async () => {
      await asOrganizer();
      await withCup("draft");

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue([
        { id: "lab-1" },
        { id: "lab-2" },
        { id: "lab-3" },
      ] as never);

      const caller = await createCaller();
      await caller.reorder({
        cupId: "cup-1",
        labelIds: ["lab-3", "lab-1", "lab-2"],
      });

      expect(updates.map((u) => u.sortOrder)).toEqual([0, 1, 2]);
    });

    it("refuse d'initialiser les labels par défaut deux fois", async () => {
      await asOrganizer();
      await withCup("draft");

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findFirst).mockResolvedValue({
        id: "lab-1",
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.initializeDefaultLabels({ cupId: "cup-1" }))
      ).toBe("BAD_REQUEST");
      expect(inserted).toHaveLength(0);
    });

    it("crée les labels par défaut à l'échelle de la cup", async () => {
      await asOrganizer();
      await withCup("draft", "0-10");

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      const result = await caller.initializeDefaultLabels({ cupId: "cup-1" });

      expect(result.created).toBe(DEFAULT_LABELS.length);
      expect(inserted).toHaveLength(1);
    });

    it("refuse un label dont le score dépasse l'échelle de la cup", async () => {
      await asOrganizer();
      // Échelle 0-10 : un minScore à 16 n'a aucun sens.
      await withCup("draft", "0-10");

      const { db } = await import("~/server/db");
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue([] as never);

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.create({
            cupId: "cup-1",
            name: "Or",
            minScore: 16,
            maxScore: 20,
            color: "#FFD700",
          })
        )
      ).toBe("BAD_REQUEST");
      expect(inserted).toHaveLength(0);
    });
  });
});
