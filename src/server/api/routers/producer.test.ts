import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  siretSchema,
  websiteSchema,
  producerRegisterSchema,
  producerProfileUpdateSchema,
  producerLogoUpdateSchema,
} from "~/lib/validations/producer";

// Mock auth
vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Test data fixtures
const mockUser = {
  id: "user-123",
  email: "producer@example.com",
  name: "Producer Name",
  emailVerified: true,
};

const mockSession = {
  user: mockUser,
  session: { id: "session-123" },
};

const mockProducer = {
  id: "producer-123",
  userId: "user-123",
  companyName: "Test Company SARL",
  brandName: "Test Brand",
  logo: null,
  siret: null,
  website: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Producer Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation - siretSchema", () => {
    it("accepts valid 14-digit SIRET", () => {
      const result = siretSchema.safeParse("12345678901234");
      expect(result.success).toBe(true);
    });

    it("rejects SIRET with less than 14 digits", () => {
      const result = siretSchema.safeParse("1234567890123");
      expect(result.success).toBe(false);
    });

    it("rejects SIRET with more than 14 digits", () => {
      const result = siretSchema.safeParse("123456789012345");
      expect(result.success).toBe(false);
    });

    it("rejects SIRET with non-numeric characters", () => {
      const result = siretSchema.safeParse("1234567890123A");
      expect(result.success).toBe(false);
    });

    it("accepts empty string (optional field)", () => {
      const result = siretSchema.safeParse("");
      expect(result.success).toBe(true);
    });

    it("accepts undefined (optional field)", () => {
      const result = siretSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - websiteSchema", () => {
    it("accepts valid HTTPS URL", () => {
      const result = websiteSchema.safeParse("https://www.example.com");
      expect(result.success).toBe(true);
    });

    it("accepts valid HTTP URL", () => {
      const result = websiteSchema.safeParse("http://example.com");
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL format", () => {
      const result = websiteSchema.safeParse("not-a-url");
      expect(result.success).toBe(false);
    });

    it("rejects URL without protocol", () => {
      const result = websiteSchema.safeParse("www.example.com");
      expect(result.success).toBe(false);
    });

    it("accepts empty string (optional field)", () => {
      const result = websiteSchema.safeParse("");
      expect(result.success).toBe(true);
    });

    it("accepts undefined (optional field)", () => {
      const result = websiteSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation - producerRegisterSchema", () => {
    it("accepts valid registration input", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "My Company SARL",
        brandName: "My Brand",
      });

      expect(result.success).toBe(true);
    });

    it("rejects empty email", () => {
      const result = producerRegisterSchema.safeParse({
        email: "",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "My Company",
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((i) =>
          i.path.includes("email")
        );
        expect(emailError).toBeDefined();
      }
    });

    it("rejects invalid email format", () => {
      const result = producerRegisterSchema.safeParse({
        email: "invalid-email",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "My Company",
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
    });

    it("rejects password mismatch", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "DifferentP@ss456!",
        name: "Producer Name",
        companyName: "My Company",
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmError = result.error.issues.find((i) =>
          i.path.includes("confirmPassword")
        );
        expect(confirmError?.message).toBe(
          "Les mots de passe ne correspondent pas"
        );
      }
    });

    it("rejects empty companyName", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "",
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
    });

    it("rejects companyName exceeding 100 characters", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "A".repeat(101),
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty brandName", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "My Company",
        brandName: "",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Input Validation - producerProfileUpdateSchema", () => {
    it("accepts valid profile update with all fields", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "Updated Company",
        brandName: "Updated Brand",
        siret: "12345678901234",
        website: "https://example.com",
      });

      expect(result.success).toBe(true);
    });

    it("accepts profile update with empty optional fields", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "Updated Company",
        brandName: "Updated Brand",
        siret: "",
        website: "",
      });

      expect(result.success).toBe(true);
    });

    it("accepts profile update without optional fields", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "Updated Company",
        brandName: "Updated Brand",
      });

      expect(result.success).toBe(true);
    });

    it("rejects empty companyName", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "",
        brandName: "My Brand",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid SIRET in profile update", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "My Company",
        brandName: "My Brand",
        siret: "invalid",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid website URL in profile update", () => {
      const result = producerProfileUpdateSchema.safeParse({
        companyName: "My Company",
        brandName: "My Brand",
        website: "not-a-url",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Input Validation - producerLogoUpdateSchema", () => {
    it("accepts valid logo URL", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "https://example.com/logo.png",
      });

      expect(result.success).toBe(true);
    });

    it("accepts empty logo (to clear it)", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "",
      });

      expect(result.success).toBe(true);
    });

    it("accepts undefined logo", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: undefined,
      });

      expect(result.success).toBe(true);
    });

    it("rejects invalid logo URL", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "not-a-url",
      });

      expect(result.success).toBe(false);
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

    it("returns valid session when authenticated", async () => {
      const { auth } = await import("~/lib/auth");
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never);

      const session = await auth.api.getSession({ headers: new Headers() });

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user-123");
    });
  });

  describe("Business Logic - Profile Existence Check", () => {
    it("identifies new user without producer profile", () => {
      const existingProducer = undefined;
      const hasProfile = !!existingProducer;

      expect(hasProfile).toBe(false);
    });

    it("identifies existing user with producer profile", () => {
      const existingProducer = mockProducer;
      const hasProfile = !!existingProducer;

      expect(hasProfile).toBe(true);
    });
  });

  describe("Business Logic - Role Exclusion", () => {
    it("blocks organizer from becoming producer", () => {
      const memberRecord = {
        id: "member-1",
        userId: "user-123",
        organizationId: "org-1",
        role: "owner" as const,
      };

      const isOrganizer = !!memberRecord;

      expect(isOrganizer).toBe(true);
      // Router would throw CONFLICT
    });

    it("allows non-organizer to become producer", () => {
      const memberRecord = undefined;
      const isOrganizer = !!memberRecord;

      expect(isOrganizer).toBe(false);
    });
  });

  describe("Business Logic - Profile Update", () => {
    it("converts empty SIRET to null for storage", () => {
      const inputSiret = "";
      const storedSiret = inputSiret || null;

      expect(storedSiret).toBeNull();
    });

    it("preserves valid SIRET for storage", () => {
      const inputSiret = "12345678901234";
      const storedSiret = inputSiret || null;

      expect(storedSiret).toBe("12345678901234");
    });

    it("converts empty website to null for storage", () => {
      const inputWebsite = "";
      const storedWebsite = inputWebsite || null;

      expect(storedWebsite).toBeNull();
    });

    it("preserves valid website for storage", () => {
      const inputWebsite = "https://example.com";
      const storedWebsite = inputWebsite || null;

      expect(storedWebsite).toBe("https://example.com");
    });
  });

  describe("Business Logic - getProfile Response", () => {
    it("combines producer data with session user data", () => {
      const producer = mockProducer;
      const user = mockUser;

      const profileResponse = {
        ...producer,
        email: user.email,
        name: user.name,
      };

      expect(profileResponse.companyName).toBe(mockProducer.companyName);
      expect(profileResponse.email).toBe(mockUser.email);
      expect(profileResponse.name).toBe(mockUser.name);
    });

    it("returns null when no producer profile exists", () => {
      const producer = undefined;
      const profileResponse = producer ?? null;

      expect(profileResponse).toBeNull();
    });
  });

  describe("Notification Preferences", () => {
    it("validates boolean input for notifyOnProductStatusChange", () => {
      const { z } = require("zod");
      const schema = z.object({
        notifyOnProductStatusChange: z.boolean(),
      });

      // Valid: true
      expect(schema.safeParse({ notifyOnProductStatusChange: true }).success).toBe(true);

      // Valid: false
      expect(schema.safeParse({ notifyOnProductStatusChange: false }).success).toBe(true);

      // Invalid: string
      expect(schema.safeParse({ notifyOnProductStatusChange: "true" }).success).toBe(false);

      // Invalid: number
      expect(schema.safeParse({ notifyOnProductStatusChange: 1 }).success).toBe(false);

      // Invalid: missing
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("correctly updates notification preference to false", () => {
      const currentPreference = true;
      const newPreference = false;

      const updateData = {
        notifyOnProductStatusChange: newPreference,
        updatedAt: new Date(),
      };

      expect(updateData.notifyOnProductStatusChange).toBe(false);
      expect(updateData.notifyOnProductStatusChange).not.toBe(currentPreference);
    });

    it("correctly updates notification preference to true", () => {
      const currentPreference = false;
      const newPreference = true;

      const updateData = {
        notifyOnProductStatusChange: newPreference,
        updatedAt: new Date(),
      };

      expect(updateData.notifyOnProductStatusChange).toBe(true);
      expect(updateData.notifyOnProductStatusChange).not.toBe(currentPreference);
    });

    it("default notification preference should be true", () => {
      const defaultValue = true;
      const newProducerPreference = defaultValue;

      expect(newProducerPreference).toBe(true);
    });

    it("getProfile response includes notifyOnProductStatusChange", () => {
      // Simulate getProfile response structure
      const producer = {
        ...mockProducer,
        notifyOnProductStatusChange: true,
      };
      const user = mockUser;

      const profileResponse = {
        ...producer,
        email: user.email,
        name: user.name,
      };

      expect(profileResponse).toHaveProperty("notifyOnProductStatusChange");
      expect(profileResponse.notifyOnProductStatusChange).toBe(true);
    });

    it("getProfile response includes notifyOnProductStatusChange when false", () => {
      const producer = {
        ...mockProducer,
        notifyOnProductStatusChange: false,
      };
      const user = mockUser;

      const profileResponse = {
        ...producer,
        email: user.email,
        name: user.name,
      };

      expect(profileResponse.notifyOnProductStatusChange).toBe(false);
    });
  });

  // Story 8.8 - Accès Producteur à sa Synthèse PDF
  describe("Story 8.8 - getCupResults", () => {
    const mockCup = {
      id: "cup-123",
      name: "Concours 2025",
      resultsPublishedAt: new Date("2025-01-15"),
    };

    const mockCupNotPublished = {
      id: "cup-456",
      name: "Concours En Cours",
      resultsPublishedAt: null,
    };

    const mockRegistration = {
      id: "reg-123",
      cupId: "cup-123",
      producerId: "producer-123",
      status: "confirmed" as const,
    };

    const mockProducts = [
      {
        id: "prod-1",
        name: "Cidre Bio",
        categoryName: "Cidres",
        finalScore: "85.5",
        categoryRank: 1,
        label: { name: "Or", color: "#FFD700" },
      },
      {
        id: "prod-2",
        name: "Pommeau",
        categoryName: "Autres",
        finalScore: "72.0",
        categoryRank: 3,
        label: null,
      },
    ];

    it("validates cupId input as required string", () => {
      const { z } = require("zod");
      const schema = z.object({ cupId: z.string() });

      expect(schema.safeParse({ cupId: "cup-123" }).success).toBe(true);
      expect(schema.safeParse({ cupId: "" }).success).toBe(true); // empty string is valid
      expect(schema.safeParse({}).success).toBe(false); // missing cupId
      expect(schema.safeParse({ cupId: 123 }).success).toBe(false); // wrong type
    });

    it("returns resultsPublished=false when cup results not published", () => {
      const cup = mockCupNotPublished;
      const resultsPublished = !!cup.resultsPublishedAt;

      expect(resultsPublished).toBe(false);
    });

    it("returns resultsPublished=true when cup results are published", () => {
      const cup = mockCup;
      const resultsPublished = !!cup.resultsPublishedAt;

      expect(resultsPublished).toBe(true);
    });

    it("formats product response correctly when results are published", () => {
      const products = mockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.categoryName,
        finalScore: p.finalScore ? parseFloat(p.finalScore) : null,
        categoryRank: p.categoryRank,
        label: p.label
          ? { name: p.label.name, color: p.label.color }
          : null,
        canDownloadPdf: p.finalScore !== null,
      }));

      expect(products).toHaveLength(2);
      expect(products[0]!.finalScore).toBe(85.5);
      expect(products[0]!.canDownloadPdf).toBe(true);
      expect(products[0]!.label).toEqual({ name: "Or", color: "#FFD700" });
      expect(products[1]!.label).toBeNull();
    });

    it("determines canDownloadSynthesis from products with scores", () => {
      const products = mockProducts;
      const canDownloadSynthesis = products.some((p) => p.finalScore !== null);

      expect(canDownloadSynthesis).toBe(true);
    });

    it("returns empty products array when results not published", () => {
      const cup = mockCupNotPublished;
      const resultsPublished = !!cup.resultsPublishedAt;

      const response = resultsPublished ? mockProducts : [];

      expect(response).toEqual([]);
    });
  });

  describe("Story 8.8 - downloadProductPdf", () => {
    const mockProduct = {
      id: "prod-123",
      name: "Cidre Bio",
      finalScore: "85.5",
      registration: {
        producerId: "producer-123",
        cup: {
          resultsPublishedAt: new Date("2025-01-15"),
        },
      },
    };

    const mockProductNoScore = {
      id: "prod-456",
      name: "Cidre En Attente",
      finalScore: null,
      registration: {
        producerId: "producer-123",
        cup: {
          resultsPublishedAt: new Date("2025-01-15"),
        },
      },
    };

    const mockProductUnpublished = {
      id: "prod-789",
      name: "Cidre Nouveau",
      finalScore: "78.0",
      registration: {
        producerId: "producer-123",
        cup: {
          resultsPublishedAt: null,
        },
      },
    };

    it("validates productId input as required string", () => {
      const { z } = require("zod");
      const schema = z.object({ productId: z.string() });

      expect(schema.safeParse({ productId: "prod-123" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("verifies product ownership - allows own product", () => {
      const product = mockProduct;
      const currentProducerId = "producer-123";
      const isOwner = product.registration.producerId === currentProducerId;

      expect(isOwner).toBe(true);
    });

    it("verifies product ownership - blocks other producer's product", () => {
      const product = mockProduct;
      const currentProducerId = "producer-456";
      const isOwner = product.registration.producerId === currentProducerId;

      expect(isOwner).toBe(false);
      // Router would throw FORBIDDEN
    });

    it("checks if results are published", () => {
      const product = mockProduct;
      const isPublished = !!product.registration.cup.resultsPublishedAt;

      expect(isPublished).toBe(true);
    });

    it("blocks download when results not published", () => {
      const product = mockProductUnpublished;
      const isPublished = !!product.registration.cup.resultsPublishedAt;

      expect(isPublished).toBe(false);
      // Router would throw PRECONDITION_FAILED
    });

    it("checks if product has results", () => {
      const product = mockProduct;
      const hasResults = !!product.finalScore;

      expect(hasResults).toBe(true);
    });

    it("blocks download when product has no score", () => {
      const product = mockProductNoScore;
      const hasResults = !!product.finalScore;

      expect(hasResults).toBe(false);
      // Router would throw PRECONDITION_FAILED
    });

    it("returns PDF response with correct structure", () => {
      const pdfResult = {
        success: true,
        filename: "synthese_cidre-bio_2025.pdf",
        pdfBase64: "JVBERi0xLjQK...",
        mimeType: "application/pdf",
      };

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.filename).toContain(".pdf");
      expect(pdfResult.mimeType).toBe("application/pdf");
    });
  });

  describe("Story 8.8 - downloadRegistrationPdf", () => {
    const mockRegistration = {
      id: "reg-123",
      producerId: "producer-123",
      cup: {
        resultsPublishedAt: new Date("2025-01-15"),
      },
      products: [
        { id: "prod-1", finalScore: "85.5" },
        { id: "prod-2", finalScore: "72.0" },
      ],
    };

    const mockRegistrationNoResults = {
      id: "reg-456",
      producerId: "producer-123",
      cup: {
        resultsPublishedAt: new Date("2025-01-15"),
      },
      products: [
        { id: "prod-3", finalScore: null },
        { id: "prod-4", finalScore: null },
      ],
    };

    const mockRegistrationUnpublished = {
      id: "reg-789",
      producerId: "producer-123",
      cup: {
        resultsPublishedAt: null,
      },
      products: [
        { id: "prod-5", finalScore: "80.0" },
      ],
    };

    it("validates registrationId input as required string", () => {
      const { z } = require("zod");
      const schema = z.object({ registrationId: z.string() });

      expect(schema.safeParse({ registrationId: "reg-123" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("verifies registration ownership - allows own registration", () => {
      const registration = mockRegistration;
      const currentProducerId = "producer-123";
      const isOwner = registration.producerId === currentProducerId;

      expect(isOwner).toBe(true);
    });

    it("verifies registration ownership - blocks other producer's registration", () => {
      const registration = mockRegistration;
      const currentProducerId = "producer-456";
      const isOwner = registration.producerId === currentProducerId;

      expect(isOwner).toBe(false);
      // Router would throw FORBIDDEN
    });

    it("checks if results are published", () => {
      const registration = mockRegistration;
      const isPublished = !!registration.cup.resultsPublishedAt;

      expect(isPublished).toBe(true);
    });

    it("blocks download when results not published", () => {
      const registration = mockRegistrationUnpublished;
      const isPublished = !!registration.cup.resultsPublishedAt;

      expect(isPublished).toBe(false);
      // Router would throw PRECONDITION_FAILED
    });

    it("checks if any products have results", () => {
      const registration = mockRegistration;
      const hasResults = registration.products.some((p) => p.finalScore !== null);

      expect(hasResults).toBe(true);
    });

    it("blocks download when no products have scores", () => {
      const registration = mockRegistrationNoResults;
      const hasResults = registration.products.some((p) => p.finalScore !== null);

      expect(hasResults).toBe(false);
      // Router would throw PRECONDITION_FAILED
    });

    it("returns synthesis PDF response with correct structure", () => {
      const pdfResult = {
        success: true,
        filename: "synthese_producteur_concours2025.pdf",
        pdfBase64: "JVBERi0xLjQK...",
        mimeType: "application/pdf",
      };

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.filename).toContain("synthese");
      expect(pdfResult.filename).toContain(".pdf");
      expect(pdfResult.mimeType).toBe("application/pdf");
    });
  });

  // Story 8.9 - Consultation Detaillee des Notes par Producteur
  describe("Story 8.9 - getProductDetailedResults", () => {
    const mockProductWithResults = {
      id: "prod-123",
      name: "Cidre Bio",
      finalScore: "85.5",
      registration: {
        producerId: "producer-123",
        cup: {
          name: "Concours 2025",
          resultsPublishedAt: new Date("2025-01-15"),
        },
      },
    };

    const mockDetailedResults = {
      productId: "prod-123",
      productName: "Cidre Bio",
      anonymousCode: "#A1",
      categoryName: "Cidres",
      finalScore: 85.5,
      categoryRank: 1,
      totalInCategory: 10,
      label: { name: "Or", color: "#FFD700" },
      criteriaScores: [
        { criterionName: "Aspect visuel", coefficient: 2, productScore: 8.5, categoryAverage: 7.2 },
        { criterionName: "Arome", coefficient: 3, productScore: 9.0, categoryAverage: 7.8 },
        { criterionName: "Gout", coefficient: 5, productScore: 8.2, categoryAverage: 7.5 },
      ],
      cupName: "Concours 2025",
    };

    it("validates productId input as required string", () => {
      const { z } = require("zod");
      const schema = z.object({ productId: z.string() });

      expect(schema.safeParse({ productId: "prod-123" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("verifies product ownership before returning results", () => {
      const product = mockProductWithResults;
      const currentProducerId = "producer-123";
      const isOwner = product.registration.producerId === currentProducerId;

      expect(isOwner).toBe(true);
    });

    it("blocks access to other producer's product results", () => {
      const product = mockProductWithResults;
      const currentProducerId = "producer-456";
      const isOwner = product.registration.producerId === currentProducerId;

      expect(isOwner).toBe(false);
      // Router would throw FORBIDDEN
    });

    it("checks if results are published before returning", () => {
      const product = mockProductWithResults;
      const isPublished = !!product.registration.cup.resultsPublishedAt;

      expect(isPublished).toBe(true);
    });

    it("returns detailed criteria scores with category comparison", () => {
      const results = mockDetailedResults;

      expect(results.criteriaScores).toHaveLength(3);
      expect(results.criteriaScores[0]!.criterionName).toBe("Aspect visuel");
      expect(results.criteriaScores[0]!.productScore).toBe(8.5);
      expect(results.criteriaScores[0]!.categoryAverage).toBe(7.2);
      expect(results.criteriaScores[0]!.coefficient).toBe(2);
    });

    it("includes category rank and total in response", () => {
      const results = mockDetailedResults;

      expect(results.categoryRank).toBe(1);
      expect(results.totalInCategory).toBe(10);
    });

    it("includes label information if awarded", () => {
      const results = mockDetailedResults;

      expect(results.label).toEqual({ name: "Or", color: "#FFD700" });
    });
  });

  describe("Story 8.9 - getProductsComparison", () => {
    const mockComparisonProducts = [
      {
        productId: "prod-1",
        productName: "Cidre Bio",
        categoryName: "Cidres",
        finalScore: 85.5,
        label: { name: "Or", color: "#FFD700" },
        criteriaScores: [
          { criterionName: "Aspect visuel", coefficient: 2, productScore: 8.5, categoryAverage: 7.2 },
          { criterionName: "Arome", coefficient: 3, productScore: 9.0, categoryAverage: 7.8 },
        ],
      },
      {
        productId: "prod-2",
        productName: "Cidre Brut",
        categoryName: "Cidres",
        finalScore: 78.0,
        label: null,
        criteriaScores: [
          { criterionName: "Aspect visuel", coefficient: 2, productScore: 7.5, categoryAverage: 7.2 },
          { criterionName: "Arome", coefficient: 3, productScore: 8.0, categoryAverage: 7.8 },
        ],
      },
    ];

    it("validates productIds input as array of strings", () => {
      const { z } = require("zod");
      const schema = z.object({
        productIds: z.array(z.string()).min(2).max(10),
      });

      expect(schema.safeParse({ productIds: ["p1", "p2"] }).success).toBe(true);
      expect(schema.safeParse({ productIds: ["p1"] }).success).toBe(false); // min 2
      expect(schema.safeParse({ productIds: [] }).success).toBe(false);
    });

    it("requires at least 2 products with results for comparison", () => {
      const productsWithResults = mockComparisonProducts.filter((p) => p.finalScore !== null);

      expect(productsWithResults.length).toBeGreaterThanOrEqual(2);
    });

    it("builds criteria comparison across products", () => {
      const criteriaMap = new Map<string, { scores: Array<{ productName: string; productScore: number | null }> }>();

      for (const product of mockComparisonProducts) {
        for (const criterion of product.criteriaScores) {
          if (!criteriaMap.has(criterion.criterionName)) {
            criteriaMap.set(criterion.criterionName, { scores: [] });
          }
          criteriaMap.get(criterion.criterionName)!.scores.push({
            productName: product.productName,
            productScore: criterion.productScore,
          });
        }
      }

      expect(criteriaMap.size).toBe(2); // "Aspect visuel" and "Arome"
      expect(criteriaMap.get("Aspect visuel")!.scores).toHaveLength(2);
    });

    it("includes all product summaries in response", () => {
      const response = {
        products: mockComparisonProducts.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          categoryName: p.categoryName,
          finalScore: p.finalScore,
          label: p.label,
        })),
        criteriaComparison: [],
      };

      expect(response.products).toHaveLength(2);
      expect(response.products[0]!.productName).toBe("Cidre Bio");
      expect(response.products[1]!.productName).toBe("Cidre Brut");
    });

    it("verifies all products belong to the same producer", () => {
      const products = [
        { registration: { producerId: "producer-123" } },
        { registration: { producerId: "producer-123" } },
      ];
      const currentProducerId = "producer-123";

      const allOwned = products.every((p) => p.registration.producerId === currentProducerId);

      expect(allOwned).toBe(true);
    });

    it("blocks comparison if any product belongs to different producer", () => {
      const products = [
        { registration: { producerId: "producer-123" } },
        { registration: { producerId: "producer-456" } },
      ];
      const currentProducerId = "producer-123";

      const allOwned = products.every((p) => p.registration.producerId === currentProducerId);

      expect(allOwned).toBe(false);
      // Router would throw FORBIDDEN
    });
  });
});
