import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Réception produit par produit (/dashboard/receipt) : même logique que la
 * réception d'un colis entier — received_at, et « product_received » dans
 * activity_logs, dans la transaction de l'écriture.
 */

vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

vi.mock("~/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const { state, notify } = vi.hoisted(() => ({
  state: { updates: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[] },
  notify: vi.fn(),
}));

vi.mock("~/server/services/product-notification.service", () => ({
  notifyProductStatusChange: notify,
}));

vi.mock("~/server/db", () => {
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            state.updates.push(values);
            return Promise.resolve([{ id: "p1", ...values }]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        state.inserts.push(row);
        return Promise.resolve(undefined);
      },
    }),
  };
  return {
    db: {
      query: { users: { findFirst: vi.fn() }, products: { findFirst: vi.fn() } },
      transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

const product = {
  id: "p1",
  name: "Fleur",
  status: "pending",
  registration: {
    id: "reg-1",
    cupId: "cup-1",
    producerId: "prod-1",
    cup: { name: "Cup 2027" },
    producer: { brandName: "Marque" },
  },
};

async function organizerCaller(row: unknown = product) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "orga@example.com" },
    session: { id: "s-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ isAdmin: false, role: "organizer" } as never);
  vi.mocked(db.query.products.findFirst).mockResolvedValue(row as never);
  const { productRouter } = await import("../product");
  return productRouter.createCaller({ headers: new Headers(), db } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  notify.mockResolvedValue({ success: true });
  state.updates.length = 0;
  state.inserts.length = 0;
});

describe("product.updateStatus", () => {
  it("« reçu » : received_at, journal product_received et notification", async () => {
    const caller = await organizerCaller();

    await caller.updateStatus({ productId: "p1", status: "received" });

    expect(state.updates[0]).toMatchObject({ status: "received" });
    expect(state.updates[0]!.receivedAt).toBeInstanceOf(Date);
    expect(state.inserts[0]).toMatchObject({ action: "product_received", userId: "user-1" });
    expect(JSON.parse(state.inserts[0]!.metadata as string)).toMatchObject({ productId: "p1", via: "product" });
    expect(notify).toHaveBeenCalledWith("p1", "pending", "received");
  });

  it("un autre statut n'écrit pas de « product_received »", async () => {
    const caller = await organizerCaller({ ...product, status: "received" });

    await caller.updateStatus({ productId: "p1", status: "rating" });

    expect(state.updates[0]).not.toHaveProperty("receivedAt");
    expect(state.inserts).toHaveLength(0);
  });
});
