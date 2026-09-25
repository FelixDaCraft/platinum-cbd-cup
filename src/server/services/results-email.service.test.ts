import { describe, it, expect, vi, beforeEach } from "vitest";

// L'URL publique est lue dans `process.env` par `~/server/services/app-url`,
// qui lève quand elle manque plutôt que de replier sur localhost.
process.env.NEXT_PUBLIC_APP_URL = "https://test.platinumcbdcup.eu";

const { mockFindFirst, mockFindMany, mockUpdate, mockSetWhere, mockPdf, mockSend } =
  vi.hoisted(() => ({
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockUpdate: vi.fn(),
    mockSetWhere: vi.fn(),
    mockPdf: vi.fn(),
    mockSend: vi.fn(),
  }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      registrations: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
    },
    update: mockUpdate,
  },
}));

vi.mock("./results-pdf.service", () => ({
  generateProducerSynthesisPdf: mockPdf,
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

import { sendBulkResultsEmails, sendResultsEmail } from "./results-email.service";

/** Inscription confirmée avec un produit noté, telle que la lit le service. */
function registrationRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: "confirmed",
    producer: {
      companyName: `Producteur ${id}`,
      user: { email: `${id}@example.test`, name: `Nom ${id}` },
    },
    cup: { id: "cup-1", name: "Platinum CBD Cup 2026", ratingScale: "0-100" },
    products: [
      {
        name: "Fleur test",
        finalScore: "88.5",
        category: { name: "Fleurs" },
        label: { name: "Or" },
      },
    ],
    ...overrides,
  };
}

/** Chaîne `db.update(...).set(...).where(...)` du suivi d'envoi. */
function trackingChain() {
  return { set: vi.fn().mockReturnValue({ where: mockSetWhere }) };
}

describe("Results Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetWhere.mockResolvedValue(undefined);
    mockUpdate.mockImplementation(() => trackingChain());
    mockPdf.mockResolvedValue({
      buffer: Buffer.from("pdf"),
      filename: "synthese.pdf",
    });
    mockSend.mockResolvedValue({ data: { id: "resend-1" }, error: null });
  });

  describe("sendResultsEmail", () => {
    it("refuse une inscription qui n'est pas confirmée", async () => {
      mockFindFirst.mockResolvedValue(registrationRow("reg-1", { status: "pending_payment" }));

      const result = await sendResultsEmail({ registrationId: "reg-1" });

      expect(result.success).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("n'échoue pas quand l'écriture du suivi d'envoi échoue", async () => {
      // Le suivi (Story 8.7) sert à cibler les relances ; sa panne ne doit ni
      // masquer un envoi réussi ni interrompre un lot.
      mockFindFirst.mockResolvedValue(registrationRow("reg-1"));
      mockSetWhere.mockRejectedValue(new Error("connexion perdue"));

      const result = await sendResultsEmail({ registrationId: "reg-1" });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendBulkResultsEmails", () => {
    it("poursuit le lot et rend compte de chacun quand un envoi échoue", async () => {
      mockFindMany.mockResolvedValue([
        registrationRow("reg-1"),
        registrationRow("reg-2"),
        registrationRow("reg-3"),
      ]);
      mockFindFirst.mockImplementation((args: { where?: unknown } | undefined) => {
        void args;
        return Promise.resolve(registrationRow("reg-x"));
      });
      // La deuxième inscription fait tomber la génération du PDF de façon
      // non rattrapée par le service lui-même.
      mockPdf
        .mockResolvedValueOnce({ buffer: Buffer.from("pdf"), filename: "a.pdf" })
        .mockRejectedValueOnce(new Error("rendu impossible"))
        .mockResolvedValueOnce({ buffer: Buffer.from("pdf"), filename: "c.pdf" });

      const summary = await sendBulkResultsEmails("cup-1");

      expect(summary.results).toHaveLength(3);
      expect(summary.success + summary.failed + summary.skipped).toBe(3);
      expect(summary.failed).toBeGreaterThanOrEqual(1);
    });

    it("compte à part les inscriptions sans produit noté, sans les envoyer", async () => {
      mockFindMany.mockResolvedValue([
        registrationRow("reg-1", { products: [{ name: "x", finalScore: null }] }),
        registrationRow("reg-2"),
      ]);
      mockFindFirst.mockResolvedValue(registrationRow("reg-2"));

      const summary = await sendBulkResultsEmails("cup-1");

      expect(summary.skipped).toBe(1);
      expect(summary.success).toBe(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("ne lance aucun envoi quand la cup n'a pas d'inscription confirmée", async () => {
      mockFindMany.mockResolvedValue([]);

      const summary = await sendBulkResultsEmails("cup-1");

      expect(summary).toMatchObject({ success: 0, failed: 0, skipped: 0 });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
