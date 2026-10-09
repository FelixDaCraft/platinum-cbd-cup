import { describe, expect, it } from "vitest";
import { criteriaOfPanel, groupCriteriaByPanel } from "./criteria-panels";

const criteria = [
  { id: "a", panel: "public" as const },
  { id: "b", panel: "pro" as const },
  { id: "c", panel: "public" as const },
  { id: "d", panel: "pro" as const },
];

describe("groupCriteriaByPanel", () => {
  it("groupe pro puis public en conservant l'ordre d'origine", () => {
    expect(groupCriteriaByPanel(criteria)).toEqual([
      { panel: "pro", criteria: [criteria[1], criteria[3]] },
      { panel: "public", criteria: [criteria[0], criteria[2]] },
    ]);
  });

  it("omet un jury sans critère", () => {
    expect(groupCriteriaByPanel(criteria.filter((c) => c.panel === "pro"))).toEqual([
      { panel: "pro", criteria: [criteria[1], criteria[3]] },
    ]);
    expect(groupCriteriaByPanel([])).toEqual([]);
  });
});

describe("criteriaOfPanel", () => {
  it("ne garde que la grille demandée", () => {
    expect(criteriaOfPanel(criteria, "public").map((c) => c.id)).toEqual(["a", "c"]);
  });
});
