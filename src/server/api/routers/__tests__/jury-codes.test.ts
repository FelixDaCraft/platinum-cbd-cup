import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nanoid", () => ({ nanoid: () => "new-id" }));

vi.mock("~/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

const dbState = vi.hoisted(() => ({
  inserted: [] as Array<{ values: unknown }>,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("~/server/db", () => {
  const db = {
    query: {
      users: { findFirst: vi.fn() },
      cups: { findFirst: vi.fn() },
      categories: { findMany: vi.fn() },
      juryInvitationCodes: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      juryInvitationCodeCategories: { findMany: vi.fn() },
      juryProfiles: { findFirst: vi.fn() },
      juryCategoryAssignments: { findMany: vi.fn().mockResolvedValue([]) },
      cupJuries: { findFirst: vi.fn() },
      producers: { findFirst: vi.fn() },
      registrations: { findFirst: vi.fn() },
    },
    insert: () => ({
      values: (values: unknown) => {
        dbState.inserted.push({ values });
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return {
          where: () =>
            Object.assign(Promise.resolve(undefined), {
              returning: () => Promise.resolve([{ id: "code-1" }]),
            }),
        };
      },
    }),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});

async function setup(options: { samplesIncluded: boolean; existingCupJury?: unknown }) {
  const { auth } = await import("~/lib/auth");
  const { db } = await import("~/server/db");

  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", email: "jure@example.com" },
    session: { id: "session-1" },
  } as never);

  vi.mocked(db.query.juryInvitationCodes.findFirst).mockResolvedValue({
    id: "code-1",
    cupId: "cup-1",
    code: "ABC-DEF-GHJ",
    status: "pending",
    expiresAt: null,
    samplesIncluded: options.samplesIncluded,
    cup: { id: "cup-1" },
    categories: [{ categoryId: "cat-1" }],
  } as never);
  vi.mocked(db.query.cupJuries.findFirst).mockResolvedValue(
    (options.existingCupJury ?? undefined) as never
  );
  vi.mocked(db.query.producers.findFirst).mockResolvedValue(undefined);
  vi.mocked(db.query.juryProfiles.findFirst).mockResolvedValue({ id: "jp-1" } as never);
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ role: "jury", isAdmin: false } as never);

  const { juryCodesRouter } = await import("../jury-codes");
  return juryCodesRouter.createCaller({ headers: new Headers(), db } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.inserted.length = 0;
  dbState.updates.length = 0;
});

describe("juryCodes.activate — échantillons inclus", () => {
  const insertedCupJury = () =>
    dbState.inserted
      .map((i) => i.values as Record<string, unknown>)
      .find((v) => !Array.isArray(v) && v.panel === "public");

  it("pose la réception des échantillons à l'activation", async () => {
    const caller = await setup({ samplesIncluded: true });

    const result = await caller.activate({ code: "abc-def-ghj" });

    expect(result).toMatchObject({ success: true, samplesIncluded: true });
    expect(insertedCupJury()?.samplesReceivedAt).toBeInstanceOf(Date);
  });

  it("laisse le juré confirmer lui-même sans l'option", async () => {
    const caller = await setup({ samplesIncluded: false });

    await caller.activate({ code: "ABCDEFGHJ" });

    expect(insertedCupJury()?.samplesReceivedAt).toBeNull();
  });

  it("complète un juré public déjà membre sans écraser une date existante", async () => {
    const caller = await setup({
      samplesIncluded: true,
      existingCupJury: { id: "cj-1", panel: "public", samplesReceivedAt: null },
    });

    await caller.activate({ code: "ABC-DEF-GHJ" });

    expect(dbState.updates.some((u) => u.samplesReceivedAt instanceof Date)).toBe(true);

    dbState.updates.length = 0;
    const again = await setup({
      samplesIncluded: true,
      existingCupJury: { id: "cj-1", panel: "public", samplesReceivedAt: new Date("2026-01-01") },
    });
    await again.activate({ code: "ABC-DEF-GHJ" });

    expect(dbState.updates.some((u) => "samplesReceivedAt" in u)).toBe(false);
  });
});
