import { describe, it, expect } from "vitest";

import { instagramHandleSchema, normalizeInstagramHandle } from "./producer";

describe("normalizeInstagramHandle", () => {
  it.each([
    ["luxuryfarm", "luxuryfarm"],
    ["@luxuryfarm", "luxuryfarm"],
    ["  @Luxury.Farm_ ", "luxury.farm_"],
    ["https://www.instagram.com/luxuryfarm/", "luxuryfarm"],
    ["instagram.com/luxuryfarm?igsh=abc123", "luxuryfarm"],
    ["http://instagram.com/luxuryfarm", "luxuryfarm"],
  ])("ramène %j au compte %j", (input, expected) => {
    expect(normalizeInstagramHandle(input)).toBe(expected);
  });
});

describe("instagramHandleSchema", () => {
  it("accepte un compte et le renvoie normalisé", () => {
    expect(instagramHandleSchema.parse("@LuxuryFarm")).toBe("luxuryfarm");
  });

  it("accepte le champ vide", () => {
    expect(instagramHandleSchema.parse("")).toBe("");
    expect(instagramHandleSchema.parse(undefined)).toBeUndefined();
    // Un « @ » seul, c'est un champ laissé vide
    expect(instagramHandleSchema.parse("@")).toBe("");
  });

  it.each([
    "luxury farm",
    "a".repeat(31),
    "https://www.facebook.com/luxuryfarm",
    "luxury..farm",
    "luxuryfarm.",
  ])("refuse %j", (input) => {
    expect(instagramHandleSchema.safeParse(input).success).toBe(false);
  });
});
