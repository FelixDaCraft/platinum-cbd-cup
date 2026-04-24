/**
 * Results Router Tests - Story 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * Tests for final score calculation, label attribution, rankings, PDF generation and email sending
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resultsRouter } from "./results";
import { createCallerFactory } from "~/server/api/trpc";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { TRPCError } from "@trpc/server";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock email service
vi.mock("~/server/services/results-email.service", () => ({
  sendResultsEmail: vi.fn(),
  sendBulkResultsEmails: vi.fn(),
}));

// Mock db
vi.mock("~/server/db", () => ({
  db: {
    query: {
      members: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn() },
      categories: { findMany: vi.fn() },
      cupLabels: { findMany: vi.fn() },
      ratingCriteria: { findMany: vi.fn() },
      products: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => []),
              })),
            })),
            where: vi.fn(() => ({
              orderBy: vi.fn(() => []),
            })),
          })),
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => []),
            })),
          })),
          where: vi.fn(() => []),
        })),
        where: vi.fn(() => [{ avgScore: "85.00", count: 5 }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(() => [{}]) })),
      })),
    })),
  },
}));

import { auth } from "~/lib/auth";
import { sendResultsEmail, sendBulkResultsEmails } from "~/server/services/results-email.service";

const mockSession = {
  user: { id: "user-1", email: "test@example.com" },
  session: { id: "session-1" },
};

const mockMember = {
  id: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "owner",
};

const mockCup = {
  id: "cup-1",
  organizationId: "org-1",
  name: "Test Cup",
  status: "rating",
  ratingScale: "1-10",
};

const mockLabels = [
  { id: "label-1", name: "Or", minScore: 90, maxScore: null, color: "#FFD700" },
  { id: "label-2", name: "Argent", minScore: 80, maxScore: 89, color: "#C0C0C0" },
  { id: "label-3", name: "Bronze", minScore: 70, maxScore: 79, color: "#CD7F32" },
];

const mockCategories = [
  { id: "cat-1", name: "Catégorie 1", cupId: "cup-1", sortOrder: 0 },
];

const createCaller = createCallerFactory(resultsRouter);

function createContext(headers = new Headers()) {
  return {
    db,
    headers,
  };
}

describe("Results Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateResults", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.calculateResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if user has no organization", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.calculateResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if cup does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.calculateResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PRECONDITION_FAILED if cup is not in rating or completed status", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        status: "draft",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.calculateResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return FORBIDDEN if user role is not owner or admin", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        ...mockMember,
        role: "member",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.calculateResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should calculate results and attribute labels", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.categories.findMany).mockResolvedValue(mockCategories as any);
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue(mockLabels as any);
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([
        { id: "crit-1", coefficient: 2 },
        { id: "crit-2", coefficient: 1 },
      ] as any);

      // Mock db.select chain for products
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

      const caller = createCaller(createContext());

      const result = await caller.calculateResults({ cupId: "cup-1" });

      expect(result.success).toBe(true);
      expect(result.productsProcessed).toBe(0);
      expect(result.labelsAttributed).toBe(0);
    });
  });

  describe("getCupResults", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getCupResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return results organized by category", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.categories.findMany).mockResolvedValue(mockCategories as any);

      // Mock db.select chain
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

      const caller = createCaller(createContext());

      const result = await caller.getCupResults({ cupId: "cup-1" });

      expect(result.categories).toHaveLength(1);
      expect(result.summary.totalCategories).toBe(1);
    });
  });

  describe("getProductResults", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getProductResults({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if product does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.products.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.getProductResults({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return detailed product results", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Test Product",
        anonymousCode: "#A001",
        finalScore: "85.50",
        categoryRank: 1,
        categoryId: "cat-1",
        category: { id: "cat-1", name: "Category 1" },
        label: { id: "label-2", name: "Argent", color: "#C0C0C0" },
        registration: {
          cupId: "cup-1",
          cup: { id: "cup-1", name: "Test Cup", ratingScale: "1-10" },
          producer: { id: "prod-1", companyName: "Test Co", brandName: "TestBrand" },
        },
      };

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.products.findFirst).mockResolvedValue(mockProduct as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.ratingCriteria.findMany).mockResolvedValue([]);

      // Mock db.select chain
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ avgScore: "85.00", count: 5 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

      const caller = createCaller(createContext());

      const result = await caller.getProductResults({ productId: "prod-1" });

      expect(result.product.id).toBe("prod-1");
      expect(result.product.finalScore).toBe(85.5);
      expect(result.product.rank).toBe(1);
      expect(result.product.label?.name).toBe("Argent");
    });
  });

  describe("getLabelStats", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getLabelStats({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return label statistics", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.cupLabels.findMany).mockResolvedValue(mockLabels as any);

      // Mock db.select chain
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

      const caller = createCaller(createContext());

      const result = await caller.getLabelStats({ cupId: "cup-1" });

      expect(result.labels).toHaveLength(3);
      expect(result.labels[0]?.label.name).toBe("Or");
    });
  });

  describe("updatePdfSettings - Story 8.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.updatePdfSettings({ cupId: "cup-1", pdfLogoUrl: "https://example.com/logo.png" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return FORBIDDEN if user is not owner or admin", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        ...mockMember,
        role: "member",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.updatePdfSettings({ cupId: "cup-1", pdfLogoUrl: "https://example.com/logo.png" })
      ).rejects.toThrow(TRPCError);
    });

    it("should update PDF settings successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);

      // Mock db.update chain
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{}]),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const caller = createCaller(createContext());

      const result = await caller.updatePdfSettings({
        cupId: "cup-1",
        pdfLogoUrl: "https://example.com/logo.png",
        pdfIntroText: "Bienvenue aux résultats du concours",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Paramètres PDF mis à jour");
    });
  });

  describe("getPdfSettings - Story 8.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getPdfSettings({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PDF settings", async () => {
      const cupWithPdfSettings = {
        ...mockCup,
        pdfLogoUrl: "https://example.com/logo.png",
        pdfIntroText: "Intro text",
        resultsPublishedAt: null,
      };

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(cupWithPdfSettings as any);

      const caller = createCaller(createContext());

      const result = await caller.getPdfSettings({ cupId: "cup-1" });

      expect(result.cupId).toBe("cup-1");
      expect(result.pdfLogoUrl).toBe("https://example.com/logo.png");
      expect(result.pdfIntroText).toBe("Intro text");
    });
  });

  describe("publishResults - Story 8.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.publishResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PRECONDITION_FAILED if results already published", async () => {
      const publishedCup = {
        ...mockCup,
        resultsPublishedAt: new Date(),
      };

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(publishedCup as any);

      const caller = createCaller(createContext());

      await expect(
        caller.publishResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should publish results successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        resultsPublishedAt: null,
      } as any);

      // Mock db.update chain
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{}]),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const caller = createCaller(createContext());

      const result = await caller.publishResults({ cupId: "cup-1" });

      expect(result.success).toBe(true);
      expect(result.publishedAt).toBeDefined();
    });
  });

  describe("unpublishResults - Story 8.3", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.unpublishResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PRECONDITION_FAILED if results not published", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        resultsPublishedAt: null,
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.unpublishResults({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should unpublish results successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        resultsPublishedAt: new Date(),
      } as any);

      // Mock db.update chain
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{}]),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const caller = createCaller(createContext());

      const result = await caller.unpublishResults({ cupId: "cup-1" });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Publication des résultats annulée");
    });
  });

  describe("generateProductPdf - Story 8.4", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.generateProductPdf({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if product does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.products.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.generateProductPdf({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("generateProducerPdf - Story 8.4", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.generateProducerPdf({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.generateProducerPdf({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getProductPdfPreview - Story 8.4", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getProductPdfPreview({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if product does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.products.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.getProductPdfPreview({ productId: "prod-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("generateAllPdfs - Story 8.5", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.generateAllPdfs({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PRECONDITION_FAILED if cup is not in rating or completed status", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        status: "draft",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.generateAllPdfs({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if no registrations found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([]);

      const caller = createCaller(createContext());

      await expect(
        caller.generateAllPdfs({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getMassGenerationStatus - Story 8.5", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getMassGenerationStatus({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return status for all registrations", async () => {
      const mockRegistrations = [
        {
          id: "reg-1",
          producer: { companyName: "Producer 1", brandName: "Brand 1" },
          products: [
            { id: "prod-1", name: "Product 1", finalScore: "85.50", category: { name: "Cat 1" } },
          ],
        },
        {
          id: "reg-2",
          producer: { companyName: "Producer 2", brandName: "Brand 2" },
          products: [
            { id: "prod-2", name: "Product 2", finalScore: null, category: { name: "Cat 1" } },
          ],
        },
      ];

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockRegistrations as any);

      const caller = createCaller(createContext());

      const result = await caller.getMassGenerationStatus({ cupId: "cup-1" });

      expect(result.totalRegistrations).toBe(2);
      expect(result.readyForPdf).toBe(1);
      expect(result.notReady).toBe(1);
      expect(result.registrations).toHaveLength(2);
    });
  });

  describe("sendResultsToProducer - Story 8.6", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToProducer({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToProducer({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return FORBIDDEN if user is not owner/admin", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        cup: mockCup,
      } as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        ...mockMember,
        role: "member",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToProducer({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should send email successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        cup: mockCup,
      } as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(sendResultsEmail).mockResolvedValue({
        success: true,
        emailId: "email-123",
      });

      const caller = createCaller(createContext());

      const result = await caller.sendResultsToProducer({
        registrationId: "reg-1",
        customMessage: "Felicitations!",
      });

      expect(result.success).toBe(true);
      expect(result.emailId).toBe("email-123");
      expect(sendResultsEmail).toHaveBeenCalledWith({
        registrationId: "reg-1",
        customMessage: "Felicitations!",
      });
    });

    it("should throw error if email service fails", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        cup: mockCup,
      } as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(sendResultsEmail).mockResolvedValue({
        success: false,
        error: "Email service error",
      });

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToProducer({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("sendResultsToAllProducers - Story 8.6", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToAllProducers({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return PRECONDITION_FAILED if cup is not in rating or completed status", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue({
        ...mockCup,
        status: "draft",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToAllProducers({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return FORBIDDEN if user is not owner/admin", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue({
        ...mockMember,
        role: "member",
      } as any);

      const caller = createCaller(createContext());

      await expect(
        caller.sendResultsToAllProducers({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should send emails to all producers successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(sendBulkResultsEmails).mockResolvedValue({
        success: 2,
        failed: 1,
        skipped: 0,
        results: [
          { registrationId: "reg-1", producerName: "Producer 1", success: true },
          { registrationId: "reg-2", producerName: "Producer 2", success: true },
          { registrationId: "reg-3", producerName: "Producer 3", success: false, error: "No email" },
        ],
      });

      const caller = createCaller(createContext());

      const result = await caller.sendResultsToAllProducers({
        cupId: "cup-1",
        customMessage: "Merci pour votre participation!",
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(sendBulkResultsEmails).toHaveBeenCalledWith(
        "cup-1",
        "Merci pour votre participation!"
      );
    });

    it("should handle empty results", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(sendBulkResultsEmails).mockResolvedValue({
        success: 0,
        failed: 0,
        skipped: 0,
        results: [],
      });

      const caller = createCaller(createContext());

      const result = await caller.sendResultsToAllProducers({ cupId: "cup-1" });

      expect(result.success).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getEmailSendStatus - Story 8.7", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.getEmailSendStatus({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return email status for all registrations", async () => {
      const mockRegistrations = [
        {
          id: "reg-1",
          synthesisEmailSentAt: new Date(),
          synthesisEmailError: null,
          synthesisEmailAttempts: 1,
          producer: { companyName: "Producer 1", user: { email: "prod1@example.com" } },
          products: [{ finalScore: "85.50" }],
        },
        {
          id: "reg-2",
          synthesisEmailSentAt: null,
          synthesisEmailError: "Email invalide",
          synthesisEmailAttempts: 2,
          producer: { companyName: "Producer 2", user: { email: "invalid" } },
          products: [{ finalScore: "90.00" }],
        },
        {
          id: "reg-3",
          synthesisEmailSentAt: null,
          synthesisEmailError: null,
          synthesisEmailAttempts: 0,
          producer: { companyName: "Producer 3", user: { email: "prod3@example.com" } },
          products: [{ finalScore: null }],
        },
      ];

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockRegistrations as any);

      const caller = createCaller(createContext());

      const result = await caller.getEmailSendStatus({ cupId: "cup-1" });

      expect(result.counts.total).toBe(3);
      expect(result.counts.sent).toBe(1);
      expect(result.counts.error).toBe(1);
      expect(result.registrations).toHaveLength(3);
    });

    it("should filter by sent status", async () => {
      const mockRegistrations = [
        {
          id: "reg-1",
          synthesisEmailSentAt: new Date(),
          synthesisEmailError: null,
          synthesisEmailAttempts: 1,
          producer: { companyName: "Producer 1", user: { email: "prod1@example.com" } },
          products: [{ finalScore: "85.50" }],
        },
      ];

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockRegistrations as any);

      const caller = createCaller(createContext());

      const result = await caller.getEmailSendStatus({ cupId: "cup-1", status: "sent" });

      expect(result.registrations).toHaveLength(1);
      expect(result.registrations[0]?.emailStatus).toBe("sent");
    });
  });

  describe("retryEmailSend - Story 8.7", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.retryEmailSend({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return NOT_FOUND if registration does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue(undefined);

      const caller = createCaller(createContext());

      await expect(
        caller.retryEmailSend({ registrationId: "reg-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should retry email send successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        cupId: "cup-1",
        cup: mockCup,
      } as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(sendResultsEmail).mockResolvedValue({
        success: true,
        emailId: "email-456",
      });

      const caller = createCaller(createContext());

      const result = await caller.retryEmailSend({ registrationId: "reg-1" });

      expect(result.success).toBe(true);
      expect(result.emailId).toBe("email-456");
    });
  });

  describe("retryAllFailedEmails - Story 8.7", () => {
    it("should return UNAUTHORIZED if no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const caller = createCaller(createContext());

      await expect(
        caller.retryAllFailedEmails({ cupId: "cup-1" })
      ).rejects.toThrow(TRPCError);
    });

    it("should return message when no failed emails", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue([]);

      const caller = createCaller(createContext());

      const result = await caller.retryAllFailedEmails({ cupId: "cup-1" });

      expect(result.totalRetried).toBe(0);
      expect(result.message).toContain("Aucun email en erreur");
    });

    it("should retry all failed emails", async () => {
      const mockFailedRegistrations = [
        {
          id: "reg-1",
          synthesisEmailError: "Previous error",
          producer: { companyName: "Producer 1" },
          products: [{ finalScore: "85.50" }],
        },
      ];

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.cups.findFirst).mockResolvedValue(mockCup as any);
      vi.mocked(db.query.registrations.findMany).mockResolvedValue(mockFailedRegistrations as any);
      vi.mocked(sendResultsEmail).mockResolvedValue({
        success: true,
        emailId: "email-retry",
      });

      const caller = createCaller(createContext());

      const result = await caller.retryAllFailedEmails({ cupId: "cup-1" });

      expect(result.totalRetried).toBe(1);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
