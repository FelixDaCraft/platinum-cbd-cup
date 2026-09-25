import { describe, it, expect, vi, beforeEach } from "vitest";

// L'URL publique est lue dans `process.env` par `~/server/services/app-url`.
process.env.NEXT_PUBLIC_APP_URL = "https://test.platinumcbdcup.eu";

const {
  mockCupFindFirst,
  mockInvitationFindFirst,
  mockUserFindFirst,
  mockInsertValues,
  mockSend,
} = vi.hoisted(() => ({
  mockCupFindFirst: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockInsertValues: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      cups: { findFirst: mockCupFindFirst },
      juryInvitations: { findFirst: mockInvitationFindFirst },
      users: { findFirst: mockUserFindFirst },
    },
    insert: () => ({ values: mockInsertValues }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
  },
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
    BETTER_AUTH_URL: "https://test.platinumcbdcup.eu",
    NODE_ENV: "test",
  },
}));

import { sendJuryInvitation } from "./jury-invitation.service";

const baseParams = {
  cupId: "cup-1",
  email: "Jure@Example.com",
  firstName: "Jean",
  lastName: "Dupont",
  invitedByUserId: "user-1",
};

describe("sendJuryInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitationFindFirst.mockResolvedValue(undefined);
    mockUserFindFirst.mockResolvedValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  it("refuse une cup inconnue sans rien envoyer", async () => {
    mockCupFindFirst.mockResolvedValue(undefined);

    const result = await sendJuryInvitation(baseParams);

    expect(result).toEqual({ success: false, error: "Cup not found" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("n'invite pas deux fois un juré qui a déjà accepté", async () => {
    mockCupFindFirst.mockResolvedValue({ id: "cup-1", name: "Platinum 2026" });
    mockInvitationFindFirst.mockResolvedValue({ id: "inv-1", status: "accepted" });

    const result = await sendJuryInvitation(baseParams);

    expect(result.success).toBe(false);
    expect(result.alreadyInvited).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("neutralise une balise injectée dans le nom de la cup", async () => {
    mockCupFindFirst.mockResolvedValue({
      id: "cup-1",
      name: '<img src=x onerror="alert(1)">',
    });

    const result = await sendJuryInvitation({
      ...baseParams,
      customMessage: '<a href="https://evil.test">Cliquez</a>',
    });

    expect(result.success).toBe(true);

    const payload = mockSend.mock.calls[0]?.[0] as { html: string; to: string };
    expect(payload.html).not.toContain("<img");
    expect(payload.html).not.toContain('<a href="https://evil.test"');
    expect(payload.html).toContain("&lt;img");
  });

  it("enregistre l'email en minuscules et pointe le lien vers l'URL publique", async () => {
    mockCupFindFirst.mockResolvedValue({ id: "cup-1", name: "Platinum 2026" });

    await sendJuryInvitation(baseParams);

    const inserted = mockInsertValues.mock.calls[0]?.[0] as {
      email: string;
      token: string;
    };
    expect(inserted.email).toBe("jure@example.com");

    const payload = mockSend.mock.calls[0]?.[0] as { html: string };
    expect(payload.html).toContain(
      `https://test.platinumcbdcup.eu/jury-invite/${inserted.token}`
    );
  });

  it("remonte l'erreur de l'expéditeur hors développement", async () => {
    mockCupFindFirst.mockResolvedValue({ id: "cup-1", name: "Platinum 2026" });
    mockSend.mockResolvedValue({ error: { message: "Rate limit exceeded" } });

    const result = await sendJuryInvitation(baseParams);

    expect(result).toEqual({ success: false, error: "Rate limit exceeded" });
  });
});
