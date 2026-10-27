import { describe, it, expect } from "vitest";

import {
  toSocialParticipants,
  type SocialParticipantRow,
} from "./social-participants.service";

const BASE_URL = "https://platinumcbdcup.eu";

function row(overrides: Partial<SocialParticipantRow> = {}): SocialParticipantRow {
  return {
    cupId: "cup_2027",
    cupName: "PlatinumCBD CUP 2027",
    producerId: "prod_1",
    brandName: "Ferme du Soleil",
    website: "https://ferme-du-soleil.fr",
    instagram: "fermedusoleil",
    logo: "/uploads/producer-logos/logo.webp",
    teamPhoto: "/uploads/producer-photos/equipe.webp",
    mediaConsentAt: new Date("2026-10-01T10:00:00Z"),
    categoryName: "Fleurs Indoor",
    confirmedAt: new Date("2026-10-02T10:00:00Z"),
    ...overrides,
  };
}

describe("toSocialParticipants", () => {
  it("regroupe une marque en une seule entrée par cup, quelles que soient ses commandes", () => {
    const result = toSocialParticipants(
      [
        row({ categoryName: "Fleurs Indoor" }),
        row({ categoryName: "Hash Dry" }),
        // Seconde commande confirmée de la même marque, catégorie déjà présente
        row({ categoryName: "Fleurs Indoor", confirmedAt: new Date("2026-10-05T10:00:00Z") }),
      ],
      BASE_URL
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "cup_2027:prod_1",
      cup: { id: "cup_2027", name: "PlatinumCBD CUP 2027" },
      brandName: "Ferme du Soleil",
      website: "https://ferme-du-soleil.fr",
      instagram: "fermedusoleil",
      categories: ["Fleurs Indoor", "Hash Dry"],
      firstConfirmedAt: "2026-10-02T10:00:00.000Z",
    });
  });

  it("donne les visuels en URL absolue quand la marque a consenti", () => {
    const [participant] = toSocialParticipants([row()], BASE_URL);

    expect(participant?.mediaConsent).toBe(true);
    expect(participant?.logoUrl).toBe(`${BASE_URL}/uploads/producer-logos/logo.webp`);
    expect(participant?.teamPhotoUrl).toBe(`${BASE_URL}/uploads/producer-photos/equipe.webp`);
  });

  it("ne diffuse aucun visuel sans consentement, même si les fichiers existent encore", () => {
    const [participant] = toSocialParticipants([row({ mediaConsentAt: null })], BASE_URL);

    expect(participant?.mediaConsent).toBe(false);
    expect(participant?.logoUrl).toBeNull();
    expect(participant?.teamPhotoUrl).toBeNull();
    expect(participant?.brandName).toBe("Ferme du Soleil");
  });

  it("laisse les visuels absents à null avec consentement", () => {
    const [participant] = toSocialParticipants([row({ logo: null, teamPhoto: null })], BASE_URL);

    expect(participant?.logoUrl).toBeNull();
    expect(participant?.teamPhotoUrl).toBeNull();
  });

  it("garde une inscription sans produit, avec une liste de catégories vide", () => {
    const [participant] = toSocialParticipants([row({ categoryName: null })], BASE_URL);

    expect(participant?.categories).toEqual([]);
  });

  it("sépare la même marque inscrite à deux cups", () => {
    const result = toSocialParticipants(
      [row(), row({ cupId: "cup_autre", cupName: "Autre cup" })],
      BASE_URL
    );

    expect(result.map((p) => p.externalId)).toEqual(["cup_2027:prod_1", "cup_autre:prod_1"]);
  });

  it("trie les marques par première confirmation, la plus ancienne d'abord", () => {
    const result = toSocialParticipants(
      [
        row({ producerId: "prod_b", brandName: "B", confirmedAt: new Date("2026-10-09T00:00:00Z") }),
        row({ producerId: "prod_a", brandName: "A", confirmedAt: new Date("2026-10-03T00:00:00Z") }),
      ],
      BASE_URL
    );

    expect(result.map((p) => p.brandName)).toEqual(["A", "B"]);
  });

  it("n'expose aucune donnée hors du strict nécessaire à la publication", () => {
    const [participant] = toSocialParticipants([row()], BASE_URL);

    expect(Object.keys(participant ?? {}).sort()).toEqual(
      [
        "brandName",
        "categories",
        "cup",
        "externalId",
        "firstConfirmedAt",
        "instagram",
        "logoUrl",
        "mediaConsent",
        "teamPhotoUrl",
        "website",
      ].sort()
    );
  });
});
