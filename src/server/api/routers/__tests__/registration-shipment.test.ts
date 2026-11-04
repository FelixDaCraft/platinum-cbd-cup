import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

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

const { mockLog, updates, wheres, selectRows } = vi.hoisted(() => ({
  mockLog: vi.fn(),
  updates: [] as Record<string, unknown>[],
  /** Condition de chaque UPDATE, dans le même ordre que `updates`. */
  wheres: [] as unknown[],
  /** Lignes rendues par les SELECT (inscriptions restantes d'un ancien colis commun). */
  selectRows: [] as { id: string }[][],
}));

vi.mock("~/server/services/activity-logger", () => ({ logActivity: mockLog }));

vi.mock("~/server/db", () => {
  const db = {
    query: {
      users: { findFirst: vi.fn() },
      producers: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          updates.push(values);
          wheres.push(condition);
          return Promise.resolve(undefined);
        },
      }),
    }),
    select: () => ({
      from: () => ({ where: () => Promise.resolve(selectRows.shift() ?? []) }),
    }),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db };
});

/** Identifiants visés par la condition d'un UPDATE. */
const dialect = new PgDialect();
const idsOf = (condition: unknown) => dialect.sqlToQuery(condition as SQL).params;

const base = {
  id: "reg-1",
  cupId: "cup-1",
  producerId: "prod-1",
  status: "confirmed",
  shippedAt: null,
  shipmentGroupId: null as string | null,
  cup: { name: "Cup 2027" },
  producer: { brandName: "Marque" },
  products: [{ status: "pending" }, { status: "pending" }],
};

type Role = "producer" | "organizer";

async function callerAs(role: Role, registration: unknown, others: unknown[] = []) {
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
  vi.mocked(db.query.registrations.findMany).mockResolvedValue(others as never);
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
    wheres.length = 0;
    selectRows.length = 0;
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
    wheres.length = 0;
    selectRows.length = 0;
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
    wheres.length = 0;
    selectRows.length = 0;
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

describe("colis commun à plusieurs inscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    wheres.length = 0;
    selectRows.length = 0;
  });

  const second = { ...base, id: "reg-2", createdAt: new Date("2026-11-04T10:00:00Z") };

  it("le producteur applique la même expédition à ses deux inscriptions, reliées par un même colis", async () => {
    const caller = await callerAs("producer", base, [second]);

    const result = await caller.declareShipment({
      registrationId: "reg-1",
      carrier: "colissimo",
      trackingNumber: "6A123",
      alsoRegistrationIds: ["reg-2"],
    });

    expect(updates).toHaveLength(1);
    expect(idsOf(wheres[0])).toEqual(["reg-1", "reg-2"]);
    expect(updates[0]).toMatchObject({ shippingCarrier: "colissimo", trackingNumber: "6A123" });
    expect(updates[0]!.shipmentGroupId).toEqual(expect.any(String));
    expect(result.registrationIds).toEqual(["reg-1", "reg-2"]);
    expect(mockLog).toHaveBeenCalledTimes(2);
  });

  it("refuse une inscription d'un autre producteur, sans rien écrire", async () => {
    const caller = await callerAs("producer", base, [{ ...second, producerId: "prod-2" }]);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", alsoRegistrationIds: ["reg-2"] })
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(updates).toHaveLength(0);
  });

  it("refuse une inscription d'une autre cup", async () => {
    const caller = await callerAs("producer", base, [{ ...second, cupId: "cup-2" }]);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", alsoRegistrationIds: ["reg-2"] })
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(updates).toHaveLength(0);
  });

  it("refuse une inscription introuvable", async () => {
    const caller = await callerAs("producer", base, []);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", alsoRegistrationIds: ["reg-9"] })
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(updates).toHaveLength(0);
  });

  it("le producteur ne peut pas y joindre une inscription déjà reçue", async () => {
    const caller = await callerAs("producer", base, [{ ...second, products: [{ status: "received" }] }]);

    const error = await errorOf(() =>
      caller.declareShipment({ registrationId: "reg-1", alsoRegistrationIds: ["reg-2"] })
    );
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(updates).toHaveLength(0);
  });

  it("l'organisation a la même possibilité, avec les mêmes vérifications", async () => {
    const caller = await callerAs("organizer", base, [second]);

    await caller.declareShipmentByOrganizer({ registrationId: "reg-1", alsoRegistrationIds: ["reg-2"] });
    expect(idsOf(wheres[0])).toEqual(["reg-1", "reg-2"]);

    const other = await callerAs("organizer", base, [{ ...second, producerId: "prod-2" }]);
    const error = await errorOf(() =>
      other.declareShipmentByOrganizer({ registrationId: "reg-1", alsoRegistrationIds: ["reg-2"] })
    );
    expect(error.code).toBe("NOT_FOUND");
  });

  it("corriger une seule inscription la détache du colis commun, sans toucher aux autres", async () => {
    // reg-1 et reg-2 partageaient le colis g1 ; seule reg-2 y reste.
    selectRows.push([{ id: "reg-2" }]);
    const caller = await callerAs("producer", { ...base, shipmentGroupId: "g1", shippedAt: new Date() });

    await caller.declareShipment({ registrationId: "reg-1", carrier: "ups" });

    expect(idsOf(wheres[0])).toEqual(["reg-1"]);
    expect(updates[0]).toMatchObject({ shippingCarrier: "ups", shipmentGroupId: null });
    // reg-2 garde son expédition ; seul le lien d'un colis réduit à elle-même tombe.
    expect(updates[1]).toEqual({ shipmentGroupId: null });
    expect(idsOf(wheres[1])).toEqual(["reg-2"]);
  });

  it("annuler une seule inscription la détache aussi", async () => {
    selectRows.push([{ id: "reg-2" }, { id: "reg-3" }]);
    const caller = await callerAs("producer", { ...base, shipmentGroupId: "g1", shippedAt: new Date() });

    await caller.clearShipment({ registrationId: "reg-1" });

    expect(idsOf(wheres[0])).toEqual(["reg-1"]);
    expect(updates[0]).toMatchObject({ shippedAt: null, shipmentGroupId: null });
    // Il reste deux inscriptions dans le colis g1 : elles restent liées.
    expect(updates).toHaveLength(1);
  });
});
