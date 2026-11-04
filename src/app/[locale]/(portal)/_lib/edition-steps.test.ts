import { describe, it, expect, vi } from "vitest";

// `edition.ts` lit la base pour ses autres fonctions : seul le calendrier,
// pur, est testé ici.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/services/category-quota.service", () => ({ getCategoryOccupancy: vi.fn() }));

import { stepsOf, type Translate } from "./edition";

/** Traducteur de test : la clé suivie de ses valeurs. */
const t: Translate = (key, values) =>
  values ? `${key}(${Object.values(values).join(", ")})` : key;

const ms = (iso: string) => new Date(iso).getTime();

const edition = {
  registrationOpenAt: ms("2026-10-01T00:00:00+02:00"),
  registrationCloseAt: ms("2026-12-31T23:59:00+01:00"),
  ratingStartAt: ms("2027-02-01T09:00:00+01:00"),
  ratingEndAt: ms("2027-03-15T18:00:00+01:00"),
  eventDate: null,
  eventLocation: null,
  samplesDeadline: "2027-01-09",
};

const november = ms("2026-11-04T12:00:00Z");

describe("stepsOf : réception des échantillons", () => {
  it("affiche « au plus tard le » avec la date de la cup, entre inscriptions et notation", () => {
    const steps = stepsOf(edition, t, "fr", november);

    expect(steps.map((s) => s.title)).toEqual([
      "steps.registration",
      "steps.samples",
      "steps.rating",
    ]);
    const samples = steps[1]!;
    expect(samples.when).toBe("range.by(9 janvier 2027)");
    expect(samples.end).toBe(ms("2027-01-09T22:59:59Z"));
  });

  it("en cours dès l'ouverture des inscriptions, terminé une fois la date passée", () => {
    expect(stepsOf(edition, t, "fr", ms("2026-09-15T12:00:00Z"))[1]!.state).toBe("next");
    expect(stepsOf(edition, t, "fr", november)[1]!.state).toBe("current");
    expect(stepsOf(edition, t, "fr", ms("2027-01-10T12:00:00Z"))[1]!.state).toBe("done");
  });

  it("date formatée dans la langue de la page", () => {
    expect(stepsOf(edition, t, "de", november)[1]!.when).toBe("range.by(9. Januar 2027)");
  });

  it("sans date limite sur la cup : pas d'étape, rien d'inventé", () => {
    const steps = stepsOf({ ...edition, samplesDeadline: null }, t, "fr", november);
    expect(steps.map((s) => s.title)).not.toContain("steps.samples");
  });
});
