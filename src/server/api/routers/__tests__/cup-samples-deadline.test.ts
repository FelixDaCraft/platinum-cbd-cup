import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Date limite de réception des échantillons, réglée par l'organisation dans
 * « Phases & Dates ». Elle est lue par tout le suivi des colis : sans date,
 * pas d'état « En retard » ni de date affichée.
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

vi.mock("~/lib/viva", () => ({ isVivaConfigured: () => false }));

const { updates } = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[] }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn() },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            updates.push(values);
            return Promise.resolve([{ id: "cup-1", ...values }]);
          },
        }),
      }),
    }),
  },
}));

const cup = {
  id: "cup-1",
  name: "Platinum Cup 2027",
  status: "published",
  samplesDeadline: null as string | null,
  registrationOpenAt: null,
  registrationCloseAt: null,
  ratingStartAt: null,
  ratingEndAt: null,
};

async function callerAs(role: "organizer" | "producer", row: unknown = cup) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
    session: { id: "session-1" },
  } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ isAdmin: false, role } as never);
  vi.mocked(db.query.cups.findFirst).mockResolvedValue(row as never);
  const { cupRouter } = await import("../cup");
  return cupRouter.createCaller({ headers: new Headers(), db } as never);
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

describe("cup.updateSamplesDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
  });

  it("l'organisation fixe la date limite de réception", async () => {
    const caller = await callerAs("organizer");

    const result = await caller.updateSamplesDeadline({ cupId: "cup-1", samplesDeadline: "2027-01-09" });

    expect(updates[0]).toMatchObject({ samplesDeadline: "2027-01-09" });
    expect(result.samplesDeadline).toBe("2027-01-09");
  });

  it("une date vide retire la date limite (aucune valeur par défaut)", async () => {
    const caller = await callerAs("organizer", { ...cup, samplesDeadline: "2027-01-09" });

    await caller.updateSamplesDeadline({ cupId: "cup-1", samplesDeadline: "" });

    expect(updates[0]).toMatchObject({ samplesDeadline: null });
  });

  it("refuse une date impossible", async () => {
    const caller = await callerAs("organizer");

    const error = await errorOf(() =>
      caller.updateSamplesDeadline({ cupId: "cup-1", samplesDeadline: "2027-02-30" })
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(updates).toHaveLength(0);
  });

  it("refusée à un producteur", async () => {
    const caller = await callerAs("producer");

    const error = await errorOf(() =>
      caller.updateSamplesDeadline({ cupId: "cup-1", samplesDeadline: "2027-01-09" })
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(updates).toHaveLength(0);
  });

  it("figée une fois la cup terminée, comme les dates de phases", async () => {
    const caller = await callerAs("organizer", { ...cup, status: "completed" });

    const error = await errorOf(() =>
      caller.updateSamplesDeadline({ cupId: "cup-1", samplesDeadline: "2027-01-09" })
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(updates).toHaveLength(0);
  });
});

describe("cup.getPhaseDates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie la date limite de réception avec les dates de phases", async () => {
    const caller = await callerAs("organizer", { ...cup, samplesDeadline: "2027-01-09" });

    const dates = await caller.getPhaseDates({ cupId: "cup-1" });

    expect(dates.samplesDeadline).toBe("2027-01-09");
  });
});
