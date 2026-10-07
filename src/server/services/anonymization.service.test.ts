import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("~/server/db", () => ({
  db: {
    query: {
      categories: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      registrations: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    update: vi.fn(),
    // Verrou consultatif pris avant l'attribution d'un code : sans lui, deux
    // confirmations concurrentes tireraient le même nombre.
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
    and: vi.fn((...conditions) => ({ conditions, type: "and" })),
    sql: Object.assign(
      vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        type: "sql",
      })),
      {
        join: vi.fn(),
        raw: vi.fn((value: string) => ({ value, type: "sql.raw" })),
      }
    ),
  };
});

describe("Anonymization Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateAnonymousCodes", () => {
    it("should use first letter of each word as prefix", async () => {
      const { db } = await import("~/server/db");

      // Mock category name "Café Filtre" -> prefix should be "CF"
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Café Filtre",
      } as never);

      // Mock no existing codes
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      expect(code).toMatch(/^CF\d+$/);
    });

    it("should generate numbers between 1 and 100", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Espresso",
      } as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      const num = parseInt(code.replace(/^[A-Z]+/, ""), 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(100);
    });

    it("should handle multi-word category names with initials", async () => {
      const { db } = await import("~/server/db");

      // "Espresso Pur Arabica" -> "EPA"
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Espresso Pur Arabica",
      } as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      expect(code).toMatch(/^EPA\d+$/);
    });

    it("should handle single-word category names", async () => {
      const { db } = await import("~/server/db");

      // "Robusta" -> "R"
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Robusta",
      } as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      expect(code).toMatch(/^R\d+$/);
    });

    it("should remove accents from category name", async () => {
      const { db } = await import("~/server/db");

      // "Café Éthiopien" -> "CE" (accents removed)
      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Café Éthiopien",
      } as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      expect(code).toMatch(/^CE\d+$/);
    });

    it("should default to X if category not found", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.categories.findFirst).mockResolvedValue(null as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      expect(code).toMatch(/^X\d+$/);
    });

    it("should avoid collisions with existing codes", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Filtre",
      } as never);

      // Mock all codes F1 through F100 as taken
      // Codes pris, tous panels confondus : la moitié côté pro, l'autre côté public.
      const existingCodes = Array.from({ length: 50 }, (_, i) => ({
        pro: `F${i + 1}`,
        public: `F${i + 51}`,
      }));
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(existingCodes),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateAnonymousCodes } = await import("./anonymization.service");
      const codes = await generateAnonymousCodes(db as never, "cat-1");
      const code = codes.pro;
      // Un code par jury, tirés séparément et jamais identiques.
      expect(codes.public).not.toBe(codes.pro);
      expect(codes.public.replace(/\d+$/, "")).toBe(code.replace(/\d+$/, ""));

      // La plage s'élargit au-delà de 100, mais le tirage reste aléatoire :
      // un repli séquentiel (101, 102, …) révélerait l'ordre de confirmation.
      expect(code).toMatch(/^F\d+$/);
      const picked = Number(code.slice(1));
      expect(picked).toBeGreaterThan(100);
      expect(picked).toBeLessThanOrEqual(202);
      // Le second tirage tient compte du premier : plage élargie d'autant.
      const pickedPublic = Number(codes.public.slice(1));
      expect(pickedPublic).toBeGreaterThan(100);
      expect(pickedPublic).toBeLessThanOrEqual(204);
    });
  });

  describe("anonymizeRegistrationProducts", () => {
    it("should anonymize all products in registration", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        products: [
          { id: "prod-1", categoryId: "cat-1", anonymousCodePro: null, anonymousCodePublic: null },
          { id: "prod-2", categoryId: "cat-1", anonymousCodePro: null, anonymousCodePublic: null },
        ],
      } as never);

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Café Filtre",
      } as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      // First call returns no existing codes, second call returns the code just assigned
      let selectCallCount = 0;
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve([]);
          }
          // After first product is assigned, return that code as existing
          return Promise.resolve([{ pro: "CF42", public: "CF7" }]);
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { anonymizeRegistrationProducts } = await import("./anonymization.service");
      const result = await anonymizeRegistrationProducts(db as never, "reg-1");

      expect(result).toHaveLength(2);
      expect(result[0]!.productId).toBe("prod-1");
      expect(result[0]!.codes.pro).toMatch(/^CF\d+$/);
      expect(result[0]!.codes.public).toMatch(/^CF\d+$/);
      expect(result[0]!.codes.public).not.toBe(result[0]!.codes.pro);
      expect(result[1]!.productId).toBe("prod-2");
      expect(result[1]!.codes.pro).not.toBe("CF42");
      expect(result[1]!.codes.public).not.toBe("CF7");
      // Les deux codes sont écrits ensemble.
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymousCodePro: expect.stringMatching(/^CF\d+$/),
          anonymousCodePublic: expect.stringMatching(/^CF\d+$/),
        })
      );
      expect(db.update).toHaveBeenCalledTimes(2);
    });

    it("should skip already anonymized products (idempotence)", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        products: [
          { id: "prod-1", categoryId: "cat-1", anonymousCodePro: "CF42", anonymousCodePublic: "CF7" },
          { id: "prod-2", categoryId: "cat-1", anonymousCodePro: null, anonymousCodePublic: null },
        ],
      } as never);

      vi.mocked(db.query.categories.findFirst).mockResolvedValue({
        name: "Café Filtre",
      } as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ pro: "CF42", public: "CF7" }]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { anonymizeRegistrationProducts } = await import("./anonymization.service");
      const result = await anonymizeRegistrationProducts(db as never, "reg-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.productId).toBe("prod-2");
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("should return empty array if registration not found", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(null as never);

      const { anonymizeRegistrationProducts } = await import("./anonymization.service");
      const result = await anonymizeRegistrationProducts(db as never, "reg-invalid");

      expect(result).toEqual([]);
      expect(db.update).not.toHaveBeenCalled();
    });

    it("should return empty array if registration has no products", async () => {
      const { db } = await import("~/server/db");

      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        products: [],
      } as never);

      const { anonymizeRegistrationProducts } = await import("./anonymization.service");
      const result = await anonymizeRegistrationProducts(db as never, "reg-1");

      expect(result).toEqual([]);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

});
