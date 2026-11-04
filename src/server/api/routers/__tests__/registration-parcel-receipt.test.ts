import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Réception d'un colis par l'organisation, depuis le panneau de détail d'une
 * inscription : tous les produits encore « à envoyer » passent « reçu » d'un
 * coup, avec ou sans expédition déclarée. L'annulation ne remet « à envoyer »
 * que les produits reçus, jamais ceux dont la notation a commencé.
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

const { tx, notify, state } = vi.hoisted(() => {
  const state = {
    /** Lignes rendues par l'UPDATE ... RETURNING de la transaction. */
    returning: [] as { id: string; name: string }[],
    updates: [] as Record<string, unknown>[],
    inserts: [] as Record<string, unknown>[],
    committed: false,
  };
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            state.updates.push(values);
            return Promise.resolve(state.returning);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        state.inserts.push(...(Array.isArray(rows) ? rows : [rows]));
        return Promise.resolve(undefined);
      },
    }),
  };
  return { tx, notify: vi.fn(), state };
});

vi.mock("~/server/services/product-notification.service", () => ({
  notifyProductStatusChange: notify,
}));

vi.mock("~/server/services/activity-logger", () => ({ logActivity: vi.fn() }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      producers: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn() },
    },
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      state.committed = true;
      return result;
    },
  },
}));

const registration = {
  id: "reg-1",
  cupId: "cup-1",
  producerId: "prod-1",
  status: "confirmed",
  shippedAt: null,
  cup: { name: "Cup 2027" },
  producer: { brandName: "Marque" },
  products: [{ status: "pending" }, { status: "pending" }],
};

async function callerAs(role: "producer" | "organizer") {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ isAdmin: false, role } as never);
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

beforeEach(() => {
  vi.clearAllMocks();
  notify.mockResolvedValue({ success: true });
  state.returning = [];
  state.updates.length = 0;
  state.inserts.length = 0;
  state.committed = false;
});

describe("registration.markParcelReceived", () => {
  it("passe « reçu » les produits à envoyer, avec received_at, dans une transaction", async () => {
    state.returning = [
      { id: "p1", name: "Fleur" },
      { id: "p2", name: "Hash" },
    ];
    const caller = await callerAs("organizer");

    const result = await caller.markParcelReceived({ registrationId: "reg-1" });

    expect(result).toEqual({ registrationId: "reg-1", changed: 2 });
    expect(state.committed).toBe(true);
    expect(state.updates[0]).toMatchObject({ status: "received" });
    expect(state.updates[0]!.receivedAt).toBeInstanceOf(Date);
  });

  it("trace chaque produit reçu dans activity_logs (product_received), dans la transaction", async () => {
    state.returning = [
      { id: "p1", name: "Fleur" },
      { id: "p2", name: "Hash" },
    ];
    const caller = await callerAs("organizer");

    await caller.markParcelReceived({ registrationId: "reg-1" });

    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]).toMatchObject({ action: "product_received", userId: "user-1" });
    expect(JSON.parse(state.inserts[0]!.metadata as string)).toMatchObject({
      productId: "p1",
      registrationId: "reg-1",
      cupId: "cup-1",
      via: "parcel",
    });
  });

  it("notifie le producteur pour chaque produit, après la transaction", async () => {
    state.returning = [{ id: "p1", name: "Fleur" }];
    const caller = await callerAs("organizer");

    await caller.markParcelReceived({ registrationId: "reg-1" });

    expect(notify).toHaveBeenCalledWith("p1", "pending", "received");
  });

  it("fonctionne sans expédition déclarée (colis arrivé sans prévenir)", async () => {
    state.returning = [{ id: "p1", name: "Fleur" }];
    const caller = await callerAs("organizer");

    await expect(caller.markParcelReceived({ registrationId: "reg-1" })).resolves.toMatchObject({
      changed: 1,
    });
  });

  it("rien à recevoir : aucune écriture de journal ni notification", async () => {
    state.returning = [];
    const caller = await callerAs("organizer");

    const result = await caller.markParcelReceived({ registrationId: "reg-1" });

    expect(result.changed).toBe(0);
    expect(state.inserts).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("réservé à l'organisation", async () => {
    const caller = await callerAs("producer");

    const error = await errorOf(() => caller.markParcelReceived({ registrationId: "reg-1" }));
    expect(error.code).toBe("FORBIDDEN");
    expect(state.updates).toHaveLength(0);
  });
});

describe("registration.cancelParcelReceipt", () => {
  it("remet « à envoyer » les produits reçus et efface received_at", async () => {
    state.returning = [{ id: "p1", name: "Fleur" }];
    const caller = await callerAs("organizer");

    const result = await caller.cancelParcelReceipt({ registrationId: "reg-1" });

    expect(result).toEqual({ registrationId: "reg-1", changed: 1 });
    expect(state.committed).toBe(true);
    expect(state.updates[0]).toMatchObject({ status: "pending", receivedAt: null });
    expect(state.inserts[0]).toMatchObject({ action: "other" });
    expect(JSON.parse(state.inserts[0]!.metadata as string)).toMatchObject({
      kind: "parcel_receipt_cancelled",
      productId: "p1",
    });
    expect(notify).toHaveBeenCalledWith("p1", "received", "pending");
  });

  it("réservé à l'organisation", async () => {
    const caller = await callerAs("producer");

    const error = await errorOf(() => caller.cancelParcelReceipt({ registrationId: "reg-1" }));
    expect(error.code).toBe("FORBIDDEN");
    expect(state.updates).toHaveLength(0);
  });
});
