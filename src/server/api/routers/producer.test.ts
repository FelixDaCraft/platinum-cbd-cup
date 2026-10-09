import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  siretSchema,
  websiteSchema,
  producerRegisterSchema,
  producerProfileUpdateSchema,
  producerLogoUpdateSchema,
} from "~/lib/validations/producer";

vi.mock("nanoid", () => ({ nanoid: () => "test-producer-id" }));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// La génération de PDF ouvre @react-pdf/renderer et lit la base : hors sujet
// ici, où l'on vérifie les gardes qui décident si on y arrive un jour.
vi.mock("~/server/services/results-pdf.service", () => ({
  generateProductSynthesisPdf: vi.fn(async () => ({
    filename: "synthese.pdf",
    buffer: Buffer.from("pdf"),
  })),
  generateProducerSynthesisPdf: vi.fn(async () => ({
    filename: "synthese-globale.pdf",
    buffer: Buffer.from("pdf"),
  })),
  getProductResultsForPdf: vi.fn(),
}));

/** État de la base simulée (voir category.test.ts pour le détail du montage). */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
}));

const { updates } = dbState;

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      producers: { findFirst: vi.fn(), findMany: vi.fn() },
      cups: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn(), findMany: vi.fn() },
      products: { findFirst: vi.fn(), findMany: vi.fn() },
      productRatings: { findMany: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () => ({ returning: () => Promise.resolve([values]) }),
        };
      },
    }),
  },
}));

beforeEach(() => {
  updates.length = 0;
});

// Test data fixtures
const mockUser = {
  id: "user-123",
  email: "producer@example.com",
  name: "Producer Name",
  emailVerified: true,
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

    // companyName and brandName are optional at register time — the
    // register form only collects email/password/name, and producers
    // fill these later via producerProfileUpdateSchema (strict). The
    // register schema purposely accepts empty strings.
    it("accepts empty companyName at register time", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "",
        brandName: "My Brand",
      });

      expect(result.success).toBe(true);
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

    it("accepts empty brandName at register time", () => {
      const result = producerRegisterSchema.safeParse({
        email: "producer@example.com",
        password: "SecureP@ss123!",
        confirmPassword: "SecureP@ss123!",
        name: "Producer Name",
        companyName: "My Company",
        brandName: "",
      });

      expect(result.success).toBe(true);
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
    it("accepts a logo uploaded on the site", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "/uploads/logos/acme.png",
      });

      expect(result.success).toBe(true);
    });

    // Les URL externes sont refusées : `next/image` ne sert plus que les
    // domaines listés dans next.config.js, un logo distant renverrait 400.
    it("rejects an external logo URL", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "https://example.com/logo.png",
      });

      expect(result.success).toBe(false);
    });

    it("rejects a path traversal attempt", () => {
      const result = producerLogoUpdateSchema.safeParse({
        logo: "/uploads/../../etc/passwd",
      });

      expect(result.success).toBe(false);
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

  // ---------------------------------------------------------------------
  // Procédures du routeur
  //
  // Remplace les blocs « Business Logic », « Notification Preferences » et
  // « Story 8.8 / 8.9 » d'origine : ils simulaient auth.api.getSession puis
  // recopiaient la règle dans le test sans jamais appeler producer.ts. Ce
  // sont pourtant les gardes les plus sensibles du routeur — un producteur
  // ne doit voir ni les produits ni les notes d'un concurrent.
  // ---------------------------------------------------------------------
  describe("Procédures", () => {
    async function signIn(userId: string | null) {
      const { auth } = await import("~/lib/auth");

      if (userId === null) {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        return;
      }

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { ...mockUser, id: userId },
        session: { id: "session-123" },
      } as never);
    }

    const asProducer = () => signIn(mockUser.id);
    const asAnonymous = () => signIn(null);

    /** Le profil producteur que le routeur résoudra depuis la session. */
    async function withProducerProfile(profile: unknown) {
      const { db } = await import("~/server/db");
      vi.mocked(db.query.producers.findFirst).mockResolvedValue(profile as never);
    }

    async function createCaller() {
      const { producerRouter } = await import("./producer");
      const { db } = await import("~/server/db");

      return producerRouter.createCaller({ headers: new Headers(), db } as never);
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

      expect(await codeOf(() => caller.getProfile())).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.hasProfile())).toBe("UNAUTHORIZED");
      expect(await codeOf(() => caller.getCupResults({ cupId: "cup-1" }))).toBe(
        "UNAUTHORIZED"
      );
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "prod-1" }))
      ).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() => caller.getProductDetailedResults({ productId: "prod-1" }))
      ).toBe("UNAUTHORIZED");
      expect(
        await codeOf(() =>
          caller.updateNotificationPreferences({ notifyOnProductStatusChange: false })
        )
      ).toBe("UNAUTHORIZED");
      expect(updates).toHaveLength(0);
    });

    it("refuse un organisateur sur la liste globale des producteurs quand il n'en est pas un", async () => {
      await asProducer();
      const { db } = await import("~/server/db");
      // organizerProcedure lit le rôle dans `users`, pas dans la session.
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        isAdmin: false,
        role: "producer",
      } as never);

      const caller = await createCaller();
      expect(await codeOf(() => caller.listByOrganization())).toBe("FORBIDDEN");
    });

    it("renvoie null quand l'utilisateur connecté n'a pas de profil producteur", async () => {
      await asProducer();
      await withProducerProfile(undefined);

      const caller = await createCaller();
      await expect(caller.getProfile()).resolves.toBeNull();
      await expect(caller.hasProfile()).resolves.toBe(false);
    });

    it("combine le profil producteur et l'utilisateur de session", async () => {
      await asProducer();
      await withProducerProfile(mockProducer);

      const caller = await createCaller();
      const profile = await caller.getProfile();

      expect(profile).toMatchObject({
        id: mockProducer.id,
        companyName: mockProducer.companyName,
      });
      await expect(caller.hasProfile()).resolves.toBe(true);
    });

    it("renvoie NOT_FOUND sur les résultats quand le profil producteur manque", async () => {
      await asProducer();
      await withProducerProfile(undefined);

      const caller = await createCaller();
      expect(await codeOf(() => caller.getCupResults({ cupId: "cup-1" }))).toBe(
        "NOT_FOUND"
      );
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "prod-1" }))
      ).toBe("NOT_FOUND");
    });

    // Le cœur du sujet : un producteur qui devine l'identifiant du produit
    // d'un concurrent ne doit obtenir ni PDF ni détail de notes.
    it("refuse le PDF d'un produit appartenant à un autre producteur", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod-1",
        finalScorePublic: "17",
        registration: {
          producerId: "producer-999",
          cup: { id: "cup-1", resultsPublishedAt: new Date() },
        },
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "prod-1" }))
      ).toBe("FORBIDDEN");

      const { generateProductSynthesisPdf } = await import(
        "~/server/services/results-pdf.service"
      );
      expect(generateProductSynthesisPdf).not.toHaveBeenCalled();
    });

    it("renvoie NOT_FOUND pour un produit inexistant", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue(undefined as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "inconnu" }))
      ).toBe("NOT_FOUND");
    });

    // Publier les résultats est une décision de l'organisateur : tant qu'elle
    // n'est pas prise, aucun producteur ne doit pouvoir extraire son score.
    it("refuse le PDF tant que les résultats de la cup ne sont pas publiés", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod-1",
        finalScorePublic: "17",
        registration: {
          producerId: "producer-123",
          cup: { id: "cup-1", resultsPublishedAt: null },
        },
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "prod-1" }))
      ).toBe("PRECONDITION_FAILED");

      const { generateProductSynthesisPdf } = await import(
        "~/server/services/results-pdf.service"
      );
      expect(generateProductSynthesisPdf).not.toHaveBeenCalled();
    });

    it("refuse le PDF d'un produit sans note finale", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod-1",
        finalScorePro: null,
        finalScorePublic: null,
        registration: {
          producerId: "producer-123",
          cup: { id: "cup-1", resultsPublishedAt: new Date() },
        },
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.downloadProductPdf({ productId: "prod-1" }))
      ).toBe("PRECONDITION_FAILED");
    });

    it("génère le PDF d'un produit noté d'une cup publiée, au producteur propriétaire", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod-1",
        finalScorePublic: "17",
        registration: {
          producerId: "producer-123",
          cup: { id: "cup-1", resultsPublishedAt: new Date() },
        },
      } as never);

      const caller = await createCaller();
      const result = await caller.downloadProductPdf({ productId: "prod-1" });

      expect(result).toMatchObject({
        success: true,
        filename: "synthese.pdf",
        mimeType: "application/pdf",
      });
      expect(result.pdfBase64).toBe(Buffer.from("pdf").toString("base64"));
    });

    it("refuse le détail des notes d'un produit appartenant à un autre producteur", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.products.findFirst).mockResolvedValue({
        id: "prod-1",
        finalScorePublic: "17",
        registration: {
          producerId: "producer-999",
          cup: { id: "cup-1", resultsPublishedAt: new Date() },
        },
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.getProductDetailedResults({ productId: "prod-1" }))
      ).toBe("FORBIDDEN");
    });

    // Le jury pro et le jury public notent sur des grilles différentes : la
    // vue d'un panel ne doit lister que les critères de ce panel.
    describe("grille de critères par jury", () => {
      const criteria = [
        { id: "c-pro-1", panel: "pro", name: "Arôme", coefficient: 2, sortOrder: 0 },
        { id: "c-pub-1", panel: "public", name: "Plaisir", coefficient: 1, sortOrder: 0 },
        { id: "c-pro-2", panel: "pro", name: "Texture", coefficient: 1, sortOrder: 1 },
      ];

      async function withRatedProduct() {
        await asProducer();
        await withProducerProfile({ id: "producer-123" });
        const { db } = await import("~/server/db");
        vi.mocked(db.query.products.findFirst).mockResolvedValue({
          id: "prod-1",
          name: "Produit",
          categoryId: "cat-1",
          finalScorePro: "15",
          finalScorePublic: "17",
          category: { name: "Fleurs", criteria },
          registration: {
            producerId: "producer-123",
            cup: { id: "cup-1", resultsPublishedAt: new Date(), ratingScale: "0-10" },
          },
        } as never);
        vi.mocked(db.query.products.findMany).mockResolvedValue([{ id: "prod-1" }] as never);
        vi.mocked(db.query.productRatings.findMany).mockResolvedValue([
          {
            jury: { panel: "pro" },
            submittedAt: new Date(),
            comment: null,
            scores: [
              { criterionId: "c-pro-1", score: 8 },
              { criterionId: "c-pro-2", score: 6 },
            ],
          },
          {
            jury: { panel: "public" },
            submittedAt: new Date(),
            comment: null,
            scores: [{ criterionId: "c-pub-1", score: 9 }],
          },
        ] as never);
      }

      it("ne renvoie que les critères du panel demandé (scores par critère)", async () => {
        await withRatedProduct();
        const caller = await createCaller();

        const pro = await caller.getMyProductCriteriaScores({ productId: "prod-1", panel: "pro" });
        expect(pro.criteriaScores.map((c) => c.criterionId)).toEqual(["c-pro-1", "c-pro-2"]);
        expect(pro.criteriaScores[0]?.productScore).toBe(8);

        const pub = await caller.getMyProductCriteriaScores({
          productId: "prod-1",
          panel: "public",
        });
        expect(pub.criteriaScores.map((c) => c.criterionId)).toEqual(["c-pub-1"]);
        expect(pub.criteriaScores[0]?.productScore).toBe(9);
      });

      it("ne renvoie que les critères du panel demandé (notes des jurés)", async () => {
        await withRatedProduct();
        const caller = await createCaller();

        const pro = await caller.getMyProductJuryScores({ productId: "prod-1", panel: "pro" });
        expect(pro.criteria.map((c) => c.id)).toEqual(["c-pro-1", "c-pro-2"]);
        expect(pro.juryScores).toHaveLength(1);
        expect(pro.juryScores[0]?.criteria.map((c) => c.criterionId)).toEqual([
          "c-pro-1",
          "c-pro-2",
        ]);

        const pub = await caller.getMyProductJuryScores({ productId: "prod-1", panel: "public" });
        expect(pub.criteria.map((c) => c.id)).toEqual(["c-pub-1"]);
        expect(pub.criteriaAverages.map((c) => c.criterionId)).toEqual(["c-pub-1"]);
        expect(pub.criteriaAverages[0]?.averageScore).toBe(9);
      });
    });

    it("refuse la synthèse d'une inscription appartenant à un autre producteur", async () => {
      await asProducer();
      await withProducerProfile({ id: "producer-123" });

      const { db } = await import("~/server/db");
      vi.mocked(db.query.registrations.findFirst).mockResolvedValue({
        id: "reg-1",
        producerId: "producer-999",
        cup: { id: "cup-1", resultsPublishedAt: new Date() },
        products: [{ id: "prod-1", finalScorePublic: "17" }],
      } as never);

      const caller = await createCaller();
      expect(
        await codeOf(() => caller.downloadRegistrationPdf({ registrationId: "reg-1" }))
      ).toBe("FORBIDDEN");

      const { generateProducerSynthesisPdf } = await import(
        "~/server/services/results-pdf.service"
      );
      expect(generateProducerSynthesisPdf).not.toHaveBeenCalled();
    });

    it("enregistre la préférence de notification telle qu'elle est envoyée", async () => {
      await asProducer();
      await withProducerProfile(mockProducer);

      const caller = await createCaller();

      await caller.updateNotificationPreferences({
        notifyOnProductStatusChange: false,
      });
      expect(updates.at(-1)).toMatchObject({ notifyOnProductStatusChange: false });

      await caller.updateNotificationPreferences({
        notifyOnProductStatusChange: true,
      });
      expect(updates.at(-1)).toMatchObject({ notifyOnProductStatusChange: true });
    });

    it("refuse de changer la préférence sans profil producteur", async () => {
      await asProducer();
      await withProducerProfile(undefined);

      const caller = await createCaller();
      expect(
        await codeOf(() =>
          caller.updateNotificationPreferences({ notifyOnProductStatusChange: false })
        )
      ).toBe("NOT_FOUND");
      expect(updates).toHaveLength(0);
    });
  });
});
