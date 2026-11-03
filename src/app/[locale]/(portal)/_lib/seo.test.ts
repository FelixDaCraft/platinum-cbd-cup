import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://platinumcbdcup.eu");

const { alternatesFor, languageAlternates, localizedCanonical } = await import("./seo");

describe("SEO multilingue", () => {
  it("canonique sans préfixe en français, préfixée ailleurs", () => {
    expect(localizedCanonical("/palmares", "fr")).toBe("https://platinumcbdcup.eu/palmares");
    expect(localizedCanonical("/palmares", "cs")).toBe("https://platinumcbdcup.eu/cs/palmares");
    expect(localizedCanonical("/", "fr")).toBe("https://platinumcbdcup.eu");
    expect(localizedCanonical("/", "it")).toBe("https://platinumcbdcup.eu/it");
  });

  it("une balise hreflang par langue plus x-default vers le français", () => {
    const alt = languageAlternates("/reglement");
    expect(Object.keys(alt)).toEqual(["fr", "en", "it", "de", "cs", "nl", "es", "x-default"]);
    expect(alt.de).toBe("https://platinumcbdcup.eu/de/reglement");
    expect(alt["x-default"]).toBe("https://platinumcbdcup.eu/reglement");
  });

  it("alternatesFor réunit canonique et langues", () => {
    const a = alternatesFor("/contact", "nl");
    expect(a.canonical).toBe("https://platinumcbdcup.eu/nl/contact");
    expect(a.languages.fr).toBe("https://platinumcbdcup.eu/contact");
  });
});
