import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Déclaration d'expédition du colis d'échantillons. Le producteur ne touche
 * qu'à ses propres inscriptions payées, et plus rien une fois le colis reçu ;
 * l'organisation peut saisir ou corriger à sa place à tout moment.
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

vi.mock("~/lib/viva", () => ({
  cancelPaymentOrder: vi.fn(),
  createPaymentOrder: vi.fn(),
  getTransaction: vi.fn(),
}));

const { mockLog, updates } = vi.hoisted(() => ({
  mockLog: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));

vi.mock("~/server/services/activity-logger", () => ({ logActivity: mockLog }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      producers: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push(values);
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));

const base = {
  id: "reg-1",
  cupId: "cup-1",
  producerId: "prod-1",
  status: "confirmed",
  shippedAt: null,
  cup: { name: "Cup 2027" },
  producer: { brandName: "Marque" },
  products: [{ status: "pending" }, { status: "pending" }],
};

type Role = "producer" | "organizer";

async function callerAs(role: Role, registration: unknown) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue(
    (role === "organizer" ? { isAdmin: false, role: "organizer" } : { isAdmin: false, role: "producer" }) as never
  );
  vi.mocked(db.query.producers.findFirst).mockResolvedValue({ id: "prod-1", userId: "user-1" } as never);
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

describe("registration.declareShipment (producteur)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
  });

  it("enregistre l'expédition et la trace dans le journal", async () => {
    const caller = await callerAs("producer", base);

    const result = await caller.declareShipment({
      registrationId: "reg-1",
      carrier: "colissimo",
      trackingNumber: "6a 123",
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ shippingCarrier: "colissimo", trackingNumber: "6A123" });
    expect(updates[0]!.shippedAt).toBeInstanceOf(Date);
    expect(result.trackingNumber).toBe("6A123");
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "other",
        metadata: expect.objectContaining({ kind: "shipment_declared", by: "producer" }),
      })
    );
  });

  it("ne trouve pas l'inscription d'un autre producteur", async () => {
    // La requête filtre sur le producteur connecté : celle d'un autre ne
    // remonte pas.
    const caller = await callerAs("producer", undefined);

    const error = await errorOf(() => caller.declareShipment({ registrationId: "reg-autre" }));
    expect(error.code).toBe("NOT_FOUND");
    expect(updates).toHaveLength(0);
  });

  it("refuse une inscription non payée", async () => {
    const caller = await callerAs("producer", { ...base, status: "pending_payment" });

    const error = await errorOf(() => caller.declareShipment({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(updates).toHaveLength(0);
  });

  it("refuse toute correction une fois le colis reçu", async () => {
    const caller = await callerAs("producer", {
      ...base,
      shippedAt: new Date("2026-11-10T10:00:00Z"),
      products: [{ status: "received" }, { status: "pending" }],
    });

    const error = await errorOf(() => caller.declareShipment({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.message).toContain("reçu");
    expect(updates).toHaveLength(0);
  });

  it("refuse un numéro de suivi trop long", async () => {
    const caller = await callerAs("producer", base);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", carrier: "ups", trackingNumber: "A".repeat(41) })
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(updates).toHaveLength(0);
  });

  it("refuse un numéro de suivi sans transporteur", async () => {
    const caller = await callerAs("producer", base);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", trackingNumber: "6A12345678" })
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toContain("Transporteur requis");
    expect(updates).toHaveLength(0);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("sans numéro de suivi, le transporteur reste facultatif", async () => {
    const caller = await callerAs("producer", base);

    await caller.declareShipment({ registrationId: "reg-1", carrier: "", trackingNumber: "" });

    expect(updates[0]).toMatchObject({ shippingCarrier: null, trackingNumber: null });
  });
});

describe("registration.clearShipment (producteur)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
  });

  it("annule la déclaration tant que le colis n'est pas reçu", async () => {
    const caller = await callerAs("producer", { ...base, shippedAt: new Date() });

    await caller.clearShipment({ registrationId: "reg-1" });

    expect(updates[0]).toEqual(
      expect.objectContaining({ shippedAt: null, shippingCarrier: null, trackingNumber: null })
    );
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ kind: "shipment_cleared", by: "producer" }),
      })
    );
  });

  it("refuse l'annulation une fois le colis reçu", async () => {
    const caller = await callerAs("producer", {
      ...base,
      shippedAt: new Date(),
      products: [{ status: "rated" }],
    });

    const error = await errorOf(() => caller.clearShipment({ registrationId: "reg-1" }));
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(updates).toHaveLength(0);
  });
});

describe("registration.declareShipmentByOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
  });

  it("refusé à un producteur", async () => {
    const caller = await callerAs("producer", base);

    const error = await errorOf(() =>
      caller.declareShipmentByOrganizer({ registrationId: "reg-1" })
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(updates).toHaveLength(0);
  });

  it("l'organisation saisit l'expédition à la place du producteur, même colis reçu", async () => {
    const caller = await callerAs("organizer", {
      ...base,
      products: [{ status: "received" }],
    });

    await caller.declareShipmentByOrganizer({
      registrationId: "reg-1",
      carrier: "Transporteur local",
      shippedAt: new Date("2026-11-02T10:00:00Z"),
    });

    expect(updates[0]).toMatchObject({
      shippedAt: new Date("2026-11-02T10:00:00Z"),
      shippingCarrier: "Transporteur local",
      trackingNumber: null,
    });
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ kind: "shipment_declared", by: "organizer" }),
      })
    );
  });

  it("refuse aussi à l'organisation un numéro de suivi sans transporteur", async () => {
    const caller = await callerAs("organizer", base);

    const error = await errorOf(() =>
      caller.declareShipmentByOrganizer({ registrationId: "reg-1", carrier: null, trackingNumber: "XY-99" })
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(updates).toHaveLength(0);
  });

  it("l'organisation peut effacer une déclaration", async () => {
    const caller = await callerAs("organizer", { ...base, shippedAt: new Date() });

    await caller.clearShipmentByOrganizer({ registrationId: "reg-1" });

    expect(updates[0]).toMatchObject({ shippedAt: null });
  });

  it("inscription introuvable", async () => {
    const caller = await callerAs("organizer", undefined);

    const error = await errorOf(() =>
      caller.clearShipmentByOrganizer({ registrationId: "reg-x" })
    );
    expect(error.code).toBe("NOT_FOUND");
  });
});
