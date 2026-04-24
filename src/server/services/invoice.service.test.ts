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
import { generateInvoiceNumber, getInvoiceData, type InvoiceData } from "./invoice.service";

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
