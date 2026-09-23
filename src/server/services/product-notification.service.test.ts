import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database and Resend - hoisted to be available at mock time
const { mockFindFirst, mockSend } = vi.hoisted(() => {
  return {
    mockFindFirst: vi.fn(),
    mockSend: vi.fn(),
  };
});

vi.mock("~/server/db", () => ({
  db: {
    query: {
      products: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Mock Resend
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

// Mock env
vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

// Import after mocking
import { notifyProductStatusChange } from "./product-notification.service";

describe("Product Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("notifyProductStatusChange", () => {
    it("should return error if product not found", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await notifyProductStatusChange("non_existent", "pending", "received");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Product not found");
    });

    it("should skip notification if producer has notifications disabled", async () => {
      mockFindFirst.mockResolvedValue({
        id: "product-1",
        name: "Test Product",
        registration: {
          producer: {
            id: "producer-1",
            notifyOnProductStatusChange: false,
            user: {
              email: "producer@example.com",
              name: "Test Producer",
            },
          },
          cup: {
            name: "Test Cup",
          },
        },
      });

      const result = await notifyProductStatusChange("product-1", "pending", "received");

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should send email if producer has notifications enabled", async () => {
      mockFindFirst.mockResolvedValue({
        id: "product-1",
        name: "Test Product",
        registration: {
          producer: {
            id: "producer-1",
            notifyOnProductStatusChange: true,
            user: {
              email: "producer@example.com",
              name: "Test Producer",
            },
          },
          cup: {
            name: "Test Cup",
          },
        },
      });
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

      const result = await notifyProductStatusChange("product-1", "pending", "received");

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "producer@example.com",
          subject: "Test Product - Statut mis a jour",
        })
      );
    });

    it("should handle resend error", async () => {
      mockFindFirst.mockResolvedValue({
        id: "product-1",
        name: "Test Product",
        registration: {
          producer: {
            id: "producer-1",
            notifyOnProductStatusChange: true,
            user: {
              email: "producer@example.com",
              name: "Test Producer",
            },
          },
          cup: {
            name: "Test Cup",
          },
        },
      });
      mockSend.mockResolvedValue({ error: { message: "Rate limit exceeded" } });

      const result = await notifyProductStatusChange("product-1", "pending", "received");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });

    it("should include correct status labels in email", async () => {
      mockFindFirst.mockResolvedValue({
        id: "product-1",
        name: "Premium Product",
        registration: {
          producer: {
            id: "producer-1",
            notifyOnProductStatusChange: true,
            user: {
              email: "producer@example.com",
              name: "Test Producer",
            },
          },
          cup: {
            name: "Cannabis Cup 2026",
          },
        },
      });
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

      await notifyProductStatusChange("product-1", "received", "rating");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("En notation"),
        })
      );
    });

    it("should handle all status transitions", async () => {
      const mockProduct = {
        id: "product-1",
        name: "Test Product",
        registration: {
          producer: {
            id: "producer-1",
            notifyOnProductStatusChange: true,
            user: {
              email: "producer@example.com",
              name: "Test Producer",
            },
          },
          cup: {
            name: "Test Cup",
          },
        },
      };
      mockFindFirst.mockResolvedValue(mockProduct);
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

      // Test all transitions
      const transitions: [string, string][] = [
        ["pending", "received"],
        ["received", "rating"],
        ["rating", "rated"],
      ];

      for (const [from, to] of transitions) {
        const result = await notifyProductStatusChange("product-1", from, to);
        expect(result.success).toBe(true);
      }

      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});
