import { describe, it, expect } from "vitest";
import { computeCoverageStatus, effectiveCodeStatus } from "./jury-coverage";

const base = { activePro: 3, activePublic: 10, targetPro: null, targetPublic: null };

describe("computeCoverageStatus", () => {
  it("est critique sans juré pro actif", () => {
    expect(computeCoverageStatus({ ...base, activePro: 0 })).toBe("critical");
  });

  it("est critique sans juré public actif", () => {
    expect(computeCoverageStatus({ ...base, activePublic: 0 })).toBe("critical");
  });

  it("reste critique même quand l'objectif de l'autre panel est atteint", () => {
    expect(
      computeCoverageStatus({ activePro: 0, activePublic: 20, targetPro: null, targetPublic: 5 })
    ).toBe("critical");
  });

  it("est prête sans objectif dès un juré par panel", () => {
    expect(computeCoverageStatus({ ...base, activePro: 1, activePublic: 1 })).toBe("ready");
  });

  it("est incomplète sous l'objectif pro", () => {
    expect(computeCoverageStatus({ ...base, targetPro: 4 })).toBe("incomplete");
  });

  it("est incomplète sous l'objectif public", () => {
    expect(computeCoverageStatus({ ...base, targetPublic: 11 })).toBe("incomplete");
  });

  it("est prête quand les objectifs sont atteints tout juste", () => {
    expect(computeCoverageStatus({ ...base, targetPro: 3, targetPublic: 10 })).toBe("ready");
  });

  it("est prête au-delà des objectifs", () => {
    expect(computeCoverageStatus({ ...base, targetPro: 1, targetPublic: 2 })).toBe("ready");
  });
});

describe("effectiveCodeStatus", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const past = new Date("2026-10-01T00:00:00Z");
  const future = new Date("2026-11-01T00:00:00Z");

  it("considère expiré un code en attente passé sa date", () => {
    expect(effectiveCodeStatus({ status: "pending", expiresAt: past }, now)).toBe("expired");
  });

  it("laisse en attente un code sans date ou à date future", () => {
    expect(effectiveCodeStatus({ status: "pending", expiresAt: null }, now)).toBe("pending");
    expect(effectiveCodeStatus({ status: "pending", expiresAt: future }, now)).toBe("pending");
  });

  it("ne touche pas aux codes activés ou révoqués", () => {
    expect(effectiveCodeStatus({ status: "activated", expiresAt: past }, now)).toBe("activated");
    expect(effectiveCodeStatus({ status: "revoked", expiresAt: past }, now)).toBe("revoked");
  });
});
