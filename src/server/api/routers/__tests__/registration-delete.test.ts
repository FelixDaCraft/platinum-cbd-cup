import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Suppression d'une inscription par l'organisation : seules les inscriptions
 * sans paiement en ligne s'effacent. Une inscription payée garde sa facture,
 * une commande Viva encore ouverte est annulée avant toute suppression.
 */

vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "https://test.platinumcbdcup.eu",
    NODE_ENV: "test",
  },
}));

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

const { mockCancelOrder, deleted } = vi.hoisted(() => ({
  mockCancelOrder: vi.fn(),
  deleted: [] as unknown[],
}));

vi.mock("~/lib/viva", () => ({
  cancelPaymentOrder: mockCancelOrder,
  createPaymentOrder: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock("~/server/services/activity-logger", () => ({ logActivity: vi.fn() }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn() },
    },
    delete: () => ({
      where: (condition: unknown) => {
        deleted.push(condition);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

const base = {
  id: "reg-1",
  cupId: "cup-1",
  producerId: "prod-1",
  status: "pending_payment",
  paymentTransactionId: null,
  stripePaymentIntentId: null,
  invoiceNumber: null,
  paymentOrderCode: null,
  paymentReservedUntil: null,
  cup: { name: "Cup 2027" },
  producer: { brandName: "Marque", companyName: "Société" },
  products: [{ id: "p1", ratings: [] }],
};

async function callerWith(registration: unknown) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "org-1", email: "org@example.com" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ isAdmin: false, role: "organizer" } as never);
  vi.mocked(db.query.registrations.findFirst).mockResolvedValue(registration as never);
  const { registrationRouter } = await import("../registration");
  return registrationRouter.createCaller({ headers: new Headers(), db } as never);
}

async function errorOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    return error as TRPCError;
  }
  throw new Error("La procédure aurait dû lever une erreur");
}

describe("registration.deleteByOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleted.length = 0;
  });

  it("supprime un panier non payé", async () => {
    const caller = await callerWith(base);

    await expect(caller.deleteByOrganizer({ registrationId: "reg-1" })).resolves.toEqual({
      deleted: true,
    });
    expect(deleted).toHaveLength(1);
  });

  it("refuse une inscription payée : la facture doit rester", async () => {
    const caller = await callerWith({ ...base, status: "confirmed", invoiceNumber: "INV-1" });

    const error = await errorOf(() => caller.deleteByOrganizer({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.message).toContain("facture");
    expect(deleted).toHaveLength(0);
  });

  it("refuse une inscription dont un produit est déjà noté", async () => {
    const caller = await callerWith({
      ...base,
      status: "confirmed",
      products: [{ id: "p1", ratings: [{ id: "r1" }] }],
    });

    const error = await errorOf(() => caller.deleteByOrganizer({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(deleted).toHaveLength(0);
  });

  it("annule la commande Viva ouverte avant de supprimer", async () => {
    mockCancelOrder.mockResolvedValue(true);
    const caller = await callerWith({
      ...base,
      paymentOrderCode: "123",
      paymentReservedUntil: new Date(Date.now() + 60_000),
    });

    await caller.deleteByOrganizer({ registrationId: "reg-1" });

    expect(mockCancelOrder).toHaveBeenCalledWith("123");
    expect(deleted).toHaveLength(1);
  });

  it("ne supprime pas tant qu'un paiement peut encore aboutir", async () => {
    mockCancelOrder.mockResolvedValue(false);
    const caller = await callerWith({
      ...base,
      paymentOrderCode: "123",
      paymentReservedUntil: new Date(Date.now() + 60_000),
    });

    const error = await errorOf(() => caller.deleteByOrganizer({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(deleted).toHaveLength(0);
  });

  it("refuse un appelant qui n'est pas organisateur", async () => {
    const caller = await callerWith(base);
    const { db } = await import("~/server/db");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ isAdmin: false, role: "producer" } as never);

    const error = await errorOf(() => caller.deleteByOrganizer({ registrationId: "reg-1" }));
    expect(error.code).toBe("FORBIDDEN");
  });
});
