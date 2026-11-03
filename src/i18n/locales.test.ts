import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  formatDate,
  formatPrice,
  intlLocale,
  isLocale,
  hrefFor,
  isLocalizedRoute,
  localeFromPathname,
  localizedContent,
  localizedField,
  localizePath,
  locales,
  negotiateLocale,
  ogLocale,
  requestLocale,
  pickLocale,
  stripLocale,
} from "./locales";

describe("locales", () => {
  it("le français est la langue par défaut, suivi des six traductions", () => {
    expect(defaultLocale).toBe("fr");
    expect([...locales]).toEqual(["fr", "en", "it", "de", "cs", "nl", "es"]);
  });

  it("isLocale ne reconnaît que les codes pris en charge", () => {
    expect(isLocale("cs")).toBe(true);
    expect(isLocale("at")).toBe(false);
    expect(isLocale("de-AT")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("negotiateLocale (Accept-Language)", () => {
  it("sans en-tête, reste en français", () => {
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale("")).toBe("fr");
  });

  it("prend la première langue prise en charge selon le poids q", () => {
    expect(negotiateLocale("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
    expect(negotiateLocale("en;q=0.5,es;q=0.9")).toBe("es");
  });

  it("l'allemand d'Autriche et de Suisse donne la version allemande", () => {
    expect(negotiateLocale("de-AT,de;q=0.9")).toBe("de");
    expect(negotiateLocale("de-CH")).toBe("de");
  });

  it("un visiteur francophone de Belgique ou de Suisse reste en français", () => {
    expect(negotiateLocale("fr-BE,fr;q=0.9,nl;q=0.8")).toBe("fr");
  });

  it("une langue non prise en charge bascule vers l'anglais, pas le français", () => {
    expect(negotiateLocale("pl-PL,pl;q=0.9")).toBe("en");
    expect(negotiateLocale("pt-PT,ja;q=0.5")).toBe("en");
  });

  it("ignore les entrées à q=0 et le joker", () => {
    expect(negotiateLocale("it;q=0,*;q=0.5")).toBe("fr");
    expect(negotiateLocale("it;q=0,pl")).toBe("en");
    expect(negotiateLocale("*")).toBe("fr");
  });

  it("résiste à un en-tête mal formé", () => {
    expect(negotiateLocale(";;,q=abc,de")).toBe("de");
  });
});

describe("pickLocale (préférence d'un utilisateur)", () => {
  it("le cookie l'emporte sur Accept-Language", () => {
    expect(pickLocale({ cookie: "it", acceptLanguage: "de" })).toBe("it");
  });

  it("un cookie invalide est ignoré", () => {
    expect(pickLocale({ cookie: "xx", acceptLanguage: "de" })).toBe("de");
  });

  it("la langue enregistrée sur le compte sert de repli final", () => {
    expect(pickLocale({ stored: "cs" })).toBe("cs");
    expect(pickLocale({})).toBe("fr");
  });
});

describe("chemins", () => {
  it("le français reste sans préfixe, les autres langues sont préfixées", () => {
    expect(localizePath("/palmares", "fr")).toBe("/palmares");
    expect(localizePath("/palmares", "en")).toBe("/en/palmares");
    expect(localizePath("/", "de")).toBe("/de");
    expect(localizePath("/", "fr")).toBe("/");
  });

  it("conserve la requête et le fragment", () => {
    expect(localizePath("/login?callbackUrl=/producer", "es")).toBe(
      "/es/login?callbackUrl=/producer"
    );
  });

  it("stripLocale retire un préfixe de langue", () => {
    expect(stripLocale("/en/palmares")).toBe("/palmares");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/palmares")).toBe("/palmares");
    expect(stripLocale("/enfants")).toBe("/enfants");
  });

  it("localeFromPathname lit le préfixe, sinon le français", () => {
    expect(localeFromPathname("/nl/cups/abc")).toBe("nl");
    expect(localeFromPathname("/cups/abc")).toBe("fr");
  });
});

describe("routes non traduites", () => {
  it("le back-office et les routes techniques ne prennent pas de préfixe", () => {
    expect(isLocalizedRoute("/dashboard")).toBe(false);
    expect(isLocalizedRoute("/dashboard/cups?x=1")).toBe(false);
    expect(isLocalizedRoute("/api/trpc")).toBe(false);
    expect(isLocalizedRoute("/uploads/a.webp")).toBe(false);
    expect(isLocalizedRoute("/dashboards-publics")).toBe(true);
    expect(isLocalizedRoute("/producer/results")).toBe(true);
  });

  it("hrefFor préfixe seulement les routes traduites", () => {
    expect(hrefFor("/dashboard", "en")).toBe("/dashboard");
    expect(hrefFor("/producer", "en")).toBe("/en/producer");
    expect(hrefFor("/de/producer?x=1", "en")).toBe("/en/producer?x=1");
    expect(hrefFor("/en/jury", "fr")).toBe("/jury");
  });
});

describe("localizedField (contenu en base)", () => {
  const category = {
    name: "Fleurs Indoor",
    description: "Culture en intérieur",
    translations: { en: { name: "Indoor Flowers", description: "" } },
  };

  it("renvoie la traduction quand elle existe", () => {
    expect(localizedField(category, "name", "en")).toBe("Indoor Flowers");
  });

  it("revient au français si la traduction manque ou est vide", () => {
    expect(localizedField(category, "name", "de")).toBe("Fleurs Indoor");
    expect(localizedField(category, "description", "en")).toBe("Culture en intérieur");
  });

  it("le français ne lit jamais les traductions", () => {
    expect(
      localizedField({ name: "A", translations: { fr: { name: "B" } } }, "name", "fr")
    ).toBe("A");
  });

  it("tolère une colonne de traductions absente ou nulle", () => {
    expect(localizedField({ name: "A", translations: null }, "name", "it")).toBe("A");
    expect(localizedField({ name: "A" }, "name", "it")).toBe("A");
  });
});

describe("formats", () => {
  // Intl insère des espaces insécables (U+00A0, U+202F) : on les normalise.
  const n = (s: string) => s.replace(/[  ]/g, " ");

  it("étiquettes Intl par langue", () => {
    expect(intlLocale("fr")).toBe("fr-FR");
    expect(intlLocale("cs")).toBe("cs-CZ");
    expect(ogLocale("nl")).toBe("nl_NL");
  });

  it("prix en euros selon la langue", () => {
    expect(n(formatPrice(20000, "fr"))).toBe("200 €");
    expect(n(formatPrice(20000, "en"))).toBe("€200");
    expect(n(formatPrice(20000, "de"))).toBe("200 €");
    expect(n(formatPrice(19950, "en"))).toBe("€199.50");
    expect(n(formatPrice(19950, "cs"))).toBe("199,50 €");
  });

  it("dates longues selon la langue", () => {
    const d = new Date("2026-12-31T12:00:00Z");
    expect(formatDate(d, "fr")).toBe("31 décembre 2026");
    expect(formatDate(d, "en")).toBe("31 December 2026");
    expect(formatDate(d, "de")).toBe("31. Dezember 2026");
    expect(formatDate(d, "es")).toBe("31 de diciembre de 2026");
  });
});

describe("localizedContent (règlement, articles)", () => {
  const doc = {
    title: "Règlement",
    lede: "Chapeau",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    translations: {
      en: { title: "Rules", content: { type: "doc", content: [] } },
      de: { title: "Reglement" },
    },
  };

  it("remplace titre et corps quand ils sont traduits", () => {
    const en = localizedContent(doc, "en");
    expect(en.title).toBe("Rules");
    expect(en.lede).toBe("Chapeau");
    expect(en.content).toEqual({ type: "doc", content: [] });
    expect(en.translated).toBe(true);
  });

  it("sans corps traduit, garde le texte français et le signale", () => {
    const de = localizedContent(doc, "de");
    expect(de.title).toBe("Reglement");
    expect(de.content).toBe(doc.content);
    expect(de.translated).toBe(false);
  });

  it("le français est toujours la version d'origine", () => {
    const fr = localizedContent(doc, "fr");
    expect(fr.title).toBe("Règlement");
    expect(fr.translated).toBe(true);
  });
});

describe("requestLocale", () => {
  it("préfère x-locale, puis l'en-tête du middleware, puis le cookie", () => {
    expect(requestLocale(new Headers({ "x-locale": "cs", cookie: "NEXT_LOCALE=de" }))).toBe("cs");
    expect(requestLocale(new Headers({ "x-next-intl-locale": "it" }))).toBe("it");
    expect(requestLocale(new Headers({ cookie: "a=b; NEXT_LOCALE=nl" }))).toBe("nl");
    expect(requestLocale(new Headers({ "x-locale": "zz" }))).toBe("fr");
  });
});
