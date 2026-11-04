import { describe, it, expect } from "vitest";

import {
  carrierLabel,
  isParcelInHands,
  isCarrierMissing,
  parcelState,
  samplesDeadlineEnd,
  samplesReminder,
  sameParcelRegistrations,
  shipmentCandidates,
  type RegistrationParcelFacts,
  trackingUrl,
  type ParcelFacts,
} from "./parcel-shipment";

const at = (iso: string) => new Date(iso);

const base: ParcelFacts = {
  competing: true,
  shippedAt: null,
  productStatuses: ["pending", "pending"],
};

// Échéance de l'édition 2027, telle que la cup la renseigne.
const deadline = samplesDeadlineEnd("2027-01-09");
// Bien avant l'échéance du 9 janvier 2027.
const november = at("2026-11-15T10:00:00Z");

describe("parcelState", () => {
  it("pas encore expédié", () => {
    expect(parcelState(base, deadline, november)).toBe("none");
  });

  it("expédié : date d'envoi déclarée, rien de reçu", () => {
    expect(parcelState({ ...base, shippedAt: at("2026-11-14T09:00:00Z") }, deadline, november)).toBe(
      "shipped"
    );
  });

  it("reçu : tous les produits sont passés au-delà de « pending »", () => {
    expect(
      parcelState({ ...base, productStatuses: ["received", "rating"] }, deadline, november)
    ).toBe("received");
    // Reçu sans déclaration d'envoi (colis déposé en main propre).
    expect(parcelState({ ...base, productStatuses: ["rated"] }, deadline, november)).toBe("received");
  });

  it("une réception partielle n'est pas « reçu »", () => {
    expect(
      parcelState(
        { ...base, shippedAt: at("2026-11-14T09:00:00Z"), productStatuses: ["received", "pending"] }, deadline,
        november
      )
    ).toBe("shipped");
  });

  it("en retard : rien d'expédié dans la dernière semaine avant l'échéance", () => {
    expect(parcelState(base, deadline, at("2027-01-03T10:00:00Z"))).toBe("late");
  });

  it("un colis expédié avant l'échéance n'est pas en retard", () => {
    expect(
      parcelState({ ...base, shippedAt: at("2027-01-04T09:00:00Z") }, deadline, at("2027-01-06T10:00:00Z"))
    ).toBe("shipped");
  });

  it("échéance passée sans réception : en retard même si expédié", () => {
    expect(
      parcelState({ ...base, shippedAt: at("2027-01-04T09:00:00Z") }, deadline, at("2027-01-10T10:00:00Z"))
    ).toBe("late");
  });

  it("reçu prime sur le retard", () => {
    expect(
      parcelState({ ...base, productStatuses: ["received"] }, deadline, at("2027-01-20T10:00:00Z"))
    ).toBe("received");
  });

  it("inscription hors compétition (non payée) ou sans produit : rien à suivre", () => {
    expect(parcelState({ ...base, competing: false }, deadline, at("2027-01-20T10:00:00Z"))).toBe("none");
    expect(parcelState({ ...base, productStatuses: [] }, deadline, at("2027-01-20T10:00:00Z"))).toBe("none");
  });

  it("sans date limite renseignée sur la cup : jamais « en retard »", () => {
    const later = at("2027-06-01T10:00:00Z");
    expect(parcelState(base, null, later)).toBe("none");
    expect(parcelState({ ...base, shippedAt: at("2027-01-04T09:00:00Z") }, null, later)).toBe(
      "shipped"
    );
    expect(parcelState({ ...base, productStatuses: ["received"] }, null, later)).toBe("received");
  });

  it("suit la date de la cup, quelle qu'elle soit", () => {
    const march = samplesDeadlineEnd("2028-03-10");
    expect(parcelState(base, march, at("2027-01-20T10:00:00Z"))).toBe("none");
    expect(parcelState(base, march, at("2028-03-05T10:00:00Z"))).toBe("late");
  });
});

describe("samplesDeadlineEnd", () => {
  it("le jour de la cup, jusqu'à 23:59:59 à Paris (heure d'hiver)", () => {
    expect(samplesDeadlineEnd("2027-01-09")?.toISOString()).toBe("2027-01-09T22:59:59.000Z");
  });

  it("tient compte de l'heure d'été", () => {
    expect(samplesDeadlineEnd("2027-07-01")?.toISOString()).toBe("2027-07-01T21:59:59.000Z");
  });

  it("pas de date, ou une date impossible : pas d'échéance", () => {
    expect(samplesDeadlineEnd(null)).toBeNull();
    expect(samplesDeadlineEnd(undefined)).toBeNull();
    expect(samplesDeadlineEnd("")).toBeNull();
    expect(samplesDeadlineEnd("2027-02-30")).toBeNull();
    expect(samplesDeadlineEnd("09/01/2027")).toBeNull();
  });
});

describe("isCarrierMissing", () => {
  it("un numéro de suivi sans transporteur : il manque le transporteur", () => {
    expect(isCarrierMissing(null, "6A12345678")).toBe(true);
    expect(isCarrierMissing("  ", "6A12345678")).toBe(true);
  });

  it("sans numéro, le transporteur reste facultatif", () => {
    expect(isCarrierMissing(null, null)).toBe(false);
    expect(isCarrierMissing("", "  ")).toBe(false);
    expect(isCarrierMissing(null, undefined)).toBe(false);
  });

  it("un transporteur connu ou saisi librement suffit", () => {
    expect(isCarrierMissing("colissimo", "6A12345678")).toBe(false);
    expect(isCarrierMissing("Coursier Dupont", "AB-12")).toBe(false);
  });
});

describe("isParcelInHands", () => {
  it("dès qu'un produit est reçu, le colis est chez l'organisation", () => {
    expect(isParcelInHands(["pending", "pending"])).toBe(false);
    expect(isParcelInHands(["pending", "received"])).toBe(true);
    expect(isParcelInHands([])).toBe(false);
  });
});

describe("trackingUrl", () => {
  it("lien de suivi des transporteurs connus", () => {
    expect(trackingUrl("colissimo", "6A12345678901")).toBe(
      "https://www.laposte.fr/outils/suivre-vos-envois?code=6A12345678901"
    );
    expect(trackingUrl("chronopost", "XY123456789FR")).toContain("chronopost.fr");
    expect(trackingUrl("dpd", "01234567890123")).toContain("dpd");
    expect(trackingUrl("ups", "1Z999AA10123456784")).toBe(
      "https://www.ups.com/track?tracknum=1Z999AA10123456784"
    );
    expect(trackingUrl("dhl", "1234567890")).toContain("dhl.com");
    expect(trackingUrl("mondial_relay", "12345678")).toContain("mondialrelay.fr");
    expect(trackingUrl("gls", "12345678901")).toContain("gls-group");
  });

  it("encode le numéro dans l'URL", () => {
    expect(trackingUrl("ups", "A B&C")).toBe("https://www.ups.com/track?tracknum=A%20B%26C");
  });

  it("aucun lien sans numéro ou pour un transporteur inconnu", () => {
    expect(trackingUrl("colissimo", null)).toBeNull();
    expect(trackingUrl("Transports Dupont", "123")).toBeNull();
    expect(trackingUrl(null, "123")).toBeNull();
  });
});

describe("carrierLabel", () => {
  it("nom affiché des transporteurs connus, texte libre sinon", () => {
    expect(carrierLabel("colissimo")).toBe("La Poste / Colissimo");
    expect(carrierLabel("mondial_relay")).toBe("Mondial Relay");
    expect(carrierLabel("Transports Dupont")).toBe("Transports Dupont");
    expect(carrierLabel(null)).toBeNull();
  });
});

describe("samplesReminder (tableau de bord producteur)", () => {
  const reg = {
    competing: true,
    shippedAt: null,
    productStatuses: ["pending"],
    samplesDeadline: "2027-01-09",
  };

  it("rappelle la date limite d'une inscription payée dont le colis n'est pas parti", () => {
    expect(samplesReminder(reg)).toBe("2027-01-09");
  });

  it("rien à rappeler : colis déclaré, déjà reçu, inscription non payée ou sans produit", () => {
    expect(samplesReminder({ ...reg, shippedAt: new Date() })).toBeNull();
    expect(samplesReminder({ ...reg, productStatuses: ["received"] })).toBeNull();
    expect(samplesReminder({ ...reg, competing: false })).toBeNull();
    expect(samplesReminder({ ...reg, productStatuses: [] })).toBeNull();
  });

  it("pas de date limite sur la cup : pas de rappel", () => {
    expect(samplesReminder({ ...reg, samplesDeadline: null })).toBeNull();
  });
});

describe("colis commun à plusieurs inscriptions", () => {
  const reg = (id: string, over: Partial<RegistrationParcelFacts> = {}): RegistrationParcelFacts => ({
    id,
    producerId: "prod-1",
    cupId: "cup-1",
    competing: true,
    productStatuses: ["pending"],
    shipmentGroupId: null,
    createdAt: at("2026-11-03T10:00:00Z"),
    ...over,
  });

  it("propose les autres inscriptions payées et non reçues du producteur sur la cup", () => {
    const self = reg("a");
    const all = [
      self,
      reg("b"),
      reg("c", { productStatuses: ["received", "pending"] }), // déjà (en partie) reçue
      reg("d", { competing: false }), // non payée
      reg("e", { cupId: "cup-2" }), // autre cup
      reg("f", { producerId: "prod-2" }), // autre producteur
      reg("g", { productStatuses: [] }), // sans produit
    ];
    expect(shipmentCandidates(self, all).map((r) => r.id)).toEqual(["b"]);
  });

  it("une seule inscription payée : rien à proposer", () => {
    const self = reg("a");
    expect(shipmentCandidates(self, [self])).toEqual([]);
  });

  it("même colis : les autres inscriptions du même groupe, jamais elle-même", () => {
    const self = reg("a", { shipmentGroupId: "g1" });
    const all = [self, reg("b", { shipmentGroupId: "g1" }), reg("c", { shipmentGroupId: "g2" }), reg("d")];
    expect(sameParcelRegistrations(self, all).map((r) => r.id)).toEqual(["b"]);
  });

  it("sans groupe : aucune inscription liée", () => {
    const self = reg("a");
    expect(sameParcelRegistrations(self, [self, reg("b")])).toEqual([]);
  });
});
