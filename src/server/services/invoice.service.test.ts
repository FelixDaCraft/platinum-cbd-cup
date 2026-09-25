import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database - use vi.hoisted for proper hoisting
const { mockFindFirst } = vi.hoisted(() => {
  return { mockFindFirst: vi.fn() };
});

vi.mock("~/server/db", () => ({
  db: {
    query: {
      registrations: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Import after mocking
import {
  allocateInvoiceNumber,
  generateInvoiceNumber,
  getInvoiceData,
  type InvoiceData,
} from "./invoice.service";

/**
 * Faux client Drizzle imitant le comportement de `pg_advisory_xact_lock` :
 * un seul appelant détient le verrou, les suivants attendent la libération
 * (le commit de la transaction précédente).
 *
 * Le but est de vérifier que la numérotation est bien sérialisée par le
 * verrou, pas de simuler Postgres : deux confirmations de paiement
 * simultanées ne doivent jamais recevoir le même numéro de facture.
 */
function createFakeLedger() {
  const issued: string[] = [];
  let chain: Promise<void> = Promise.resolve();

  function makeTx() {
    let release: () => void = () => undefined;

    return {
      execute: async () => {
        const previous = chain;
        chain = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
      },
      query: {
        registrations: {
          // `orderBy` distingue la lecture du plus grand numéro de l'année de
          // la lecture du numéro déjà attribué à l'inscription.
          findFirst: async (args: { orderBy?: unknown }) =>
            args.orderBy
              ? issued.length > 0
                ? { invoiceNumber: issued[issued.length - 1] }
                : undefined
              : { invoiceNumber: null },
        },
      },
      update: () => ({
        set: (values: { invoiceNumber: string }) => ({
          where: async () => {
            issued.push(values.invoiceNumber);
          },
        }),
      }),
      /** Relâche le verrou, comme le ferait le commit de la transaction. */
      commit: () => release(),
    };
  }

  return { issued, makeTx };
}

describe("Invoice Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateInvoiceNumber", () => {
    it("should generate first invoice number of the year", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const invoiceNumber = await generateInvoiceNumber();

      expect(invoiceNumber).toBe("INV-2026-00001");
      expect(mockFindFirst).toHaveBeenCalledTimes(1);
    });

    it("should increment invoice number based on last invoice", async () => {
      mockFindFirst.mockResolvedValue({
        invoiceNumber: "INV-2026-00042",
      });

      const invoiceNumber = await generateInvoiceNumber();

      expect(invoiceNumber).toBe("INV-2026-00043");
    });

    it("should pad invoice number to 5 digits", async () => {
      mockFindFirst.mockResolvedValue({
        invoiceNumber: "INV-2026-00001",
      });

      const invoiceNumber = await generateInvoiceNumber();

      expect(invoiceNumber).toBe("INV-2026-00002");
      expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    });

    it("should use current year", async () => {
      vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
      mockFindFirst.mockResolvedValue(undefined);

      const invoiceNumber = await generateInvoiceNumber();

      expect(invoiceNumber).toBe("INV-2027-00001");
    });

    it("should handle malformed invoice number gracefully", async () => {
      mockFindFirst.mockResolvedValue({
        invoiceNumber: "INV-2026-INVALID",
      });

      const invoiceNumber = await generateInvoiceNumber();

      // Should fall back to 1 when parsing fails
      expect(invoiceNumber).toBe("INV-2026-00001");
    });

    it("should handle high sequence numbers", async () => {
      mockFindFirst.mockResolvedValue({
        invoiceNumber: "INV-2026-99999",
      });

      const invoiceNumber = await generateInvoiceNumber();

      expect(invoiceNumber).toBe("INV-2026-100000");
    });
  });

  describe("allocateInvoiceNumber sous concurrence", () => {
    it("prend le verrou avant la moindre lecture", async () => {
      const calls: string[] = [];
      const tx = {
        execute: async () => {
          calls.push("lock");
        },
        query: {
          registrations: {
            findFirst: async () => {
              calls.push("read");
              return { invoiceNumber: null };
            },
          },
        },
        update: () => ({
          set: () => ({
            where: async () => {
              calls.push("write");
            },
          }),
        }),
      };

      await allocateInvoiceNumber(tx as never, "reg_1");

      // Une lecture avant le verrou rendrait la sérialisation inopérante.
      expect(calls[0]).toBe("lock");
      expect(calls).toContain("write");
    });

    it("n'attribue jamais le même numéro à deux confirmations simultanées", async () => {
      const { issued, makeTx } = createFakeLedger();
      const first = makeTx();
      const second = makeTx();

      // Les deux transactions démarrent avant que la première ne commite.
      const firstNumber = allocateInvoiceNumber(first as never, "reg_a");
      const secondNumber = allocateInvoiceNumber(second as never, "reg_b");

      expect(await firstNumber).toBe("INV-2026-00001");
      first.commit();

      expect(await secondNumber).toBe("INV-2026-00002");
      second.commit();

      expect(issued).toEqual(["INV-2026-00001", "INV-2026-00002"]);
    });

    it("est idempotent : une inscription déjà numérotée conserve son numéro", async () => {
      const tx = {
        execute: async () => undefined,
        query: {
          registrations: {
            findFirst: async () => ({ invoiceNumber: "INV-2026-00042" }),
          },
        },
        update: () => {
          throw new Error("aucune réécriture attendue");
        },
      };

      await expect(allocateInvoiceNumber(tx as never, "reg_1")).resolves.toBe(
        "INV-2026-00042"
      );
    });
  });

  describe("InvoiceData interface", () => {
    it("should have correct structure for getInvoiceData", async () => {
      expect(typeof getInvoiceData).toBe("function");
    });

    it("should return null for non-existent registration", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await getInvoiceData("non_existent_id");

      expect(result).toBeNull();
    });
  });

  describe("InvoiceData type validation", () => {
    it("should have all required fields", () => {
      const validInvoiceData: InvoiceData = {
        invoiceNumber: "INV-2026-00001",
        invoiceDate: new Date(),
        sellerName: "Test Organization",
        buyerName: "Test Producer",
        cupName: "Test Cup",
        products: [
          { name: "Product 1", category: "Category A", priceInCents: 1500 },
        ],
        totalAmountInCents: 1500,
        currency: "EUR",
        isPaid: true,
      };

      expect(validInvoiceData.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(validInvoiceData.products).toHaveLength(1);
      expect(validInvoiceData.totalAmountInCents).toBe(1500);
    });

    it("should accept optional fields", () => {
      const invoiceDataWithOptionals: InvoiceData = {
        invoiceNumber: "INV-2026-00001",
        invoiceDate: new Date(),
        sellerName: "Test Organization",
        sellerAddress: "123 Main St",
        sellerSiret: "12345678901234",
        buyerName: "Test Producer",
        buyerCompany: "Producer Corp",
        buyerAddress: "456 Producer St",
        cupName: "Test Cup",
        products: [],
        totalAmountInCents: 0,
        currency: "EUR",
        isPaid: false,
        paymentDate: new Date(),
      };

      expect(invoiceDataWithOptionals.sellerSiret).toBe("12345678901234");
      expect(invoiceDataWithOptionals.buyerCompany).toBe("Producer Corp");
    });
  });
});

describe("Invoice PDF Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateInvoicePdf", () => {
    it("should throw error for non-existent registration", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const { generateInvoicePdf } = await import("./invoice.service");

      await expect(generateInvoicePdf("non_existent_id")).rejects.toThrow(
        "Registration not found: non_existent_id"
      );
    });
  });
});

describe("Invoice Number Format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should follow INV-YYYY-XXXXX format", async () => {
    vi.setSystemTime(new Date("2026-03-15"));
    mockFindFirst.mockResolvedValue(undefined);

    const invoiceNumber = await generateInvoiceNumber();

    expect(invoiceNumber).toMatch(/^INV-2026-\d{5}$/);
  });

  it("should be year-specific", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    vi.setSystemTime(new Date("2025-12-31"));
    const invoice2025 = await generateInvoiceNumber();

    vi.setSystemTime(new Date("2026-01-01"));
    const invoice2026 = await generateInvoiceNumber();

    expect(invoice2025).toContain("2025");
    expect(invoice2026).toContain("2026");
  });
});
