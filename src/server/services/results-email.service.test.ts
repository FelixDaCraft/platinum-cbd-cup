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
      // Un des trois rendus de PDF échoue. `sendResultsEmail` rattrape cet
      // échec lui-même et répond `{ success: false }` : ce cas vérifie donc le
      // comptage du lot, pas le filet de sécurité (couvert plus bas).
      mockPdf
        .mockResolvedValueOnce({ buffer: Buffer.from("pdf"), filename: "a.pdf" })
        .mockRejectedValueOnce(new Error("rendu impossible"))
        .mockResolvedValueOnce({ buffer: Buffer.from("pdf"), filename: "c.pdf" });

      const summary = await sendBulkResultsEmails("cup-1");

      expect(summary.results).toHaveLength(3);
      expect(summary).toMatchObject({ success: 2, failed: 1, skipped: 0 });
      expect(
        summary.results.find((r) => !r.success)?.error
      ).toContain("rendu impossible");
    });

    it("isole une inscription inexploitable au lieu de faire tomber tout le lot", async () => {
      // Ce qui atteint le try/catch du lot, c'est une exception INATTENDUE :
      // le service attrape déjà lui-même l'échec de rendu du PDF et rend
      // `{ success: false }`, donc faire échouer le rendu n'y mène jamais.
      // On simule ici un incident de lecture en base au milieu du lot — un
      // pool saturé, une coupure réseau. Sans le filet, ce rejet remonterait à
      // `mapWithConcurrency` : l'organisateur perdrait le compte rendu entier,
      // y compris la liste des envois déjà partis, et relancerait en double.
      //
      // Une version précédente de ce test passait `producer: null`, un état que
      // le schéma interdit (`producer_id` est NOT NULL avec une FK en cascade,
      // cf. drizzle/0000_baseline_production.sql) : il prouvait donc la
      // robustesse face à un cas qui ne peut pas se produire.
      mockFindMany.mockResolvedValue([
        registrationRow("reg-1"),
        registrationRow("reg-2"),
        registrationRow("reg-3"),
      ]);
      // La condition `where` de Drizzle porte des références circulaires : on
      // ne peut pas l'inspecter pour reconnaître une inscription. On fait donc
      // échouer une lecture sur trois, peu importe laquelle — c'est bien une
      // seule des trois qui doit tomber.
      let lectures = 0;
      mockFindFirst.mockImplementation((args: { where?: unknown } | undefined) => {
        void args;
        lectures += 1;
        return lectures === 2
          ? Promise.reject(new Error("connection terminated unexpectedly"))
          : Promise.resolve(registrationRow("reg-x"));
      });

      const summary = await sendBulkResultsEmails("cup-1");

      expect(summary.results).toHaveLength(3);
      expect(summary).toMatchObject({ success: 2, failed: 1, skipped: 0 });
      // Les deux inscriptions saines sont bien parties malgré la troisième.
      expect(mockSend).toHaveBeenCalledTimes(2);
      // L'inscription fautive est nommément rendue à l'organisateur, avec la
      // cause : sans cela il ne saurait pas laquelle relancer.
      const echec = summary.results.find((r) => !r.success);
      expect(echec?.registrationId).toMatch(/^reg-[123]$/);
      expect(echec?.error).toContain("connection terminated");
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
