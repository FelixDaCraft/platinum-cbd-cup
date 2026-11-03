import { describe, it, expect } from "vitest";

import { declareShipmentSchema, TRACKING_NUMBER_MAX } from "./registration";

const valid = { registrationId: "reg-1" };

describe("declareShipmentSchema", () => {
  it("le transporteur et le numéro de suivi sont facultatifs", () => {
    expect(declareShipmentSchema.parse(valid)).toEqual({
      registrationId: "reg-1",
      carrier: null,
      trackingNumber: null,
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
    expect(declareShipmentSchema.safeParse({ ...valid, trackingNumber: tooLong }).success).toBe(
      false
    );
    expect(
      declareShipmentSchema.safeParse({ ...valid, trackingNumber: "A".repeat(TRACKING_NUMBER_MAX) })
        .success
    ).toBe(true);
  });

  it("refuse les caractères hors lettres, chiffres et tirets dans le numéro", () => {
    expect(
      declareShipmentSchema.safeParse({ ...valid, trackingNumber: "<script>" }).success
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
