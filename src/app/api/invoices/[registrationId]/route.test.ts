import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Téléchargement de facture : le producteur de l'inscription, ou un
 * organisateur pour une facture déjà émise. Un organisateur ne doit jamais
 * provoquer l'émission d'une facture (et l'attribution d'un numéro).
 */

const { session, role, registration, mockGenerate } = vi.hoisted(() => ({
  session: { userId: "producer-user" },
  role: { value: "producer" as string | null },
  registration: { value: null as unknown },
  mockGenerate: vi.fn(),
}));

vi.mock("../../_lib/route-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireSession: async () => ({ userId: session.userId }),
    getCallerRole: async () => role.value,
    forbidden: () => NextResponse.json({ error: "Permission refusée" }, { status: 403 }),
  };
});

vi.mock("~/server/services/invoice.service", () => ({ generateInvoicePdf: mockGenerate }));

vi.mock("~/server/db", () => ({
  db: { query: { registrations: { findFirst: async () => registration.value } } },
}));

let call = 0;
async function download() {
  const { GET } = await import("./route");
  // Utilisateur distinct à chaque appel : le rate limit est un état de module.
  session.userId = `${session.userId.split("#")[0]}#${call++}`;
  return GET(new Request("https://example.test/api/invoices/reg-1"), {
    params: Promise.resolve({ registrationId: "reg-1" }),
  });
}

describe("GET /api/invoices/[registrationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({ buffer: Buffer.from("%PDF"), invoiceNumber: "INV-2026-00001" });
  });

  it("laisse un organisateur télécharger une facture émise", async () => {
    session.userId = "org-user";
    role.value = "organizer";
    registration.value = {
      status: "confirmed",
      invoiceNumber: "INV-2026-00001",
      producer: { userId: "producer-user" },
    };

    const response = await download();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });

  it("n'émet jamais de facture pour un organisateur (inscription importée)", async () => {
    session.userId = "org-user";
    role.value = "organizer";
    registration.value = { status: "confirmed", invoiceNumber: null, producer: { userId: "producer-user" } };

    const response = await download();

    expect(response.status).toBe(404);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("refuse un autre producteur", async () => {
    session.userId = "other-producer";
    role.value = "producer";
    registration.value = {
      status: "confirmed",
      invoiceNumber: "INV-2026-00001",
      producer: { userId: "producer-user" },
    };

    expect((await download()).status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
