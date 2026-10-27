import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEnv, mockList } = vi.hoisted(() => ({
  mockEnv: { INSTAPLANNER_API_KEY: undefined as string | undefined },
  mockList: vi.fn(),
}));

vi.mock("~/env", () => ({ env: mockEnv }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/services/app-url", () => ({
  getPortalBaseUrl: () => "https://platinumcbdcup.eu",
}));
vi.mock("~/server/services/social-participants.service", () => ({
  listSocialParticipants: mockList,
}));

import { GET } from "./route";

const API_KEY = "cle-instaplanner-de-test-suffisamment-longue";

function request(query = "", authorization?: string) {
  return new Request(`https://example.test/api/integrations/instaplanner/participants${query}`, {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/integrations/instaplanner/participants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.INSTAPLANNER_API_KEY = API_KEY;
    mockList.mockResolvedValue([{ externalId: "cup_2027:prod_1", brandName: "Ferme du Soleil" }]);
  });

  it("répond 404 quand l'intégration n'est pas configurée", async () => {
    mockEnv.INSTAPLANNER_API_KEY = undefined;

    const response = await GET(request("", `Bearer ${API_KEY}`));

    expect(response.status).toBe(404);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("refuse une requête sans clé", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("refuse une mauvaise clé", async () => {
    const response = await GET(request("", "Bearer mauvaise-cle"));

    expect(response.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("refuse un schéma d'authentification autre que Bearer", async () => {
    const response = await GET(request("", `Basic ${API_KEY}`));

    expect(response.status).toBe(401);
  });

  it("liste les participants des cups en cours avec la bonne clé", async () => {
    const response = await GET(request("", `Bearer ${API_KEY}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      participants: [{ externalId: "cup_2027:prod_1", brandName: "Ferme du Soleil" }],
    });
    expect(mockList).toHaveBeenCalledWith(
      {},
      { cupId: undefined, baseUrl: "https://platinumcbdcup.eu" }
    );
  });

  it("restreint à une cup quand cupId est fourni", async () => {
    await GET(request("?cupId=GMDGknBu4e_IEq7FmKp8Z", `Bearer ${API_KEY}`));

    expect(mockList).toHaveBeenCalledWith(
      {},
      { cupId: "GMDGknBu4e_IEq7FmKp8Z", baseUrl: "https://platinumcbdcup.eu" }
    );
  });

  it("rejette un cupId mal formé", async () => {
    const response = await GET(request("?cupId=x'%20or%201=1", `Bearer ${API_KEY}`));

    expect(response.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });
});
