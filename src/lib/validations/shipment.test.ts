import { describe, it, expect } from "vitest";

import {
  CARRIER_REQUIRED_MESSAGE,
  declareShipmentSchema,
  TRACKING_NUMBER_MAX,
} from "./registration";
import { samplesDeadlineSchema } from "./phases";

const valid = { registrationId: "reg-1" };

describe("declareShipmentSchema", () => {
  it("le transporteur et le numéro de suivi sont facultatifs", () => {
    expect(declareShipmentSchema.parse(valid)).toEqual({
      registrationId: "reg-1",
      carrier: null,
      trackingNumber: null,
      alsoRegistrationIds: [],
    });
  });

  it("normalise le numéro de suivi : sans espaces, en majuscules", () => {
    const parsed = declareShipmentSchema.parse({
      ...valid,
      carrier: " colissimo ",
      trackingNumber: " 6a 1234 5678 ",
    });
    expect(parsed.carrier).toBe("colissimo");
    expect(parsed.trackingNumber).toBe("6A12345678");
  });

  it("des champs vides valent « non renseigné »", () => {
    const parsed = declareShipmentSchema.parse({ ...valid, carrier: "  ", trackingNumber: "" });
    expect(parsed.carrier).toBeNull();
    expect(parsed.trackingNumber).toBeNull();
  });

  it("limite la longueur du numéro de suivi", () => {
    const tooLong = "A".repeat(TRACKING_NUMBER_MAX + 1);
    const withCarrier = { ...valid, carrier: "ups" };
    expect(declareShipmentSchema.safeParse({ ...withCarrier, trackingNumber: tooLong }).success).toBe(
      false
    );
    expect(
      declareShipmentSchema.safeParse({ ...withCarrier, trackingNumber: "A".repeat(TRACKING_NUMBER_MAX) })
        .success
    ).toBe(true);
  });

  it("refuse les caractères hors lettres, chiffres et tirets dans le numéro", () => {
    expect(
      declareShipmentSchema.safeParse({ ...valid, carrier: "ups", trackingNumber: "<script>" }).success
    ).toBe(false);
  });

  it("limite la longueur du transporteur", () => {
    expect(declareShipmentSchema.safeParse({ ...valid, carrier: "x".repeat(41) }).success).toBe(
      false
    );
  });

  it("refuse une date d'expédition dans le futur", () => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    expect(declareShipmentSchema.safeParse({ ...valid, shippedAt: tomorrow }).success).toBe(false);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    expect(declareShipmentSchema.parse({ ...valid, shippedAt: yesterday }).shippedAt).toEqual(
      yesterday
    );
  });
});

describe("declareShipmentSchema : transporteur obligatoire avec un numéro de suivi", () => {
  it("refuse un numéro de suivi sans transporteur, en signalant le champ transporteur", () => {
    const result = declareShipmentSchema.safeParse({ ...valid, trackingNumber: "6A12345678" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["carrier"]);
    expect(result.error?.issues[0]?.message).toBe(CARRIER_REQUIRED_MESSAGE);
  });

  it("un transporteur vide ou en espaces ne compte pas", () => {
    expect(
      declareShipmentSchema.safeParse({ ...valid, carrier: "   ", trackingNumber: "6A123" }).success
    ).toBe(false);
    expect(
      declareShipmentSchema.safeParse({ ...valid, carrier: null, trackingNumber: "6A123" }).success
    ).toBe(false);
  });

  it("un numéro réduit à des espaces vaut « pas de numéro » : transporteur facultatif", () => {
    expect(declareShipmentSchema.safeParse({ ...valid, trackingNumber: "   " }).success).toBe(true);
  });

  it("accepte un transporteur seul, ou un transporteur avec son numéro", () => {
    expect(declareShipmentSchema.safeParse({ ...valid, carrier: "dpd" }).success).toBe(true);
    expect(
      declareShipmentSchema.safeParse({ ...valid, carrier: "Coursier local", trackingNumber: "AB-1" })
        .success
    ).toBe(true);
  });
});

describe("samplesDeadlineSchema", () => {
  it("accepte un jour civil AAAA-MM-JJ, ou null pour retirer la date", () => {
    expect(samplesDeadlineSchema.parse({ cupId: "c", samplesDeadline: "2027-01-09" })).toEqual({
      cupId: "c",
      samplesDeadline: "2027-01-09",
    });
    expect(samplesDeadlineSchema.parse({ cupId: "c", samplesDeadline: null }).samplesDeadline).toBeNull();
  });

  it("une saisie vide vaut « pas de date limite »", () => {
    expect(samplesDeadlineSchema.parse({ cupId: "c", samplesDeadline: "" }).samplesDeadline).toBeNull();
  });

  it("refuse un autre format ou une date impossible", () => {
    for (const bad of ["09/01/2027", "2027-1-9", "2027-02-30", "demain"]) {
      expect(samplesDeadlineSchema.safeParse({ cupId: "c", samplesDeadline: bad }).success).toBe(false);
    }
  });
});

describe("declareShipmentSchema : colis commun", () => {
  it("sans autre inscription : liste vide par défaut", () => {
    expect(declareShipmentSchema.parse(valid).alsoRegistrationIds).toEqual([]);
  });

  it("dédoublonne et retire l'inscription elle-même", () => {
    const parsed = declareShipmentSchema.parse({
      ...valid,
      alsoRegistrationIds: ["reg-2", "reg-2", "reg-1", "reg-3"],
    });
    expect(parsed.alsoRegistrationIds).toEqual(["reg-2", "reg-3"]);
  });

  it("limite le nombre d'inscriptions d'un même colis", () => {
    const many = Array.from({ length: 21 }, (_, i) => `reg-${i + 10}`);
    expect(declareShipmentSchema.safeParse({ ...valid, alsoRegistrationIds: many }).success).toBe(false);
  });
});
